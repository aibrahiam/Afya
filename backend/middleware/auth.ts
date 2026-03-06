// Authentication Middleware

import { Request, Response, NextFunction } from 'express';
import { JWTService, TokenPayload } from '../utils/jwt.js';
import { apiResponse } from '../utils/apiResponse.js';
import { logger } from '../utils/logger.js';

// Extend Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

export class AuthMiddleware {
  // Authenticate JWT token
  static authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json(apiResponse.error('UNAUTHORIZED', 'Access token required'));
        return;
      }

      const token = authHeader.substring(7); // Remove "Bearer " prefix

      try {
        const payload = JWTService.verifyAccessToken(token);
        req.user = payload;
        next();
      } catch (tokenError) {
        logger.error({ err: tokenError }, 'Token verification failed');
        res.status(401).json(apiResponse.error('UNAUTHORIZED', 'Invalid or expired token'));
        return;
      }
    } catch (error) {
      logger.error({ err: error }, 'Authentication middleware error');
      res.status(500).json(apiResponse.error('INTERNAL_ERROR', 'Authentication error'));
      return;
    }
  };

  // Check if user has specific role
  static requireRole = (allowedRoles: string[]) => {
    return (req: Request, res: Response, next: NextFunction): void => {
      if (!req.user) {
        res.status(401).json(apiResponse.error('UNAUTHORIZED', 'Authentication required'));
        return;
      }

      if (!allowedRoles.includes(req.user.role)) {
        res.status(403).json(apiResponse.error('FORBIDDEN', 'Insufficient permissions'));
        return;
      }

      next();
    };
  };

  // Check if user is admin
  static requireAdmin = AuthMiddleware.requireRole(['ADMIN']);

  // Check if user is radiologist or admin
  static requireRadiologist = AuthMiddleware.requireRole(['RADIOLOGIST', 'ADMIN']);

  // Optional authentication (for public endpoints that can benefit from user context)
  static optionalAuth = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;
      
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        try {
          const payload = JWTService.verifyAccessToken(token);
          req.user = payload;
        } catch (tokenError) {
          // Token is invalid, but continue without authentication
          logger.warn({ err: tokenError }, 'Invalid token in optional auth');
        }
      }

      next();
    } catch (error) {
      logger.error({ err: error }, 'Optional auth middleware error');
      next(); // Continue without authentication
    }
  };
}