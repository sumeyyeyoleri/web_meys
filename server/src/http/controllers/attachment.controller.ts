import type { Request, Response } from 'express';
import { pipeline } from 'node:stream/promises';
import type { Services } from '../../container';
import type { AttachmentService } from '../../services/attachment.service';
import type { Actor } from '../../services/order.service';
import { getAuth } from '../middleware/auth';
import { parseIdParam } from '../middleware/validation';

/** RFC 6266 / 5987 Content-Disposition with an ASCII fallback. */
function contentDisposition(type: 'inline' | 'attachment', fileName: string): string {
  const ascii = fileName.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return `${type}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

/** Streams a private reference image after the service checked that `viewer` may read it. */
export async function sendAttachment(req: Request, res: Response, attachments: AttachmentService, viewer: Actor) {
  const { attachment, file } = await attachments.open(parseIdParam(req), viewer);
  const asDownload = req.query.download === '1';
  res.setHeader('Content-Type', attachment.mimeType);
  res.setHeader('Content-Disposition', contentDisposition(asDownload ? 'attachment' : 'inline', attachment.originalName));
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'private, max-age=300');
  if (file.size !== undefined) res.setHeader('Content-Length', String(file.size));
  await pipeline(file.stream, res);
}

export function createAttachmentController({ attachments }: Services) {
  return {
    async download(req: Request, res: Response) {
      const { user } = getAuth(req);
      await sendAttachment(req, res, attachments, { id: user.id, role: user.role });
    },
  };
}
