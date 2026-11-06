import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { ADMIN, closeTestPrisma, guest, orderPayload, setupTest, signedIn, submitOrder, type Client, type TestContext } from './helpers';

let ctx: TestContext;
let admin: Client;
beforeEach(async () => {
  ctx = await setupTest();
  admin = await signedIn(ctx.app, ADMIN);
});
afterAll(closeTestPrisma);

const names = (nl: string, en: string, tr: string) => ({ translations: { 'nl-BE': { name: nl }, en: { name: en }, tr: { name: tr } } });

async function createWork(categoryId: string | null, isPublished = true) {
  const res = await admin
    .post('/api/admin/portfolio')
    .send({
      imageUrl: '/media/portfolio/x.svg',
      categoryId,
      isFeatured: false,
      isPublished,
      isSample: false,
      translations: { 'nl-BE': { title: 'Werk' }, en: { title: 'Work' }, tr: { title: 'Eser' } },
    })
    .expect(201);
  return res.body.id as string;
}

describe('catalog categories (dashboard)', () => {
  it('creates a category with a readable slug from the English name; all three names are required', async () => {
    const missing = await admin.post('/api/admin/categories').send(names('Bruiloften', '', 'Düğün')).expect(400);
    expect(missing.body.error.fields).toEqual({ 'translations.en.name': 'validation.required' });

    const first = await admin.post('/api/admin/categories').send(names('Cafés', 'Cafés & restaurants', 'Kafeler')).expect(201);
    expect(first.body).toMatchObject({ slug: 'cafes-restaurants', isVisible: true, itemCount: 0, translations: { tr: { name: 'Kafeler' } } });
    const second = await admin.post('/api/admin/categories').send(names('Cafés 2', 'Cafés & Restaurants', 'Kafeler 2')).expect(201);
    expect(second.body.slug).toBe('cafes-restaurants-2');

    // Renaming keeps the slug, so shared links keep working.
    const renamed = await admin.put(`/api/admin/categories/${first.body.id}`).send({ ...names('Horeca', 'Hospitality', 'Horeca'), isVisible: true }).expect(200);
    expect(renamed.body).toMatchObject({ slug: 'cafes-restaurants', translations: { en: { name: 'Hospitality' } } });

    const site = await (await guest(ctx.app)).get('/api/categories?locale=en').expect(200);
    expect(site.body.find((c: { id: string }) => c.id === first.body.id)).toMatchObject({ name: 'Hospitality', hasWorks: false }); // no works yet
  });

  it('stores description, cover image, default unit and the two switches, and shows them on the site', async () => {
    const created = await admin
      .post('/api/admin/categories')
      .send({
        translations: {
          'nl-BE': { name: 'Rolluiken', description: 'Beschilderde rolluiken.' },
          en: { name: 'Shutters', description: '' },
          tr: { name: 'Kepenk', description: 'Boyalı kepenkler.' },
        },
        isVisible: true,
        showInOrderForm: false,
        coverImageUrl: '/media/categories/x.svg',
        defaultUnit: 'M',
      })
      .expect(201);
    expect(created.body).toMatchObject({
      showInOrderForm: false,
      coverImageUrl: '/media/categories/x.svg',
      defaultUnit: 'M',
      orderCount: 0,
      translations: { en: { description: null }, tr: { description: 'Boyalı kepenkler.' } },
    });

    const site = (await (await guest(ctx.app)).get('/api/categories?locale=tr').expect(200)).body;
    expect(site.find((c: { id: string }) => c.id === created.body.id)).toEqual({
      id: created.body.id,
      slug: 'shutters',
      name: 'Kepenk',
      description: 'Boyalı kepenkler.',
      coverImageUrl: '/media/categories/x.svg',
      defaultUnit: 'M',
      showOnSite: true,
      showInOrderForm: false,
      hasWorks: false,
    });

    // Not in the order form: an order cannot choose it.
    const order = await submitOrder(await guest(ctx.app), orderPayload({ categoryId: created.body.id })).expect(400);
    expect(order.body.error.fields).toEqual({ categoryId: 'validation.invalidOption' });
    const bad = await admin.post('/api/admin/categories').send({ ...names('X', 'X', 'X'), defaultUnit: 'KM', coverImageUrl: 'javascript:x' }).expect(400);
    expect(bad.body.error.fields).toEqual({ defaultUnit: 'validation.invalidOption', coverImageUrl: 'validation.url' });
  });

  it('counts the orders of a category', async () => {
    const client = await guest(ctx.app);
    await submitOrder(client, orderPayload({ categoryId: ctx.ids.categoryId })).expect(201);
    const list = (await admin.get('/api/admin/categories').expect(200)).body as Array<{ id: string; orderCount: number }>;
    expect(list.find((c) => c.id === ctx.ids.categoryId)?.orderCount).toBe(1);
  });

  it('orders categories and counts their works', async () => {
    const a = (await admin.post('/api/admin/categories').send(names('A', 'A', 'A')).expect(201)).body;
    const b = (await admin.post('/api/admin/categories').send(names('B', 'B', 'B')).expect(201)).body;
    await createWork(b.id);
    await createWork(b.id, false);
    const moved = await admin.post('/api/admin/categories/reorder').send({ id: b.id, direction: 'up' }).expect(200);
    // After the two test categories (canvas, mural) from the setup.
    expect(moved.body.slice(2).map((c: { id: string; itemCount: number }) => [c.id, c.itemCount])).toEqual([
      [b.id, 2],
      [a.id, 0],
    ]);
  });

  it('hides a category and its works on the site, and shows them again', async () => {
    const category = (await admin.post('/api/admin/categories').send(names('Gym', 'Gyms', 'Spor salonu')).expect(201)).body;
    const work = await createWork(category.id);
    const client = await guest(ctx.app);
    expect((await client.get('/api/portfolio')).body).toHaveLength(1);

    const hidden = await admin.post(`/api/admin/categories/${category.id}/visible`).send({ value: false }).expect(200);
    expect(hidden.body.isVisible).toBe(false);
    expect((await client.get('/api/portfolio')).body).toEqual([]);
    expect((await admin.get('/api/admin/portfolio')).body[0]).toMatchObject({ id: work, categoryHidden: true, isPublished: true });

    await admin.post(`/api/admin/categories/${category.id}/visible`).send({ value: true }).expect(200);
    expect((await client.get('/api/portfolio')).body).toHaveLength(1);
  });

  it('deletes a category without deleting its works: they move or become uncategorised', async () => {
    const from = (await admin.post('/api/admin/categories').send(names('Oud', 'Old', 'Eski')).expect(201)).body;
    const to = (await admin.post('/api/admin/categories').send(names('Nieuw', 'New', 'Yeni')).expect(201)).body;
    const w1 = await createWork(from.id);
    const w2 = await createWork(from.id);

    const self = await admin.delete(`/api/admin/categories/${from.id}?moveTo=${from.id}`).expect(400);
    expect(self.body.error.fields).toEqual({ moveTo: 'validation.invalidOption' });
    await admin.delete(`/api/admin/categories/${from.id}?moveTo=${randomUUID()}`).expect(400);

    await admin.delete(`/api/admin/categories/${from.id}?moveTo=${to.id}`).expect(204);
    const works = (await admin.get('/api/admin/portfolio')).body as Array<{ id: string; categoryId: string | null }>;
    expect(works.filter((w) => [w1, w2].includes(w.id)).map((w) => w.categoryId)).toEqual([to.id, to.id]);

    await admin.delete(`/api/admin/categories/${to.id}`).expect(204);
    const after = (await admin.get('/api/admin/portfolio')).body as Array<{ categoryId: string | null }>;
    expect(after).toHaveLength(2);
    expect(after.every((w) => w.categoryId === null)).toBe(true);
    await admin.delete(`/api/admin/categories/${to.id}`).expect(404);
  });

  it('publishes and unpublishes a work quickly', async () => {
    const work = await createWork(null, false);
    const res = await admin.post(`/api/admin/portfolio/${work}/published`).send({ value: true }).expect(200);
    expect(res.body.isPublished).toBe(true);
    expect((await (await guest(ctx.app)).get('/api/portfolio')).body).toHaveLength(1);
  });

  it('is for the signed-in artist only', async () => {
    const client = await guest(ctx.app);
    await client.get('/api/admin/categories').expect(401);
    await client.post('/api/admin/categories').send(names('A', 'A', 'A')).expect(401);
  });
});
