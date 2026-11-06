import { Router, type RequestHandler } from 'express';
import type { Services } from '../../container';
import { createAdminContentController } from '../controllers/admin-content.controller';
import { createAdminOrderController } from '../controllers/admin-order.controller';
import { requireAdmin } from '../middleware/auth';
import { logoUpload, mediaUpload } from '../middleware/media-upload';

/** Everything under /api/admin requires an administrator session. */
export function createAdminRouter(services: Services, translationLimiter: RequestHandler): Router {
  const router = Router();
  const orders = createAdminOrderController(services);
  const content = createAdminContentController(services);

  router.use(requireAdmin);

  router.get('/stats', orders.stats);

  router.get('/orders', orders.list);
  router.get('/orders/:id', orders.detail);
  router.put('/orders/:id', orders.update);
  router.post('/orders/:id/status', orders.changeStatus);
  router.post('/orders/:id/archive', orders.archive);
  router.get('/orders/:id/messages', orders.listMessages);
  router.post('/orders/:id/messages', orders.sendMessage);
  router.post('/orders/:id/messages/read', orders.markMessagesRead);
  router.post('/orders/:id/messages/:messageId/translate', translationLimiter, orders.translateMessage);
  router.post('/orders/:id/tracking-link', orders.regenerateTrackingLink);
  router.get('/orders/:id/notes', orders.listNotes);
  router.post('/orders/:id/notes', orders.addNote);

  router.get('/portfolio', content.listPortfolio);
  router.post('/portfolio', content.createPortfolio);
  router.post('/portfolio/reorder', content.reorderPortfolio);
  router.put('/portfolio/:id', content.updatePortfolio);
  router.post('/portfolio/:id/featured', content.setPortfolioFeatured);
  router.post('/portfolio/:id/published', content.setPortfolioPublished);
  router.delete('/portfolio/:id', content.deletePortfolio);

  router.get('/categories', content.listCategories);
  router.post('/categories', content.createCategory);
  router.post('/categories/reorder', content.reorderCategories);
  router.put('/categories/:id', content.updateCategory);
  router.post('/categories/:id/visible', content.setCategoryVisible);
  router.delete('/categories/:id', content.deleteCategory);

  router.get('/content', content.listContent);
  router.put('/content', content.updateContent);

  router.get('/settings', content.getSettings);
  router.put('/settings', content.updateSettings);
  router.post('/settings/logo', logoUpload, content.uploadLogo);
  router.delete('/settings/logo', content.removeLogo);

  router.post('/media', mediaUpload, content.uploadMedia);

  return router;
}
