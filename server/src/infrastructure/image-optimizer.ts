import sharp from 'sharp';

/** Longest side of a public image after upload; larger photos are scaled down, smaller ones kept. */
export const MAX_IMAGE_EDGE = 2400;
const WEBP_QUALITY = 82;
/** Refuse decompression bombs (about 50 megapixels). */
const MAX_INPUT_PIXELS = 50_000_000;

/**
 * Optimises an admin-uploaded photo for the web: applies the camera rotation, scales it to at
 * most MAX_IMAGE_EDGE px, drops metadata (EXIF, GPS) and stores it as WebP.
 * Small encoder quirks are tolerated (as browsers do); truncated or unreadable files return null.
 */
export async function optimizeImage(buffer: Buffer): Promise<{ buffer: Buffer; mimeType: 'image/webp' } | null> {
  try {
    const output = await sharp(buffer, { failOn: 'truncated', limitInputPixels: MAX_INPUT_PIXELS })
      .rotate()
      .resize({ width: MAX_IMAGE_EDGE, height: MAX_IMAGE_EDGE, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer();
    return { buffer: output, mimeType: 'image/webp' };
  } catch {
    return null;
  }
}
