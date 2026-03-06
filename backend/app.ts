// Express Application Configuration

import express, { type Application, type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import rateLimit from 'express-rate-limit';
import path from 'path';

import { logger } from './utils/logger.js';
import { apiResponse } from './utils/apiResponse.js';
import routes from './routes/index.js';

const app: Application = express();

// ─── Security Middleware ─────────────────────────────────────────────────────

// Helmet for security headers
app.use(helmet());

// CORS configuration
const corsOrigins = process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:5173'];
app.use(cors({
  origin: corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Rate limiting
// General limiter – applied to all API routes
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'),
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '1000'),
  message: apiResponse.error('RATE_LIMIT_EXCEEDED', 'Too many requests, please try again later'),
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', limiter);

// Polling-specific limiter – analysis endpoint is hit every 3 s per open case.
// Allow 1 200 req / min (= 20 cases polling simultaneously) before throttling.
const pollLimiter = rateLimit({
  windowMs: 60_000,
  max: 1200,
  message: apiResponse.error('RATE_LIMIT_EXCEEDED', 'Analysis polling rate limit exceeded'),
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => !req.path.endsWith('/analysis'),
});
app.use('/api/v1/cases', pollLimiter);

// ─── Body Parsing ────────────────────────────────────────────────────────────

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Logging ─────────────────────────────────────────────────────────────────

app.use(pinoHttp({
  logger,
  customLogLevel: (_req, res, error) => {
    if (res.statusCode >= 500 || error) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
}));

// ─── Health Check ────────────────────────────────────────────────────────────

app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// ─── API Routes ──────────────────────────────────────────────────────────────

app.use('/api/v1', routes);

// ─── Static File Serving for DICOM images ────────────────────────────────────
// CORP is set to cross-origin so the React frontend (different port) can load
// images. Helmet's default of same-origin would block cross-origin fetches.

const dicomDir = path.resolve(process.cwd(), '..', 'dicom');
app.use('/dicom', (_req, res, next) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, express.static(dicomDir));

// ─── 404 Handler ─────────────────────────────────────────────────────────────

app.use((req: Request, res: Response) => {
  res.status(404).json(
    apiResponse.error('NOT_FOUND', `Route ${req.method} ${req.path} not found`)
  );
});

// ─── Global Error Handler ────────────────────────────────────────────────────

app.use((error: Error, req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err: error, path: req.path }, 'Unhandled error');
  
  const statusCode = (error as any).statusCode || 500;
  const code = (error as any).code || 'INTERNAL_SERVER_ERROR';
  
  res.status(statusCode).json(
    apiResponse.error(code, 
      process.env.NODE_ENV === 'production' 
        ? 'An unexpected error occurred' 
        : error.message
    )
  );
});

export default app;
