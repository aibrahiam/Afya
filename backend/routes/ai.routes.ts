// AI Analysis Routes

import { Router, Request, Response, IRouter } from 'express';
import multer from 'multer';
import { AuthMiddleware } from '../middleware/auth.js';
import { JobQueueService } from '../services/jobQueueService.js';
import { apiResponse } from '../utils/apiResponse.js';
import { logger } from '../utils/logger.js';
import { body, param, validationResult } from 'express-validator';

const router: IRouter = Router();

// Configure multer for medical image uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '52428800'), // 50MB default
    files: parseInt(process.env.MAX_FILES_PER_REQUEST || '5'),
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = process.env.ALLOWED_FILE_TYPES?.split(',') || [
      'image/jpeg',
      'image/png',
      'image/tiff',
      'application/dicom'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
    }
  },
});

// Validation rules
const submitAnalysisValidation = [
  body('caseId').isUUID().withMessage('Case ID must be a valid UUID'),
  body('patientId').isString().isLength({ min: 1 }).withMessage('Patient ID is required'),
  body('patientName').isString().isLength({ min: 1 }).withMessage('Patient name is required'),
  body('age').isInt({ min: 0, max: 150 }).withMessage('Age must be between 0 and 150'),
  body('gender').isIn(['male', 'female', 'other']).withMessage('Gender must be male, female, or other'),
  body('scanType').isString().isLength({ min: 1 }).withMessage('Scan type is required'),
  body('bodyPart').isString().isLength({ min: 1 }).withMessage('Body part is required'),
  body('clinicalHistory').optional().isString(),
  body('priority').optional().isIn(['normal', 'urgent']).withMessage('Priority must be normal or urgent'),
];

const jobIdValidation = [
  param('jobId').isString().isLength({ min: 1 }).withMessage('Job ID is required'),
];

// ===== ROUTES =====

// POST /api/v1/ai/analyze - Submit case for AI analysis
router.post('/analyze', 
  AuthMiddleware.authenticate,
  upload.single('image'),
  submitAnalysisValidation,
  async (req: Request, res: Response): Promise<any> => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json(apiResponse.error('VALIDATION_ERROR', 'Validation failed', errors.array()));
      }

      // Check if image file is present
      if (!req.file) {
        return res.status(400).json(apiResponse.error('VALIDATION_ERROR', 'Medical image file is required'));
      }

      const {
        caseId,
        patientId,
        patientName,
        age,
        gender,
        scanType,
        bodyPart,
        clinicalHistory,
        priority = 'normal'
      } = req.body;

      const userId = req.user?.userId || '';

      // Prepare case data
      const caseData = {
        id: caseId,
        patientId,
        patientName,
        age: parseInt(age),
        gender,
        scanType,
        bodyPart,
        clinicalHistory,
      };

      // Submit job to queue
      const jobId = await JobQueueService.submitAnalysisJob(
        caseData,
        req.file.buffer,
        priority,
        userId
      );

      logger.info(`AI analysis job submitted: ${jobId} by user ${userId}`);

      return res.json(apiResponse.success({
        message: 'AI analysis job submitted successfully',
        jobId,
        caseId,
        status: 'QUEUED',
        priority,
        submittedAt: new Date().toISOString(),
      }));

    } catch (error: any) {
      logger.error({ err: error }, 'Failed to submit AI analysis');
      return res.status(500).json(apiResponse.error('INTERNAL_SERVER_ERROR', 'Failed to submit analysis job', [error.message]));
    }
  }
);

// GET /api/v1/ai/jobs/:jobId/status - Get job status
router.get('/jobs/:jobId/status',
  AuthMiddleware.authenticate,
  jobIdValidation,
  async (req: Request, res: Response): Promise<any> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json(apiResponse.error('VALIDATION_ERROR', 'Validation failed', errors.array()));
      }

      const { jobId } = req.params;

      const status = await JobQueueService.getJobStatus(jobId);
      if (!status) {
        return res.status(404).json(apiResponse.error('NOT_FOUND', 'Job not found'));
      }

      return res.json(apiResponse.success(status));

    } catch (error: any) {
      logger.error(`Failed to get job status ${req.params.jobId}:`, error);
      return res.status(500).json(apiResponse.error('INTERNAL_SERVER_ERROR', 'Failed to retrieve job status', [error.message]));
    }
  }
);

// DELETE /api/v1/ai/jobs/:jobId/cancel - Cancel job
router.delete('/jobs/:jobId/cancel',
  AuthMiddleware.authenticate,
  jobIdValidation,
  async (req: Request, res: Response): Promise<any> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json(apiResponse.error('VALIDATION_ERROR', 'Validation failed', errors.array()));
      }

      const { jobId } = req.params;

      const cancelled = await JobQueueService.cancelJob(jobId);
      if (!cancelled) {
        return res.status(404).json(apiResponse.error('NOT_FOUND', 'Job not found or cannot be cancelled'));
      }

      logger.info(`Job cancelled: ${jobId} by user ${req.user?.userId}`);

      return res.json(apiResponse.success({
        message: 'Job cancelled successfully',
        jobId,
        status: 'CANCELLED',
        cancelledAt: new Date().toISOString(),
      }));

    } catch (error: any) {
      logger.error(`Failed to cancel job ${req.params.jobId}:`, error);
      return res.status(500).json(apiResponse.error('INTERNAL_SERVER_ERROR', 'Failed to cancel job', [error.message]));
    }
  }
);

// GET /api/v1/ai/queue/stats - Get queue statistics (admin)
router.get('/queue/stats',
  AuthMiddleware.authenticate,
  async (req: Request, res: Response): Promise<any> => {
    try {
      // Check if user has admin role
      if (req.user?.role !== 'ADMIN') {
        return res.status(403).json(apiResponse.error('FORBIDDEN', 'Admin access required'));
      }

      const stats = await JobQueueService.getQueueStats();

      return res.json(apiResponse.success(stats));

    } catch (error: any) {
      logger.error({ err: error }, 'Failed to get queue stats');
      return res.status(500).json(apiResponse.error('INTERNAL_SERVER_ERROR', 'Failed to retrieve queue statistics', [error.message]));
    }
  }
);

// GET /api/v1/ai/queue/active - Get active jobs (admin)
router.get('/queue/active',
  AuthMiddleware.authenticate,
  async (req: Request, res: Response): Promise<any> => {
    try {
      // Check if user has admin role
      if (req.user?.role !== 'ADMIN') {
        return res.status(403).json(apiResponse.error('FORBIDDEN', 'Admin access required'));
      }

      const activeJobs = await JobQueueService.getActiveJobs();

      return res.json(apiResponse.success({
        message: 'Active jobs retrieved',
        jobs: activeJobs,
        count: activeJobs.length,
      }));

    } catch (error: any) {
      logger.error({ err: error }, 'Failed to get active jobs');
      return res.status(500).json(apiResponse.error('INTERNAL_SERVER_ERROR', 'Failed to retrieve active jobs', [error.message]));
    }
  }
);

// GET /api/v1/ai/queue/failed - Get failed jobs (admin)
router.get('/queue/failed',
  AuthMiddleware.authenticate,
  async (req: Request, res: Response): Promise<any> => {
    try {
      // Check if user has admin role
      if (req.user?.role !== 'ADMIN') {
        return res.status(403).json(apiResponse.error('FORBIDDEN', 'Admin access required'));
      }

      const limit = parseInt(req.query.limit as string) || 50;
      const failedJobs = await JobQueueService.getFailedJobs(limit);

      return res.json(apiResponse.success({
        message: 'Failed jobs retrieved',
        jobs: failedJobs,
        count: failedJobs.length,
        limit,
      }));

    } catch (error: any) {
      logger.error({ err: error }, 'Failed to get failed jobs');
      return res.status(500).json(apiResponse.error('INTERNAL_SERVER_ERROR', 'Failed to retrieve failed jobs', [error.message]));
    }
  }
);

// POST /api/v1/ai/jobs/:jobId/retry - Retry failed job (admin)
router.post('/jobs/:jobId/retry',
  AuthMiddleware.authenticate,
  jobIdValidation,
  async (req: Request, res: Response): Promise<any> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json(apiResponse.error('VALIDATION_ERROR', 'Validation failed', errors.array()));
      }

      // Check if user has admin role
      if (req.user?.role !== 'ADMIN') {
        return res.status(403).json(apiResponse.error('FORBIDDEN', 'Admin access required'));
      }

      const { jobId } = req.params;

      const retried = await JobQueueService.retryFailedJob(jobId);
      if (!retried) {
        return res.status(404).json(apiResponse.error('NOT_FOUND', 'Job not found or cannot be retried'));
      }

      logger.info(`Job retried: ${jobId} by admin ${req.user?.userId}`);

      return res.json(apiResponse.success({
        message: 'Job retried successfully',
        jobId,
        retriedAt: new Date().toISOString(),
      }));

    } catch (error: any) {
      logger.error(`Failed to retry job ${req.params.jobId}:`, error);
      return res.status(500).json(apiResponse.error('INTERNAL_SERVER_ERROR', 'Failed to retry job', [error.message]));
    }
  }
);

// POST /api/v1/ai/queue/pause - Pause queue (admin)
router.post('/queue/pause',
  AuthMiddleware.authenticate,
  async (req: Request, res: Response): Promise<any> => {
    try {
      // Check if user has admin role
      if (req.user?.role !== 'ADMIN') {
        return res.status(403).json(apiResponse.error('FORBIDDEN', 'Admin access required'));
      }

      await JobQueueService.pauseQueue();

      logger.info(`Queue paused by admin ${req.user?.userId}`);

      return res.json(apiResponse.success({
        message: 'Queue paused successfully',
        status: 'PAUSED',
        pausedAt: new Date().toISOString(),
      }));

    } catch (error: any) {
      logger.error({ err: error }, 'Failed to pause queue');
      return res.status(500).json(apiResponse.error('INTERNAL_SERVER_ERROR', 'Failed to pause queue', [error.message]));
    }
  }
);

// POST /api/v1/ai/queue/resume - Resume queue (admin)
router.post('/queue/resume',
  AuthMiddleware.authenticate,
  async (req: Request, res: Response): Promise<any> => {
    try {
      // Check if user has admin role
      if (req.user?.role !== 'ADMIN') {
        return res.status(403).json(apiResponse.error('FORBIDDEN', 'Admin access required'));
      }

      await JobQueueService.resumeQueue();

      logger.info(`Queue resumed by admin ${req.user?.userId}`);

      return res.json(apiResponse.success({
        message: 'Queue resumed successfully',
        status: 'ACTIVE',
        resumedAt: new Date().toISOString(),
      }));

    } catch (error: any) {
      logger.error({ err: error }, 'Failed to resume queue');
      return res.status(500).json(apiResponse.error('INTERNAL_SERVER_ERROR', 'Failed to resume queue', [error.message]));
    }
  }
);

// GET /api/v1/ai/health - Health check for AI services
router.get('/health',
  async (_req: Request, res: Response): Promise<any> => {
    try {
      const health = {
        aiService: 'healthy',
        jobQueue: 'healthy',
        redis: 'healthy',
        geminiApi: 'healthy',
        timestamp: new Date().toISOString(),
      };

      // Check job queue health
      try {
        await JobQueueService.getQueueStats();
      } catch (error) {
        health.jobQueue = 'unhealthy';
        health.redis = 'unhealthy';
      }

      // Check if Gemini API key is configured
      if (!process.env.GEMINI_API_KEY) {
        health.geminiApi = 'not configured';
      }

      const overallStatus = Object.values(health).includes('unhealthy') ? 'unhealthy' : 'healthy';

      return res.json(apiResponse.success({
        message: `AI services health: ${overallStatus}`,
        health
      }));

    } catch (error: any) {
      logger.error({ err: error }, 'Health check failed');
      return res.status(500).json(apiResponse.error('INTERNAL_SERVER_ERROR', 'Health check failed', [error.message]));
    }
  }
);

export { router as aiRoutes };