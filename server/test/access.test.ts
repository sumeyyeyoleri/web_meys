import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { closeTestPrisma, createOrder, guest, setupTest, signedIn, track, type TestContext } from './helpers';

let ctx: TestContext;
beforeEach(async () => {
  ctx = await setupTest();
});
afterAll(closeTestPrisma);

describe('reference images', () => {
  it('are served to the artist with safe headers, and to the customer only through the tracking link', async () => {
    const customer = await guest(ctx.app);
    const order = await createOrder(customer);
    const id = order.attachments[0]!.id;
    const admin = await signedIn(ctx.app);

    const own = await admin.get(`/api/attachments/${id}`).expect(200);
    expect(own.headers['content-type']).toBe('image/png');
    expect(own.headers['content-disposition']).toMatch(/^inline;/);
    expect(own.headers['x-content-type-options']).toBe('nosniff');
    expect(own.headers['cache-control']).toMatch(/private/);
    const download = await admin.get(`/api/attachments/${id}?download=1`).expect(200);
    expect(download.headers['content-disposition']).toMatch(/^attachment;/);

    await customer.get(`/api/attachments/${id}`).expect(401);
    await track(customer, 'get', `/attachments/${id}`, order.token).expect(200);
  });

  it('treats malformed ids as not found', async () => {
    const admin = await signedIn(ctx.app);
    await admin.get('/api/admin/orders/not-a-uuid').expect(404);
    await admin.get('/api/attachments/../../etc/passwd').expect(404);
  });
});

describe('admin area', () => {
  const adminRoutes: Array<['get' | 'post' | 'put' | 'delete', string]> = [
    ['get', '/api/admin/stats'],
    ['get', '/api/admin/orders'],
    ['get', '/api/admin/portfolio'],
    ['post', '/api/admin/portfolio'],
    ['get', '/api/admin/services'],
    ['get', '/api/admin/content'],
    ['put', '/api/admin/content'],
    ['get', '/api/admin/settings'],
    ['put', '/api/admin/settings'],
    ['post', '/api/admin/media'],
    ['get', '/api/notifications'],
    ['get', '/api/notifications/unread-count'],
  ];

  it('returns 401 without the artist session on every admin route', async () => {
    const anonymous = await guest(ctx.app);
    for (const [method, url] of adminRoutes) {
      const res = await anonymous[method](url).send({});
      expect(res.status, `${method.toUpperCase()} ${url}`).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    }
  });

  it('does not accept a tracking token instead of a session', async () => {
    const customer = await guest(ctx.app);
    const order = await createOrder(customer);
    await customer.get(`/api/admin/orders/${order.id}`).set('X-Order-Token', order.token).expect(401);
  });
});
