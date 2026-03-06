// System Routes

import { Router, type IRouter, type Request, type Response } from 'express';
import { apiResponse } from '../utils/apiResponse.js';

const router: IRouter = Router();

// GET /api/v1/system/health
router.get('/health', async (_req: Request, res: Response) => {
  res.json(apiResponse.success({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {
      api: 'operational',
      database: 'operational', // TODO: Check actual DB connection
      aiEngine: 'operational', // TODO: Check AI service
    },
  }));
});

// GET /api/v1/system/stats
router.get('/stats', async (_req: Request, res: Response) => {
  // TODO: Get real stats from database
  res.json(apiResponse.success({
    totalCases: 5,
    pendingCases: 2,
    urgentCases: 1,
    reviewedToday: 12,
    averageProcessingTime: 2.4,
    aiAccuracyRate: 0.94,
  }));
});

export default router;
