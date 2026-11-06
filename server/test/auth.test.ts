import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  ADMIN,
  closeTestPrisma,
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

describe('artist login', () => {
  it('signs the artist in and returns no secrets', async () => {
    const client = await guest(ctx.app);
    const res = await client.post('/api/auth/login').send({ email: 'Admin@Test.Local', password: ADMIN.password }).expect(200);
    expect(res.body).toEqual({ id: ctx.ids.adminId, email: ADMIN.email, name: null, preferredLocale: 'nl-BE', createdAt: expect.any(String) });
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|argon2/);

    const cookie = String(res.headers['set-cookie']);
    expect(cookie).toMatch(/sid=.*HttpOnly/);
    expect(cookie).toMatch(/SameSite=Lax/);
    expect((await client.get('/api/auth/me').expect(200)).body.user.email).toBe(ADMIN.email);
  });

  it('has no customer accounts: registration, profile and "my orders" are gone', async () => {
    const client = await guest(ctx.app);
    const payload = { fullName: 'Lies', email: 'lies@test.local', password: 'long-password-1', passwordConfirm: 'long-password-1', preferredLocale: 'tr' };
    for (const res of [
      await client.post('/api/auth/register').send(payload),
      await client.patch('/api/users/me').send({ fullName: 'X' }),
      await client.get('/api/orders'),
      await client.get('/api/orders/00000000-0000-4000-8000-000000000000'),
    ]) {
      expect(res.status).toBe(404);
    }
    expect(await ctx.prisma.user.count()).toBe(1);
  });

  it('logs in, rotates the session and logs out', async () => {
    const client = await guest(ctx.app);
    await client.login(ADMIN);
    const first = await ctx.prisma.session.findMany();
    await client.login(ADMIN);
    const second = await ctx.prisma.session.findMany();
    expect(second).toHaveLength(1);
    expect(second[0]!.id).not.toBe(first[0]!.id);

    await client.post('/api/auth/logout').expect(204);
    expect(await ctx.prisma.session.count()).toBe(0);
    expect((await client.get('/api/auth/me')).body.user).toBeNull();
  });

  it('stores only a hash of the session token', async () => {
    const client = await guest(ctx.app);
    const res = await client.post('/api/auth/login').send(ADMIN).expect(200);
    const token = /sid=([^;]+)/.exec(String(res.headers['set-cookie']))![1]!;
    const session = await ctx.prisma.session.findFirstOrThrow();
    expect(session.tokenHash).not.toContain(token);
    expect(session.tokenHash).toHaveLength(64);
  });

  it('gives the same answer for a wrong password and an unknown email', async () => {
    const client = await guest(ctx.app);
    const wrong = await client.post('/api/auth/login').send({ email: ADMIN.email, password: 'wrong-password' }).expect(401);
    const unknown = await client.post('/api/auth/login').send({ email: 'nobody@test.local', password: 'wrong-password' }).expect(401);
    expect(wrong.body).toEqual(unknown.body);
    expect(wrong.body.error.code).toBe('INVALID_CREDENTIALS');
  });
});

describe('sessions and CSRF', () => {
  it('requires a session for protected routes', async () => {
    const client = await guest(ctx.app);
    const res = await client.get('/api/admin/orders').expect(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
    await client.get('/api/notifications/unread-count').expect(401);
  });

  it('rejects state-changing requests without the CSRF header', async () => {
    const client = await guest(ctx.app);
    const res = await client.agent.post('/api/auth/login').send(ADMIN).expect(403);
    expect(res.body.error.code).toBe('CSRF_INVALID');
  });

  it('rejects a CSRF header that does not match the cookie, and foreign origins', async () => {
    const client = await guest(ctx.app);
    await client.agent.post('/api/auth/login').set('X-CSRF-Token', 'forged.token').send(ADMIN).expect(403);
    const foreign = await client.post('/api/auth/login').set('Origin', 'https://evil.example').send(ADMIN).expect(403);
    expect(foreign.body.error.code).toBe('CSRF_INVALID');
    await client.post('/api/auth/login').set('Origin', 'http://localhost:5173').send(ADMIN).expect(200);
  });

  it('rate limits login attempts', async () => {
    const limited = await setupTest({ rateLimits: { login: { windowMs: 60_000, limit: 3 } } });
    const client = await guest(limited.app);
    for (let i = 0; i < 3; i++) {
      await client.post('/api/auth/login').send({ email: ADMIN.email, password: 'wrong-password' }).expect(401);
    }
    const blocked = await client.post('/api/auth/login').send(ADMIN).expect(429);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');
  });
});

describe('passwords', () => {
  it('changes the password and ends all other sessions', async () => {
    const laptop = await signedIn(ctx.app, ADMIN);
    const phone = await signedIn(ctx.app, ADMIN);

    const wrong = await laptop
      .post('/api/auth/change-password')
      .send({ currentPassword: 'nope-nope-nope', newPassword: 'brand-new-password', newPasswordConfirm: 'brand-new-password' })
      .expect(400);
    expect(wrong.body.error.fields).toEqual({ currentPassword: 'validation.currentPasswordWrong' });

    await laptop
      .post('/api/auth/change-password')
      .send({ currentPassword: ADMIN.password, newPassword: 'brand-new-password', newPasswordConfirm: 'brand-new-password' })
      .expect(204);
    await laptop.get('/api/admin/orders').expect(200);
    await phone.get('/api/admin/orders').expect(401);
    await (await guest(ctx.app)).post('/api/auth/login').send({ email: ADMIN.email, password: 'brand-new-password' }).expect(200);
  });

  it('resets a password with a single-use emailed token', async () => {
    const other = await signedIn(ctx.app, ADMIN);
    const client = await guest(ctx.app);
    await client.post('/api/auth/forgot-password').send({ email: ADMIN.email }).expect(202);
    await client.post('/api/auth/forgot-password').send({ email: 'nobody@test.local' }).expect(202);

    await eventually(() => ctx.mailer.sent.length === 1);
    const token = /token=([A-Za-z0-9_-]+)/.exec(ctx.mailer.sent[0]!.text)![1]!;
    expect(ctx.mailer.sent[0]!.to).toBe(ADMIN.email);
    expect(ctx.mailer.sent[0]!.text).toContain('http://localhost:5173/admin/reset-password?token=');
    expect(ctx.mailer.sent[0]!.subject).toBe('Uw wachtwoord opnieuw instellen');

    const stored = await ctx.prisma.passwordResetToken.findFirstOrThrow();
    expect(stored.tokenHash).not.toBe(token);

    const body = { token, password: 'reset-password-123', passwordConfirm: 'reset-password-123' };
    await client.post('/api/auth/reset-password').send(body).expect(204);
    const reused = await client.post('/api/auth/reset-password').send(body).expect(400);
    expect(reused.body.error.code).toBe('RESET_TOKEN_INVALID');

    await other.get('/api/admin/orders').expect(401);
    await client.post('/api/auth/login').send({ email: ADMIN.email, password: 'reset-password-123' }).expect(200);
  });

  it('rejects expired reset tokens', async () => {
    const client = await guest(ctx.app);
    await client.post('/api/auth/forgot-password').send({ email: ADMIN.email }).expect(202);
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
    const res = await client.post('/api/auth/forgot-password').send({ email: ADMIN.email }).expect(202);
    expect(res.body).toEqual({ ok: true });
    await eventually(async () => (await unconfigured.prisma.passwordResetToken.count()) === 1);
    expect(unconfigured.mailer.sent).toHaveLength(0);
  });
});

describe('dashboard preferences', () => {
  it('stores the artist\'s language, Turkish by default', async () => {
    const admin = await signedIn(ctx.app, ADMIN);
    const fresh = await ctx.prisma.user.create({ data: { email: 'second@test.local', passwordHash: 'x' } });
    expect(fresh.preferredLocale).toBe('TR');

    const res = await admin.patch('/api/admin/me').send({ preferredLocale: 'en' }).expect(200);
    expect(res.body.preferredLocale).toBe('en');
    expect((await admin.get('/api/auth/me')).body.user.preferredLocale).toBe('en');
    const bad = await admin.patch('/api/admin/me').send({ preferredLocale: 'de' }).expect(400);
    expect(bad.body.error.fields).toEqual({ preferredLocale: 'validation.invalidOption' });
    await (await guest(ctx.app)).patch('/api/admin/me').send({ preferredLocale: 'tr' }).expect(401);
  });
});

describe('my account', () => {
  it('sets and clears the display name', async () => {
    const admin = await signedIn(ctx.app, ADMIN);
    const named = await admin.put('/api/admin/account/profile').send({ name: '  Meyse  ' }).expect(200);
    expect(named.body).toMatchObject({ email: ADMIN.email, name: 'Meyse' });
    expect((await admin.get('/api/auth/me').expect(200)).body.user.name).toBe('Meyse');

    const tooLong = await admin.put('/api/admin/account/profile').send({ name: 'x'.repeat(81) }).expect(400);
    expect(tooLong.body.error.fields).toEqual({ name: 'validation.tooLong' });
    const cleared = await admin.put('/api/admin/account/profile').send({ name: '' }).expect(200);
    expect(cleared.body.name).toBeNull();
  });

  it('changes the sign-in email with the current password and ends all other sessions', async () => {
    const laptop = await signedIn(ctx.app, ADMIN);
    const phone = await signedIn(ctx.app, ADMIN);

    const wrong = await laptop.post('/api/admin/account/email').send({ newEmail: 'new@test.local', currentPassword: 'nope-nope-nope' }).expect(400);
    expect(wrong.body.error.fields).toEqual({ currentPassword: 'validation.currentPasswordWrong' });
    const invalid = await laptop.post('/api/admin/account/email').send({ newEmail: 'not-an-email', currentPassword: ADMIN.password }).expect(400);
    expect(Object.keys(invalid.body.error.fields)).toEqual(['newEmail']);

    const res = await laptop.post('/api/admin/account/email').send({ newEmail: 'Atelier@New.Test', currentPassword: ADMIN.password }).expect(200);
    expect(res.body.email).toBe('atelier@new.test');
    await laptop.get('/api/admin/orders').expect(200);
    await phone.get('/api/admin/orders').expect(401);

    await (await guest(ctx.app)).post('/api/auth/login').send(ADMIN).expect(401);
    await (await guest(ctx.app)).post('/api/auth/login').send({ email: 'atelier@new.test', password: ADMIN.password }).expect(200);
  });

  it('refuses an email address that another account uses', async () => {
    await ctx.prisma.user.create({ data: { email: 'taken@test.local', passwordHash: 'x' } });
    const admin = await signedIn(ctx.app, ADMIN);
    const res = await admin.post('/api/admin/account/email').send({ newEmail: 'taken@test.local', currentPassword: ADMIN.password }).expect(409);
    expect(res.body.error.fields).toEqual({ newEmail: 'validation.emailTaken' });
  });

  it('requires a signed-in artist', async () => {
    const client = await guest(ctx.app);
    await client.put('/api/admin/account/profile').send({ name: 'X' }).expect(401);
    await client.post('/api/admin/account/email').send({ newEmail: 'x@test.local', currentPassword: 'x' }).expect(401);
  });
});
