import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  ADMIN,
  closeTestPrisma,
  eventually,
  createOrder,
  CUSTOMER,
  guest,
  IMAGES,
  setupTest,
  signedIn,
  track,
  type Client,
  type TestContext,
} from './helpers';

let ctx: TestContext;
let admin: Client;
let customer: Client;
beforeEach(async () => {
  ctx = await setupTest();
  admin = await signedIn(ctx.app, ADMIN);
  customer = await guest(ctx.app);
});
afterAll(closeTestPrisma);

const move = (id: string, status: string, extra: Record<string, unknown> = {}) =>
  admin.post(`/api/admin/orders/${id}/status`).send({ status, ...extra });

describe('admin order list', () => {
  it('filters, searches and paginates on the server', async () => {
    const first = await createOrder(customer);
    await createOrder(customer, { phone: '+32 499 55 44 33' });
    await createOrder(customer, { fullName: 'Bram Janssens', email: 'bram@test.local' });
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
    expect((await admin.get(`/api/admin/orders?q=${encodeURIComponent('bram@test.local')}`)).body.total).toBe(1);
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
    const order = await createOrder(customer);
    await move(order.id, 'UNDER_REVIEW').expect(200);
    await move(order.id, 'AWAITING_CUSTOMER_INFO', { note: 'Need wall photos' }).expect(200);
    const quoted = await move(order.id, 'QUOTE_SENT', { quoteAmount: 1250.5 }).expect(200);
    expect(quoted.body).toMatchObject({ status: 'QUOTE_SENT', quoteAmount: 1250.5 });

    const customerView = await track(customer, 'get', '/order', order.token).expect(200);
    expect(customerView.body.allowedTransitions).toEqual(['ACCEPTED', 'CANCELLED']);
    await track(customer, 'post', '/status', order.token).send({ status: 'ACCEPTED' }).expect(200);

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
    const order = await createOrder(customer);
    for (const status of ['QUOTE_SENT', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'SUBMITTED']) {
      const res = await move(order.id, status, { quoteAmount: 100 });
      expect(res.status, status).toBe(409);
      expect(res.body.error.code).toBe('ORDER_INVALID_TRANSITION');
    }
    await move(order.id, 'CANCELLED').expect(200);
    await move(order.id, 'UNDER_REVIEW').expect(409);
  });

  it('requires a quote amount for QUOTE_SENT', async () => {
    const order = await createOrder(customer);
    await move(order.id, 'UNDER_REVIEW').expect(200);
    const missing = await move(order.id, 'QUOTE_SENT').expect(400);
    expect(missing.body.error.fields).toEqual({ quoteAmount: 'validation.quoteRequired' });
    await move(order.id, 'QUOTE_SENT', { quoteAmount: 0 }).expect(400);
    const order2 = await ctx.prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(order2.status).toBe('UNDER_REVIEW');
  });

  it('emails the customer about admin status changes, without in-app notifications', async () => {
    const order = await createOrder(customer);
    ctx.mailer.sent.length = 0;
    await move(order.id, 'UNDER_REVIEW').expect(200);
    await eventually(() => ctx.mailer.sent.some((m) => m.to === CUSTOMER.email));
    expect(await ctx.prisma.notification.count({ where: { type: 'ORDER_STATUS_CHANGED' } })).toBe(0);
  });
});

describe('internal notes', () => {
  it('are visible to admins but never appear in customer responses', async () => {
    const order = await createOrder(customer);
    const secret = 'INTERNAL-ONLY-margin-is-thin';
    await admin.post(`/api/admin/orders/${order.id}/notes`).send({ body: secret }).expect(201);
    await admin.post(`/api/admin/orders/${order.id}/messages`).send({ body: 'Public reply' }).expect(201);
    await move(order.id, 'UNDER_REVIEW', { note: 'status note' }).expect(200);

    const adminView = await admin.get(`/api/admin/orders/${order.id}`).expect(200);
    expect(adminView.body.internalNotes).toEqual([expect.objectContaining({ body: secret, authorEmail: ADMIN.email })]);
    expect((await admin.get(`/api/admin/orders/${order.id}/notes`)).body).toHaveLength(1);

    const responses = await Promise.all([
      track(customer, 'get', '/order', order.token),
      track(customer, 'get', '/messages', order.token),
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
    const order = await createOrder(customer);
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
    const order = await createOrder(customer);
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

    await track(customer, 'post', '/messages', order.token).send({ body: 'Question' }).expect(201);
    const stats = await admin.get('/api/admin/stats').expect(200);
    expect(stats.body).toMatchObject({ totalOrders: 1, newOrders: 1, inReview: 0, unreadCustomerMessages: 1 });
    expect(stats.body.recentOrders[0]).toMatchObject({ id: order.id, unreadMessages: 1 });
    expect(stats.body.recentMessages[0]).toMatchObject({ body: 'Question', customerName: CUSTOMER.name });

    await admin.post(`/api/admin/orders/${order.id}/messages/read`).expect(204);
    expect((await admin.get('/api/admin/stats')).body.unreadCustomerMessages).toBe(0);
  });
});

describe('content management', () => {
  const translations = (name: string) => ({ 'nl-BE': { name }, en: { name }, tr: { name } });

  it('lets the admin change an order\'s category; the stored name follows', async () => {
    const order = await createOrder(customer, { categoryId: ctx.ids.categoryId });
    const detail = (await admin.get(`/api/admin/orders/${order.id}`).expect(200)).body;
    const update = {
      categoryId: ctx.ids.wallCategoryId,
      title: detail.title,
      width: 2,
      height: 3,
      unit: 'M',
      description: detail.description,
      fullName: detail.contact.fullName,
      email: detail.contact.email ?? '',
      phone: detail.contact.phone,
      communicationLocale: detail.contact.communicationLocale,
      country: detail.projectAddress.country,
      city: detail.projectAddress.city,
      postalCode: detail.projectAddress.postalCode,
      street: detail.projectAddress.street,
      houseNumber: detail.projectAddress.houseNumber,
      addressExtra: '',
    };
    const res = await admin.put(`/api/admin/orders/${order.id}`).send(update).expect(200);
    expect(res.body).toMatchObject({ categoryId: ctx.ids.wallCategoryId, categoryName: 'Mural NL', previousServiceName: null });
    const unknown = await admin.put(`/api/admin/orders/${order.id}`).send({ ...update, categoryId: randomUUID() }).expect(400);
    expect(unknown.body.error.fields).toEqual({ categoryId: 'validation.invalidOption' });
  });

  it('manages portfolio items and reflects them on the public site', async () => {
    const item = {
      imageUrl: '/media/portfolio/test.svg',
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

    expect(settings).not.toHaveProperty('budgetRequired');
    expect(settings).not.toHaveProperty('deadlineRequired');
    await admin.put('/api/admin/settings').send({ ...settings, enabledLocales: ['nl-BE', 'en'], welcomeEnabled: false }).expect(200);
    const site = (await customer.get('/api/site?locale=tr')).body;
    expect(site.locale).toBe('nl-BE');
    expect(site.settings).toMatchObject({ welcomeEnabled: false, enabledLocales: ['nl-BE', 'en'], emailAvailable: true });
  });

  it('uploads public media after checking the file signature, stored as WebP', async () => {
    const ok = await admin.post('/api/admin/media').attach('file', IMAGES.png, { filename: 'a.png', contentType: 'image/png' }).expect(201);
    expect(ok.body.url).toMatch(/^\/media\/uploads\/[0-9a-f-]{36}\.webp$/);
    const served = await customer.get(ok.body.url).expect(200);
    expect(served.headers['content-type']).toMatch(/image\/webp/);
    const spoofed = await admin
      .post('/api/admin/media')
      .attach('file', IMAGES.text, { filename: 'a.png', contentType: 'image/png' })
      .expect(400);
    expect(spoofed.body.error.fields).toEqual({ file: 'validation.fileType' });
  });
});

describe('image optimisation', () => {
  it('scales large photos down to 2400 px, keeps small ones, applies the rotation and drops metadata', async () => {
    const big = await sharp({ create: { width: 3600, height: 1200, channels: 3, background: '#b4532a' } })
      .jpeg()
      .withMetadata({ orientation: 6, exif: { IFD0: { Copyright: 'secret-location' } } })
      .toBuffer();
    const res = await admin.post('/api/admin/media').attach('file', big, { filename: 'wall.jpg', contentType: 'image/jpeg' }).expect(201);
    const stored = (await customer.get(res.body.url).buffer(true).expect(200)).body as Buffer;
    const meta = await sharp(stored).metadata();
    // Orientation 6 = rotated 90°: the stored image is upright (portrait) and at most 2400 px.
    expect(meta).toMatchObject({ format: 'webp', width: 800, height: 2400 });
    expect(meta.exif).toBeUndefined();
    expect(meta.orientation).toBeUndefined();

    const small = await sharp({ create: { width: 640, height: 480, channels: 3, background: '#2f5d62' } }).png().toBuffer();
    const kept = await admin.post('/api/admin/media').attach('file', small, { filename: 'small.png', contentType: 'image/png' }).expect(201);
    expect(await sharp((await customer.get(kept.body.url).buffer(true)).body as Buffer).metadata()).toMatchObject({ width: 640, height: 480 });
  });

  it('refuses a file with a valid signature that is not a readable image', async () => {
    const res = await admin.post('/api/admin/media').attach('file', IMAGES.jpeg, { filename: 'broken.jpg', contentType: 'image/jpeg' }).expect(400);
    expect(res.body.error.fields).toEqual({ file: 'validation.fileUnreadable' });
  });
});

describe('brand and welcome screen', () => {
  const logoSvg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M0 0h10v10z"/></svg>');
  const uploadLogo = (client: Client, buffer: Buffer, filename: string, contentType: string) =>
    client.post('/api/admin/settings/logo').attach('file', buffer, { filename, contentType });

  it('stores a safe SVG logo, serves it locked down and exposes it publicly', async () => {
    const res = await uploadLogo(admin, logoSvg, 'logo.svg', 'image/svg+xml').expect(200);
    expect(res.body.logoUrl).toMatch(/^\/media\/uploads\/logo\/[0-9a-f-]{36}\.svg$/);
    const served = await customer.get(res.body.logoUrl).expect(200);
    expect(served.headers['content-type']).toContain('image/svg+xml');
    expect(served.headers['content-security-policy']).toContain("default-src 'none'");
    expect((await customer.get('/api/site').expect(200)).body.settings.logoUrl).toBe(res.body.logoUrl);
  });

  it('rejects SVGs with active content and files that are not SVG/PNG/WebP', async () => {
    const script = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    const unsafe = await uploadLogo(admin, script, 'logo.svg', 'image/svg+xml').expect(400);
    expect(unsafe.body.error).toMatchObject({ code: 'UPLOAD_UNSAFE_SVG', fields: { file: 'validation.svgUnsafe' } });

    const handler = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>');
    await uploadLogo(admin, handler, 'logo.svg', 'image/svg+xml').expect(400);

    const jpeg = await uploadLogo(admin, IMAGES.jpeg, 'logo.jpg', 'image/jpeg').expect(400);
    expect(jpeg.body.error.fields).toEqual({ file: 'validation.logoType' });
    // A PNG pretending to be an SVG.
    await uploadLogo(admin, IMAGES.png, 'logo.svg', 'image/svg+xml').expect(400);
    expect((await admin.get('/api/admin/settings').expect(200)).body.logoUrl).toBeNull();
  });

  it('replaces and removes the logo, deleting the old file', async () => {
    const first = (await uploadLogo(admin, IMAGES.png, 'logo.png', 'image/png').expect(200)).body.logoUrl as string;
    const second = (await uploadLogo(admin, IMAGES.webp, 'logo.webp', 'image/webp').expect(200)).body.logoUrl as string;
    expect(second).toMatch(/\.webp$/);
    await customer.get(first).expect(404);
    const removed = await admin.delete('/api/admin/settings/logo').expect(200);
    expect(removed.body.logoUrl).toBeNull();
    await customer.get(second).expect(404);
  });

  it('only lets the signed-in artist change the logo', async () => {
    await uploadLogo(customer, logoSvg, 'logo.svg', 'image/svg+xml').expect(401);
    await customer.delete('/api/admin/settings/logo').expect(401);
  });

  it('saves the welcome screen settings and tagline', async () => {
    const settings = (await admin.get('/api/admin/settings').expect(200)).body;
    expect(settings).toMatchObject({ welcomeEnabled: true, welcomeImageUrl: null });

    const image = (await admin.post('/api/admin/media').attach('file', IMAGES.png, { filename: 'bg.png', contentType: 'image/png' }).expect(201)).body.url;
    await admin.put('/api/admin/settings').send({ ...settings, welcomeEnabled: false, welcomeImageUrl: image }).expect(200);
    await admin
      .put('/api/admin/content')
      .send({ items: [{ key: 'welcome.tagline', locale: 'en', value: 'Hand-painted art, made for your space.' }] })
      .expect(200);

    const site = (await customer.get('/api/site?locale=en').expect(200)).body;
    expect(site.settings).toMatchObject({ welcomeEnabled: false, welcomeImageUrl: image });
    expect(site.content['welcome.tagline']).toBe('Hand-painted art, made for your space.');

    // Clearing the background falls back to the featured artwork and deletes the unused upload.
    await admin.put('/api/admin/settings').send({ ...settings, welcomeImageUrl: '' }).expect(200);
    await customer.get(image).expect(404);
  });
});
