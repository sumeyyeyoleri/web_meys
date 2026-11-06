import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { resetAdminPassword } from '../prisma/admin-recovery';
import { ADMIN, closeTestPrisma, guest, setupTest, signedIn, type TestContext } from './helpers';

let ctx: TestContext;
beforeEach(async () => {
  ctx = await setupTest();
});
afterAll(closeTestPrisma);

const NEW_PASSWORD = 'emergency-password-1';

describe('npm run admin:reset-password', () => {
  it('sets the password from ADMIN_PASSWORD and signs out every session', async () => {
    const laptop = await signedIn(ctx.app, ADMIN);
    expect(await resetAdminPassword(ctx.prisma, { email: ADMIN.email, password: NEW_PASSWORD })).toBe(ADMIN.email);

    await laptop.get('/api/admin/orders').expect(401);
    await (await guest(ctx.app)).post('/api/auth/login').send(ADMIN).expect(401);
    await (await guest(ctx.app)).post('/api/auth/login').send({ email: ADMIN.email, password: NEW_PASSWORD }).expect(200);
  });

  it('finds the artist after a sign-in email change in "My account"', async () => {
    const admin = await signedIn(ctx.app, ADMIN);
    await admin.post('/api/admin/account/email').send({ newEmail: 'atelier@new.test', currentPassword: ADMIN.password }).expect(200);

    expect(await resetAdminPassword(ctx.prisma, { email: ADMIN.email, password: NEW_PASSWORD })).toBe('atelier@new.test');
    await admin.get('/api/admin/orders').expect(401);
    await (await guest(ctx.app)).post('/api/auth/login').send({ email: 'atelier@new.test', password: NEW_PASSWORD }).expect(200);
    expect(await ctx.prisma.user.count()).toBe(1);
  });

  it('cancels unused "forgot password" links', async () => {
    await (await guest(ctx.app)).post('/api/auth/forgot-password').send({ email: ADMIN.email }).expect(202);
    await expect.poll(() => ctx.prisma.passwordResetToken.count()).toBe(1);
    await resetAdminPassword(ctx.prisma, { email: ADMIN.email, password: NEW_PASSWORD });
    expect(await ctx.prisma.passwordResetToken.count()).toBe(0);
  });

  it('does nothing without an account', async () => {
    await ctx.prisma.user.deleteMany();
    expect(await resetAdminPassword(ctx.prisma, { email: ADMIN.email, password: NEW_PASSWORD })).toBeNull();
    expect(await ctx.prisma.user.count()).toBe(0);
  });
});
