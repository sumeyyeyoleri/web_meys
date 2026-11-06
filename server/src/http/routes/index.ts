import { Router, type RequestHandler } from 'express';
import type { Container } from '../../container';
import { createAttachmentController } from '../controllers/attachment.controller';
import { createAuthController } from '../controllers/auth.controller';
import { createNotificationController } from '../controllers/notification.controller';
import { createOrderController } from '../controllers/order.controller';
import { createPublicController } from '../controllers/public.controller';
import { createTrackingController } from '../controllers/tracking.controller';
import { requireAdmin } from '../middleware/auth';
import type { RateLimitName } from '../middleware/rate-limit';
import { requireTrackingToken } from '../middleware/tracking';
import { orderUpload } from '../middleware/upload';
import { createAdminRouter } from './admin';

export function createApiRouter(container: Container, limiters: Record<RateLimitName, RequestHandler>): Router {
  const router = Router();
  const publicCtrl = createPublicController(container.services);
  const auth = createAuthController(container);
  const orders = createOrderController(container);
  const attachments = createAttachmentController(container.services);
  const notifications = createNotificationController(container.services);
  const tracking = createTrackingController(container.services);
  const tracked = [limiters.tracking, requireTrackingToken(container.services.tracking)];

  // Public content
  router.get('/site', publicCtrl.site);
  router.get('/categories', publicCtrl.categories);
  router.get('/portfolio', publicCtrl.portfolio);
  router.get('/portfolio/:id', publicCtrl.portfolioItem);

  // Authentication (the artist's account only; customers have none)
  router.get('/auth/csrf', auth.csrf);
  router.get('/auth/me', auth.me);
  router.post('/auth/login', limiters.login, auth.login);
  router.post('/auth/logout', auth.logout);
  router.post('/auth/forgot-password', limiters.forgotPassword, auth.forgotPassword);
  router.post('/auth/reset-password', limiters.resetPassword, auth.resetPassword);
  router.post('/auth/change-password', requireAdmin, auth.changePassword);

  // Orders: anyone submits, no account
  router.post('/orders', limiters.orderSubmit, orderUpload, orders.create);

  // The customer's order through the private tracking link (token in the X-Order-Token header)
  router.get('/track/order', tracked, tracking.order);
  router.post('/track/status', tracked, tracking.changeStatus);
  router.get('/track/messages', tracked, tracking.listMessages);
  router.post('/track/messages', tracked, limiters.message, tracking.sendMessage);
  router.post('/track/messages/read', tracked, tracking.markMessagesRead);
  router.post('/track/messages/:messageId/translate', tracked, limiters.translation, tracking.translateMessage);
  router.get('/track/attachments/:id', tracked, tracking.attachment);

  // Reference images for the artist (customers use /track/attachments/:id)
  router.get('/attachments/:id', requireAdmin, attachments.download);

  // The artist's in-app notifications
  router.get('/notifications', requireAdmin, notifications.list);
  router.get('/notifications/unread-count', requireAdmin, notifications.unreadCount);
  router.post('/notifications/read-all', requireAdmin, notifications.markAllRead);
  router.post('/notifications/:id/read', requireAdmin, notifications.markRead);

  // Administration
  router.patch('/admin/me', requireAdmin, auth.updatePreferences);
  router.put('/admin/account/profile', requireAdmin, auth.updateProfile);
  router.post('/admin/account/email', requireAdmin, auth.changeEmail);
  router.use('/admin', createAdminRouter(container.services, limiters.translation));

  return router;
}
