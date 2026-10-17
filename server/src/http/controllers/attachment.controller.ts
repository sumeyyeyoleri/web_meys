import type { Request, Response } from 'express';
import { pipeline } from 'node:stream/promises';
import type { Services } from '../../container';
import { getAuth } from '../middleware/auth';
import { parseIdParam } from '../middleware/validation';

/** RFC 6266 / 5987 Content-Disposition with an ASCII fallback. */
function contentDisposition(type: 'inline' | 'attachment', fileName: string): string {
  const ascii = fileName.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return `${type}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

export function createAttachmentController({ attachments }: Services) {
  return {
    async download(req: Request, res: Response) {
      const { user } = getAuth(req);
      const { attachment, file } = await attachments.open(parseIdParam(req), { id: user.id, role: user.role });
      const asDownload = req.query.download === '1';
      res.setHeader('Content-Type', attachment.mimeType);
      res.setHeader('Content-Disposition', contentDisposition(asDownload ? 'attachment' : 'inline', attachment.originalName));
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'private, max-age=300');
      if (file.size !== undefined) res.setHeader('Content-Length', String(file.size));
      await pipeline(file.stream, res);
    },
  };
}
