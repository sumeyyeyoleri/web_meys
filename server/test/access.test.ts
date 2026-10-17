import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  ADMIN,
  closeTestPrisma,
  createOrderAs,
  CUSTOMER_A,
  CUSTOMER_B,
  guest,
  setupTest,
  signedIn,
  type TestContext,
} from './helpers';

let ctx: TestContext;
beforeEach(async () => {
  ctx = await setupTest();
});
afterAll(closeTestPrisma);

describe('customers only see their own data', () => {
  it('returns 404 (not 403) for another customer’s order, attachment and messages', async () => {
    const a = await signedIn(ctx.app, CUSTOMER_A);
    const b = await signedIn(ctx.app, CUSTOMER_B);
    const order = await createOrderAs(a);
    const attachmentId = order.attachments[0]!.id;

    for (const url of [
      `/api/orders/${order.id}`,
      `/api/orders/${order.id}/messages`,
      `/api/attachments/${attachmentId}`,
    ]) {
      const res = await b.get(url).expect(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    }
    await b.post(`/api/orders/${order.id}/messages`).send({ body: 'Hallo?' }).expect(404);
    await b.post(`/api/orders/${order.id}/messages/read`).expect(404);
    await b.post(`/api/orders/${order.id}/status`).send({ status: 'CANCELLED' }).expect(404);
    expect((await b.get('/api/orders')).body.total).toBe(0);
    expect(await ctx.prisma.orderMessage.count()).toBe(0);
  });

  it('serves attachments to the owner and admins with safe headers', async () => {
    const a = await signedIn(ctx.app, CUSTOMER_A);
    const admin = await signedIn(ctx.app, ADMIN);
    const order = await createOrderAs(a);
    const url = `/api/attachments/${order.attachments[0]!.id}`;

    const own = await a.get(url).expect(200);
    expect(own.headers['content-type']).toBe('image/png');
    expect(own.headers['content-disposition']).toMatch(/^inline;/);
    expect(own.headers['x-content-type-options']).toBe('nosniff');
    expect(own.headers['cache-control']).toMatch(/private/);

    const download = await admin.get(`${url}?download=1`).expect(200);
    expect(download.headers['content-disposition']).toMatch(/^attachment;/);

    await (await guest(ctx.app)).get(url).expect(401);
  });

  it('cannot see another customer’s notifications', async () => {
    const a = await signedIn(ctx.app, CUSTOMER_A);
    const b = await signedIn(ctx.app, CUSTOMER_B);
    const admin = await signedIn(ctx.app, ADMIN);
    const order = await createOrderAs(a);
    await admin.post(`/api/admin/orders/${order.id}/messages`).send({ body: 'Hallo' }).expect(201);
    const notification = await ctx.prisma.notification.findFirstOrThrow({ where: { userId: ctx.ids.customerAId } });
    await b.post(`/api/notifications/${notification.id}/read`).expect(404);
    expect((await b.get('/api/notifications')).body.total).toBe(0);
  });

  it('treats malformed ids as not found', async () => {
    const a = await signedIn(ctx.app, CUSTOMER_A);
    await a.get('/api/orders/not-a-uuid').expect(404);
    await a.get('/api/attachments/../../etc/passwd').expect(404);
  });
});

describe('admin area is admin-only', () => {
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
  ];

  it('returns 403 for customers on every admin route', async () => {
    const a = await signedIn(ctx.app, CUSTOMER_A);
    for (const [method, url] of adminRoutes) {
      const res = await a[method](url).send({});
      expect(res.status, `${method.toUpperCase()} ${url}`).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    }
  });

  it('returns 401 for guests on every admin route', async () => {
    const g = await guest(ctx.app);
    for (const [method, url] of adminRoutes) {
      expect((await g[method](url).send({})).status, `${method.toUpperCase()} ${url}`).toBe(401);
    }
  });

  it('keeps customer endpoints for customers only', async () => {
    const admin = await signedIn(ctx.app, ADMIN);
    await admin.get('/api/orders').expect(403);
  });
});
