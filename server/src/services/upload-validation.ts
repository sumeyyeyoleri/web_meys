import { randomUUID } from 'node:crypto';
import {
  UPLOAD_ALLOWED_EXTENSIONS,
  UPLOAD_ALLOWED_MIME_TYPES,
  UPLOAD_MAX_FILE_SIZE_BYTES,
  UPLOAD_MAX_FILES,
  type UploadMimeType,
} from '@painter/shared';
import { AppError } from '../domain/errors';
import { detectImageType, EXTENSION_FOR_MIME } from '../domain/upload-signature';

/** Transport-independent view of an uploaded file. */
export interface IncomingFile {
  originalName: string;
  declaredMimeType: string;
  size: number;
  buffer: Buffer;
}

export interface ValidatedImage {
  originalName: string;
  mimeType: UploadMimeType;
  size: number;
  buffer: Buffer;
  /** Random server-side name: UUID + safe extension. */
  storageKey: string;
}

const EXTENSIONS_BY_MIME: Record<UploadMimeType, readonly string[]> = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
};

/** Removes any path, control characters and excess length from a client-supplied file name. */
export function sanitizeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? '';
  const cleaned = base.replace(/[\u0000-\u001f\u007f"<>|*?:]/g, '').trim();
  return (cleaned || 'image').slice(0, 200);
}

/**
 * Checks count, size, declared MIME type, extension AND magic bytes. All three must agree,
 * so a renamed or spoofed file is rejected. Errors point at `files.<index>`.
 */
export function validateImages(files: IncomingFile[], keyPrefix: string): ValidatedImage[] {
  if (files.length > UPLOAD_MAX_FILES) {
    throw new AppError(400, 'UPLOAD_TOO_MANY_FILES', `At most ${UPLOAD_MAX_FILES} files are allowed`, {
      files: 'validation.tooManyFiles',
    });
  }
  return files.map((file, index) => {
    const field = `files.${index}`;
    if (file.size > UPLOAD_MAX_FILE_SIZE_BYTES) {
      throw new AppError(400, 'UPLOAD_FILE_TOO_LARGE', 'File is too large', { [field]: 'validation.fileTooLarge' });
    }
    if (file.size === 0) {
      throw new AppError(400, 'UPLOAD_INVALID_TYPE', 'File is empty', { [field]: 'validation.fileEmpty' });
    }
    const invalidType = () =>
      new AppError(400, 'UPLOAD_INVALID_TYPE', 'Only JPG, PNG and WebP images are allowed', {
        [field]: 'validation.fileType',
      });

    const declared = file.declaredMimeType.toLowerCase();
    if (!(UPLOAD_ALLOWED_MIME_TYPES as readonly string[]).includes(declared)) throw invalidType();
    const detected = detectImageType(file.buffer);
    if (detected === null || detected !== declared) throw invalidType();

    const name = sanitizeFileName(file.originalName);
    const lower = name.toLowerCase();
    const extension = UPLOAD_ALLOWED_EXTENSIONS.find((ext) => lower.endsWith(ext));
    if (!extension || !EXTENSIONS_BY_MIME[detected].includes(extension)) throw invalidType();

    return {
      originalName: name,
      mimeType: detected,
      size: file.size,
      buffer: file.buffer,
      storageKey: `${keyPrefix}/${randomUUID()}${EXTENSION_FOR_MIME[detected]}`,
    };
  });
}
