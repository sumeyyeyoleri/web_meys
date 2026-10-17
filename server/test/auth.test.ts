import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  ADMIN,

  closeTestPrisma,
  CUSTOMER_A,
  eventually,
  FakeMailer,
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

describe('registration and login', () => {
  it('registers a customer, signs them in and returns no secrets', async () => {
    const client = await guest(ctx.app);
    const res = await client
      .post('/api/auth/register')
      .send({ fullName: 'Lies', email: 'Lies@Test.Local', password: 'long-password-1', passwordConfirm: 'long-password-1', preferredLocale: 'tr' })
      .expect(201);
    expect(res.body).toMatchObject({ email: 'lies@test.local', role: 'CUSTOMER', preferredLocale: 'tr' });
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|argon2/);

    const cookie = String(res.headers['set-cookie']);
    expect(cookie).toMatch(/sid=.*HttpOnly/);
    expect(cookie).toMatch(/SameSite=Lax/);

    const me = await client.get('/api/auth/me').expect(200);
    expect(me.body.user.email).toBe('lies@test.local');
  });

  it('rejects a duplicate email and weak/mismatched passwords with i18n keys', async () => {
    const client = await guest(ctx.app);
    const dup = await client
      .post('/api/auth/register')
      .send({ fullName: 'X', email: CUSTOMER_A.email, password: 'long-password-1', passwordConfirm: 'long-password-1', preferredLocale: 'en' })
      .expect(409);
    expect(dup.body.error.code).toBe('EMAIL_IN_USE');

    const weak = await client
      .post('/api/auth/register')
      .send({ fullName: '', email: 'not-an-email', password: 'short', passwordConfirm: 'other', preferredLocale: 'xx' })
      .expect(400);
    expect(weak.body.error).toMatchObject({
      code: 'VALIDATION_ERROR',
      fields: {
        fullName: 'validation.required',
        email: 'validation.email',
        password: 'validation.passwordTooShort',
        preferredLocale: 'validation.invalidOption',
      },
    });
  });

  it('logs in, rotates the session and logs out', async () => {
    const client = await guest(ctx.app);
    await client.login(CUSTOMER_A);
    const first = await ctx.prisma.session.findMany();
    await client.login(CUSTOMER_A);
    const second = await ctx.prisma.session.findMany();
    expect(second).toHaveLength(1);
    expect(second[0]!.id).not.toBe(first[0]!.id);

    await client.post('/api/auth/logout').expect(204);
    expect(await ctx.prisma.session.count()).toBe(0);
    expect((await client.get('/api/auth/me')).body.user).toBeNull();
  });

  it('stores only a hash of the session token', async () => {
    const client = await guest(ctx.app);
    const res = await client.post('/api/auth/login').send(CUSTOMER_A).expect(200);
    const token = /sid=([^;]+)/.exec(String(res.headers['set-cookie']))![1]!;
    const session = await ctx.prisma.session.findFirstOrThrow();
    expect(session.tokenHash).not.toContain(token);
    expect(session.tokenHash).toHaveLength(64);
  });

  it('gives the same answer for a wrong password and an unknown email', async () => {
    const client = await guest(ctx.app);
    const wrong = await client.post('/api/auth/login').send({ email: CUSTOMER_A.email, password: 'wrong-password' }).expect(401);
    const unknown = await client.post('/api/auth/login').send({ email: 'nobody@test.local', password: 'wrong-password' }).expect(401);
    expect(wrong.body).toEqual(unknown.body);
    expect(wrong.body.error.code).toBe('INVALID_CREDENTIALS');
  });
});

describe('sessions and CSRF', () => {
  it('requires a session for protected routes', async () => {
    const client = await guest(ctx.app);
    const res = await client.get('/api/orders').expect(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
    await client.get('/api/notifications/unread-count').expect(401);
  });

  it('rejects state-changing requests without the CSRF header', async () => {
    const client = await guest(ctx.app);
    const res = await client.agent.post('/api/auth/login').send(CUSTOMER_A).expect(403);
    expect(res.body.error.code).toBe('CSRF_INVALID');
  });

  it('rejects a CSRF header that does not match the cookie, and foreign origins', async () => {
    const client = await guest(ctx.app);
    await client.agent.post('/api/auth/login').set('X-CSRF-Token', 'forged.token').send(CUSTOMER_A).expect(403);
    const foreign = await client.post('/api/auth/login').set('Origin', 'https://evil.example').send(CUSTOMER_A).expect(403);
    expect(foreign.body.error.code).toBe('CSRF_INVALID');
    await client.post('/api/auth/login').set('Origin', 'http://localhost:5173').send(CUSTOMER_A).expect(200);
  });

  it('rate limits login attempts', async () => {
    const limited = await setupTest({ rateLimits: { login: { windowMs: 60_000, limit: 3 } } });
    const client = await guest(limited.app);
    for (let i = 0; i < 3; i++) {
      await client.post('/api/auth/login').send({ email: CUSTOMER_A.email, password: 'wrong-password' }).expect(401);
    }
    const blocked = await client.post('/api/auth/login').send(CUSTOMER_A).expect(429);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');
  });
});

describe('passwords', () => {
  it('changes the password and ends all other sessions', async () => {
    const laptop = await signedIn(ctx.app, CUSTOMER_A);
    const phone = await signedIn(ctx.app, CUSTOMER_A);

    const wrong = await laptop
      .post('/api/auth/change-password')
      .send({ currentPassword: 'nope-nope-nope', newPassword: 'brand-new-password', newPasswordConfirm: 'brand-new-password' })
      .expect(400);
    expect(wrong.body.error.fields).toEqual({ currentPassword: 'validation.currentPasswordWrong' });

    await laptop
      .post('/api/auth/change-password')
      .send({ currentPassword: CUSTOMER_A.password, newPassword: 'brand-new-password', newPasswordConfirm: 'brand-new-password' })
      .expect(204);
    await laptop.get('/api/orders').expect(200);
    await phone.get('/api/orders').expect(401);
    await (await guest(ctx.app)).post('/api/auth/login').send({ email: CUSTOMER_A.email, password: 'brand-new-password' }).expect(200);
  });

  it('resets a password with a single-use emailed token', async () => {
    const other = await signedIn(ctx.app, CUSTOMER_A);
    const client = await guest(ctx.app);
    await client.post('/api/auth/forgot-password').send({ email: CUSTOMER_A.email }).expect(202);
    await client.post('/api/auth/forgot-password').send({ email: 'nobody@test.local' }).expect(202);

    await eventually(() => ctx.mailer.sent.length === 1);
    const token = /token=([A-Za-z0-9_-]+)/.exec(ctx.mailer.sent[0]!.text)![1]!;
    expect(ctx.mailer.sent[0]!.to).toBe(CUSTOMER_A.email);
    expect(ctx.mailer.sent[0]!.subject).toBe('Uw wachtwoord opnieuw instellen');

    const stored = await ctx.prisma.passwordResetToken.findFirstOrThrow();
    expect(stored.tokenHash).not.toBe(token);

    const body = { token, password: 'reset-password-123', passwordConfirm: 'reset-password-123' };
    await client.post('/api/auth/reset-password').send(body).expect(204);
    const reused = await client.post('/api/auth/reset-password').send(body).expect(400);
    expect(reused.body.error.code).toBe('RESET_TOKEN_INVALID');

    await other.get('/api/orders').expect(401);
    await client.post('/api/auth/login').send({ email: CUSTOMER_A.email, password: 'reset-password-123' }).expect(200);
  });

  it('rejects expired reset tokens', async () => {
    const client = await guest(ctx.app);
    await client.post('/api/auth/forgot-password').send({ email: CUSTOMER_A.email }).expect(202);
    await eventually(() => ctx.mailer.sent.length === 1);
    const token = /token=([A-Za-z0-9_-]+)/.exec(ctx.mailer.sent[0]!.text)![1]!;
    await ctx.prisma.passwordResetToken.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    await client
      .post('/api/auth/reset-password')
      .send({ token, password: 'reset-password-123', passwordConfirm: 'reset-password-123' })
      .expect(400);
  });

  it('never claims an email was sent when SMTP is not configured', async () => {
    const unconfigured = await setupTest({ mailer: new FakeMailer(false) });
    const client = await guest(unconfigured.app);
    const res = await client.post('/api/auth/forgot-password').send({ email: CUSTOMER_A.email }).expect(202);
    expect(res.body).toEqual({ ok: true });
    await eventually(async () => (await unconfigured.prisma.passwordResetToken.count()) === 1);
    expect(unconfigured.mailer.sent).toHaveLength(0);
  });
});

describe('profile', () => {
  it('updates the profile and preferred language', async () => {
    const client = await signedIn(ctx.app, CUSTOMER_A);
    const res = await client
      .patch('/api/users/me')
      .send({ fullName: 'Anna P.', phone: '+32 471 00 00 00', city: 'Brugge', preferredLocale: 'en' })
      .expect(200);
    expect(res.body).toMatchObject({ preferredLocale: 'en', profile: { fullName: 'Anna P.', city: 'Brugge' } });
  });

  it('is available to admins as well, and only when signed in', async () => {
    await (await guest(ctx.app)).patch('/api/users/me').send({ fullName: 'X', preferredLocale: 'en' }).expect(401);
    const admin = await signedIn(ctx.app, ADMIN);
    await admin.patch('/api/users/me').send({ fullName: 'Admin', preferredLocale: 'tr' }).expect(200);
  });
});
