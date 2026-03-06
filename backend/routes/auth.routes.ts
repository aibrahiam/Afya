// Authentication Routes

import { Router, type IRouter, type Request, type Response } from 'express';
import { AuthService } from '../services/authService.js';
import { AuthMiddleware } from '../middleware/auth.js';
import { CasesService } from '../services/casesService.js';
import { apiResponse } from '../utils/apiResponse.js';
import { logger } from '../utils/logger.js';

const router: IRouter = Router();

// POST /api/v1/auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json(apiResponse.error('VALIDATION_ERROR', 'Email and password are required'));
    }

    const result = await AuthService.login({ email, password });
    
    return res.json(apiResponse.success(result));
  } catch (error: any) {
    logger.error({ err: error }, 'Login error');
    return res.status(401).json(apiResponse.error('UNAUTHORIZED', error.message));
  }
});

// POST /api/v1/auth/refresh
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json(apiResponse.error('VALIDATION_ERROR', 'Refresh token is required'));
    }

    const result = await AuthService.refreshAccessToken(refreshToken);
    
    return res.json(apiResponse.success(result));
  } catch (error: any) {
    logger.error({ err: error }, 'Token refresh error');
    return res.status(401).json(apiResponse.error('UNAUTHORIZED', error.message));
  }
});

// GET /api/v1/auth/me
router.get('/me', AuthMiddleware.authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json(apiResponse.error('UNAUTHORIZED', 'User not found'));
    }

    const userProfile = await AuthService.getUserProfile(req.user.userId);
    const caseStats = await CasesService.getCaseStatistics(req.user.userId);

    return res.json(apiResponse.success({
      ...userProfile,
      sessionStartedAt: new Date().toISOString(),
      casesReviewedToday: caseStats.casesToday,
      totalCases: caseStats.totalCases,
      pendingCases: caseStats.pendingCases,
    }));
  } catch (error: any) {
    logger.error({ err: error }, 'Get profile error');
    return res.status(500).json(apiResponse.error('INTERNAL_ERROR', 'Failed to get user profile'));
  }
});

// POST /api/v1/auth/logout
router.post('/logout', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (refreshToken) {
      await AuthService.logout(refreshToken);
    }

    return res.json(apiResponse.success({ message: 'Logged out successfully.' }));
  } catch (error: any) {
    logger.error({ err: error }, 'Logout error');
    return res.status(500).json(apiResponse.error('INTERNAL_ERROR', 'Logout failed'));
  }
});

// POST /api/v1/auth/register (Admin only)
router.post('/register', AuthMiddleware.authenticate, AuthMiddleware.requireAdmin, async (req: Request, res: Response) => {
  try {
    const { name, email, password, role, department, licenseNumber } = req.body;

    // Validate input
    if (!name || !email || !password || !role) {
      return res.status(400).json(apiResponse.error('VALIDATION_ERROR', 'Name, email, password, and role are required'));
    }

    const validRoles = ['ADMIN', 'RADIOLOGIST', 'TECHNOLOGIST', 'REFERRING_PHYSICIAN'];
    if (!validRoles.includes(role)) {
      return res.status(400).json(apiResponse.error('VALIDATION_ERROR', 'Invalid role'));
    }

    const newUser = await AuthService.createUser({
      name,
      email,
      password,
      role,
      department,
      licenseNumber,
    });

    return res.status(201).json(apiResponse.success(newUser));
  } catch (error: any) {
    logger.error({ err: error }, 'User registration error');
    if (error.message.includes('already exists')) {
      return res.status(409).json(apiResponse.error('CONFLICT', error.message));
    } else {
      return res.status(500).json(apiResponse.error('INTERNAL_ERROR', 'Failed to create user'));
    }
  }
});

export default router;
