import { describe, expect, it } from 'vitest';
import { detectImageType } from './upload-signature';

describe('detectImageType', () => {
  it('recognises JPEG, PNG and WebP signatures', () => {
    expect(detectImageType(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]))).toBe('image/jpeg');
    expect(detectImageType(Buffer.from('89504e470d0a1a0a0000', 'hex'))).toBe('image/png');
    expect(detectImageType(Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP')]))).toBe('image/webp');
  });

  it('rejects anything else', () => {
    expect(detectImageType(Buffer.from('GIF89a'))).toBeNull();
    expect(detectImageType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBeNull();
    expect(detectImageType(Buffer.from('RIFF....WAVE'))).toBeNull();
    expect(detectImageType(Buffer.alloc(0))).toBeNull();
  });
});
