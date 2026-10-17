import { Router, type RequestHandler } from 'express';
import type { Container } from '../../container';
import { createAttachmentController } from '../controllers/attachment.controller';
import { createAuthController } from '../controllers/auth.controller';
import { createNotificationController } from '../controllers/notification.controller';
import { createOrderController } from '../controllers/order.controller';
import { createPublicController } from '../controllers/public.controller';
import { createUserController } from '../controllers/user.controller';
import { requireAuth, requireRole } from '../middleware/auth';
import type { RateLimitName } from '../middleware/rate-limit';
import { orderUpload } from '../middleware/upload';
import { createAdminRouter } from './admin';

export function createApiRouter(container: Container, limiters: Record<RateLimitName, RequestHandler>): Router {
  const router = Router();
  const publicCtrl = createPublicController(container.services);
  const auth = createAuthController(container);
  const users = createUserController(container.services);
  const orders = createOrderController(container);
  const attachments = createAttachmentController(container.services);
  const notifications = createNotificationController(container.services);
  const customerOnly = requireRole('CUSTOMER');

  // Public content
  router.get('/site', publicCtrl.site);
  router.get('/services', publicCtrl.services);
  router.get('/portfolio', publicCtrl.portfolio);
  router.get('/portfolio/:id', publicCtrl.portfolioItem);

  // Authentication
  router.get('/auth/csrf', auth.csrf);
  router.get('/auth/me', auth.me);
  router.post('/auth/register', limiters.register, auth.register);
  router.post('/auth/login', limiters.login, auth.login);
  router.post('/auth/logout', auth.logout);
  router.post('/auth/forgot-password', limiters.forgotPassword, auth.forgotPassword);
  router.post('/auth/reset-password', limiters.resetPassword, auth.resetPassword);
  router.post('/auth/change-password', requireAuth, auth.changePassword);

  // Profile
  router.patch('/users/me', requireAuth, users.updateMe);

  // Customer orders (guests may submit; an account is created with the order)
  router.post('/orders', limiters.orderSubmit, orderUpload, orders.create);
  router.get('/orders', customerOnly, orders.list);
  router.get('/orders/:id', customerOnly, orders.detail);
  router.post('/orders/:id/status', customerOnly, orders.changeStatus);
  router.get('/orders/:id/messages', customerOnly, orders.listMessages);
  router.post('/orders/:id/messages', customerOnly, limiters.message, orders.sendMessage);
  router.post('/orders/:id/messages/read', customerOnly, orders.markMessagesRead);

  // Reference images (owner or admin)
  router.get('/attachments/:id', requireAuth, attachments.download);

  // In-app notifications
  router.get('/notifications', requireAuth, notifications.list);
  router.get('/notifications/unread-count', requireAuth, notifications.unreadCount);
  router.post('/notifications/read-all', requireAuth, notifications.markAllRead);
  router.post('/notifications/:id/read', requireAuth, notifications.markRead);

  // Administration
  router.use('/admin', createAdminRouter(container.services));

  return router;
}
