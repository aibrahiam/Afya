// Gemini AI Analysis Service

import { GoogleGenAI } from '@google/genai';
import { PrismaClient, Prisma } from '@prisma/client';
import { logger } from '../utils/logger.js';
import sharp from 'sharp';

const prisma = new PrismaClient();

export interface ImageMetadata {
  width: number;
  height: number;
  mimeType: string;
  size: number;
}

export interface CaseData {
  id: string;
  patientId: string;
  patientName: string;
  age: number;
  gender: string;
  clinicalHistory?: string;
  scanType: string;
  bodyPart: string;
}

export interface AIAnalysisResult {
  caseId: string;
  jobId: string;
  status: 'COMPLETED' | 'FAILED';
  modelVersion: string;
  confidenceScore: number;
  processingTimeMs: number;
  imageQuality: string;
  summary: string;
  keyFindings: string[];
  clinicalSignificance: string;
  analyzedAt: string;
  reportSections?: {
    indication: string;
    technique: string;
    findings: string;
    impression: string;
  };
  findings: Array<{
    category: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
    finding: string;
    description: string;
    confidence: number;
    location: string;
    details: string;
    boundingBox: {
      x: number;
      y: number;
      width: number;
      height: number;
    } | null;
  }>;
  recommendations: Array<{
    category: string;
    text: string;
    priority: 'urgent' | 'routine';
    reasoning: string;
  }>;
  heatmap: {
    imageId: string | null;
    imageUrl: string | null;
    width: number;
    height: number;
    regions: Array<{
      x: number;
      y: number;
      width: number;
      height: number;
      intensity: number;
      label: string;
    }>;
    overlayData: any;
  } | null;
}

export class AIAnalysisService {
  private static readonly MODEL_VERSION = 'AfyaDX-Radiology-v2.1';
  private static GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  private static readonly MAX_RETRIES = 3;

  private static genAI: GoogleGenAI;

  static initialize() {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      logger.warn('⚠️  GEMINI_API_KEY is not set – AI analysis features will be unavailable');
      return;
    }
    // Detect common placeholder values that ship with .env.example
    const placeholders = [
      'your-google-gemini-api-key-here',
      'your-gemini-api-key',
      'GEMINI_API_KEY',
      'change-this',
    ];
    if (placeholders.some(p => key.toLowerCase().includes(p.toLowerCase()))) {
      logger.error(
        '❌ GEMINI_API_KEY is still set to a placeholder value. ' +
        'Get a real key at https://aistudio.google.com/app/apikey ' +
        'and update GEMINI_API_KEY in backend/.env'
      );
      return; // Do NOT initialise — every call would fail with 400 API_KEY_INVALID
    }
    this.genAI = new GoogleGenAI({ apiKey: key });
    this.GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    logger.info('✅ Gemini AI configured (model: ' + this.GEMINI_MODEL + ')');
  }

  // Main analysis method
  static async analyzeCase(
    caseData: CaseData,
    imageBuffer: Buffer
  ): Promise<AIAnalysisResult> {
    const jobId = `ai-job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

    try {
      // Store analysis record as QUEUED (upsert so retries work without duplicate-key errors)
      await prisma.aIAnalysis.upsert({
        where: { caseId: caseData.id },
        create: {
          caseId: caseData.id,
          jobId,
          status: 'QUEUED',
          modelVersion: this.MODEL_VERSION,
        },
        update: {
          jobId,
          status: 'QUEUED',
          modelVersion: this.MODEL_VERSION,
        },
      });

      // Process image and get metadata
      const imageMetadata = await this.processImage(imageBuffer);

      // Analyze with Gemini
      const result = await this.callGeminiAPI(caseData, imageBuffer, imageMetadata, jobId);
      
      // Calculate actual processing time
      const processingTimeMs = Date.now() - startTime;
      result.processingTimeMs = processingTimeMs;

      // Store results in database
      await this.storeAnalysisResults(result);

      logger.info(`AI analysis completed for case ${caseData.id} in ${processingTimeMs}ms`);
      return result;

    } catch (error) {
      logger.error({ err: error }, `AI analysis failed for case ${caseData.id}`);

      // Update status to FAILED
      await prisma.aIAnalysis.updateMany({
        where: { caseId: caseData.id, jobId },
        data: { status: 'FAILED' },
      });

      throw error;
    }
  }

  // Process and validate medical image
  private static async processImage(imageBuffer: Buffer): Promise<ImageMetadata> {
    try {
      const image = sharp(imageBuffer);
      const metadata = await image.metadata();

      if (!metadata.width || !metadata.height) {
        throw new Error('Invalid image: missing dimensions');
      }

      // Validate image format
      const allowedFormats = ['jpeg', 'jpg', 'png', 'webp', 'tiff'];
      if (!metadata.format || !allowedFormats.includes(metadata.format.toLowerCase())) {
        throw new Error(`Unsupported image format: ${metadata.format}`);
      }

      // Validate image size (max 20MB)
      const maxSize = 20 * 1024 * 1024; // 20MB
      if (imageBuffer.length > maxSize) {
        throw new Error(`Image too large: ${imageBuffer.length} bytes (max: ${maxSize})`);
      }

      return {
        width: metadata.width,
        height: metadata.height,
        mimeType: `image/${metadata.format}`,
        size: imageBuffer.length,
      };

    } catch (error: any) {
      logger.error({ err: error }, 'Image processing failed');
      throw new Error(`Image processing failed: ${error?.message ?? error}`);
    }
  }

  // Call Gemini API for analysis
  private static async callGeminiAPI(
    caseData: CaseData,
    imageBuffer: Buffer,
    imageMetadata: ImageMetadata,
    jobId: string
  ): Promise<AIAnalysisResult> {

    if (!this.genAI) {
      throw new Error(
        'Gemini AI is not initialised. ' +
        'Set a valid GEMINI_API_KEY in backend/.env and restart the server. ' +
        'Get a key at https://aistudio.google.com/app/apikey'
      );
    }

    const prompt = this.buildPrompt(caseData, imageMetadata, jobId);

    try {
      // Convert buffer to base64 for Gemini
      const base64Image = imageBuffer.toString('base64');

      const response = await this.genAI.models.generateContent({
        model: this.GEMINI_MODEL,
        contents: [
          {
            role: 'user',
            parts: [
              { text: prompt },
              {
                inlineData: {
                  data: base64Image,
                  mimeType: imageMetadata.mimeType,
                },
              },
            ],
          },
        ],
        config: {
          temperature: 0.1,
          topP: 0.8,
          maxOutputTokens: 8192,
          responseMimeType: 'application/json',
        },
      });

      const responseText = response.text ?? '';
      logger.info(`Gemini raw response length: ${responseText.length} chars`);

      if (!responseText.trim()) {
        throw new Error('Gemini returned an empty response body');
      }

      // Parse JSON response
      let aiResponse: AIAnalysisResult;
      try {
        // Strip any accidental markdown fences Gemini may wrap around JSON
        const cleaned = responseText
          .replace(/^```(?:json)?\s*/i, '')
          .replace(/\s*```$/i, '')
          .trim();
        aiResponse = JSON.parse(cleaned);
      } catch (parseError) {
        logger.error({ rawText: responseText.substring(0, 500) }, 'Failed to parse Gemini JSON response');
        throw new Error('Invalid JSON response from AI service');
      }

      // Validate and sanitize response
      return this.validateAndSanitizeResponse(aiResponse, caseData);

    } catch (error: any) {
      // Log the full Gemini error body — Pino format requires data object first
      logger.error({
        err: error,
        geminiStatus: error?.status,
        geminiCode: error?.code,
        geminiDetails: error?.errorDetails ?? error?.details,
        geminiMessage: error?.message,
      }, 'Gemini API call failed');
      throw new Error(`AI service error: ${error?.message ?? error}`);
    }
  }

  // Build structured prompt for Gemini
  private static buildPrompt(caseData: CaseData, imageMetadata: ImageMetadata, jobId: string): string {
    const getTechniqueText = () => {
      const scan = caseData.scanType.toLowerCase();
      const part = caseData.bodyPart;
      if (scan.includes('x-ray') || scan.includes('xray') || scan.includes('radiograph')) {
        return `PA and lateral ${part} radiograph performed.`;
      } else if (scan.includes('ct')) {
        return `CT of the ${part} performed with standard protocol. Multiplanar reconstructions provided.`;
      } else if (scan.includes('mri')) {
        return `MRI of the ${part} performed with standard sequences including T1, T2, and FLAIR.`;
      }
      return `${caseData.scanType} of ${part} performed.`;
    };

    return `You are a board-certified radiologist AI assistant for the AfyaDX platform specializing in medical image analysis.

=== CRITICAL: SYSTEM CONTEXT (inject these exact values into your JSON response) ===
caseId: "${caseData.id}"
jobId: "${jobId}"
modelVersion: "${this.MODEL_VERSION}"
imageWidth: ${imageMetadata.width}
imageHeight: ${imageMetadata.height}

=== PATIENT CONTEXT ===
Patient ID: ${caseData.patientId}
Patient Name: ${caseData.patientName} (DO NOT include this in your response)
Age: ${caseData.age} years, Gender: ${caseData.gender}
Scan Type: ${caseData.scanType}
Body Part: ${caseData.bodyPart}
Clinical History: ${caseData.clinicalHistory || 'Not provided'}

=== ANALYSIS INSTRUCTIONS ===
1. Analyze the medical image for pathological findings with clinical-grade accuracy
2. Structure your output to mirror a standard radiology report with Indication, Technique, Findings (by anatomical region/system), and Impression sections
3. Write "findings" array entries with professional radiological narrative in the "details" field — organized by anatomical region (e.g., Lungs, Heart, Mediastinum, Vasculature, Bones)
4. Write "summary" as a formal numbered Impression section (e.g., "1. Findings consistent with... 2. Recommend...")
5. Write "clinicalSignificance" as the overall clinical interpretation and urgency
6. Use absolute pixel coordinates for bounding boxes based on the image dimensions provided
7. Return confidence scores as decimals (0.0-1.0)
8. Classify severity as exactly: "HIGH", "MEDIUM", or "LOW"
9. The "reportSections" field must mirror standard radiology report formatting exactly as a radiologist would write it

=== OUTPUT FORMAT (return ONLY valid JSON, no markdown or other text) ===
{
  "caseId": "${caseData.id}",
  "jobId": "${jobId}",
  "status": "COMPLETED",
  "modelVersion": "${this.MODEL_VERSION}",
  "confidenceScore": <overall_confidence_0_to_1>,
  "processingTimeMs": 0,
  "imageQuality": "<good|fair|poor>",
  "summary": "<Formal numbered Impression section — e.g.: 1. [Finding]. 2. [Recommendation].>",
  "keyFindings": ["<concise finding 1>", "<concise finding 2>"],
  "clinicalSignificance": "<overall clinical significance and urgency level>",
  "analyzedAt": "${new Date().toISOString()}",

  "reportSections": {
    "indication": "${caseData.clinicalHistory || 'Clinical indication not provided.'}",
    "technique": "${getTechniqueText()}",
    "findings": "<Full narrative findings text organized by anatomical region, written as a radiologist would — covering all visible structures systematically>",
    "impression": "<Numbered conclusion statements matching the Impression section of a formal radiology report>"
  },
  
  "findings": [
    {
      "category": "<Infection|Cardiac|Oncology|Trauma|Vascular|Normal|Other>",
      "severity": "<HIGH|MEDIUM|LOW>",
      "finding": "<concise finding name>",
      "description": "<one-line description>",
      "confidence": <0.0_to_1.0>,
      "location": "<anatomical location>",
      "details": "<Detailed radiological narrative for this region — written as it would appear in the Findings section of a radiology report>",
      "boundingBox": { 
        "x": <absolute_pixel_x>, 
        "y": <absolute_pixel_y>, 
        "width": <absolute_pixel_width>, 
        "height": <absolute_pixel_height> 
      }
    }
  ],
  
  "recommendations": [
    {
      "category": "<Lab|Imaging|Follow-Up|Referral|Treatment|Clinical>",
      "text": "<actionable recommendation>",
      "priority": "<urgent|routine>",
      "reasoning": "<medical rationale>"
    }
  ],
  
  "heatmap": {
    "imageId": null,
    "imageUrl": null,
    "width": ${imageMetadata.width},
    "height": ${imageMetadata.height},
    "regions": [
      {
        "x": <absolute_pixel_x>,
        "y": <absolute_pixel_y>, 
        "width": <absolute_pixel_width>,
        "height": <absolute_pixel_height>,
        "intensity": <0.0_to_1.0_based_on_confidence>,
        "label": "<descriptive_region_label>"
      }
    ],
    "overlayData": null
  }
}`;
  }

  // Validate and sanitize AI response
  private static validateAndSanitizeResponse(
    response: any,
    _caseData: CaseData
  ): AIAnalysisResult {
    // Ensure required fields exist
    if (!response.summary || !Array.isArray(response.findings)) {
      throw new Error('Missing required fields in AI response');
    }

    // Validate and sanitize findings
    if (response.findings) {
      response.findings.forEach((finding: any) => {
        // Ensure severity is valid
        if (!['LOW', 'MEDIUM', 'HIGH'].includes(finding.severity)) {
          finding.severity = 'MEDIUM';
        }
        // Clamp confidence to 0-1
        finding.confidence = Math.max(0, Math.min(1, finding.confidence || 0.5));
      });
    }

    // Ensure recommendations exist
    if (!Array.isArray(response.recommendations)) {
      response.recommendations = [];
    }

    // Set defaults
    response.analyzedAt = new Date().toISOString();
    response.status = 'COMPLETED';
    response.confidenceScore = Math.max(0, Math.min(1, response.confidenceScore || 0.5));

    // Ensure reportSections exists with defaults
    if (!response.reportSections) {
      response.reportSections = {
        indication: _caseData.clinicalHistory || 'Not provided',
        technique: `${_caseData.scanType} of ${_caseData.bodyPart}.`,
        findings: response.findings?.map((f: any) => `${f.location}: ${f.details || f.description || f.finding}`).join('\n\n') || '',
        impression: response.summary || '',
      };
    }

    return response as AIAnalysisResult;
  }

  // Store analysis results in database
  private static async storeAnalysisResults(result: AIAnalysisResult): Promise<void> {
    try {
      // Use a transaction so the update is atomic — delete stale child records
      // first so retries and re-analyses don't hit unique-constraint errors.
      await prisma.$transaction(async (tx) => {
        // Update main analysis record
        const analysis = await tx.aIAnalysis.update({
          where: { caseId: result.caseId },
          data: {
            status: 'COMPLETED',
            confidenceScore: result.confidenceScore,
            processingTimeMs: result.processingTimeMs,
            imageQuality: result.imageQuality,
            summary: result.summary,
            keyFindings: result.keyFindings,
            clinicalSignificance: result.clinicalSignificance,
            analyzedAt: new Date(result.analyzedAt),
          },
        });

        // Remove previous child records (safe for first run — deletes 0 rows)
        await tx.aIFinding.deleteMany({ where: { analysisId: analysis.id } });
        await tx.aIRecommendation.deleteMany({ where: { analysisId: analysis.id } });
        await tx.aIHeatmap.deleteMany({ where: { analysisId: analysis.id } });

        // Store findings
        for (const finding of result.findings) {
          await tx.aIFinding.create({
            data: {
              analysisId: analysis.id,
              category: finding.category,
              severity: finding.severity as any,
              finding: finding.finding,
              description: finding.description,
              confidence: finding.confidence,
              location: finding.location,
              details: finding.details,
              boundingBox: finding.boundingBox ?? Prisma.JsonNull,
            },
          });
        }

        // Store recommendations
        for (const rec of result.recommendations) {
          await tx.aIRecommendation.create({
            data: {
              analysisId: analysis.id,
              category: rec.category,
              text: rec.text,
              recommendation: rec.text,
              priority: rec.priority,
              reasoning: rec.reasoning,
            },
          });
        }

        // Store heatmap if present
        if (result.heatmap) {
          await tx.aIHeatmap.create({
            data: {
              analysisId: analysis.id,
              width: result.heatmap.width,
              height: result.heatmap.height,
              regions: result.heatmap.regions,
              overlayData: result.heatmap.overlayData,
            },
          });
        }
      });

      logger.info(`Stored analysis results for case ${result.caseId}`);

    } catch (error: any) {
      logger.error({ err: error }, 'Failed to store analysis results');
      throw new Error(`Database storage failed: ${error?.message ?? error}`);
    }
  }

  // Retry wrapper with exponential backoff
  static async analyzeWithRetry(
    caseData: CaseData,
    imageBuffer: Buffer,
    maxRetries: number = this.MAX_RETRIES
  ): Promise<AIAnalysisResult> {
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.analyzeCase(caseData, imageBuffer);
        
      } catch (error: any) {
        if (attempt === maxRetries) {
          throw error; // Final attempt failed
        }

        // Check if error is retryable
        const retryableErrors = [
          'RATE_LIMIT_EXCEEDED',
          'INTERNAL_ERROR', 
          'TIMEOUT',
          'OVERLOADED'
        ];

        const isRetryable = retryableErrors.some(err => 
          error.message.includes(err)
        );

        if (isRetryable) {
          // Exponential backoff
          const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
          
          logger.warn({ errMsg: error.message, attempt, delay }, `AI analysis retry ${attempt + 1}/${maxRetries}`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          throw error; // Non-retryable error
        }
      }
    }

    throw new Error('All retry attempts failed');
  }
}

// Note: AIAnalysisService is initialised explicitly in index.ts