import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  closeTestPrisma,
  CUSTOMER_A,
  CUSTOMER_B,
  eventually,
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

  it('validates the size and the project address', async () => {
    const client = await signedIn(ctx.app, CUSTOMER_A);
    const res = await submitOrder(
      client,
      orderPayload({ width: 0, height: 'abc', unit: 'INCH', country: '', city: ' ', postalCode: '', street: '', houseNumber: '' }),
    ).expect(400);
    expect(res.body.error.fields).toEqual({
      width: 'validation.positive',
      height: 'validation.number',
      unit: 'validation.invalidOption',
      country: 'validation.required',
      city: 'validation.required',
      postalCode: 'validation.required',
      street: 'validation.required',
      houseNumber: 'validation.required',
    });
    expect(await ctx.prisma.order.count()).toBe(0);
  });

  it('keeps the phone and the service optional and derives a title', async () => {
    const client = await signedIn(ctx.app, CUSTOMER_A);
    const plain = await submitOrder(client, orderPayload({ phone: '', addressExtra: '' })).expect(201);
    expect(plain.body.order).toMatchObject({ serviceId: null, contact: { phone: null }, projectAddress: { addressExtra: null } });
    expect(plain.body.order.title).toBe('Warm earth tones, loose brushwork, something calm and quiet.');

    const long = 'Een groot doek voor de inkomhal met zachte, warme kleuren en veel ruimte voor licht, zoals een ochtend aan zee.';
    const cut = await submitOrder(client, orderPayload({ description: long })).expect(201);
    expect(cut.body.order.title).toMatch(/^Een groot doek voor de inkomhal .*…$/);
    expect(cut.body.order.title.length).toBeLessThanOrEqual(81);

    const withService = await submitOrder(client, orderPayload({ serviceId: ctx.ids.serviceId, communicationLocale: 'en' })).expect(201);
    expect(withService.body.order.title).toBe('Canvas EN');
  });

  it('saves the site language as the communication language', async () => {
    const client = await signedIn(ctx.app, CUSTOMER_A);
    const res = await submitOrder(client, orderPayload({ communicationLocale: 'tr' })).expect(201);
    expect(res.body.order.contact.communicationLocale).toBe('tr');
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

describe('signed-in customer orders', () => {
  it('links the order to the account without a tracking link', async () => {
    const client = await signedIn(ctx.app, CUSTOMER_A);
    const res = await submitOrder(client, orderPayload(), [pngFile()]).expect(201);
    expect(res.body.tracking).toBeNull();
    expect(res.body.order.attachments[0].url).toBe(`/api/attachments/${res.body.order.attachments[0].id}`);
    const stored = await ctx.prisma.order.findUniqueOrThrow({ where: { id: res.body.order.id } });
    expect(stored.customerId).toBe(ctx.ids.customerAId);
    expect(await ctx.prisma.orderTrackingToken.count()).toBe(0);
    expect((await client.get('/api/orders').expect(200)).body.total).toBe(1);
  });

  it('keeps the contact details typed for this order, even when they differ from the profile', async () => {
    const client = await signedIn(ctx.app, CUSTOMER_A);
    const res = await submitOrder(client, orderPayload({ fullName: 'Anna P.', email: 'anna.work@test.local' })).expect(201);
    expect(res.body.order.contact).toMatchObject({ fullName: 'Anna P.', email: 'anna.work@test.local' });
    const stored = await ctx.prisma.order.findUniqueOrThrow({ where: { id: res.body.order.id } });
    expect(stored.customerId).toBe(ctx.ids.customerAId);
  });

  it('refuses an idempotency key that belongs to someone else', async () => {
    const a = await signedIn(ctx.app, CUSTOMER_A);
    const b = await signedIn(ctx.app, CUSTOMER_B);
    const payload = orderPayload();
    await submitOrder(a, payload).expect(201);
    const res = await submitOrder(b, { ...payload, email: CUSTOMER_B.email }).expect(409);
    expect(res.body.error.code).toBe('CONFLICT');
    expect(await ctx.prisma.order.count()).toBe(1);
  });
});

describe('customer order access', () => {
  it('lists only the customer’s own orders, newest first, paginated', async () => {
    const a = await signedIn(ctx.app, CUSTOMER_A);
    for (let i = 0; i < 3; i++) await submitOrder(a, orderPayload({ description: `Order ${i}: a calm painting in warm tones.` })).expect(201);
    const page = await a.get('/api/orders?page=1&pageSize=2').expect(200);
    expect(page.body).toMatchObject({ page: 1, pageSize: 2, total: 3, totalPages: 2 });
    expect(page.body.items.map((o: { title: string }) => o.title.slice(0, 7))).toEqual(['Order 2', 'Order 1']);
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
