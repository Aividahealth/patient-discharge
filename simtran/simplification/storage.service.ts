import { Storage } from '@google-cloud/storage';
import { createLogger } from './common/utils/logger';
import { getConfig } from './common/utils/config';

const logger = createLogger('StorageService');

export interface SimplifiedFile {
  type: 'discharge-summary' | 'discharge-instructions';
  originalPath: string;
  simplifiedPath: string;
  language: string;
}

export interface Binary {
  id: string;
  text: string;
  contentType: string;
  category: string;
}

/**
 * Service for tenant-aware GCS operations
 */
export class StorageService {
  private storage: Storage;
  private config = getConfig();

  constructor() {
    this.storage = new Storage({
      projectId: this.config.projectId,
    });
    logger.info('StorageService initialized', { projectId: this.config.projectId });
  }

  /**
   * Write raw files to tenant-specific raw bucket
   */
  async writeRawFiles(
    bucketName: string,
    compositionId: string,
    dischargeSummaries: Binary[],
    dischargeInstructions: Binary[]
  ): Promise<void> {
    logger.info('Writing raw files to GCS', {
      bucketName,
      compositionId,
      summariesCount: dischargeSummaries.length,
      instructionsCount: dischargeInstructions.length,
    });

    // Ensure bucket exists before writing
    await this.ensureBucketExists(bucketName);

    const bucket = this.storage.bucket(bucketName);

    // Write discharge summaries
    for (const summary of dischargeSummaries) {
      const fileName = `${compositionId}-discharge-summary.txt`;
      await bucket.file(fileName).save(summary.text, {
        contentType: 'text/plain',
        metadata: {
          metadata: {
            compositionId,
            category: 'discharge-summary',
            processedBy: 'discharge-simplification-service',
            processedAt: new Date().toISOString(),
          },
        },
      });
      logger.info('Wrote discharge summary to GCS', { bucketName, fileName });
    }

    // Write discharge instructions
    for (const instruction of dischargeInstructions) {
      const fileName = `${compositionId}-discharge-instructions.txt`;
      await bucket.file(fileName).save(instruction.text, {
        contentType: 'text/plain',
        metadata: {
          metadata: {
            compositionId,
            category: 'discharge-instructions',
            processedBy: 'discharge-simplification-service',
            processedAt: new Date().toISOString(),
          },
        },
      });
      logger.info('Wrote discharge instructions to GCS', { bucketName, fileName });
    }
  }

  /**
   * Write simplified files to tenant-specific simplified bucket
   */
  async writeSimplifiedFiles(
    bucketName: string,
    compositionId: string,
    simplifiedResults: any
  ): Promise<SimplifiedFile[]> {
    logger.info('Writing simplified files to GCS', {
      bucketName,
      compositionId,
    });

    // Ensure bucket exists before writing
    await this.ensureBucketExists(bucketName);

    const bucket = this.storage.bucket(bucketName);
    const files: SimplifiedFile[] = [];

    // Write simplified discharge summary
    if (simplifiedResults.dischargeSummary) {
      const fileName = `${compositionId}-discharge-summary-simplified.txt`;
      const gcsPath = `gs://${bucketName}/${fileName}`;

      await bucket.file(fileName).save(simplifiedResults.dischargeSummary.content, {
        contentType: 'text/plain',
        metadata: {
          metadata: {
            compositionId,
            category: 'discharge-summary-simplified',
            processedBy: 'discharge-simplification-service',
            processedAt: new Date().toISOString(),
            tokensUsed: simplifiedResults.dischargeSummary.tokensUsed?.toString() || '0',
          },
        },
      });

      logger.info('Wrote simplified discharge summary to GCS', { bucketName, fileName });

      files.push({
        type: 'discharge-summary',
        originalPath: `gs://${bucketName.replace('simplified', 'raw')}/${compositionId}-discharge-summary.txt`,
        simplifiedPath: gcsPath,
        language: 'en',
      });
    }

    // Write simplified discharge instructions
    if (simplifiedResults.dischargeInstructions) {
      const fileName = `${compositionId}-discharge-instructions-simplified.txt`;
      const gcsPath = `gs://${bucketName}/${fileName}`;

      await bucket.file(fileName).save(simplifiedResults.dischargeInstructions.content, {
        contentType: 'text/plain',
        metadata: {
          metadata: {
            compositionId,
            category: 'discharge-instructions-simplified',
            processedBy: 'discharge-simplification-service',
            processedAt: new Date().toISOString(),
            tokensUsed: simplifiedResults.dischargeInstructions.tokensUsed?.toString() || '0',
          },
        },
      });

      logger.info('Wrote simplified discharge instructions to GCS', { bucketName, fileName });

      files.push({
        type: 'discharge-instructions',
        originalPath: `gs://${bucketName.replace('simplified', 'raw')}/${compositionId}-discharge-instructions.txt`,
        simplifiedPath: gcsPath,
        language: 'en',
      });
    }

    return files;
  }

  /**
   * Check if bucket exists
   */
  async bucketExists(bucketName: string): Promise<boolean> {
    try {
      const [exists] = await this.storage.bucket(bucketName).exists();
      return exists;
    } catch (error) {
      logger.error('Failed to check bucket existence', error as Error, { bucketName });
      return false;
    }
  }

  /**
   * Ensure bucket exists, create if it doesn't
   */
  private async ensureBucketExists(bucketName: string): Promise<void> {
    const exists = await this.bucketExists(bucketName);
    if (!exists) {
      logger.info(`Bucket ${bucketName} does not exist, creating it...`);
      try {
        const location = process.env.LOCATION || 'us-central1';
        await this.storage.createBucket(bucketName, {
          location,
          storageClass: 'STANDARD',
        });
        logger.info(`✅ Created bucket: ${bucketName}`);
      } catch (error) {
        logger.error(`Failed to create bucket ${bucketName}`, error as Error);
        throw new Error(`Failed to create bucket ${bucketName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }
}
