import { Router } from 'express';
import type { Services } from '../../container';
import { createAdminContentController } from '../controllers/admin-content.controller';
import { createAdminOrderController } from '../controllers/admin-order.controller';
import { requireRole } from '../middleware/auth';
import { mediaUpload } from '../middleware/media-upload';

/** Everything under /api/admin requires an administrator session. */
export function createAdminRouter(services: Services): Router {
  const router = Router();
  const orders = createAdminOrderController(services);
  const content = createAdminContentController(services);

  router.use(requireRole('ADMIN'));

  router.get('/stats', orders.stats);

  router.get('/orders', orders.list);
  router.get('/orders/:id', orders.detail);
  router.put('/orders/:id', orders.update);
  router.post('/orders/:id/status', orders.changeStatus);
  router.post('/orders/:id/archive', orders.archive);
  router.get('/orders/:id/messages', orders.listMessages);
  router.post('/orders/:id/messages', orders.sendMessage);
  router.post('/orders/:id/messages/read', orders.markMessagesRead);
  router.get('/orders/:id/notes', orders.listNotes);
  router.post('/orders/:id/notes', orders.addNote);

  router.get('/portfolio', content.listPortfolio);
  router.post('/portfolio', content.createPortfolio);
  router.post('/portfolio/reorder', content.reorderPortfolio);
  router.put('/portfolio/:id', content.updatePortfolio);
  router.post('/portfolio/:id/featured', content.setPortfolioFeatured);
  router.delete('/portfolio/:id', content.deletePortfolio);

  router.get('/services', content.listServices);
  router.post('/services', content.createService);
  router.post('/services/reorder', content.reorderServices);
  router.put('/services/:id', content.updateService);
  router.post('/services/:id/active', content.setServiceActive);
  router.delete('/services/:id', content.deleteService);

  router.get('/content', content.listContent);
  router.put('/content', content.updateContent);

  router.get('/settings', content.getSettings);
  router.put('/settings', content.updateSettings);

  router.post('/media', mediaUpload, content.uploadMedia);

  return router;
}
