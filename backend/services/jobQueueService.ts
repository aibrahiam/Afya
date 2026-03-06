// Job Queue Service for AI Analysis

import Queue from 'bull';
import { AIAnalysisService, CaseData } from './aiAnalysisService.js';
import { logger } from '../utils/logger.js';
import Redis from 'ioredis';

// Redis connection configuration
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379');
const MAX_REDIS_RETRIES = 3;

const redisConfig = {
  host: REDIS_HOST,
  port: REDIS_PORT,
  password: process.env.REDIS_PASSWORD,
  connectTimeout: 5000,
  maxRetriesPerRequest: 3,
  lazyConnect: true,
};

// Track whether we've already warned about Redis being unavailable
let redisUnavailableLogged = false;

function createRedisRetryStrategy(retryCount: number): number | null {
  if (retryCount >= MAX_REDIS_RETRIES) {
    if (!redisUnavailableLogged) {
      redisUnavailableLogged = true;
      logger.warn(
        `Redis unavailable at ${REDIS_HOST}:${REDIS_PORT} after ${MAX_REDIS_RETRIES} attempts. ` +
        `Job queue will not be available. Start Redis and restart the server to enable it.`
      );
    }
    // Return null to stop retrying
    return null;
  }
  // Exponential backoff: 500ms, 1s, 2s
  return Math.min(500 * Math.pow(2, retryCount), 2000);
}

// Create AI analysis queue
const aiAnalysisQueue = new Queue<AIJobData>('ai-analysis', {
  createClient: (type) => {
    const baseConfig = {
      ...redisConfig,
      retryStrategy: createRedisRetryStrategy,
    };

    // Bull requires enableReadyCheck: false and maxRetriesPerRequest: null
    // for 'bclient' and 'subscriber' connection types (see Bull issue #1873)
    const clientConfig = type === 'client'
      ? baseConfig
      : { ...baseConfig, enableReadyCheck: false, maxRetriesPerRequest: null };

    const client = new Redis(clientConfig);
    client.on('error', (err: NodeJS.ErrnoException) => {
      // Only log the first ECONNREFUSED; subsequent ones are suppressed
      if (err.code === 'ECONNREFUSED') {
        if (!redisUnavailableLogged) {
          logger.warn(`Redis connection refused on ${REDIS_HOST}:${REDIS_PORT}. Is Redis running?`);
        }
      } else {
        logger.error({ err }, 'Redis error');
      }
    });
    return client;
  },
  defaultJobOptions: {
    removeOnComplete: 50,     // Keep 50 completed jobs
    removeOnFail: 100,        // Keep 100 failed jobs
    attempts: 3,              // Retry failed jobs 3 times
    backoff: {
      type: 'exponential',
      delay: 5000,            // Start with 5 second delay
    },
    delay: 1000,              // Initial delay before processing
  },
});

// Attach queue-level error handler immediately so Bull never emits an unhandled error
aiAnalysisQueue.on('error', (err: Error) => {
  if (!redisUnavailableLogged) {
    logger.error({ err }, 'AI analysis queue error');
  }
});

export interface AIJobData {
  caseId: string;
  patientId: string;
  patientName: string;
  age: number;
  gender: string;
  scanType: string;
  bodyPart: string;
  clinicalHistory?: string;
  imageBuffer: Buffer;
  priority: 'normal' | 'urgent';
  submittedBy: string;
  submittedAt: string;
}

export interface JobStatus {
  id: string;
  status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  progress: number;
  priority: 'normal' | 'urgent';
  submittedAt: string;
  startedAt?: string;
  completedAt?: string;
  estimatedCompletionTime?: string;
  error?: string;
  result?: any;
  queuePosition?: number;
}

export class JobQueueService {
  private static initialized = false;
  
  // Initialize job queue
  static async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Test Redis connection with a disposable client
      const testRedis = new Redis({
        ...redisConfig,
        retryStrategy: () => null, // No retries for the probe – fail fast
      });

      let probeErrorLogged = false;
      testRedis.on('error', (err) => {
        if (!probeErrorLogged) {
          probeErrorLogged = true;
          logger.warn({ err }, 'Failed to establish initial Redis connection');
        }
      });

      // Give Redis.ping a reasonable timeout so we don't block forever
      await Promise.race([
        testRedis.ping(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Redis connection timeout')), 2000))
      ]);
      testRedis.disconnect();

      logger.info('✅ Redis connection established');

      // Set up job processing
      this.setupJobProcessor();
      
      // Set up event listeners
      this.setupEventListeners();

      this.initialized = true;
      logger.info('✅ Job queue service initialized');

    } catch (error: any) {
      redisUnavailableLogged = true; // Suppress further retry noise from Bull clients
      logger.warn(
        `⚠️ Redis not available (${error?.message ?? error}). ` +
        `Job queue disabled – AI analysis will run synchronously. Start Redis to enable background processing.`
      );
      // Don't throw – infrastructure errors shouldn't prevent the rest of the app from starting
    }
  }

  // Submit case for AI analysis
  static async submitAnalysisJob(
    caseData: CaseData,
    imageBuffer: Buffer,
    priority: 'normal' | 'urgent' = 'normal',
    submittedBy: string
  ): Promise<string> {
    
    const jobData: AIJobData = {
        ...caseData,
        imageBuffer,
        priority,
        submittedBy,
        submittedAt: new Date().toISOString(),
        caseId: ''
    };

    // Set job priority (urgent = higher number)
    const jobPriority = priority === 'urgent' ? 10 : 1;

    // Add job to queue
    const job = await aiAnalysisQueue.add('analyze-case', jobData, {
      priority: jobPriority,
      delay: priority === 'urgent' ? 0 : 1000, // Urgent jobs start immediately
    });

    logger.info(`🚀 AI analysis job queued: ${job.id} (priority: ${priority})`);
    return job.id.toString();
  }

  // Get job status
  static async getJobStatus(jobId: string): Promise<JobStatus | null> {
    try {
      const job = await aiAnalysisQueue.getJob(jobId);
      if (!job) return null;

      // Get queue statistics
      const waiting = await aiAnalysisQueue.getWaiting();
      const queuePosition = waiting.findIndex(j => j.id === job.id) + 1;

      // Calculate estimated completion time
      let estimatedCompletionTime: string | undefined;
      if (job.opts.delay && queuePosition > 0) {
        const avgProcessingTime = 45000; // 45 seconds average
        const estimatedMs = (queuePosition - 1) * avgProcessingTime + job.opts.delay;
        estimatedCompletionTime = new Date(Date.now() + estimatedMs).toISOString();
      }

      const status: JobStatus = {
        id: job.id.toString(),
        status: this.mapJobState(await job.getState()),
        progress: job.progress(),
        priority: job.data.priority || 'normal',
        submittedAt: job.data.submittedAt,
        startedAt: job.processedOn ? new Date(job.processedOn).toISOString() : undefined,
        completedAt: job.finishedOn ? new Date(job.finishedOn).toISOString() : undefined,
        estimatedCompletionTime,
        queuePosition: queuePosition > 0 ? queuePosition : undefined,
        error: job.failedReason,
        result: job.returnvalue,
      };

      return status;

    } catch (error) {
      logger.error(`Failed to get job status for ${jobId}:`, error);
      return null;
    }
  }

  // Cancel job
  static async cancelJob(jobId: string): Promise<boolean> {
    try {
      const job = await aiAnalysisQueue.getJob(jobId);
      if (!job) return false;

      await job.remove();
      logger.info(`🗑️ Job cancelled: ${jobId}`);
      return true;

    } catch (error) {
      logger.error(`Failed to cancel job ${jobId}:`, error);
      return false;
    }
  }

  // Get queue statistics
  static async getQueueStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    const counts = await aiAnalysisQueue.getJobCounts();
    return {
      waiting: counts.waiting,
      active: counts.active,
      completed: counts.completed,
      failed: counts.failed,
      delayed: counts.delayed,
    };
  }

  // Set up job processor
  private static setupJobProcessor(): void {
    aiAnalysisQueue.process('analyze-case', 2, async (job, done) => {
      const { data } = job;
      const startTime = Date.now();

      try {
        logger.info(`🔄 Processing AI analysis job: ${job.id} for case ${data.caseId}`);

        // Update progress
        await job.progress(10);

        // Extract case data
        const caseData: CaseData = {
          id: data.caseId,
          patientId: data.patientId,
          patientName: data.patientName,
          age: data.age,
          gender: data.gender,
          scanType: data.scanType,
          bodyPart: data.bodyPart,
          clinicalHistory: data.clinicalHistory,
        };

        await job.progress(20);

        // Perform AI analysis with retry
        const result = await AIAnalysisService.analyzeWithRetry(
          caseData,
          data.imageBuffer
        );

        await job.progress(90);

        // Log completion
        const processingTime = Date.now() - startTime;
        logger.info(`✅ AI analysis completed: ${job.id} in ${processingTime}ms`);

        await job.progress(100);
        done(null, result);

      } catch (error) {
        logger.error(`❌ AI analysis failed: ${job.id}`, error);
        done(error as Error);
      }
    });
  }

  // Set up event listeners
  private static setupEventListeners(): void {
    // Job events
    aiAnalysisQueue.on('completed', (job) => {
      logger.info(`✅ Job completed: ${job.id} (case: ${job.data.caseId})`);
    });

    aiAnalysisQueue.on('failed', (job, err) => {
      logger.error(`❌ Job failed: ${job.id} (case: ${job.data.caseId})`, err.message);
    });

    aiAnalysisQueue.on('stalled', (job) => {
      logger.warn(`⚠️ Job stalled: ${job.id} (case: ${job.data.caseId})`);
    });

    // Queue events
    aiAnalysisQueue.on('waiting', (jobId) => {
      logger.debug(`⏳ Job waiting: ${jobId}`);
    });

    aiAnalysisQueue.on('active', (job) => {
      logger.info(`🔄 Job active: ${job.id} (case: ${job.data.caseId})`);
    });

    aiAnalysisQueue.on('progress', (job, progress) => {
      logger.debug(`📊 Job progress: ${job.id} - ${progress}%`);
    });

    // Error handling
    aiAnalysisQueue.on('error', (error) => {
      logger.error({ err: error }, 'Queue error');
    });

    // Clean up completed/failed jobs periodically
    setInterval(async () => {
      try {
        await aiAnalysisQueue.clean(24 * 60 * 60 * 1000, 'completed'); // Remove completed jobs older than 24h
        await aiAnalysisQueue.clean(7 * 24 * 60 * 60 * 1000, 'failed'); // Remove failed jobs older than 7 days
      } catch (error) {
        logger.error({ err: error }, 'Job cleanup error');
      }
    }, 60 * 60 * 1000); // Run every hour
  }

  // Map Bull job state to our status
  private static mapJobState(state: string): JobStatus['status'] {
    switch (state) {
      case 'waiting':
      case 'delayed':
        return 'QUEUED';
      case 'active':
        return 'PROCESSING';
      case 'completed':
        return 'COMPLETED';
      case 'failed':
        return 'FAILED';
      default:
        return 'QUEUED';
    }
  }

  // Pause queue (admin function)
  static async pauseQueue(): Promise<void> {
    await aiAnalysisQueue.pause();
    logger.info('⏸️ AI analysis queue paused');
  }

  // Resume queue (admin function)
  static async resumeQueue(): Promise<void> {
    await aiAnalysisQueue.resume();
    logger.info('▶️ AI analysis queue resumed');
  }

  // Get active jobs (admin function)
  static async getActiveJobs(): Promise<any[]> {
    const jobs = await aiAnalysisQueue.getActive();
    return jobs.map(job => ({
      id: job.id,
      caseId: job.data.caseId,
      priority: job.data.priority,
      progress: job.progress(),
      startedAt: new Date(job.processedOn || Date.now()).toISOString(),
    }));
  }

  // Get failed jobs (admin function)
  static async getFailedJobs(limit: number = 50): Promise<any[]> {
    const jobs = await aiAnalysisQueue.getFailed(0, limit - 1);
    return jobs.map(job => ({
      id: job.id,
      caseId: job.data?.caseId,
      error: job.failedReason,
      failedAt: job.finishedOn ? new Date(job.finishedOn).toISOString() : null,
      attempts: job.attemptsMade,
    }));
  }

  // Retry failed job
  static async retryFailedJob(jobId: string): Promise<boolean> {
    try {
      const job = await aiAnalysisQueue.getJob(jobId);
      if (!job) return false;

      await job.retry();
      logger.info(`🔄 Job retried: ${jobId}`);
      return true;

    } catch (error) {
      logger.error(`Failed to retry job ${jobId}:`, error);
      return false;
    }
  }
}

// Export queue for middleware/admin access
export { aiAnalysisQueue };