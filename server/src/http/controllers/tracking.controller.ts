import type { Request, Response } from 'express';
import { customerStatusActionSchema, isLocale, localeFromDb, messageBodySchema, type Locale } from '@painter/shared';
import type { Services } from '../../container';
import type { OrderWithDetail } from '../../repositories/order.repository';
import { customerActor } from '../../services/order.service';
import { toMessageDto } from '../mappers/message.mapper';
import { toOrderDetailDto } from '../mappers/order.mapper';
import { getTrackedOrderId } from '../middleware/tracking';
import { parseBody } from '../middleware/validation';
import { sendAttachment } from './attachment.controller';

/** `?locale=` (the site language) or the order's communication language. */
function trackingLocale(req: Request, order: OrderWithDetail): Locale {
  const requested = req.query.locale;
  return isLocale(requested) ? requested : localeFromDb(order.communicationLocale);
}

/**
 * The customer's view of an order through the private tracking link: order detail, status
 * actions and the message thread, authorised by the token (customers have no account).
 */
export function createTrackingController({ orders, messages, attachments, content }: Services) {
  const actorOf = (req: Request) => customerActor(getTrackedOrderId(req));

  return {
    async order(req: Request, res: Response) {
      const actor = actorOf(req);
      const { order, unreadMessages } = await orders.getForViewer(getTrackedOrderId(req), actor);
      res.json(toOrderDetailDto(order, trackingLocale(req, order), 'CUSTOMER', unreadMessages, { viaTracking: true }));
    },

    async changeStatus(req: Request, res: Response) {
      const { status } = parseBody(customerStatusActionSchema, req);
      const order = await orders.changeStatus({ orderId: getTrackedOrderId(req), actor: actorOf(req), status });
      res.json(toOrderDetailDto(order, trackingLocale(req, order), 'CUSTOMER', 0, { viaTracking: true }));
    },

    async listMessages(req: Request, res: Response) {
      const [thread, settings] = await Promise.all([
        messages.list(getTrackedOrderId(req), actorOf(req)),
        content.requireSettings(),
      ]);
      const names = { businessName: settings.businessName, contactName: thread.order.contactName };
      res.json(thread.messages.map((m) => toMessageDto(m, null, names)));
    },

    async sendMessage(req: Request, res: Response) {
      const { body } = parseBody(messageBodySchema, req);
      const [{ order, message }, settings] = await Promise.all([
        messages.send(getTrackedOrderId(req), actorOf(req), body),
        content.requireSettings(),
      ]);
      res.status(201).json(toMessageDto(message, null, { businessName: settings.businessName, contactName: order.contactName }));
    },

    async markMessagesRead(req: Request, res: Response) {
      await messages.markRead(getTrackedOrderId(req), actorOf(req));
      res.status(204).end();
    },

    async attachment(req: Request, res: Response) {
      await sendAttachment(req, res, attachments, actorOf(req));
    },
  };
}
