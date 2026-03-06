// API Routes Aggregator

import { Router, type IRouter } from 'express';
import authRoutes from './auth.routes.js';
import casesRoutes from './cases.routes.js';
import systemRoutes from './system.routes.js';
import { aiRoutes } from './ai.routes.js';

const router: IRouter = Router();

// Mount routes
router.use('/auth', authRoutes);
router.use('/cases', casesRoutes);
router.use('/system', systemRoutes);
router.use('/ai', aiRoutes);

// API Info endpoint
router.get('/', (_req, res) => {
  res.json({
    name: 'AfyaDX API',
    version: 'v1',
    documentation: '/api/v1/docs',
    endpoints: {
      auth: '/api/v1/auth',
      cases: '/api/v1/cases',
      system: '/api/v1/system',
      ai: '/api/v1/ai',
    },
  });
});

export default router;
