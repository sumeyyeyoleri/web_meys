import multer from 'multer';
import type { Request } from 'express';
import { MEDIA_MAX_FILE_SIZE_BYTES } from '@painter/shared';
import type { IncomingFile } from '../../services/upload-validation';

/** Admin media upload: a single image in the `file` field. */
export const mediaUpload = multer({
  storage: multer.memoryStorage(),
  defParamCharset: 'utf8',
  limits: { fileSize: MEDIA_MAX_FILE_SIZE_BYTES, files: 1, fields: 2, parts: 3 },
}).single('file');

export function incomingFile(req: Request): IncomingFile | undefined {
  const file = req.file;
  return file
    ? { originalName: file.originalname, declaredMimeType: file.mimetype, size: file.size, buffer: file.buffer }
    : undefined;
}
