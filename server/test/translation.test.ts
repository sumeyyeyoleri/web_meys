import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  closeTestPrisma,
  createOrder,
  FakeTranslator,
  guest,
  setupTest,
  signedIn,
  track,
  type CreatedOrder,
  type Client,
  type TestContext,
} from './helpers';

let ctx: TestContext;
let admin: Client;
let customer: Client;
let order: CreatedOrder;

async function prepare(options: Parameters<typeof setupTest>[0] = {}) {
  ctx = await setupTest(options);
  customer = await guest(ctx.app);
  order = await createOrder(customer, { communicationLocale: 'nl-BE' });
  admin = await signedIn(ctx.app);
}

afterAll(closeTestPrisma);

/** Customer writes (in Dutch), the artist answers (dashboard language: Turkish). */
async function thread() {
  const fromCustomer = await track(customer, 'post', '/messages', order.token).send({ body: 'Kan het ook in het blauw?' }).expect(201);
  await admin.patch('/api/admin/me').send({ preferredLocale: 'tr' }).expect(200);
  const fromArtist = await admin.post(`/api/admin/orders/${order.id}/messages`).send({ body: 'Tabii, mavi de olur.' }).expect(201);
  return { customerMessageId: fromCustomer.body.id as string, artistMessageId: fromArtist.body.id as string };
}

describe('message language', () => {
  beforeEach(() => prepare());

  it("stores the sender's language: the order's language for the customer, the dashboard language for the artist", async () => {
    await thread();
    const res = await admin.get(`/api/admin/orders/${order.id}/messages`).expect(200);
    expect(res.body.map((m: { locale: string }) => m.locale)).toEqual(['nl-BE', 'tr']);
    const customerView = await track(customer, 'get', '/messages', order.token).expect(200);
    expect(customerView.body.map((m: { locale: string }) => m.locale)).toEqual(['nl-BE', 'tr']);
  });
});

describe('message translation', () => {
  beforeEach(() => prepare());

  it('translates on request into the given language and reuses the stored translation', async () => {
    const { customerMessageId } = await thread();
    const url = `/api/admin/orders/${order.id}/messages/${customerMessageId}/translate`;
    const first = await admin.post(url).send({ targetLocale: 'tr' }).expect(200);
    expect(first.body).toEqual({ messageId: customerMessageId, locale: 'tr', body: '[tr] Kan het ook in het blauw?' });
    const again = await admin.post(url).send({ targetLocale: 'tr' }).expect(200);
    expect(again.body).toEqual(first.body);
    // One DeepL call for two clicks; a different language is a new translation.
    expect(ctx.translator.calls).toHaveLength(1);
    await admin.post(url).send({ targetLocale: 'en' }).expect(200);
    expect(ctx.translator.calls).toHaveLength(2);
    expect(await ctx.prisma.messageTranslation.count()).toBe(2);
  });

  it('never translates automatically', async () => {
    await thread();
    await admin.get(`/api/admin/orders/${order.id}/messages`).expect(200);
    await track(customer, 'get', '/messages', order.token).expect(200);
    expect(ctx.translator.calls).toHaveLength(0);
  });

  it("lets the customer translate the artist's message through the tracking link", async () => {
    const { artistMessageId } = await thread();
    const res = await track(customer, 'post', `/messages/${artistMessageId}/translate`, order.token).send({ targetLocale: 'nl-BE' }).expect(200);
    expect(res.body.body).toBe('[nl-BE] Tabii, mavi de olur.');
  });

  it('does not call DeepL for a message already in the target language', async () => {
    const { customerMessageId } = await thread();
    const res = await admin.post(`/api/admin/orders/${order.id}/messages/${customerMessageId}/translate`).send({ targetLocale: 'nl-BE' }).expect(200);
    expect(res.body.body).toBe('Kan het ook in het blauw?');
    expect(ctx.translator.calls).toHaveLength(0);
  });

  it("only reaches messages of the viewer's own order", async () => {
    const { artistMessageId } = await thread();
    const other = await createOrder(customer);
    await track(customer, 'post', `/messages/${artistMessageId}/translate`, other.token).send({ targetLocale: 'en' }).expect(404);
    await admin.post(`/api/admin/orders/${other.id}/messages/${artistMessageId}/translate`).send({ targetLocale: 'en' }).expect(404);
    await track(customer, 'post', `/messages/${artistMessageId}/translate`, 'x'.repeat(43)).send({ targetLocale: 'en' }).expect(404);
    const signedOut = await guest(ctx.app);
    await signedOut.post(`/api/admin/orders/${order.id}/messages/${artistMessageId}/translate`).send({ targetLocale: 'en' }).expect(401);
    expect(ctx.translator.calls).toHaveLength(0);
  });

  it('rejects an unknown target language', async () => {
    const { customerMessageId } = await thread();
    const res = await admin.post(`/api/admin/orders/${order.id}/messages/${customerMessageId}/translate`).send({ targetLocale: 'de' }).expect(400);
    expect(res.body.error.fields).toEqual({ targetLocale: 'validation.invalidOption' });
  });

  it('reports DeepL failures with a clear code and stores nothing', async () => {
    const { customerMessageId } = await thread();
    const url = `/api/admin/orders/${order.id}/messages/${customerMessageId}/translate`;
    ctx.translator.failWith = 456;
    const quota = await admin.post(url).send({ targetLocale: 'tr' }).expect(503);
    expect(quota.body.error.code).toBe('TRANSLATION_LIMIT_REACHED');
    ctx.translator.failWith = 500;
    const failed = await admin.post(url).send({ targetLocale: 'tr' }).expect(502);
    expect(failed.body.error.code).toBe('TRANSLATION_FAILED');
    expect(await ctx.prisma.messageTranslation.count()).toBe(0);
  });
});

describe('without a DeepL key', () => {
  beforeEach(() => prepare({ translator: new FakeTranslator(false) }));

  it('says so in the site settings and refuses translation; messages still work', async () => {
    const site = await customer.get('/api/site').expect(200);
    expect(site.body.settings.translationAvailable).toBe(false);
    const { customerMessageId } = await thread();
    const res = await admin.post(`/api/admin/orders/${order.id}/messages/${customerMessageId}/translate`).send({ targetLocale: 'tr' }).expect(503);
    expect(res.body.error.code).toBe('TRANSLATION_UNAVAILABLE');
    expect(ctx.translator.calls).toHaveLength(0);
  });
});

describe('translation rate limit', () => {
  beforeEach(() => prepare({ rateLimits: { translation: { windowMs: 60_000, limit: 2 } } }));

  it('limits translation requests', async () => {
    const { customerMessageId } = await thread();
    const url = `/api/admin/orders/${order.id}/messages/${customerMessageId}/translate`;
    await admin.post(url).send({ targetLocale: 'tr' }).expect(200);
    await admin.post(url).send({ targetLocale: 'tr' }).expect(200);
    const limited = await admin.post(url).send({ targetLocale: 'tr' }).expect(429);
    expect(limited.body.error.code).toBe('RATE_LIMITED');
  });
});
