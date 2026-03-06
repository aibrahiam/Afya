// Backend Entry Point
// AfyaDX Backend API Server with AI Integration

import dotenv from 'dotenv';
dotenv.config();

import app from './app.js';
import { logger } from './utils/logger.js';
import { JobQueueService } from './services/jobQueueService.js';
import { FileUploadService } from './services/fileUploadService.js';
import { AIAnalysisService } from './services/aiAnalysisService.js';

const PORT = process.env.PORT || 3001;

// Initialize services
async function initializeServices(): Promise<void> {
  try {
    logger.info('🔧 Initializing services...');

    // Initialize AI Analysis Service
    AIAnalysisService.initialize();
    logger.info('✅ AI Analysis Service initialized');

    // Initialize File Upload Service
    FileUploadService.initialize();
    logger.info('✅ File Upload Service initialized');

    // Initialize Job Queue Service
    await JobQueueService.initialize();
    logger.info('✅ Job Queue Service initialized');

    logger.info('🎉 All services initialized successfully');

  } catch (error) {
    logger.error({ err: error }, '❌ Failed to initialize services');
    process.exit(1);
  }
}

// Start server
async function startServer(): Promise<void> {
  try {
    // Initialize all services first
    await initializeServices();

    // Start HTTP server
    const server = app.listen(PORT, () => {
      logger.info(`🚀 AfyaDX API Server running on port ${PORT}`);
      logger.info(`📖 API Documentation: http://localhost:${PORT}/api/v1/docs`);
      logger.info(`🏥 Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`🤖 AI Engine: Gemini 1.5 Pro (${process.env.GEMINI_API_KEY ? 'Configured' : 'Not Configured'})`);
      logger.info(`📋 Job Queue: Redis (${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379})`);
      logger.info(`☁️ File Storage: AWS S3 (${process.env.S3_BUCKET_NAME || 'Not Configured'})`);
    });

    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        logger.error(`❌ Port ${PORT} is already in use. Please stop any other running instance.`);
      } else {
      logger.error({ err: err }, '❌ Server error');
      }
      process.exit(1);
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`${signal} received. Shutting down gracefully...`);
      
      server.close(async () => {
        logger.info('HTTP server closed');
        
        try {
          // Add any cleanup tasks here
          logger.info('Cleanup completed');
        } catch (error) {
          logger.error({ err: error }, 'Cleanup failed');
        }
        
        process.exit(0);
      });

      // Force shutdown after 15 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 15000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error({ reason, promise: String(promise) }, 'Unhandled Rejection');
      // Don't exit – infrastructure errors (Redis, S3) should not take down the server
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error({ err: error }, 'Uncaught Exception');
      process.exit(1);
    });

  } catch (error) {
    logger.error({ err: error }, '❌ Failed to start server');
    process.exit(1);
  }
}

// Start the application
startServer();
