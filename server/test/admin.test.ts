import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  ADMIN,
  closeTestPrisma,
  createOrderAs,
  CUSTOMER_A,
  CUSTOMER_B,
  IMAGES,
  setupTest,
  signedIn,
  type Client,
  type TestContext,
} from './helpers';

let ctx: TestContext;
let admin: Client;
let customer: Client;
beforeEach(async () => {
  ctx = await setupTest();
  admin = await signedIn(ctx.app, ADMIN);
  customer = await signedIn(ctx.app, CUSTOMER_A);
});
afterAll(closeTestPrisma);

const move = (id: string, status: string, extra: Record<string, unknown> = {}) =>
  admin.post(`/api/admin/orders/${id}/status`).send({ status, ...extra });

describe('admin order list', () => {
  it('filters, searches and paginates on the server', async () => {
    const b = await signedIn(ctx.app, CUSTOMER_B);
    const first = await createOrderAs(customer, { title: 'Mural' });
    await createOrderAs(customer, { title: 'Portrait', phone: '+32 499 55 44 33' });
    await createOrderAs(b, { title: 'Canvas', fullName: CUSTOMER_B.name, email: CUSTOMER_B.email });
    await move(first.id, 'UNDER_REVIEW').expect(200);

    const all = await admin.get('/api/admin/orders?pageSize=2').expect(200);
    expect(all.body).toMatchObject({ total: 3, totalPages: 2, page: 1 });
    expect(all.body.items).toHaveLength(2);
    expect(all.body.items[0]).toHaveProperty('customerEmail');

    const page2 = await admin.get('/api/admin/orders?pageSize=2&page=2').expect(200);
    expect(page2.body.items).toHaveLength(1);

    const byStatus = await admin.get('/api/admin/orders?status=UNDER_REVIEW').expect(200);
    expect(byStatus.body.items.map((o: { id: string }) => o.id)).toEqual([first.id]);

    const byRef = await admin.get(`/api/admin/orders?q=${first.reference.slice(-6).toLowerCase()}`).expect(200);
    expect(byRef.body.total).toBe(1);
    expect((await admin.get('/api/admin/orders?q=bram')).body.total).toBe(1);
    expect((await admin.get(`/api/admin/orders?q=${encodeURIComponent(CUSTOMER_B.email)}`)).body.total).toBe(1);
    expect((await admin.get('/api/admin/orders?q=499 55')).body.total).toBe(1);

    const today = new Date().toISOString().slice(0, 10);
    expect((await admin.get(`/api/admin/orders?from=${today}&to=${today}`)).body.total).toBe(3);
    expect((await admin.get('/api/admin/orders?to=2000-01-01')).body.total).toBe(0);

    const invalid = await admin.get('/api/admin/orders?status=NOPE&pageSize=500').expect(400);
    expect(invalid.body.error.fields).toHaveProperty('status');
  });
});

describe('status transitions', () => {
  it('walks an order from SUBMITTED to COMPLETED', async () => {
    const order = await createOrderAs(customer);
    await move(order.id, 'UNDER_REVIEW').expect(200);
    await move(order.id, 'AWAITING_CUSTOMER_INFO', { note: 'Need wall photos' }).expect(200);
    const quoted = await move(order.id, 'QUOTE_SENT', { quoteAmount: 1250.5 }).expect(200);
    expect(quoted.body).toMatchObject({ status: 'QUOTE_SENT', quoteAmount: 1250.5 });

    const customerView = await customer.get(`/api/orders/${order.id}`).expect(200);
    expect(customerView.body.allowedTransitions).toEqual(['ACCEPTED', 'CANCELLED']);
    await customer.post(`/api/orders/${order.id}/status`).send({ status: 'ACCEPTED' }).expect(200);

    await move(order.id, 'IN_PROGRESS').expect(200);
    const done = await move(order.id, 'COMPLETED').expect(200);
    expect(done.body.allowedTransitions).toEqual([]);
    expect(done.body.statusHistory.map((h: { toStatus: string }) => h.toStatus)).toEqual([
      'SUBMITTED',
      'UNDER_REVIEW',
      'AWAITING_CUSTOMER_INFO',
      'QUOTE_SENT',
      'ACCEPTED',
      'IN_PROGRESS',
      'COMPLETED',
    ]);
    const history = await ctx.prisma.orderStatusHistory.findMany({ where: { orderId: order.id, toStatus: 'AWAITING_CUSTOMER_INFO' } });
    expect(history[0]).toMatchObject({ note: 'Need wall photos', changedById: ctx.ids.adminId });
  });

  it('rejects invalid transitions with 409 ORDER_INVALID_TRANSITION', async () => {
    const order = await createOrderAs(customer);
    for (const status of ['QUOTE_SENT', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'SUBMITTED']) {
      const res = await move(order.id, status, { quoteAmount: 100 });
      expect(res.status, status).toBe(409);
      expect(res.body.error.code).toBe('ORDER_INVALID_TRANSITION');
    }
    await move(order.id, 'CANCELLED').expect(200);
    await move(order.id, 'UNDER_REVIEW').expect(409);
  });

  it('requires a quote amount for QUOTE_SENT', async () => {
    const order = await createOrderAs(customer);
    await move(order.id, 'UNDER_REVIEW').expect(200);
    const missing = await move(order.id, 'QUOTE_SENT').expect(400);
    expect(missing.body.error.fields).toEqual({ quoteAmount: 'validation.quoteRequired' });
    await move(order.id, 'QUOTE_SENT', { quoteAmount: 0 }).expect(400);
    const order2 = await ctx.prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(order2.status).toBe('UNDER_REVIEW');
  });

  it('notifies the customer about every admin status change', async () => {
    const order = await createOrderAs(customer);
    await move(order.id, 'UNDER_REVIEW').expect(200);
    const notifications = await ctx.prisma.notification.findMany({ where: { userId: ctx.ids.customerAId } });
    expect(notifications).toEqual([expect.objectContaining({ type: 'ORDER_STATUS_CHANGED', status: 'UNDER_REVIEW' })]);
  });
});

describe('internal notes', () => {
  it('are visible to admins but never appear in customer responses', async () => {
    const order = await createOrderAs(customer);
    const secret = 'INTERNAL-ONLY-margin-is-thin';
    await admin.post(`/api/admin/orders/${order.id}/notes`).send({ body: secret }).expect(201);
    await admin.post(`/api/admin/orders/${order.id}/messages`).send({ body: 'Public reply' }).expect(201);
    await move(order.id, 'UNDER_REVIEW', { note: 'status note' }).expect(200);

    const adminView = await admin.get(`/api/admin/orders/${order.id}`).expect(200);
    expect(adminView.body.internalNotes).toEqual([expect.objectContaining({ body: secret, authorEmail: ADMIN.email })]);
    expect((await admin.get(`/api/admin/orders/${order.id}/notes`)).body).toHaveLength(1);

    const responses = await Promise.all([
      customer.get(`/api/orders/${order.id}`),
      customer.get('/api/orders'),
      customer.get(`/api/orders/${order.id}/messages`),
      customer.get('/api/notifications'),
    ]);
    for (const res of responses) {
      expect(res.status).toBe(200);
      const text = JSON.stringify(res.body);
      expect(text).not.toContain(secret);
      expect(text).not.toContain('internalNotes');
    }
  });
});

describe('archiving', () => {
  it('only archives COMPLETED or CANCELLED orders', async () => {
    const order = await createOrderAs(customer);
    const refused = await admin.post(`/api/admin/orders/${order.id}/archive`).expect(409);
    expect(refused.body.error.code).toBe('ORDER_NOT_ARCHIVABLE');

    await move(order.id, 'CANCELLED').expect(200);
    const archived = await admin.post(`/api/admin/orders/${order.id}/archive`).expect(200);
    expect(archived.body.archivedAt).not.toBeNull();
    expect(archived.body.canArchive).toBe(false);

    expect((await admin.get('/api/admin/orders')).body.total).toBe(0);
    expect((await admin.get('/api/admin/orders?includeArchived=true')).body.total).toBe(1);
    expect(await ctx.prisma.order.count()).toBe(1);
  });
});

describe('order editing and stats', () => {
  it('edits order details and reports dashboard numbers', async () => {
    const order = await createOrderAs(customer);
    const detail = (await admin.get(`/api/admin/orders/${order.id}`).expect(200)).body;
    const update = {
      customRequest: detail.customRequest,
      width: 80,
      height: 60,
      unit: 'CM',
      title: 'Corrected title',
      description: detail.description,
      fullName: detail.contact.fullName,
      email: detail.contact.email,
      phone: detail.contact.phone,
      communicationLocale: 'en',
      country: 'België',
      city: 'Gent',
      postalCode: '9000',
      street: 'Veldstraat',
      houseNumber: '2',
    };
    const edited = await admin.put(`/api/admin/orders/${order.id}`).send(update).expect(200);
    expect(edited.body).toMatchObject({ title: 'Corrected title', width: 80, contact: { communicationLocale: 'en' } });

    await customer.post(`/api/orders/${order.id}/messages`).send({ body: 'Question' }).expect(201);
    const stats = await admin.get('/api/admin/stats').expect(200);
    expect(stats.body).toMatchObject({ totalOrders: 1, newOrders: 1, inReview: 0, unreadCustomerMessages: 1 });
    expect(stats.body.recentOrders[0]).toMatchObject({ id: order.id, unreadMessages: 1 });
    expect(stats.body.recentMessages[0]).toMatchObject({ body: 'Question', customerName: CUSTOMER_A.name });

    await admin.post(`/api/admin/orders/${order.id}/messages/read`).expect(204);
    expect((await admin.get('/api/admin/stats')).body.unreadCustomerMessages).toBe(0);
  });
});

describe('content management', () => {
  const translations = (name: string) => ({ 'nl-BE': { name }, en: { name }, tr: { name } });

  it('blocks deleting a service that orders use, and allows deactivating it', async () => {
    await createOrderAs(customer, { serviceId: ctx.ids.serviceId });
    const res = await admin.delete(`/api/admin/services/${ctx.ids.serviceId}`).expect(409);
    expect(res.body.error.code).toBe('SERVICE_IN_USE');
    await admin.post(`/api/admin/services/${ctx.ids.serviceId}/active`).send({ value: false }).expect(200);
    const publicServices = await customer.get('/api/services').expect(200);
    expect(publicServices.body.map((s: { id: string }) => s.id)).not.toContain(ctx.ids.serviceId);
  });

  it('creates, reorders and deletes services; every language needs a name', async () => {
    const missing = await admin
      .post('/api/admin/services')
      .send({ isActive: true, isWallService: false, translations: { ...translations('Fresco'), tr: { name: '' } } })
      .expect(400);
    expect(missing.body.error.fields).toEqual({ 'translations.tr.name': 'validation.required' });

    const created = await admin
      .post('/api/admin/services')
      .send({ isActive: true, isWallService: false, translations: translations('Fresco') })
      .expect(201);
    const reordered = await admin.post('/api/admin/services/reorder').send({ id: created.body.id, direction: 'up' }).expect(200);
    expect(reordered.body.map((s: { translations: { en: { name: string } } }) => s.translations.en.name)).toEqual([
      'Canvas EN',
      'Fresco',
      'Mural EN',
    ]);
    await admin.delete(`/api/admin/services/${created.body.id}`).expect(204);
  });

  it('manages portfolio items and reflects them on the public site', async () => {
    const item = {
      imageUrl: '/media/portfolio/test.svg',
      category: 'MURAL',
      width: 3,
      height: 2,
      unit: 'M',
      year: 2025,
      isFeatured: false,
      isPublished: true,
      isSample: false,
      translations: { 'nl-BE': { title: 'Golven' }, en: { title: 'Waves' }, tr: { title: 'Dalgalar' } },
    };
    const created = await admin.post('/api/admin/portfolio').send(item).expect(201);
    await admin.post(`/api/admin/portfolio/${created.body.id}/featured`).send({ value: true }).expect(200);
    const featured = await customer.get('/api/portfolio?featured=true&locale=tr').expect(200);
    expect(featured.body).toEqual([expect.objectContaining({ title: 'Dalgalar', isFeatured: true, isSample: false })]);

    await admin.put(`/api/admin/portfolio/${created.body.id}`).send({ ...item, isPublished: false }).expect(200);
    expect((await customer.get('/api/portfolio')).body).toHaveLength(0);
    await admin.delete(`/api/admin/portfolio/${created.body.id}`).expect(204);
  });

  it('updates text blocks and settings', async () => {
    await admin
      .put('/api/admin/content')
      .send({ items: [{ key: 'hero.title', locale: 'tr', value: 'Merhaba dünya' }] })
      .expect(200);
    expect((await customer.get('/api/site?locale=tr')).body.content['hero.title']).toBe('Merhaba dünya');

    const settings = (await admin.get('/api/admin/settings').expect(200)).body;
    expect(settings.smtpConfigured).toBe(true);
    const bad = await admin.put('/api/admin/settings').send({ ...settings, accentColor: 'orange', enabledLocales: ['en'] }).expect(400);
    expect(bad.body.error.fields).toMatchObject({ accentColor: 'validation.color', enabledLocales: 'validation.defaultLocaleRequired' });

    await admin.put('/api/admin/settings').send({ ...settings, enabledLocales: ['nl-BE', 'en'], budgetRequired: true }).expect(200);
    const site = (await customer.get('/api/site?locale=tr')).body;
    expect(site.locale).toBe('nl-BE');
    expect(site.settings).toMatchObject({ budgetRequired: true, enabledLocales: ['nl-BE', 'en'], emailAvailable: true });
  });

  it('uploads public media after checking the file signature', async () => {
    const ok = await admin.post('/api/admin/media').attach('file', IMAGES.png, { filename: 'a.png', contentType: 'image/png' }).expect(201);
    expect(ok.body.url).toMatch(/^\/media\/uploads\/[0-9a-f-]{36}\.png$/);
    await customer.get(ok.body.url).expect(200);
    const spoofed = await admin
      .post('/api/admin/media')
      .attach('file', IMAGES.text, { filename: 'a.png', contentType: 'image/png' })
      .expect(400);
    expect(spoofed.body.error.fields).toEqual({ file: 'validation.fileType' });
  });
});
