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

async function createCategory(slug: string, data: Partial<{ isVisible: boolean; sortOrder: number }> = {}) {
  return ctx.prisma.category.create({
    data: {
      slug,
      isVisible: data.isVisible ?? true,
      sortOrder: data.sortOrder ?? 0,
      translations: {
        create: [
          { locale: 'NL_BE', name: `${slug} NL` },
          { locale: 'EN', name: `${slug} EN` },
          { locale: 'TR', name: `${slug} TR` },
        ],
      },
    },
  });
}

async function createItem(
  data: Partial<{ isPublished: boolean; allowSimilarRequest: boolean; isFeatured: boolean; categoryId: string | null }> = {},
) {
  return ctx.prisma.portfolioItem.create({
    data: {
      slug: `item-${randomUUID()}`,
      categoryId: data.categoryId ?? null,
      imageUrl: '/media/portfolio/moon.svg',
      isPublished: data.isPublished ?? true,
      isFeatured: data.isFeatured ?? false,
      allowSimilarRequest: data.allowSimilarRequest ?? true,
      isSample: true,
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
      orderPayload({ inspirationItemId: item.id, categoryId: ctx.ids.wallCategoryId, communicationLocale: 'tr' }),
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

  it('accepts a catalog example without a category', async () => {
    const item = await createItem();
    const client = await guest(ctx.app);
    const res = await submitOrder(client, orderPayload({ inspirationItemId: item.id })).expect(201);
    expect(res.body.order).toMatchObject({ categoryId: null, title: 'Maanlichtheuvels' });
  });

  it('works without an email address too', async () => {
    const item = await createItem();
    const client = await guest(ctx.app);
    const res = await submitOrder(
      client,
      orderPayload({ inspirationItemId: item.id, categoryId: ctx.ids.categoryId, email: '' }),
    ).expect(201);
    expect(res.body.order.inspiration.id).toBe(item.id);
    expect(res.body.order.categoryId).toBe(ctx.ids.categoryId);
    expect(res.body.tracking.url).toMatch(/\/track#/);
  });

  it('rejects unpublished, disabled, hidden-category and unknown catalog items', async () => {
    const unpublished = await createItem({ isPublished: false });
    const disabled = await createItem({ allowSimilarRequest: false });
    const hiddenCategory = await createItem({ categoryId: (await createCategory('hidden', { isVisible: false })).id });
    const client = await guest(ctx.app);
    for (const id of [unpublished.id, disabled.id, hiddenCategory.id, randomUUID()]) {
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

describe('catalog categories', () => {
  it('lists only visible categories with published works, in order and in the requested language', async () => {
    const home = await createCategory('home', { sortOrder: 1 });
    const horeca = await createCategory('horeca', { sortOrder: 0 });
    await createCategory('gym', { sortOrder: 2 }); // no works
    const hidden = await createCategory('hidden', { sortOrder: 3, isVisible: false });
    const drafts = await createCategory('drafts', { sortOrder: 4 });
    await createItem({ categoryId: home.id });
    await createItem({ categoryId: horeca.id });
    await createItem({ categoryId: hidden.id });
    await createItem({ categoryId: drafts.id, isPublished: false });
    const client = await guest(ctx.app);

    const res = await client.get('/api/categories?locale=tr').expect(200);
    const bySlug = (slug: string) => res.body.find((c: { slug: string }) => c.slug === slug);
    // Catalog filters: shown on the site and with works on the site, in the artist's order.
    expect(res.body.filter((c: { showOnSite: boolean; hasWorks: boolean }) => c.showOnSite && c.hasWorks)).toEqual([
      expect.objectContaining({ id: horeca.id, slug: 'horeca', name: 'horeca TR' }),
      expect.objectContaining({ id: home.id, slug: 'home', name: 'home TR' }),
    ]);
    expect(bySlug('gym')).toMatchObject({ showOnSite: true, hasWorks: false });
    expect(bySlug('drafts')).toMatchObject({ hasWorks: false });
    // Hidden on the site, still in the order form (the default); its works do not count.
    expect(bySlug('hidden')).toMatchObject({ showOnSite: false, showInOrderForm: true, hasWorks: false });
  });

  it('leaves out categories shown neither on the site nor in the order form', async () => {
    await ctx.prisma.category.create({ data: { slug: 'off', isVisible: false, showInOrderForm: false, translations: { create: [{ locale: 'NL_BE', name: 'Uit' }] } } });
    const res = await (await guest(ctx.app)).get('/api/categories').expect(200);
    expect(res.body.map((c: { slug: string }) => c.slug)).not.toContain('off');
  });

  it('filters the portfolio by category slug; uncategorised works only appear under "All"', async () => {
    const home = await createCategory('home');
    const inHome = await createItem({ categoryId: home.id });
    const loose = await createItem({ allowSimilarRequest: false });
    const client = await guest(ctx.app);

    const all = await client.get('/api/portfolio?locale=en').expect(200);
    expect(all.body.map((i: { id: string }) => i.id).sort()).toEqual([inHome.id, loose.id].sort());
    expect(all.body.find((i: { id: string }) => i.id === loose.id)).toMatchObject({ category: null, allowSimilarRequest: false });

    const filtered = await client.get('/api/portfolio?category=home&locale=en').expect(200);
    expect(filtered.body).toEqual([
      expect.objectContaining({ id: inHome.id, title: 'Moonlit hills', category: { id: home.id, slug: 'home', name: 'home EN' } }),
    ]);
    expect(filtered.body[0]).not.toHaveProperty('spaces');

    // Old fixed-category links and unknown slugs simply match nothing.
    expect((await client.get('/api/portfolio?category=MURAL').expect(200)).body).toEqual([]);
  });

  it('hides the works of a hidden category everywhere, and shows them again when it is visible', async () => {
    const category = await createCategory('street-art');
    const item = await createItem({ categoryId: category.id, isFeatured: true });
    const client = await guest(ctx.app);
    const admin = await signedIn(ctx.app, ADMIN);

    await ctx.prisma.category.update({ where: { id: category.id }, data: { isVisible: false } });
    expect((await client.get('/api/portfolio')).body).toEqual([]);
    expect((await client.get('/api/portfolio?featured=true')).body).toEqual([]);
    expect((await client.get('/api/portfolio?category=street-art')).body).toEqual([]);
    expect((await client.get('/api/categories')).body.find((c: { slug: string }) => c.slug === 'street-art')).toMatchObject({ showOnSite: false, hasWorks: false });
    await client.get(`/api/portfolio/${item.id}`).expect(404);
    // The work itself is untouched; the dashboard says why it is not on the site.
    const list = await admin.get('/api/admin/portfolio').expect(200);
    expect(list.body).toEqual([expect.objectContaining({ id: item.id, isPublished: true, categoryId: category.id, categoryHidden: true })]);

    await ctx.prisma.category.update({ where: { id: category.id }, data: { isVisible: true } });
    expect((await client.get('/api/portfolio')).body).toHaveLength(1);
    await client.get(`/api/portfolio/${item.id}`).expect(200);
    expect((await admin.get('/api/admin/portfolio')).body[0].categoryHidden).toBe(false);
  });

  it('serves a single published item with its category and hides unpublished ones', async () => {
    const category = await createCategory('home');
    const item = await createItem({ categoryId: category.id });
    const hidden = await createItem({ isPublished: false });
    const client = await guest(ctx.app);
    const res = await client.get(`/api/portfolio/${item.id}?locale=nl-BE`).expect(200);
    expect(res.body).toMatchObject({ id: item.id, title: 'Maanlichtheuvels', category: { slug: 'home', name: 'home NL' } });
    await client.get(`/api/portfolio/${hidden.id}`).expect(404);
    await client.get(`/api/portfolio/${randomUUID()}`).expect(404);
  });

  it('lets the admin pick a category or none, rejects unknown ones, and sets the similar-request toggle', async () => {
    const category = await createCategory('canvas-portrait');
    const admin = await signedIn(ctx.app, ADMIN);
    const base = {
      imageUrl: '/media/portfolio/x.svg',
      isFeatured: false,
      isPublished: true,
      isSample: false,
      translations: { 'nl-BE': { title: 'A' }, en: { title: 'A' }, tr: { title: 'A' } },
    };
    const created = await admin.post('/api/admin/portfolio').send({ ...base, categoryId: category.id }).expect(201);
    // Defaults to allowing similar requests.
    expect(created.body).toMatchObject({ categoryId: category.id, categoryHidden: false, allowSimilarRequest: true });
    expect(created.body).not.toHaveProperty('spaces');

    const updated = await admin
      .put(`/api/admin/portfolio/${created.body.id}`)
      .send({ ...base, categoryId: '', allowSimilarRequest: false })
      .expect(200);
    expect(updated.body).toMatchObject({ categoryId: null, allowSimilarRequest: false });

    const unknown = await admin.post('/api/admin/portfolio').send({ ...base, categoryId: randomUUID() }).expect(400);
    expect(unknown.body.error.fields).toEqual({ categoryId: 'validation.invalidOption' });
    const invalid = await admin.post('/api/admin/portfolio').send({ ...base, categoryId: 'MURAL' }).expect(400);
    expect(invalid.body.error.fields).toEqual({ categoryId: 'validation.invalid' });
  });

  it('keeps the works when their category is deleted: they become uncategorised', async () => {
    const category = await createCategory('gym');
    const item = await createItem({ categoryId: category.id });
    await ctx.prisma.category.delete({ where: { id: category.id } });
    const after = await ctx.prisma.portfolioItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(after.categoryId).toBeNull();
  });
});
