import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  ADMIN,
  closeTestPrisma,
  guest,
  orderPayload,
  pngFile,
  setupTest,
  signedIn,
  submitOrder,
  tokenFromUrl,
  track,
  type TestContext,
} from './helpers';

let ctx: TestContext;
beforeEach(async () => {
  ctx = await setupTest();
});
afterAll(closeTestPrisma);

async function createItem(
  data: Partial<{ isPublished: boolean; allowSimilarRequest: boolean; spaces: Array<'KIDS_ROOM' | 'BEDROOM' | 'OFFICE'>; category: 'MURAL' | 'PAINTING' }> = {},
) {
  return ctx.prisma.portfolioItem.create({
    data: {
      slug: `item-${randomUUID()}`,
      category: data.category ?? 'MURAL',
      imageUrl: '/media/portfolio/moon.svg',
      isPublished: data.isPublished ?? true,
      allowSimilarRequest: data.allowSimilarRequest ?? true,
      isSample: true,
      spaces: data.spaces ?? ['KIDS_ROOM'],
      translations: {
        create: [
          { locale: 'NL_BE', title: 'Maanlichtheuvels' },
          { locale: 'EN', title: 'Moonlit hills' },
          { locale: 'TR', title: 'Ay ışığında tepeler' },
        ],
      },
    },
  });
}

describe('orders inspired by a catalog item', () => {
  it('stores the inspiration and returns it in the order locale for customer and admin', async () => {
    const item = await createItem();
    const client = await guest(ctx.app);
    const res = await submitOrder(
      client,
      orderPayload({ inspirationItemId: item.id, serviceId: ctx.ids.wallServiceId, communicationLocale: 'tr' }),
      [pngFile()],
    ).expect(201);

    const expected = { id: item.id, title: 'Ay ışığında tepeler', imageUrl: '/media/portfolio/moon.svg' };
    expect(res.body.order.inspiration).toEqual(expected);
    // The title is derived from the example, in the order's communication language.
    expect(res.body.order.title).toBe('Ay ışığında tepeler');
    // The catalog item is a reference, not an upload: it does not use an attachment slot.
    expect(res.body.order.attachments).toHaveLength(1);

    const customerView = await track(client, 'get', '/order?locale=en', tokenFromUrl(res.body.tracking.url)).expect(200);
    expect(customerView.body.inspiration).toEqual(expected);
    const admin = await signedIn(ctx.app, ADMIN);
    const adminView = await admin.get(`/api/admin/orders/${res.body.order.id}`).expect(200);
    expect(adminView.body.inspiration).toEqual(expected);
  });

  it('accepts a catalog example without a service', async () => {
    const item = await createItem();
    const client = await guest(ctx.app);
    const res = await submitOrder(client, orderPayload({ inspirationItemId: item.id })).expect(201);
    expect(res.body.order).toMatchObject({ serviceId: null, title: 'Maanlichtheuvels' });
  });

  it('works without an email address too', async () => {
    const item = await createItem();
    const client = await guest(ctx.app);
    const res = await submitOrder(
      client,
      orderPayload({ inspirationItemId: item.id, serviceId: ctx.ids.serviceId, email: '' }),
    ).expect(201);
    expect(res.body.order.inspiration.id).toBe(item.id);
    expect(res.body.order.serviceId).toBe(ctx.ids.serviceId);
    expect(res.body.tracking.url).toMatch(/\/track#/);
  });

  it('rejects unpublished, disabled and unknown catalog items', async () => {
    const unpublished = await createItem({ isPublished: false });
    const disabled = await createItem({ allowSimilarRequest: false });
    const client = await guest(ctx.app);
    for (const id of [unpublished.id, disabled.id, randomUUID()]) {
      const res = await submitOrder(client, orderPayload({ inspirationItemId: id })).expect(400);
      expect(res.body.error).toMatchObject({
        code: 'VALIDATION_ERROR',
        fields: { inspirationItemId: 'validation.invalidInspiration' },
      });
    }
    expect(await ctx.prisma.order.count()).toBe(0);
  });

  it('returns null when there is no inspiration, and after the item is deleted', async () => {
    const item = await createItem();
    const client = await guest(ctx.app);
    // Fields of the former wizard are no longer accepted for new orders.
    const plain = await submitOrder(client, orderPayload({ additionalSpecs: 'ignored', budgetMin: 100 })).expect(201);
    expect(plain.body.order.inspiration).toBeNull();
    expect(plain.body.order.additionalSpecs).toBeNull();
    expect(plain.body.order.budgetMin).toBeNull();

    const inspired = await submitOrder(client, orderPayload({ inspirationItemId: item.id })).expect(201);
    const admin = await signedIn(ctx.app, ADMIN);
    await admin.delete(`/api/admin/portfolio/${item.id}`).expect(204);
    const after = await track(client, 'get', '/order', tokenFromUrl(inspired.body.tracking.url)).expect(200);
    expect(after.body.inspiration).toBeNull();
    // The derived title was stored with the order, so it stays.
    expect(after.body.title).toBe('Maanlichtheuvels');
  });
});

describe('catalog spaces', () => {
  it('filters the public portfolio by space and exposes spaces and allowSimilarRequest', async () => {
    const kids = await createItem({ spaces: ['KIDS_ROOM', 'BEDROOM'] });
    await createItem({ spaces: ['OFFICE'], allowSimilarRequest: false });
    await createItem({ spaces: ['KIDS_ROOM'], isPublished: false });
    const client = await guest(ctx.app);

    const all = await client.get('/api/portfolio').expect(200);
    expect(all.body).toHaveLength(2);

    const kidsRoom = await client.get('/api/portfolio?space=KIDS_ROOM&locale=en').expect(200);
    expect(kidsRoom.body).toEqual([
      expect.objectContaining({ id: kids.id, title: 'Moonlit hills', spaces: ['KIDS_ROOM', 'BEDROOM'], allowSimilarRequest: true }),
    ]);

    const office = await client.get('/api/portfolio?space=OFFICE').expect(200);
    expect(office.body[0].allowSimilarRequest).toBe(false);

    const combined = await client.get('/api/portfolio?space=BEDROOM&category=PAINTING').expect(200);
    expect(combined.body).toEqual([]);

    const invalid = await client.get('/api/portfolio?space=GARAGE').expect(400);
    expect(invalid.body.error.fields).toEqual({ space: 'validation.invalidOption' });
  });

  it('serves a single published item and hides unpublished ones', async () => {
    const item = await createItem();
    const hidden = await createItem({ isPublished: false });
    const client = await guest(ctx.app);
    const res = await client.get(`/api/portfolio/${item.id}?locale=nl-BE`).expect(200);
    expect(res.body).toMatchObject({ id: item.id, title: 'Maanlichtheuvels', category: 'MURAL' });
    await client.get(`/api/portfolio/${hidden.id}`).expect(404);
    await client.get(`/api/portfolio/${randomUUID()}`).expect(404);
  });

  it('lets the admin set spaces and the similar-request toggle', async () => {
    const admin = await signedIn(ctx.app, ADMIN);
    const base = {
      imageUrl: '/media/portfolio/x.svg',
      category: 'PAINTING',
      isFeatured: false,
      isPublished: true,
      isSample: false,
      translations: { 'nl-BE': { title: 'A' }, en: { title: 'A' }, tr: { title: 'A' } },
    };
    const created = await admin.post('/api/admin/portfolio').send({ ...base, spaces: ['OFFICE', 'BEDROOM', 'OFFICE'] }).expect(201);
    // Defaults to allowing similar requests; spaces are de-duplicated in canonical order.
    expect(created.body).toMatchObject({ spaces: ['BEDROOM', 'OFFICE'], allowSimilarRequest: true });

    const updated = await admin
      .put(`/api/admin/portfolio/${created.body.id}`)
      .send({ ...base, spaces: [], allowSimilarRequest: false })
      .expect(200);
    expect(updated.body).toMatchObject({ spaces: [], allowSimilarRequest: false });

    const bad = await admin.post('/api/admin/portfolio').send({ ...base, spaces: ['GARAGE'] }).expect(400);
    expect(bad.body.error.fields).toEqual({ 'spaces.0': 'validation.invalidOption' });
  });
});
