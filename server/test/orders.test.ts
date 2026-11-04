import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  ADMIN,
  closeTestPrisma,
  createOrder,
  CUSTOMER,
  eventually,
  guest,
  IMAGES,
  orderPayload,
  pngFile,
  setupTest,
  signedIn,
  submitOrder,
  track,
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
    const client = await guest(ctx.app);
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
    const client = await guest(ctx.app);
    const res = await submitOrder(client, orderPayload({ city: 'Antwerpen', street: 'Meir', houseNumber: '50' })).expect(201);
    expect(res.body.order.projectAddress).toMatchObject({ city: 'Antwerpen', street: 'Meir', houseNumber: '50' });
    expect(res.body.order.contact).toMatchObject({ fullName: CUSTOMER.name, email: CUSTOMER.email, phone: CUSTOMER.phone });
  });

  it('returns field-level i18n keys for invalid data', async () => {
    const client = await guest(ctx.app);
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
    const client = await guest(ctx.app);
    const bad = await client.post('/api/orders').field('data', '{not json').expect(400);
    expect(bad.body.error.fields).toEqual({ data: 'validation.invalid' });
    const missing = await client.post('/api/orders').field('other', 'x').expect(400);
    expect(missing.body.error.fields).toEqual({ data: 'validation.required' });
  });

  it('rejects an inactive or unknown service', async () => {
    await ctx.prisma.service.update({ where: { id: ctx.ids.serviceId }, data: { isActive: false } });
    const client = await guest(ctx.app);
    const res = await submitOrder(client, orderPayload({ serviceId: ctx.ids.serviceId })).expect(400);
    expect(res.body.error.fields).toEqual({ serviceId: 'validation.invalidOption' });
  });

  it('validates the size and the project address', async () => {
    const client = await guest(ctx.app);
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

  it('requires name and phone, keeps the email, service and extra address line optional, and derives a title', async () => {
    const client = await guest(ctx.app);
    const missing = await submitOrder(client, orderPayload({ fullName: ' ', phone: '' })).expect(400);
    expect(missing.body.error.fields).toEqual({ fullName: 'validation.required', phone: 'validation.required' });
    const plain = await submitOrder(client, orderPayload({ email: '', addressExtra: '' })).expect(201);
    expect(plain.body.order).toMatchObject({ serviceId: null, contact: { email: null, phone: CUSTOMER.phone }, projectAddress: { addressExtra: null } });
    expect(plain.body.order.title).toBe('Warm earth tones, loose brushwork, something calm and quiet.');

    const long = 'Een groot doek voor de inkomhal met zachte, warme kleuren en veel ruimte voor licht, zoals een ochtend aan zee.';
    const cut = await submitOrder(client, orderPayload({ description: long })).expect(201);
    expect(cut.body.order.title).toMatch(/^Een groot doek voor de inkomhal .*…$/);
    expect(cut.body.order.title.length).toBeLessThanOrEqual(81);

    const withService = await submitOrder(client, orderPayload({ serviceId: ctx.ids.serviceId, communicationLocale: 'en' })).expect(201);
    expect(withService.body.order.title).toBe('Canvas EN');
  });

  it('saves the site language as the communication language', async () => {
    const client = await guest(ctx.app);
    const res = await submitOrder(client, orderPayload({ communicationLocale: 'tr' })).expect(201);
    expect(res.body.order.contact.communicationLocale).toBe('tr');
  });

  it('is idempotent for a repeated submission with the same key', async () => {
    const client = await guest(ctx.app);
    const payload = orderPayload();
    const first = await submitOrder(client, payload, [pngFile()]).expect(201);
    const second = await submitOrder(client, payload, [pngFile()]).expect(200);
    expect(second.body.created).toBe(false);
    expect(second.body.order.id).toBe(first.body.order.id);
    expect(await ctx.prisma.order.count()).toBe(1);
    expect(await ctx.prisma.orderAttachment.count()).toBe(1);
  });

  it('accepts an order while the artist is signed in (it is not linked to the account)', async () => {
    const admin = await signedIn(ctx.app, ADMIN);
    const res = await submitOrder(admin, orderPayload()).expect(201);
    expect(res.body.tracking.url).toMatch(/\/track#/);
  });
});

describe('customer updates by email', () => {
  it('emails the customer in their communication language when the admin acts', async () => {
    const client = await guest(ctx.app);
    const admin = await signedIn(ctx.app, ADMIN);
    const order = await createOrder(client, { communicationLocale: 'tr' });
    await eventually(() => ctx.mailer.sent.length === 2); // tracking link → customer, new order → admin
    expect(ctx.mailer.sent.map((m) => m.to).sort()).toEqual([ADMIN.email, CUSTOMER.email].sort());

    await admin.post(`/api/admin/orders/${order.id}/status`).send({ status: 'UNDER_REVIEW' }).expect(200);
    await eventually(() => ctx.mailer.sent.length === 3);
    expect(ctx.mailer.sent[2]).toMatchObject({ to: CUSTOMER.email, subject: `${order.reference} numaralı siparişiniz güncellendi` });
    expect(ctx.mailer.sent[2]!.text).toContain('İnceleniyor');
    expect(ctx.mailer.sent[2]!.text).not.toContain('/account/');
  });

  it('sends the customer nothing by email without an address, but still shows the link', async () => {
    const client = await guest(ctx.app);
    const admin = await signedIn(ctx.app, ADMIN);
    const order = await createOrder(client, { email: '' });
    expect(order.tracking.emailSent).toBe(false);
    await admin.post(`/api/admin/orders/${order.id}/status`).send({ status: 'UNDER_REVIEW' }).expect(200);
    await admin.post(`/api/admin/orders/${order.id}/messages`).send({ body: 'Hallo' }).expect(201);
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(ctx.mailer.sent.map((m) => m.to)).toEqual([ADMIN.email]);
    await track(client, 'get', '/order', order.token).expect(200);
  });

  it('sends no order notification emails when the admin switched them off', async () => {
    const quiet = await setupTest({ settings: { emailNotificationsEnabled: false } });
    const client = await guest(quiet.app);
    const order = await createOrder(client);
    // The tracking link is part of the order itself, so it is still emailed.
    await eventually(() => quiet.mailer.sent.length === 1);
    expect(quiet.mailer.sent[0]!.text).toContain(order.tracking.url);
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(quiet.mailer.sent).toHaveLength(1);
  });
});

describe('admin notifications', () => {
  it('notifies the artist in-app about new orders and customer messages, and marks them read', async () => {
    const client = await guest(ctx.app);
    const admin = await signedIn(ctx.app, ADMIN);
    const order = await createOrder(client);
    await track(client, 'post', '/messages', order.token).send({ body: 'Nog een vraag' }).expect(201);

    const list = await admin.get('/api/notifications').expect(200);
    expect(list.body.total).toBe(2);
    expect(list.body.items.map((n: { type: string }) => n.type).sort()).toEqual(['ORDER_MESSAGE', 'ORDER_SUBMITTED']);
    expect(list.body.items[0]).toMatchObject({ orderReference: order.reference });

    await admin.post(`/api/notifications/${list.body.items[0].id}/read`).expect(204);
    expect((await admin.get('/api/notifications/unread-count')).body.count).toBe(1);
    await admin.post('/api/notifications/read-all').expect(204);
    expect((await admin.get('/api/notifications/unread-count')).body.count).toBe(0);
    // Only the artist has an account, so these are the only notification rows.
    expect(await ctx.prisma.notification.count({ where: { userId: { not: ctx.ids.adminId } } })).toBe(0);
  });
});
