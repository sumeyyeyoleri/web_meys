import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { sha256 } from '../src/infrastructure/crypto';
import {
  ADMIN,
  closeTestPrisma,
  createOrder,
  CUSTOMER,
  eventually,
  FakeMailer,
  guest,
  IMAGES,
  orderPayload,
  pngFile,
  setupTest,
  signedIn,
  submitOrder,
  tokenFromUrl,
  track,
  type Client,
  type TestContext,
} from './helpers';

let ctx: TestContext;
beforeEach(async () => {
  ctx = await setupTest();
});
afterAll(closeTestPrisma);

const NOT_FOUND = { error: { code: 'NOT_FOUND', message: 'Order not found' } };

/** An order together with its tracking link and token. */
async function orderWithLink(client: Client, overrides: Record<string, unknown> = {}) {
  const order = await createOrder(client, overrides);
  return { order, tracking: order.tracking, token: order.token };
}

describe('orders and their private link', () => {
  it('stores the order without an account and returns a private tracking link', async () => {
    const client = await guest(ctx.app);
    const res = await submitOrder(
      client,
      orderPayload({ fullName: CUSTOMER.name, email: CUSTOMER.email, communicationLocale: 'en' }),
      [pngFile()],
    ).expect(201);

    const { order, tracking } = res.body;
    expect(res.body).not.toHaveProperty('user');
    expect(String(res.headers['set-cookie'] ?? '')).not.toMatch(/sid=/);
    expect(tracking.url).toMatch(/^http:\/\/localhost:5173\/track#[A-Za-z0-9_-]{43}$/);
    expect(new Date(tracking.expiresAt).getTime()).toBeGreaterThan(Date.now() + 360 * 86_400_000);
    expect(order.attachments[0].url).toBe(`/api/track/attachments/${order.attachments[0].id}`);
    expect(order.statusHistory).toEqual([expect.objectContaining({ toStatus: 'SUBMITTED', changedByRole: 'CUSTOMER' })]);

    // No account is created: the artist's login stays the only one.
    expect(await ctx.prisma.user.count()).toBe(1);

    // Only the hash of the token is stored.
    const token = tokenFromUrl(tracking.url);
    const rows = await ctx.prisma.orderTrackingToken.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.tokenHash).toBe(sha256(token));
    expect(JSON.stringify(rows)).not.toContain(token);
  });

  it('emails the link when SMTP is configured and says so', async () => {
    const client = await guest(ctx.app);
    const { tracking, order } = await orderWithLink(client, { communicationLocale: 'tr' });
    expect(tracking.emailSent).toBe(true);
    const mail = ctx.mailer.sent.find((m) => m.to === CUSTOMER.email);
    expect(mail?.subject).toBe(`${order.reference} numaralı siparişiniz için özel link`);
    expect(mail?.text).toContain(tracking.url);
  });

  it('never claims the link was emailed without SMTP', async () => {
    const offline = await setupTest({ mailer: new FakeMailer(false) });
    const client = await guest(offline.app);
    const { tracking } = await orderWithLink(client);
    expect(tracking.emailSent).toBe(false);
    expect(offline.mailer.sent).toHaveLength(0);
  });

  it('emails the link only when the customer gave an email address', async () => {
    const client = await guest(ctx.app);
    const { tracking } = await orderWithLink(client, { email: '' });
    expect(tracking.emailSent).toBe(false);
    await eventually(() => ctx.mailer.sent.length === 1);
    expect(ctx.mailer.sent.map((m) => m.to)).toEqual([ADMIN.email]);
  });

  it('returns the same order for a repeated submission and issues a fresh link', async () => {
    const client = await guest(ctx.app);
    const payload = orderPayload({ fullName: CUSTOMER.name, email: CUSTOMER.email });
    const first = await submitOrder(client, payload, [pngFile()]).expect(201);
    const second = await submitOrder(client, payload, [pngFile()]).expect(200);
    expect(second.body.created).toBe(false);
    expect(second.body.order.id).toBe(first.body.order.id);
    expect(second.body.tracking.emailSent).toBe(false);
    expect(await ctx.prisma.order.count()).toBe(1);
    expect(await ctx.prisma.orderAttachment.count()).toBe(1);

    // Both links open the order: the first one may already have been emailed.
    for (const res of [first, second]) {
      await track(client, 'get', '/order', tokenFromUrl(res.body.tracking.url)).expect(200);
    }
    // The same key with other contact details is refused.
    await submitOrder(client, { ...payload, phone: '+32 499 00 00 00' }).expect(409);
  });

  it('shows the order to the artist with the contact details as submitted', async () => {
    const client = await guest(ctx.app);
    const { order } = await orderWithLink(client, { email: '' });
    const admin = await signedIn(ctx.app, ADMIN);
    const list = await admin.get('/api/admin/orders').expect(200);
    expect(list.body.items[0]).toMatchObject({ id: order.id, customerName: CUSTOMER.name, customerEmail: null, customerPhone: CUSTOMER.phone });
    expect(list.body.items[0]).not.toHaveProperty('isGuest');

    const detail = await admin.get(`/api/admin/orders/${order.id}`).expect(200);
    expect(detail.body.contact).toMatchObject({ fullName: CUSTOMER.name, email: null, phone: CUSTOMER.phone });
    expect(detail.body).not.toHaveProperty('customerId');
    expect(detail.body.attachments[0].url).toBe(`/api/attachments/${order.attachments[0]!.id}`);
    await admin.get(detail.body.attachments[0].url).expect(200);
  });
});

describe('tracking link access', () => {
  it('opens the order, its images and nothing else', async () => {
    const client = await guest(ctx.app);
    const { order, token } = await orderWithLink(client);
    const other = await orderWithLink(await guest(ctx.app), { email: 'other@test.local' });

    const detail = await track(client, 'get', '/order?locale=en', token).expect(200);
    expect(detail.body).toMatchObject({ id: order.id, reference: order.reference, status: 'SUBMITTED', allowedTransitions: ['CANCELLED'] });
    expect(detail.body).not.toHaveProperty('internalNotes');

    const image = await track(client, 'get', `/attachments/${order.attachments[0]!.id}`, token).expect(200);
    expect(image.headers['content-type']).toBe('image/png');
    expect(image.headers['cache-control']).toBe('private, max-age=300');
    // Another order's image is not reachable with this token.
    await track(client, 'get', `/attachments/${other.order.attachments[0]!.id}`, token).expect(404);
    // The artist's routes stay closed.
    await client.get(`/api/admin/orders/${order.id}`).expect(401);
    await client.get(`/api/attachments/${order.attachments[0]!.id}`).expect(401);
  });

  it('rejects missing, malformed, unknown, expired and revoked tokens with the same 404', async () => {
    const client = await guest(ctx.app);
    const { order, token } = await orderWithLink(client);

    const responses = [
      await client.get('/api/track/order'),
      await track(client, 'get', '/order', 'not-a-token'),
      await track(client, 'get', '/order', `${token.slice(0, -1)}${token.endsWith('A') ? 'B' : 'A'}`),
    ];
    // The reference alone never gives access.
    responses.push(await client.get(`/api/track/order?reference=${order.reference}`));
    responses.push(await track(client, 'get', '/order', order.reference));

    await ctx.prisma.orderTrackingToken.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    responses.push(await track(client, 'get', '/order', token));
    await ctx.prisma.orderTrackingToken.updateMany({ data: { expiresAt: new Date(Date.now() + 86_400_000), revokedAt: new Date() } });
    responses.push(await track(client, 'get', '/order', token));

    for (const res of responses) {
      expect(res.status).toBe(404);
      expect(res.body).toEqual(NOT_FOUND);
    }
  });

  it('requires the CSRF header for actions', async () => {
    const client = await guest(ctx.app);
    const { token } = await orderWithLink(client);
    const res = await client.agent.post('/api/track/messages').set('X-Order-Token', token).send({ body: 'Hallo' }).expect(403);
    expect(res.body.error.code).toBe('CSRF_INVALID');
  });

  it('is rate limited', async () => {
    const limited = await setupTest({ rateLimits: { tracking: { windowMs: 60_000, limit: 2 } } });
    const client = await guest(limited.app);
    await track(client, 'get', '/order', 'x').expect(404);
    await track(client, 'get', '/order', 'y').expect(404);
    const res = await track(client, 'get', '/order', 'z').expect(429);
    expect(res.body.error.code).toBe('RATE_LIMITED');
  });
});

describe('customer messaging and status actions', () => {
  it('runs the message thread between customer and artist', async () => {
    const client = await guest(ctx.app);
    const { order, token } = await orderWithLink(client);
    const admin = await signedIn(ctx.app, ADMIN);

    const sent = await track(client, 'post', '/messages', token).send({ body: 'Kan het ook in het blauw?' }).expect(201);
    expect(sent.body).toMatchObject({ senderRole: 'CUSTOMER', senderName: CUSTOMER.name, isOwn: true });
    const adminThread = await admin.get(`/api/admin/orders/${order.id}/messages`).expect(200);
    expect(adminThread.body).toEqual([expect.objectContaining({ senderName: CUSTOMER.name, isOwn: false, readAt: null })]);

    await admin.post(`/api/admin/orders/${order.id}/messages`).send({ body: 'Zeker, ik stuur een voorstel.' }).expect(201);
    // The customer has no account: an email (without an account link), no in-app notification.
    await eventually(() => ctx.mailer.sent.some((m) => m.to === CUSTOMER.email && m.subject.startsWith('Nieuw bericht')));
    const mail = ctx.mailer.sent.find((m) => m.to === CUSTOMER.email && m.subject.startsWith('Nieuw bericht'))!;
    expect(mail.text).not.toContain('/account/');
    expect(mail.text).toContain('volglink');
    expect(await ctx.prisma.notification.count({ where: { type: 'ORDER_MESSAGE' } })).toBe(1); // the admin's only

    const before = await track(client, 'get', '/order', token).expect(200);
    expect(before.body.unreadMessages).toBe(1);
    const thread = await track(client, 'get', '/messages', token).expect(200);
    expect(thread.body.map((m: { senderRole: string; isOwn: boolean }) => [m.senderRole, m.isOwn])).toEqual([
      ['CUSTOMER', true],
      ['ADMIN', false],
    ]);
    await track(client, 'post', '/messages/read', token).expect(204);
    expect((await track(client, 'get', '/order', token)).body.unreadMessages).toBe(0);
    await track(client, 'post', '/messages', token).send({ body: '  ' }).expect(400);
  });

  it('lets the customer accept a quote', async () => {
    const client = await guest(ctx.app);
    const { order, token } = await orderWithLink(client);
    const admin = await signedIn(ctx.app, ADMIN);
    await admin.post(`/api/admin/orders/${order.id}/status`).send({ status: 'UNDER_REVIEW' }).expect(200);
    await admin.post(`/api/admin/orders/${order.id}/status`).send({ status: 'QUOTE_SENT', quoteAmount: 450 }).expect(200);

    const quoted = await track(client, 'get', '/order', token).expect(200);
    expect(quoted.body).toMatchObject({ status: 'QUOTE_SENT', quoteAmount: 450, allowedTransitions: ['ACCEPTED', 'CANCELLED'] });
    const accepted = await track(client, 'post', '/status', token).send({ status: 'ACCEPTED' }).expect(200);
    expect(accepted.body.status).toBe('ACCEPTED');
    expect(accepted.body.statusHistory.at(-1)).toMatchObject({ fromStatus: 'QUOTE_SENT', toStatus: 'ACCEPTED', changedByRole: 'CUSTOMER' });
    const history = await ctx.prisma.orderStatusHistory.findFirstOrThrow({ where: { toStatus: 'ACCEPTED' } });
    expect(history.changedById).toBeNull();
    // The artist is notified in-app.
    expect(await ctx.prisma.notification.count({ where: { userId: ctx.ids.adminId, type: 'ORDER_STATUS_CHANGED' } })).toBe(1);
  });

  it('lets the customer cancel, but only through allowed transitions', async () => {
    const client = await guest(ctx.app);
    const { token } = await orderWithLink(client);
    const accept = await track(client, 'post', '/status', token).send({ status: 'ACCEPTED' }).expect(409);
    expect(accept.body.error.code).toBe('ORDER_INVALID_TRANSITION');
    await track(client, 'post', '/status', token).send({ status: 'COMPLETED' }).expect(400);
    const cancelled = await track(client, 'post', '/status', token).send({ status: 'CANCELLED' }).expect(200);
    expect(cancelled.body).toMatchObject({ status: 'CANCELLED', allowedTransitions: [] });
  });
});

describe('admin: new tracking link', () => {
  it('revokes the old link, shows the new one once and emails it', async () => {
    const client = await guest(ctx.app);
    const { order, token } = await orderWithLink(client);
    const admin = await signedIn(ctx.app, ADMIN);
    ctx.mailer.sent.length = 0;

    const res = await admin.post(`/api/admin/orders/${order.id}/tracking-link`).expect(201);
    expect(res.body.url).toMatch(/\/track#[A-Za-z0-9_-]{43}$/);
    expect(res.body.emailSent).toBe(true);
    const newToken = tokenFromUrl(res.body.url);
    expect(newToken).not.toBe(token);
    expect(ctx.mailer.sent).toEqual([expect.objectContaining({ to: CUSTOMER.email, text: expect.stringContaining(res.body.url) })]);

    await track(client, 'get', '/order', token).expect(404);
    await track(client, 'get', '/order', newToken).expect(200);
    // It is not part of the order detail: the token is only returned this once.
    const detail = await admin.get(`/api/admin/orders/${order.id}`).expect(200);
    expect(JSON.stringify(detail.body)).not.toContain(newToken);
  });

  it('reports honestly when the email could not be sent', async () => {
    const offline = await setupTest({ mailer: new FakeMailer(false) });
    const { order } = await orderWithLink(await guest(offline.app));
    const admin = await signedIn(offline.app, ADMIN);
    const res = await admin.post(`/api/admin/orders/${order.id}/tracking-link`).expect(201);
    expect(res.body.emailSent).toBe(false);
  });

  it('is only for the artist', async () => {
    const client = await guest(ctx.app);
    const { order } = await orderWithLink(client);
    await client.post(`/api/admin/orders/${order.id}/tracking-link`).expect(401);
    const admin = await signedIn(ctx.app, ADMIN);
    await admin.post('/api/admin/orders/00000000-0000-4000-8000-000000000000/tracking-link').expect(404);
  });
});

describe('uploads', () => {
  it('stores nothing (no order, no link) when a file is rejected', async () => {
    const client = await guest(ctx.app);
    const payload = orderPayload({ fullName: CUSTOMER.name, email: CUSTOMER.email });
    const spoofed = await submitOrder(client, payload, [{ buffer: IMAGES.text, name: 'evil.png', type: 'image/png' }]).expect(400);
    expect(spoofed.body.error.code).toBe('UPLOAD_INVALID_TYPE');
    const tooMany = Array.from({ length: 9 }, (_, i) => pngFile(`p${i}.png`));
    const many = await submitOrder(client, payload, tooMany).expect(400);
    expect(many.body.error.code).toBe('UPLOAD_TOO_MANY_FILES');
    expect(await ctx.prisma.order.count()).toBe(0);
    expect(await ctx.prisma.orderTrackingToken.count()).toBe(0);
  });
});
