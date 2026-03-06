// Cases Service

import { PrismaClient, CaseStatus, CasePriority, AnalysisStatus, SeverityLevel } from '@prisma/client';
import { logger } from '../utils/logger.js';

const prisma = new PrismaClient();

export interface CaseFilters {
  status?: CaseStatus;
  priority?: CasePriority;
  scanType?: string;
  bodyPart?: string;
  assignedToId?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

export interface PaginationOptions {
  page: number;
  limit: number;
}

export interface CaseWithDetails {
  id: string;
  patientId: string;
  patientName: string;
  age: number;
  gender: string;
  scanType: string;
  bodyPart: string;
  clinicalHistory?: string;
  accessionNumber: string;
  referringPhysician?: string;
  status: CaseStatus;
  priority: CasePriority;
  date: Date;
  time: string;
  createdAt: Date;
  updatedAt: Date;
  assignedTo?: {
    id: string;
    name: string;
    email: string;
  };
  analysis?: {
    id: string;
    status: AnalysisStatus;
    summary?: string;
    findings: number;
    recommendations: number;
  };
  images: Array<{ id: string; storageUrl: string; isPrimary: boolean }>;
  imageCount: number;
}

export class CasesService {
  // Get paginated cases with filters
  static async getCases(
    filters: CaseFilters = {},
    pagination: PaginationOptions = { page: 1, limit: 20 }
  ): Promise<{
    data: CaseWithDetails[];
    totalCount: number;
    totalPages: number;
    currentPage: number;
  }> {
    try {
      const { page, limit } = pagination;
      const skip = (page - 1) * limit;

      // Build where clause
      const where: any = {
        deletedAt: null, // Exclude soft deleted cases
      };

      if (filters.status) where.status = filters.status;
      if (filters.priority) where.priority = filters.priority;
      if (filters.scanType) where.scanType = { contains: filters.scanType, mode: 'insensitive' };
      if (filters.bodyPart) where.bodyPart = { contains: filters.bodyPart, mode: 'insensitive' };
      if (filters.assignedToId) where.assignedToId = filters.assignedToId;
      if (filters.dateFrom && filters.dateTo) {
        where.date = {
          gte: filters.dateFrom,
          lte: filters.dateTo,
        };
      }

      // Get cases with related data
      const [cases, totalCount] = await Promise.all([
        prisma.case.findMany({
          where,
          skip,
          take: limit,
          orderBy: [
            { priority: 'desc' }, // Urgent first
            { date: 'desc' }, // Then by date
            { createdAt: 'desc' },
          ],
          include: {
            assignedTo: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            analysis: {
              select: {
                id: true,
                status: true,
                summary: true,
                _count: {
                  select: {
                    findings: true,
                    recommendations: true,
                  },
                },
              },
            },
            images: {
              select: { id: true, storageUrl: true, isPrimary: true },
              orderBy: { isPrimary: 'desc' },
              take: 1,
            },
            _count: {
              select: {
                images: true,
              },
            },
          },
        }),
        prisma.case.count({ where }),
      ]);

      // Transform data
      const transformedCases: CaseWithDetails[] = cases.map(case_ => ({
        id: case_.id,
        patientId: case_.patientId,
        patientName: case_.patientName,
        age: case_.age,
        gender: case_.gender,
        scanType: case_.scanType,
        bodyPart: case_.bodyPart,
        clinicalHistory: case_.clinicalHistory || undefined,
        accessionNumber: case_.accessionNumber,
        referringPhysician: case_.referringPhysician || undefined,
        status: case_.status,
        priority: case_.priority,
        date: case_.date,
        time: case_.time,
        createdAt: case_.createdAt,
        updatedAt: case_.updatedAt,
        assignedTo: case_.assignedTo || undefined,
        analysis: case_.analysis ? {
          id: case_.analysis.id,
          status: case_.analysis.status,
          summary: case_.analysis.summary || undefined,
          findings: case_.analysis._count.findings,
          recommendations: case_.analysis._count.recommendations,
        } : undefined,
        images: case_.images ?? [],
        imageCount: case_._count.images,
      }));

      return {
        data: transformedCases,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        currentPage: page,
      };
    } catch (error) {
      logger.error({ err: error }, 'Failed to get cases');
      throw error;
    }
  }

  // Get single case by ID
  static async getCaseById(caseId: string): Promise<CaseWithDetails | null> {
    try {
      const case_ = await prisma.case.findUnique({
        where: { id: caseId, deletedAt: null },
        include: {
          assignedTo: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          analysis: {
            select: {
              id: true,
              status: true,
              summary: true,
              _count: {
                select: {
                  findings: true,
                  recommendations: true,
                },
              },
            },
          },
          images: {
            select: { id: true, storageUrl: true, isPrimary: true },
            orderBy: { isPrimary: 'desc' },
            take: 3,
          },
          _count: {
            select: {
              images: true,
            },
          },
        },
      });

      if (!case_) return null;

      return {
        id: case_.id,
        patientId: case_.patientId,
        patientName: case_.patientName,
        age: case_.age,
        gender: case_.gender,
        scanType: case_.scanType,
        bodyPart: case_.bodyPart,
        clinicalHistory: case_.clinicalHistory || undefined,
        accessionNumber: case_.accessionNumber,
        referringPhysician: case_.referringPhysician || undefined,
        status: case_.status,
        priority: case_.priority,
        date: case_.date,
        time: case_.time,
        createdAt: case_.createdAt,
        updatedAt: case_.updatedAt,
        assignedTo: case_.assignedTo || undefined,
        analysis: case_.analysis ? {
          id: case_.analysis.id,
          status: case_.analysis.status,
          summary: case_.analysis.summary || undefined,
          findings: case_.analysis._count.findings,
          recommendations: case_.analysis._count.recommendations,
        } : undefined,
        images: case_.images ?? [],
        imageCount: case_._count.images,
      };
    } catch (error) {
      logger.error({ err: error }, 'Failed to get case by ID');
      throw error;
    }
  }

  // Update case status
  static async updateCaseStatus(caseId: string, status: CaseStatus, userId: string) {
    try {
      const updatedCase = await prisma.case.update({
        where: { id: caseId, deletedAt: null },
        data: { 
          status,
          assignedToId: status === 'REVIEWED' ? userId : undefined,
        },
      });

      logger.info(`Case ${caseId} status updated to ${status} by user ${userId}`);
      return updatedCase;
    } catch (error) {
      logger.error({ err: error }, 'Failed to update case status');
      throw error;
    }
  }

  // Assign case to radiologist
  static async assignCase(caseId: string, radiologistId: string) {
    try {
      const updatedCase = await prisma.case.update({
        where: { id: caseId, deletedAt: null },
        data: { assignedToId: radiologistId },
      });

      logger.info(`Case ${caseId} assigned to ${radiologistId}`);
      return updatedCase;
    } catch (error) {
      logger.error({ err: error }, 'Failed to assign case');
      throw error;
    }
  }

  // Get AI analysis for a case
  static async getCaseAnalysis(caseId: string) {
    try {
      const analysis = await prisma.aIAnalysis.findUnique({
        where: { caseId },
        include: {
          findings: {
            orderBy: { confidence: 'desc' },
          },
          recommendations: {
            orderBy: { priority: 'asc' },
          },
          heatmap: true,
          case: {
            select: { clinicalHistory: true, scanType: true, bodyPart: true },
          },
        },
      });

      if (!analysis) {
        return null;
      }

      // Derive technique text from scan type
      const getTechniqueText = (scanType: string, bodyPart: string) => {
        const scan = scanType.toLowerCase();
        if (scan.includes('x-ray') || scan.includes('xray') || scan.includes('radiograph')) {
          return `PA and lateral ${bodyPart} radiograph performed.`;
        } else if (scan.includes('ct')) {
          return `CT of the ${bodyPart} performed with standard protocol. Multiplanar reconstructions provided.`;
        } else if (scan.includes('mri')) {
          return `MRI of the ${bodyPart} performed with standard sequences.`;
        }
        return `${scanType} of ${bodyPart} performed.`;
      };

      const mappedFindings = analysis.findings.map(finding => ({
        id: finding.id,
        severity: finding.severity,
        finding: finding.finding,
        confidence: finding.confidence,
        location: finding.location,
        details: finding.details,
        boundingBox: finding.boundingBox,
      }));

      // Build report sections from available data
      const findingsNarrative = mappedFindings.length > 0
        ? mappedFindings.map(f => `${f.location}: ${f.details || f.finding || ''}`).filter(s => s.trim() !== ':').join('\n\n')
        : 'No significant findings identified.';

      return {
        id: analysis.id,
        caseId: analysis.caseId,
        status: analysis.status,
        modelVersion: analysis.modelVersion,
        processingTimeMs: analysis.processingTimeMs,
        imageQuality: analysis.imageQuality,
        summary: analysis.summary,
        clinicalSignificance: analysis.clinicalSignificance,
        keyFindings: analysis.keyFindings,
        analyzedAt: analysis.analyzedAt,
        createdAt: analysis.createdAt,
        findings: mappedFindings,
        recommendations: analysis.recommendations.map(rec => rec.text ?? rec.recommendation).filter(Boolean),
        heatmap: analysis.heatmap ? {
          width: analysis.heatmap.width,
          height: analysis.heatmap.height,
          regions: analysis.heatmap.regions,
        } : null,
        reportSections: {
          indication: analysis.case.clinicalHistory || 'Clinical indication not provided.',
          technique: getTechniqueText(analysis.case.scanType, analysis.case.bodyPart),
          findings: findingsNarrative,
          impression: analysis.summary || analysis.clinicalSignificance || 'No acute findings.',
        },
      };
    } catch (error) {
      logger.error({ err: error }, 'Failed to get case analysis');
      throw error;
    }
  }

  // Submit AI feedback
  static async submitAIFeedback(
    analysisId: string,
    userId: string,
    feedback: {
      rating: 'accurate' | 'needs_review' | 'incorrect';
      correctionText?: string;
      findingId?: string;
      correctedSeverity?: SeverityLevel;
    }
  ) {
    try {
      const feedbackRecord = await prisma.aIFeedback.create({
        data: {
          analysisId,
          submittedById: userId,
          rating: feedback.rating,
          correctionText: feedback.correctionText,
          findingId: feedback.findingId,
          correctedSeverity: feedback.correctedSeverity,
        },
      });

      logger.info(`AI feedback submitted for analysis ${analysisId} by user ${userId}`);
      return feedbackRecord;
    } catch (error) {
      logger.error({ err: error }, 'Failed to submit AI feedback');
      throw error;
    }
  }

  // Create a new case with image
  static async createCase(data: {
    patientName: string;
    patientId: string;
    age: number;
    gender: string;
    scanType: string;
    bodyPart: string;
    clinicalHistory?: string;
    referringPhysician?: string;
    priority: CasePriority;
    createdById: string;
    image?: {
      filename: string;
      storageUrl: string;
      mimeType: string;
      fileSize: number;
    };
  }) {
    try {
      const accessionNumber = `ACC-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
      const now = new Date();

      const newCase = await prisma.case.create({
        data: {
          patientId: data.patientId,
          patientName: data.patientName,
          age: data.age,
          gender: data.gender,
          scanType: data.scanType,
          bodyPart: data.bodyPart,
          clinicalHistory: data.clinicalHistory,
          referringPhysician: data.referringPhysician,
          accessionNumber,
          status: 'PENDING',
          priority: data.priority,
          date: now,
          time: now.toTimeString().slice(0, 5),
          createdById: data.createdById,
          ...(data.image
            ? {
                images: {
                  create: {
                    filename: data.image.filename,
                    modality: data.scanType,
                    fileSize: data.image.fileSize,
                    mimeType: data.image.mimeType,
                    storageUrl: data.image.storageUrl,
                    isPrimary: true,
                    uploadedById: data.createdById,
                  },
                },
              }
            : {}),
        },
        include: {
          images: true,
        },
      });

      logger.info(`New case created: ${newCase.id} by user ${data.createdById}`);
      return newCase;
    } catch (error) {
      logger.error({ err: error }, 'Failed to create case');
      throw error;
    }
  }

  // Soft-delete a case
  static async deleteCase(caseId: string): Promise<void> {
    await prisma.case.update({
      where: { id: caseId },
      data: { deletedAt: new Date() },
    });
    logger.info(`Case ${caseId} soft-deleted`);
  }

  // Update editable case fields
  static async updateCase(
    caseId: string,
    data: {
      patientName?: string;
      age?: number;
      gender?: string;
      scanType?: string;
      bodyPart?: string;
      clinicalHistory?: string;
      referringPhysician?: string;
      priority?: CasePriority;
    }
  ) {
    const updated = await prisma.case.update({
      where: { id: caseId },
      data,
    });
    logger.info(`Case ${caseId} updated`);
    return updated;
  }

  // Get case statistics
  static async getCaseStatistics(userId?: string) {
    try {
      const where = userId ? { assignedToId: userId } : {};

      const [
        totalCases,
        pendingCases,
        reviewedCases,
        urgentCases,
        casesToday,
      ] = await Promise.all([
        prisma.case.count({ where: { ...where, deletedAt: null } }),
        prisma.case.count({ where: { ...where, status: 'PENDING', deletedAt: null } }),
        prisma.case.count({ where: { ...where, status: 'REVIEWED', deletedAt: null } }),
        prisma.case.count({ where: { ...where, priority: 'URGENT', deletedAt: null } }),
        prisma.case.count({
          where: {
            ...where,
            date: {
              gte: new Date(new Date().setHours(0, 0, 0, 0)),
            },
            deletedAt: null,
          },
        }),
      ]);

      return {
        totalCases,
        pendingCases,
        reviewedCases,
        urgentCases,
        casesToday,
      };
    } catch (error) {
      logger.error({ err: error }, 'Failed to get case statistics');
      throw error;
    }
  }
}