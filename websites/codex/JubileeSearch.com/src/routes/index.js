import { Router } from 'express';
import searchRoutes from './search.js';

const router = Router();

// API routes
router.use('/api/search', searchRoutes);

// Health check
router.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'JubileeSearch.com',
    timestamp: new Date().toISOString()
  });
});

export default router;
