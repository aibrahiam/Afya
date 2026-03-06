// Cases Routes

import { Router, type IRouter, type Request, type Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { CasesService } from '../services/casesService.js';
import { AIAnalysisService } from '../services/aiAnalysisService.js';
import { AuthMiddleware } from '../middleware/auth.js';
import { apiResponse } from '../utils/apiResponse.js';
import { logger } from '../utils/logger.js';
import { CaseStatus, CasePriority } from '@prisma/client';

const router: IRouter = Router();

// Configure multer for DICOM image uploads
const dicomDir = path.resolve(process.cwd(), '..', 'dicom');
if (!fs.existsSync(dicomDir)) {
  fs.mkdirSync(dicomDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, dicomDir);
  },
  filename: (req, file, cb) => {
    // Prefix with patientId so files are identifiable per case.
    // req.body is populated for text fields that appear before the file in the
    // multipart stream (standard form order: fields first, then file).
    const rawId = (req.body?.patientId || 'case').toString();
    const safeId = rawId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
    const timestamp = Date.now();
    const random = Math.round(Math.random() * 1e6);
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `${safeId}-${timestamp}-${random}${ext}`);
  },
});

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/dicom',
  'application/octet-stream',
];

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Allowed: JPEG, PNG, WebP, DICOM'));
    }
  },
});

// Apply authentication to all routes
router.use(AuthMiddleware.authenticate);

// POST /api/v1/cases - Create a new case with optional image
router.post('/', upload.single('image'), async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json(apiResponse.error('UNAUTHORIZED', 'User not authenticated'));
    }

    const { patientName, patientId, age, gender, scanType, bodyPart, clinicalHistory, referringPhysician, priority } = req.body;

    // Validate required fields
    if (!patientName || !patientId || !age || !gender || !scanType || !bodyPart) {
      return res.status(400).json(apiResponse.error('VALIDATION_ERROR', 'Missing required fields: patientName, patientId, age, gender, scanType, bodyPart'));
    }

    const parsedAge = parseInt(age, 10);
    if (isNaN(parsedAge) || parsedAge < 0 || parsedAge > 200) {
      return res.status(400).json(apiResponse.error('VALIDATION_ERROR', 'Invalid age'));
    }

    const casePriority = priority && Object.values(CasePriority).includes(priority as CasePriority)
      ? (priority as CasePriority)
      : CasePriority.NORMAL;

    let imageData: { filename: string; storageUrl: string; mimeType: string; fileSize: number } | undefined;
    if (req.file) {
      imageData = {
        filename: req.file.originalname,
        storageUrl: `/dicom/${req.file.filename}`,
        mimeType: req.file.mimetype,
        fileSize: req.file.size,
      };
    }

    const newCase = await CasesService.createCase({
      patientName,
      patientId,
      age: parsedAge,
      gender,
      scanType,
      bodyPart,
      clinicalHistory: clinicalHistory || undefined,
      referringPhysician: referringPhysician || undefined,
      priority: casePriority,
      createdById: req.user.userId,
      image: imageData,
    });

    // Trigger AI analysis asynchronously (does not block response)
    if (req.file) {
      const imagePath = req.file.path;
      setImmediate(async () => {
        try {
          const imageBuffer = fs.readFileSync(imagePath);
          await AIAnalysisService.analyzeWithRetry(
            {
              id: newCase.id,
              patientId: newCase.patientId,
              patientName: newCase.patientName,
              age: newCase.age,
              gender: newCase.gender,
              clinicalHistory: newCase.clinicalHistory ?? undefined,
              scanType: newCase.scanType,
              bodyPart: newCase.bodyPart,
            },
            imageBuffer
          );
        } catch (err) {
          logger.error(`Background AI analysis failed for case ${newCase.id}:`, err);
        }
      });
    }

    return res.status(201).json(apiResponse.success(newCase));
  } catch (error: any) {
    logger.error({ err: error }, 'Create case error');
    return res.status(500).json(apiResponse.error('INTERNAL_ERROR', 'Failed to create case'));
  }
});

// GET /api/v1/cases/stats - Must be before :caseId route
router.get('/stats', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json(apiResponse.error('UNAUTHORIZED', 'User not authenticated'));
    }

    // Get stats for current user unless they're admin
    const userId = req.user.role === 'ADMIN' ? undefined : req.user.userId;
    const stats = await CasesService.getCaseStatistics(userId);

    return res.json(apiResponse.success(stats));
  } catch (error: any) {
    logger.error({ err: error }, 'Get case statistics error');
    return res.status(500).json(apiResponse.error('INTERNAL_ERROR', 'Failed to get statistics'));
  }
});

// GET /api/v1/cases
router.get('/', async (req: Request, res: Response) => {
  try {
    const { 
      status, 
      priority, 
      scanType, 
      bodyPart,
      assignedToId,
      dateFrom,
      dateTo,
      page = 1, 
      limit = 20 
    } = req.query;

    // Build filters
    const filters: any = {};
    if (status && Object.values(CaseStatus).includes(status as CaseStatus)) {
      filters.status = status as CaseStatus;
    }
    if (priority && Object.values(CasePriority).includes(priority as CasePriority)) {
      filters.priority = priority as CasePriority;
    }
    if (scanType) filters.scanType = scanType as string;
    if (bodyPart) filters.bodyPart = bodyPart as string;
    if (assignedToId) filters.assignedToId = assignedToId as string;
    if (dateFrom) filters.dateFrom = new Date(dateFrom as string);
    if (dateTo) filters.dateTo = new Date(dateTo as string);

    const result = await CasesService.getCases(
      filters,
      { 
        page: Number(page), 
        limit: Math.min(Number(limit), 100) // Max 100 per page
      }
    );

    return res.json(apiResponse.paginated(result.data, result.currentPage, Number(limit), result.totalCount));
  } catch (error: any) {
    logger.error({ err: error }, 'Get cases error');
    return res.status(500).json(apiResponse.error('INTERNAL_ERROR', 'Failed to get cases'));
  }
});

// GET /api/v1/cases/:caseId
router.get('/:caseId', async (req: Request, res: Response) => {
  try {
    const { caseId } = req.params;
    const case_ = await CasesService.getCaseById(caseId);

    if (!case_) {
      return res.status(404).json(apiResponse.error('NOT_FOUND', 'Case not found'));
    }

    return res.json(apiResponse.success(case_));
  } catch (error: any) {
    logger.error({ err: error }, 'Get case error');
    return res.status(500).json(apiResponse.error('INTERNAL_ERROR', 'Failed to get case'));
  }
});

// GET /api/v1/cases/:caseId/analysis
// This endpoint is polled every 3 s while Gemini processes.  We must disable
// HTTP caching (ETag / If-None-Match) so the browser never serves a stale
// 304 "not modified" response — the analysis body changes once Gemini finishes.
router.get('/:caseId/analysis', (_req: Request, res: Response, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  // Remove ETag so Express never sends a 304 Not Modified for polling responses
  res.removeHeader('ETag');
  next();
}, async (req: Request, res: Response) => {
  try {
    const { caseId } = req.params;
    const analysis = await CasesService.getCaseAnalysis(caseId);
    // Return null data (not 404) when no analysis exists yet — frontend polls for it
    return res.json(apiResponse.success(analysis));
  } catch (error: any) {
    logger.error({ err: error }, 'Get case analysis error');
    return res.status(500).json(apiResponse.error('INTERNAL_ERROR', 'Failed to get case analysis'));
  }
});

// PATCH /api/v1/cases/:caseId/status
router.patch('/:caseId/status', AuthMiddleware.requireRadiologist, async (req: Request, res: Response) => {
  try {
    const { caseId } = req.params;
    const { status } = req.body;

    if (!Object.values(CaseStatus).includes(status)) {
      return res.status(400).json(apiResponse.error('VALIDATION_ERROR', 'Invalid status'));
    }

    if (!req.user) {
      return res.status(401).json(apiResponse.error('UNAUTHORIZED', 'User not authenticated'));
    }

    const updatedCase = await CasesService.updateCaseStatus(caseId, status as CaseStatus, req.user.userId);

    return res.json(apiResponse.success({
      id: updatedCase.id,
      status: updatedCase.status,
      updatedAt: updatedCase.updatedAt,
    }));
  } catch (error: any) {
    logger.error({ err: error }, 'Update case status error');
    return res.status(500).json(apiResponse.error('INTERNAL_ERROR', 'Failed to update case status'));
  }
});

// PATCH /api/v1/cases/:caseId/assign
router.patch('/:caseId/assign', AuthMiddleware.requireAdmin, async (req: Request, res: Response) => {
  try {
    const { caseId } = req.params;
    const { radiologistId } = req.body;

    if (!radiologistId) {
      return res.status(400).json(apiResponse.error('VALIDATION_ERROR', 'Radiologist ID is required'));
    }

    const updatedCase = await CasesService.assignCase(caseId, radiologistId);

    return res.json(apiResponse.success({
      id: updatedCase.id,
      assignedToId: updatedCase.assignedToId,
      updatedAt: updatedCase.updatedAt,
    }));
  } catch (error: any) {
    logger.error({ err: error }, 'Assign case error');
    return res.status(500).json(apiResponse.error('INTERNAL_ERROR', 'Failed to assign case'));
  }
});

// POST /api/v1/cases/:caseId/analysis/feedback
router.post('/:caseId/analysis/feedback', AuthMiddleware.requireRadiologist, async (req: Request, res: Response) => {
  try {
    const { caseId } = req.params;
    const { rating, correctionText, findingId, correctedSeverity } = req.body;

    if (!rating || !['accurate', 'needs_review', 'incorrect'].includes(rating)) {
      return res.status(400).json(apiResponse.error('VALIDATION_ERROR', 'Valid rating is required'));
    }

    if (!req.user) {
      return res.status(401).json(apiResponse.error('UNAUTHORIZED', 'User not authenticated'));
    }

    // First get the analysis ID for this case
    const analysis = await CasesService.getCaseAnalysis(caseId);
    if (!analysis) {
      return res.status(404).json(apiResponse.error('NOT_FOUND', 'No analysis found for this case'));
    }
    
    const feedback = await CasesService.submitAIFeedback(
      analysis.id,
      req.user.userId,
      {
        rating,
        correctionText,
        findingId,
        correctedSeverity,
      }
    );

    return res.status(201).json(apiResponse.success(feedback));
  } catch (error: any) {
    logger.error({ err: error }, 'Submit AI feedback error');
    return res.status(500).json(apiResponse.error('INTERNAL_ERROR', 'Failed to submit feedback'));
  }
});

// POST /api/v1/cases/:caseId/analyze - Trigger (or re-trigger) AI analysis on demand
router.post('/:caseId/analyze', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json(apiResponse.error('UNAUTHORIZED', 'User not authenticated'));
    }

    const { caseId } = req.params;
    const force = req.query.force === 'true';

    const case_ = await CasesService.getCaseById(caseId);
    if (!case_) {
      return res.status(404).json(apiResponse.error('NOT_FOUND', 'Case not found'));
    }

    // Return cached result if a COMPLETED analysis already exists (unless force=true)
    if (!force) {
      const existing = await CasesService.getCaseAnalysis(caseId);
      if (existing && existing.status === 'COMPLETED') {
        logger.info(`Returning cached AI analysis for case ${caseId}`);
        return res.json(apiResponse.success({ message: 'AI analysis already completed', caseId, cached: true }));
      }
    }

    // Find the primary image for this case
    const imageRecord = case_.images?.[0];
    if (!imageRecord) {
      return res.status(422).json(
        apiResponse.error('UNPROCESSABLE', 'No image found for this case — upload an image first')
      );
    }

    // Resolve file path from storageUrl (e.g. /dicom/filename.jpg → dicom/filename.jpg)
    const relPath = imageRecord.storageUrl.replace(/^\//, '');
    const imagePath = path.resolve(process.cwd(), '..', relPath);

    if (!fs.existsSync(imagePath)) {
      return res.status(422).json(
        apiResponse.error('UNPROCESSABLE', 'Image file not found on disk. Cannot run analysis.')
      );
    }

    // Schedule background analysis, then ack immediately
    setImmediate(async () => {
      try {
        const imageBuffer = fs.readFileSync(imagePath);
        await AIAnalysisService.analyzeWithRetry(
          {
            id: case_.id,
            patientId: case_.patientId,
            patientName: case_.patientName,
            age: case_.age,
            gender: case_.gender,
            clinicalHistory: case_.clinicalHistory ?? undefined,
            scanType: case_.scanType,
            bodyPart: case_.bodyPart,
          },
          imageBuffer
        );
      } catch (err) {
        logger.error({ err }, `On-demand AI analysis failed for case ${caseId}`);
      }
    });

    return res.json(apiResponse.success({ message: 'AI analysis started', caseId }));
  } catch (error: any) {
    logger.error({ err: error }, 'Trigger analysis error');
    return res.status(500).json(apiResponse.error('INTERNAL_ERROR', 'Failed to start analysis'));
  }
});

// PATCH /api/v1/cases/:caseId - Update editable case fields
router.patch('/:caseId', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json(apiResponse.error('UNAUTHORIZED', 'User not authenticated'));
    }

    const { caseId } = req.params;
    const { patientName, age, gender, scanType, bodyPart, clinicalHistory, referringPhysician, priority } = req.body;

    const updateData: any = {};
    if (patientName !== undefined) updateData.patientName = patientName;
    if (age !== undefined) {
      const parsed = parseInt(age, 10);
      if (isNaN(parsed) || parsed < 0 || parsed > 200) {
        return res.status(400).json(apiResponse.error('VALIDATION_ERROR', 'Invalid age'));
      }
      updateData.age = parsed;
    }
    if (gender !== undefined) updateData.gender = gender;
    if (scanType !== undefined) updateData.scanType = scanType;
    if (bodyPart !== undefined) updateData.bodyPart = bodyPart;
    if (clinicalHistory !== undefined) updateData.clinicalHistory = clinicalHistory;
    if (referringPhysician !== undefined) updateData.referringPhysician = referringPhysician;
    if (priority !== undefined) {
      if (!Object.values(CasePriority).includes(priority as CasePriority)) {
        return res.status(400).json(apiResponse.error('VALIDATION_ERROR', 'Invalid priority'));
      }
      updateData.priority = priority as CasePriority;
    }

    const updatedCase = await CasesService.updateCase(caseId, updateData);
    return res.json(apiResponse.success(updatedCase));
  } catch (error: any) {
    logger.error({ err: error }, 'Update case error');
    return res.status(500).json(apiResponse.error('INTERNAL_ERROR', 'Failed to update case'));
  }
});

// DELETE /api/v1/cases/:caseId - Soft-delete a case
router.delete('/:caseId', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json(apiResponse.error('UNAUTHORIZED', 'User not authenticated'));
    }

    const { caseId } = req.params;
    const existing = await CasesService.getCaseById(caseId);
    if (!existing) {
      return res.status(404).json(apiResponse.error('NOT_FOUND', 'Case not found'));
    }

    await CasesService.deleteCase(caseId);
    return res.json(apiResponse.success({ message: 'Case deleted successfully' }));
  } catch (error: any) {
    logger.error({ err: error }, 'Delete case error');
    return res.status(500).json(apiResponse.error('INTERNAL_ERROR', 'Failed to delete case'));
  }
});

export default router;
