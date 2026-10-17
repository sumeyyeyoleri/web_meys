import multer from 'multer';
import { UPLOAD_MAX_FILE_SIZE_BYTES, UPLOAD_MAX_FILES } from '@painter/shared';
import type { Request } from 'express';
import type { IncomingFile } from '../../services/upload-validation';

/** Order submission: `data` (JSON text) + up to N images in `files`, kept in memory for validation. */
export const orderUpload = multer({
  storage: multer.memoryStorage(),
  defParamCharset: 'utf8',
  limits: {
    fileSize: UPLOAD_MAX_FILE_SIZE_BYTES,
    files: UPLOAD_MAX_FILES,
    fields: 5,
    fieldSize: 256 * 1024,
    parts: UPLOAD_MAX_FILES + 5,
  },
}).array('files', UPLOAD_MAX_FILES);

export function incomingFiles(req: Request): IncomingFile[] {
  const files = Array.isArray(req.files) ? req.files : [];
  return files.map((file) => ({
    originalName: file.originalname,
    declaredMimeType: file.mimetype,
    size: file.size,
    buffer: file.buffer,
  }));
}
