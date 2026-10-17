import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  closeTestPrisma,
  CUSTOMER_A,
  eventually,
  guest,
  IMAGES,
  orderPayload,
  pngFile,
  setupTest,
  signedIn,
  submitOrder,
  type TestContext,
} from './helpers';
import { ORDER_REFERENCE_PATTERN } from '@painter/shared';

let ctx: TestContext;
beforeEach(async () => {
  ctx = await setupTest();
});
afterAll(closeTestPrisma);

describe('order creation', () => {
  it('creates an order with images, history and an admin notification in one go', async () => {
    const client = await signedIn(ctx.app, CUSTOMER_A);
    const res = await submitOrder(client, orderPayload({ serviceId: ctx.ids.serviceId, customRequest: '' }), [
      pngFile('schets één.png'),
      { buffer: IMAGES.jpeg, name: 'photo.JPG', type: 'image/jpeg' },
      { buffer: IMAGES.webp, name: 'wall.webp', type: 'image/webp' },
    ]).expect(201);

    const { order, created } = res.body;
    expect(created).toBe(true);
    expect(order.reference).toMatch(ORDER_REFERENCE_PATTERN);
    expect(order.status).toBe('SUBMITTED');
    expect(order.serviceName).toBe('Canvas NL');
    expect(order.attachments.map((a: { originalName: string }) => a.originalName)).toEqual([
      'schets één.png',
      'photo.JPG',
      'wall.webp',
    ]);
    expect(order.statusHistory).toEqual([expect.objectContaining({ fromStatus: null, toStatus: 'SUBMITTED' })]);
    expect(order.allowedTransitions).toEqual(['CANCELLED']);

    const attachments = await ctx.prisma.orderAttachment.findMany();
    for (const a of attachments) expect(a.storageKey).toMatch(/^orders\/[0-9a-f-]{36}\.(png|jpg|webp)$/);
    const notifications = await ctx.prisma.notification.findMany();
    expect(notifications).toEqual([expect.objectContaining({ userId: ctx.ids.adminId, type: 'ORDER_SUBMITTED' })]);
  });

  it('keeps the submitted contact details and project address on the order', async () => {
    const client = await signedIn(ctx.app, CUSTOMER_A);
    const res = await submitOrder(client, orderPayload({ city: 'Antwerpen', street: 'Meir', houseNumber: '50' })).expect(201);
    expect(res.body.order.projectAddress).toMatchObject({ city: 'Antwerpen', street: 'Meir', houseNumber: '50' });
    await client.patch('/api/users/me').send({ fullName: 'Anna', city: 'Leuven', preferredLocale: 'nl-BE' }).expect(200);
    const detail = await client.get(`/api/orders/${res.body.order.id}`).expect(200);
    expect(detail.body.projectAddress.city).toBe('Antwerpen');
  });

  it('returns field-level i18n keys for invalid data', async () => {
    const client = await signedIn(ctx.app, CUSTOMER_A);
    const res = await submitOrder(
      client,
      orderPayload({ width: -5, description: 'too short', phone: '0470', budgetMin: 500, budgetMax: 100, deadline: '2020-01-01', privacyAccepted: false }),
    ).expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.fields).toMatchObject({
      width: 'validation.positive',
      description: 'validation.descriptionTooShort',
      phone: 'validation.phone',
      privacyAccepted: 'validation.privacyRequired',
    });
  });

  it('rejects malformed JSON and missing data', async () => {
    const client = await signedIn(ctx.app, CUSTOMER_A);
    const bad = await client.post('/api/orders').field('data', '{not json').expect(400);
    expect(bad.body.error.fields).toEqual({ data: 'validation.invalid' });
    const missing = await client.post('/api/orders').field('other', 'x').expect(400);
    expect(missing.body.error.fields).toEqual({ data: 'validation.required' });
  });

  it('rejects an inactive or unknown service', async () => {
    await ctx.prisma.service.update({ where: { id: ctx.ids.serviceId }, data: { isActive: false } });
    const client = await signedIn(ctx.app, CUSTOMER_A);
    const res = await submitOrder(client, orderPayload({ serviceId: ctx.ids.serviceId })).expect(400);
    expect(res.body.error.fields).toEqual({ serviceId: 'validation.invalidOption' });
  });

  it('enforces budget and deadline when the admin requires them', async () => {
    const strict = await setupTest({ settings: { budgetRequired: true, deadlineRequired: true } });
    const client = await signedIn(strict.app, CUSTOMER_A);
    const res = await submitOrder(client, orderPayload()).expect(400);
    expect(res.body.error.fields).toMatchObject({
      budgetMin: 'validation.required',
      budgetMax: 'validation.required',
      deadline: 'validation.required',
    });
    const future = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
    await submitOrder(client, orderPayload({ budgetMin: 300, budgetMax: 900, deadline: future })).expect(201);
  });

  it('is idempotent for a repeated submission with the same key', async () => {
    const client = await signedIn(ctx.app, CUSTOMER_A);
    const payload = orderPayload();
    const first = await submitOrder(client, payload, [pngFile()]).expect(201);
    const second = await submitOrder(client, payload, [pngFile()]).expect(200);
    expect(second.body.created).toBe(false);
    expect(second.body.order.id).toBe(first.body.order.id);
    expect(await ctx.prisma.order.count()).toBe(1);
    expect(await ctx.prisma.orderAttachment.count()).toBe(1);
  });

  it('does not let administrators submit orders', async () => {
    const admin = await signedIn(ctx.app, { email: 'admin@test.local', password: 'admin-password-123' });
    await submitOrder(admin, orderPayload()).expect(403);
  });
});

describe('guest orders', () => {
  const guestData = (overrides: Record<string, unknown> = {}) =>
    orderPayload({
      email: 'new.customer@test.local',
      fullName: 'Nieuwe Klant',
      communicationLocale: 'tr',
      password: 'guest-password-1',
      passwordConfirm: 'guest-password-1',
      ...overrides,
    });

  it('creates an account together with the order and signs the guest in', async () => {
    const client = await guest(ctx.app);
    const res = await submitOrder(client, guestData(), [pngFile()]).expect(201);
    expect(res.body.user).toMatchObject({ email: 'new.customer@test.local', role: 'CUSTOMER', preferredLocale: 'tr' });
    expect(res.body.user.profile.fullName).toBe('Nieuwe Klant');
    expect(String(res.headers['set-cookie'])).toMatch(/sid=/);

    const mine = await client.get('/api/orders').expect(200);
    expect(mine.body.total).toBe(1);
  });

  it('requires a matching password for guests', async () => {
    const client = await guest(ctx.app);
    const res = await submitOrder(client, guestData({ passwordConfirm: 'something-else' })).expect(400);
    expect(res.body.error.fields).toEqual({ passwordConfirm: 'validation.passwordsDontMatch' });
  });

  it('asks the guest to log in when the email already has an account', async () => {
    const client = await guest(ctx.app);
    const res = await submitOrder(client, guestData({ email: CUSTOMER_A.email }), [pngFile()]).expect(409);
    expect(res.body.error).toMatchObject({
      code: 'ACCOUNT_EXISTS_LOGIN_REQUIRED',
      fields: { email: 'validation.accountExistsLogin' },
    });
    expect(await ctx.prisma.order.count()).toBe(0);
    expect(await ctx.prisma.user.count({ where: { email: CUSTOMER_A.email } })).toBe(1);
  });
});

describe('customer order access', () => {
  it('lists only the customer’s own orders, newest first, paginated', async () => {
    const a = await signedIn(ctx.app, CUSTOMER_A);
    for (let i = 0; i < 3; i++) await submitOrder(a, orderPayload({ title: `Order ${i}` })).expect(201);
    const page = await a.get('/api/orders?page=1&pageSize=2').expect(200);
    expect(page.body).toMatchObject({ page: 1, pageSize: 2, total: 3, totalPages: 2 });
    expect(page.body.items.map((o: { title: string }) => o.title)).toEqual(['Order 2', 'Order 1']);
  });

  it('lets the customer cancel before acceptance but not afterwards', async () => {
    const a = await signedIn(ctx.app, CUSTOMER_A);
    const { body } = await submitOrder(a, orderPayload()).expect(201);
    const id = body.order.id as string;

    const accept = await a.post(`/api/orders/${id}/status`).send({ status: 'ACCEPTED' }).expect(409);
    expect(accept.body.error.code).toBe('ORDER_INVALID_TRANSITION');

    const cancelled = await a.post(`/api/orders/${id}/status`).send({ status: 'CANCELLED' }).expect(200);
    expect(cancelled.body.status).toBe('CANCELLED');
    expect(cancelled.body.allowedTransitions).toEqual([]);
    await a.post(`/api/orders/${id}/status`).send({ status: 'CANCELLED' }).expect(409);

    const admins = await ctx.prisma.notification.findMany({ where: { userId: ctx.ids.adminId, type: 'ORDER_STATUS_CHANGED' } });
    expect(admins).toHaveLength(1);
  });

  it('runs the message thread with read state and notifications', async () => {
    const a = await signedIn(ctx.app, CUSTOMER_A);
    const admin = await signedIn(ctx.app, { email: 'admin@test.local', password: 'admin-password-123' });
    const { body } = await submitOrder(a, orderPayload()).expect(201);
    const id = body.order.id as string;

    await admin.post(`/api/admin/orders/${id}/messages`).send({ body: 'Dag Anna, welk formaat precies?' }).expect(201);
    expect((await a.get('/api/notifications/unread-count')).body.count).toBe(1);
    expect((await a.get('/api/orders')).body.items[0].unreadMessages).toBe(1);

    const thread = await a.get(`/api/orders/${id}/messages`).expect(200);
    expect(thread.body).toEqual([expect.objectContaining({ senderRole: 'ADMIN', senderName: 'Test Atelier', isOwn: false, readAt: null })]);

    await a.post(`/api/orders/${id}/messages/read`).expect(204);
    expect((await a.get('/api/orders')).body.items[0].unreadMessages).toBe(0);
    expect((await a.get('/api/notifications/unread-count')).body.count).toBe(0);

    const reply = await a.post(`/api/orders/${id}/messages`).send({ body: '60 op 40 cm graag.' }).expect(201);
    expect(reply.body).toMatchObject({ senderRole: 'CUSTOMER', senderName: CUSTOMER_A.name, isOwn: true });
    await a.post(`/api/orders/${id}/messages`).send({ body: '   ' }).expect(400);
  });

  it('marks notifications as read individually and all at once', async () => {
    const a = await signedIn(ctx.app, CUSTOMER_A);
    const admin = await signedIn(ctx.app, { email: 'admin@test.local', password: 'admin-password-123' });
    const { body } = await submitOrder(a, orderPayload()).expect(201);
    await admin.post(`/api/admin/orders/${body.order.id}/status`).send({ status: 'UNDER_REVIEW' }).expect(200);
    await admin.post(`/api/admin/orders/${body.order.id}/messages`).send({ body: 'Hallo' }).expect(201);

    const list = await a.get('/api/notifications').expect(200);
    expect(list.body.total).toBe(2);
    expect(list.body.items[1]).toMatchObject({ type: 'ORDER_STATUS_CHANGED', status: 'UNDER_REVIEW', orderReference: body.order.reference });

    await a.post(`/api/notifications/${list.body.items[0].id}/read`).expect(204);
    expect((await a.get('/api/notifications/unread-count')).body.count).toBe(1);
    await a.post('/api/notifications/read-all').expect(204);
    expect((await a.get('/api/notifications/unread-count')).body.count).toBe(0);
  });

  it('emails the customer in their communication language when the admin acts', async () => {
    const a = await signedIn(ctx.app, CUSTOMER_A);
    const admin = await signedIn(ctx.app, { email: 'admin@test.local', password: 'admin-password-123' });
    const { body } = await submitOrder(a, orderPayload({ communicationLocale: 'tr' })).expect(201);
    await eventually(() => ctx.mailer.sent.length === 1); // new order → admin
    expect(ctx.mailer.sent[0]!.to).toBe('admin@test.local');

    await admin.post(`/api/admin/orders/${body.order.id}/status`).send({ status: 'UNDER_REVIEW' }).expect(200);
    await eventually(() => ctx.mailer.sent.length === 2);
    expect(ctx.mailer.sent[1]).toMatchObject({ to: CUSTOMER_A.email, subject: `${body.order.reference} numaralı siparişiniz güncellendi` });
    expect(ctx.mailer.sent[1]!.text).toContain('İnceleniyor');
  });

  it('sends no order emails when the admin switched them off', async () => {
    const quiet = await setupTest({ settings: { emailNotificationsEnabled: false } });
    const a = await signedIn(quiet.app, CUSTOMER_A);
    await submitOrder(a, orderPayload()).expect(201);
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(quiet.mailer.sent).toHaveLength(0);
  });
});
