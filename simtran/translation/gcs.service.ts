import { Storage } from '@google-cloud/storage';
import { GCSError, GCSFileMetadata, ValidationError } from '../common/types';
import { getConfig } from '../common/utils/config';
import { createLogger } from '../common/utils/logger';
import * as path from 'path';

const logger = createLogger('GCSService');

/**
 * Service for Google Cloud Storage operations
 */
export class GCSService {
  private storage: Storage;
  private config = getConfig();

  constructor() {
    this.storage = new Storage({
      projectId: this.config.projectId,
    });
    logger.info('GCS Service initialized', { projectId: this.config.projectId });
  }

  /**
   * Validate file before processing
   */
  private validateFile(fileName: string, fileSizeBytes: number): void {
    // Check file extension
    const ext = path.extname(fileName).toLowerCase();
    if (!this.config.allowedFileExtensions.includes(ext)) {
      throw new ValidationError(
        `Invalid file extension: ${ext}. Allowed: ${this.config.allowedFileExtensions.join(', ')}`
      );
    }

    // Check file size
    const fileSizeMb = fileSizeBytes / (1024 * 1024);
    if (fileSizeMb > this.config.maxFileSizeMb) {
      throw new ValidationError(
        `File size ${fileSizeMb.toFixed(2)}MB exceeds maximum ${this.config.maxFileSizeMb}MB`
      );
    }

    // Sanitize filename - check for path traversal attempts
    if (fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
      throw new ValidationError(`Invalid filename: ${fileName}. Filename contains invalid characters`);
    }

    logger.debug('File validation passed', { fileName, fileSizeMb: fileSizeMb.toFixed(2) });
  }

  /**
   * Get file metadata from GCS
   */
  async getFileMetadata(bucketName: string, fileName: string): Promise<GCSFileMetadata> {
    try {
      logger.debug('Fetching file metadata', { bucketName, fileName });

      const bucket = this.storage.bucket(bucketName);
      const file = bucket.file(fileName);
      const [metadata] = await file.getMetadata();

      const fileMetadata: GCSFileMetadata = {
        name: metadata.name || fileName,
        bucket: metadata.bucket || bucketName,
        size: parseInt(String(metadata.size || '0'), 10),
        contentType: metadata.contentType || 'application/octet-stream',
        timeCreated: new Date(metadata.timeCreated || Date.now()),
        updated: new Date(metadata.updated || Date.now()),
      };

      logger.info('File metadata retrieved', {
        fileName,
        size: fileMetadata.size,
        contentType: fileMetadata.contentType,
      });

      return fileMetadata;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to get file metadata', error as Error, { bucketName, fileName });
      throw new GCSError(`Failed to get file metadata: ${errorMessage}`);
    }
  }

  /**
   * Read file content from GCS
   */
  async readFile(bucketName: string, fileName: string): Promise<string> {
    try {
      logger.info('Reading file from GCS', { bucketName, fileName });

      // Get metadata first to validate
      const metadata = await this.getFileMetadata(bucketName, fileName);
      this.validateFile(fileName, metadata.size);

      const bucket = this.storage.bucket(bucketName);
      const file = bucket.file(fileName);

      const [contents] = await file.download();
      const contentString = contents.toString('utf-8');

      logger.info('File read successfully', {
        fileName,
        contentLength: contentString.length,
        sizeBytes: metadata.size,
      });

      return contentString;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to read file', error as Error, { bucketName, fileName });
      throw new GCSError(`Failed to read file: ${errorMessage}`);
    }
  }

  /**
   * Write file content to GCS
   */
  async writeFile(bucketName: string, fileName: string, content: string): Promise<void> {
    try {
      logger.info('Writing file to GCS', { bucketName, fileName, contentLength: content.length });

      // Validate filename
      this.validateFile(fileName, Buffer.byteLength(content, 'utf-8'));

      const bucket = this.storage.bucket(bucketName);
      const file = bucket.file(fileName);

      await file.save(content, {
        contentType: 'text/markdown',
        metadata: {
          metadata: {
            processedBy: 'discharge-summary-simplifier',
            processedAt: new Date().toISOString(),
          },
        },
      });

      logger.info('File written successfully', {
        fileName,
        contentLength: content.length,
        sizeBytes: Buffer.byteLength(content, 'utf-8'),
      });
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to write file', error as Error, { bucketName, fileName });
      throw new GCSError(`Failed to write file: ${errorMessage}`);
    }
  }

  /**
   * Generate output filename from input filename
   */
  generateOutputFileName(inputFileName: string): string {
    const ext = path.extname(inputFileName);
    const baseName = path.basename(inputFileName, ext);
    const outputFileName = `${baseName}-simplified${ext}`;

    logger.debug('Generated output filename', { inputFileName, outputFileName });

    return outputFileName;
  }

  /**
   * Check if file exists in bucket
   */
  async fileExists(bucketName: string, fileName: string): Promise<boolean> {
    try {
      const bucket = this.storage.bucket(bucketName);
      const file = bucket.file(fileName);
      const [exists] = await file.exists();

      logger.debug('File existence check', { bucketName, fileName, exists });

      return exists;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to check file existence', error as Error, { bucketName, fileName });
      throw new GCSError(`Failed to check file existence: ${errorMessage}`);
    }
  }

  /**
   * Delete file from bucket (useful for cleanup in error scenarios)
   */
  async deleteFile(bucketName: string, fileName: string): Promise<void> {
    try {
      logger.info('Deleting file from GCS', { bucketName, fileName });

      const bucket = this.storage.bucket(bucketName);
      const file = bucket.file(fileName);
      await file.delete();

      logger.info('File deleted successfully', { fileName });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to delete file', error as Error, { bucketName, fileName });
      throw new GCSError(`Failed to delete file: ${errorMessage}`);
    }
  }
}
