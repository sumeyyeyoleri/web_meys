import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { UPLOAD_MAX_FILE_SIZE_BYTES, UPLOAD_MAX_FILES } from '@painter/shared';
import {
  closeTestPrisma,
  CUSTOMER_A,
  IMAGES,
  orderPayload,
  pngFile,
  privateFiles,
  setupTest,
  signedIn,
  submitOrder,
  type TestContext,
} from './helpers';

let ctx: TestContext;
beforeEach(async () => {
  ctx = await setupTest();
});
afterAll(closeTestPrisma);

async function expectNothingStored() {
  expect(await ctx.prisma.order.count()).toBe(0);
  expect(await ctx.prisma.orderAttachment.count()).toBe(0);
}

describe('reference image validation', () => {
  it(`rejects more than ${UPLOAD_MAX_FILES} files`, async () => {
    const client = await signedIn(ctx.app, CUSTOMER_A);
    const files = Array.from({ length: UPLOAD_MAX_FILES + 1 }, (_, i) => pngFile(`ref-${i}.png`));
    const res = await submitOrder(client, orderPayload(), files).expect(400);
    expect(res.body.error).toMatchObject({ code: 'UPLOAD_TOO_MANY_FILES', fields: { files: 'validation.tooManyFiles' } });
    await expectNothingStored();
  });

  it('accepts exactly the maximum number of files', async () => {
    const client = await signedIn(ctx.app, CUSTOMER_A);
    const files = Array.from({ length: UPLOAD_MAX_FILES }, (_, i) => pngFile(`ref-${i}.png`));
    const res = await submitOrder(client, orderPayload(), files).expect(201);
    expect(res.body.order.attachments).toHaveLength(UPLOAD_MAX_FILES);
  });

  it('rejects files over the size limit', async () => {
    const client = await signedIn(ctx.app, CUSTOMER_A);
    const big = Buffer.concat([IMAGES.png, Buffer.alloc(UPLOAD_MAX_FILE_SIZE_BYTES)]);
    const res = await submitOrder(client, orderPayload(), [{ buffer: big, name: 'big.png', type: 'image/png' }]).expect(400);
    expect(res.body.error).toMatchObject({ code: 'UPLOAD_FILE_TOO_LARGE', fields: { files: 'validation.fileTooLarge' } });
    await expectNothingStored();
  });

  it('rejects disallowed MIME types', async () => {
    const client = await signedIn(ctx.app, CUSTOMER_A);
    const res = await submitOrder(client, orderPayload(), [{ buffer: IMAGES.gif, name: 'anim.gif', type: 'image/gif' }]).expect(400);
    expect(res.body.error).toMatchObject({ code: 'UPLOAD_INVALID_TYPE', fields: { 'files.0': 'validation.fileType' } });
  });

  it('rejects a spoofed extension and MIME type whose bytes are not an image', async () => {
    const client = await signedIn(ctx.app, CUSTOMER_A);
    const res = await submitOrder(client, orderPayload(), [
      pngFile('fine.png'),
      { buffer: IMAGES.text, name: 'evil.png', type: 'image/png' },
    ]).expect(400);
    expect(res.body.error).toMatchObject({ code: 'UPLOAD_INVALID_TYPE', fields: { 'files.1': 'validation.fileType' } });
    await expectNothingStored();
  });

  it('rejects a real image whose declared type or extension does not match its bytes', async () => {
    const client = await signedIn(ctx.app, CUSTOMER_A);
    await submitOrder(client, orderPayload(), [{ buffer: IMAGES.png, name: 'photo.jpg', type: 'image/jpeg' }]).expect(400);
    await submitOrder(client, orderPayload(), [{ buffer: IMAGES.png, name: 'photo.jpg', type: 'image/png' }]).expect(400);
    await submitOrder(client, orderPayload(), [{ buffer: IMAGES.png, name: 'photo.svg', type: 'image/png' }]).expect(400);
  });

  it('removes already stored files when the database transaction fails', async () => {
    const client = await signedIn(ctx.app, CUSTOMER_A);
    const before = await privateFiles();
    // A trigger makes the attachment insert fail after the files were already written to storage.
    await ctx.prisma.$executeRawUnsafe(
      `CREATE OR REPLACE FUNCTION fail_attachment() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'forced failure'; END; $$ LANGUAGE plpgsql`,
    );
    await ctx.prisma.$executeRawUnsafe(
      `CREATE TRIGGER fail_attachment BEFORE INSERT ON "OrderAttachment" FOR EACH ROW EXECUTE FUNCTION fail_attachment()`,
    );
    try {
      const res = await submitOrder(client, orderPayload(), [pngFile(), pngFile('b.png')]).expect(500);
      expect(res.body.error.code).toBe('INTERNAL_ERROR');
      expect(JSON.stringify(res.body)).not.toContain('forced failure');
    } finally {
      await ctx.prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS fail_attachment ON "OrderAttachment"`);
      await ctx.prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS fail_attachment()`);
    }
    expect(await privateFiles()).toEqual(before);
    await expectNothingStored();
  });
});
