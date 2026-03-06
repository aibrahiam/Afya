// File Upload Service for Medical Images

import { S3 } from 'aws-sdk';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger.js';
import crypto from 'crypto';
import path from 'path';

export interface UploadResult {
  fileId: string;
  originalName: string;
  s3Key: string;
  s3Url: string;
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
  thumbnailUrl?: string;
  checksum: string;
}

export interface ImageProcessingOptions {
  createThumbnail?: boolean;
  thumbnailSize?: { width: number; height: number };
  maxImageSize?: { width: number; height: number };
  quality?: number;
  format?: 'jpeg' | 'png' | 'webp';
}

export class FileUploadService {
  private static s3: S3;
  private static bucketName: string;
  private static initialized = false;

  // Initialize AWS S3
  static initialize(): void {
    if (this.initialized) return;

    // Validate required environment variables
    const requiredEnvVars = ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_REGION', 'S3_BUCKET_NAME'];
    const missing = requiredEnvVars.filter(env => !process.env[env]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }

    this.s3 = new S3({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION,
      signatureVersion: 'v4',
    });

    this.bucketName = process.env.S3_BUCKET_NAME!;
    this.initialized = true;

    logger.info('✅ File upload service initialized');
  }

  // Upload medical image
  static async uploadMedicalImage(
    file: Express.Multer.File,
    caseId: string,
    uploadedBy: string,
    options: ImageProcessingOptions = {}
  ): Promise<UploadResult> {
    
    if (!this.initialized) {
      throw new Error('FileUploadService not initialized');
    }

    try {
      // Generate unique file ID
      const fileId = uuidv4();
      const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      
      // Validate file type
      this.validateMedicalImage(file);

      // Process image
      const { processedBuffer, metadata } = await this.processImage(file.buffer, options);
      
      // Generate checksum
      const checksum = crypto.createHash('sha256').update(processedBuffer).digest('hex');
      
      // Generate S3 key
      const sanitizedFilename = this.sanitizeFilename(file.originalname);
      const s3Key = `medical-images/${timestamp}/${caseId}/${fileId}-${sanitizedFilename}`;
      
      // Upload to S3
      const uploadParams: S3.PutObjectRequest = {
        Bucket: this.bucketName,
        Key: s3Key,
        Body: processedBuffer,
        ContentType: file.mimetype,
        ContentDisposition: 'inline',
        Metadata: {
          'original-name': file.originalname,
          'case-id': caseId,
          'uploaded-by': uploadedBy,
          'file-id': fileId,
          'checksum': checksum,
          'upload-timestamp': new Date().toISOString(),
        },
        ServerSideEncryption: 'AES256', // Encrypt at rest
      };

      await this.s3.upload(uploadParams).promise();
      
      // Generate signed URL (valid for 7 days)
      const s3Url = this.s3.getSignedUrl('getObject', {
        Bucket: this.bucketName,
        Key: s3Key,
        Expires: 7 * 24 * 60 * 60, // 7 days
      });

      // Create thumbnail if requested
      let thumbnailUrl: string | undefined;
      if (options.createThumbnail) {
        thumbnailUrl = await this.createThumbnail(processedBuffer, s3Key, caseId, fileId, options);
      }

      const result: UploadResult = {
        fileId,
        originalName: file.originalname,
        s3Key,
        s3Url,
        mimeType: file.mimetype,
        size: processedBuffer.length,
        width: metadata.width,
        height: metadata.height,
        thumbnailUrl,
        checksum,
      };

      logger.info(`✅ Medical image uploaded: ${fileId} (${result.size} bytes)`);
      return result;

    } catch (error: any) {
      logger.error({ err: error }, 'Failed to upload medical image');
      throw new Error(`Upload failed: ${error?.message ?? error}`);
    }
  }

  // Validate medical image file
  private static validateMedicalImage(file: Express.Multer.File): void {
    // Check file size (max 50MB)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      throw new Error(`File too large: ${file.size} bytes (max: ${maxSize})`);
    }

    // Check MIME type
    const allowedMimeTypes = [
      'image/jpeg',
      'image/jpg', 
      'image/png',
      'image/tiff',
      'image/tif',
      'image/bmp',
      'image/webp',
      'application/dicom', // DICOM images
    ];

    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new Error(`Unsupported file type: ${file.mimetype}`);
    }

    // Check file signature (magic numbers)
    this.validateFileSignature(file.buffer, file.mimetype);
  }

  // Validate file signature to prevent header spoofing
  private static validateFileSignature(buffer: Buffer, mimeType: string): void {
    if (buffer.length < 4) {
      throw new Error('Invalid file: too small');
    }

    const signature = buffer.toString('hex', 0, 4);
    
    const validSignatures: { [key: string]: string[] } = {
      'image/jpeg': ['ffd8ffe0', 'ffd8ffe1', 'ffd8ffe2', 'ffd8ffe3', 'ffd8ffe8'],
      'image/png': ['89504e47'],
      'image/tiff': ['49492a00', '4d4d002a'],
      'image/bmp': ['424d'],
      'image/webp': ['52494646'], // Checks first 4 bytes, full signature would be longer
    };

    if (validSignatures[mimeType] && !validSignatures[mimeType].includes(signature.toLowerCase())) {
      throw new Error('File signature does not match MIME type');
    }
  }

  // Process image (resize, optimize, etc.)
  private static async processImage(
    buffer: Buffer,
    options: ImageProcessingOptions
  ): Promise<{ processedBuffer: Buffer; metadata: sharp.Metadata }> {
    
    let image = sharp(buffer);
    
    // Get original metadata
    const metadata = await image.metadata();
    
    // Resize if max size specified
    if (options.maxImageSize && metadata.width && metadata.height) {
      const { width, height } = options.maxImageSize;
      
      if (metadata.width > width || metadata.height > height) {
        image = image.resize(width, height, {
          fit: 'inside',
          withoutEnlargement: true,
        });
      }
    }

    // Set format and quality
    if (options.format === 'jpeg') {
      image = image.jpeg({ quality: options.quality || 90 });
    } else if (options.format === 'png') {
      image = image.png({ quality: options.quality || 90 });
    } else if (options.format === 'webp') {
      image = image.webp({ quality: options.quality || 90 });
    }

    // Process image
    const processedBuffer = await image.toBuffer();
    const finalMetadata = await sharp(processedBuffer).metadata();

    return {
      processedBuffer,
      metadata: finalMetadata,
    };
  }

  // Create thumbnail
  private static async createThumbnail(
    originalBuffer: Buffer,
    originalS3Key: string,
    caseId: string,
    fileId: string,
    options: ImageProcessingOptions
  ): Promise<string> {
    
    try {
      const thumbnailSize = options.thumbnailSize || { width: 200, height: 200 };
      
      // Create thumbnail
      const thumbnailBuffer = await sharp(originalBuffer)
        .resize(thumbnailSize.width, thumbnailSize.height, {
          fit: 'cover',
          position: 'center',
        })
        .jpeg({ quality: 80 })
        .toBuffer();

      // Generate thumbnail S3 key
      const thumbnailKey = originalS3Key.replace(/(\.[^.]+)$/, '-thumbnail$1');
      
      // Upload thumbnail
      await this.s3.upload({
        Bucket: this.bucketName,
        Key: thumbnailKey,
        Body: thumbnailBuffer,
        ContentType: 'image/jpeg',
        ContentDisposition: 'inline',
        Metadata: {
          'is-thumbnail': 'true',
          'parent-file-id': fileId,
          'case-id': caseId,
        },
        ServerSideEncryption: 'AES256',
      }).promise();

      // Generate signed URL for thumbnail
      const thumbnailUrl = this.s3.getSignedUrl('getObject', {
        Bucket: this.bucketName,
        Key: thumbnailKey,
        Expires: 7 * 24 * 60 * 60, // 7 days
      });

      return thumbnailUrl;

    } catch (error: any) {
      logger.error({ err: error }, 'Failed to create thumbnail');
      throw new Error(`Thumbnail creation failed: ${error?.message ?? error}`);
    }
  }

  // Generate new signed URL
  static generateSignedUrl(s3Key: string, expiresInSeconds: number = 7 * 24 * 60 * 60): string {
    if (!this.initialized) {
      throw new Error('FileUploadService not initialized');
    }

    return this.s3.getSignedUrl('getObject', {
      Bucket: this.bucketName,
      Key: s3Key,
      Expires: expiresInSeconds,
    });
  }

  // Delete file from S3
  static async deleteFile(s3Key: string): Promise<void> {
    if (!this.initialized) {
      throw new Error('FileUploadService not initialized');
    }

    try {
      await this.s3.deleteObject({
        Bucket: this.bucketName,
        Key: s3Key,
      }).promise();

      // Also try to delete thumbnail
      const thumbnailKey = s3Key.replace(/(\.[^.]+)$/, '-thumbnail$1');
      try {
        await this.s3.deleteObject({
          Bucket: this.bucketName,
          Key: thumbnailKey,
        }).promise();
      } catch (thumbnailError) {
        // Thumbnail might not exist, ignore error
      }

      logger.info(`🗑️ File deleted: ${s3Key}`);

    } catch (error: any) {
      logger.error(`Failed to delete file ${s3Key}:`, error);
      throw new Error(`Delete failed: ${error?.message ?? error}`);
    }
  }

  // Check if file exists
  static async fileExists(s3Key: string): Promise<boolean> {
    if (!this.initialized) {
      throw new Error('FileUploadService not initialized');
    }

    try {
      await this.s3.headObject({
        Bucket: this.bucketName,
        Key: s3Key,
      }).promise();
      return true;

    } catch (error: any) {
      if (error.code === 'NotFound') {
        return false;
      }
      throw error;
    }
  }

  // Get file metadata
  static async getFileMetadata(s3Key: string): Promise<S3.HeadObjectOutput | null> {
    if (!this.initialized) {
      throw new Error('FileUploadService not initialized');
    }

    try {
      const result = await this.s3.headObject({
        Bucket: this.bucketName,
        Key: s3Key,
      }).promise();
      
      return result;

    } catch (error: any) {
      if (error.code === 'NotFound') {
        return null;
      }
      throw error;
    }
  }

  // Sanitize filename
  private static sanitizeFilename(filename: string): string {
    // Remove dangerous characters
    const sanitized = filename
      .replace(/[^a-zA-Z0-9.-_]/g, '_') // Replace special chars with underscore
      .replace(/_+/g, '_') // Replace multiple underscores with single
      .replace(/^_|_$/g, '') // Remove leading/trailing underscores
      .toLowerCase();

    // Ensure it has an extension
    if (!path.extname(sanitized)) {
      return sanitized + '.bin';
    }

    return sanitized;
  }
}

// Initialize service
FileUploadService.initialize();