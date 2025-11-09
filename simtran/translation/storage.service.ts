import { Storage } from '@google-cloud/storage';
import { createLogger } from '../common/utils/logger';

const logger = createLogger('StorageService');

export interface TranslatedFile {
  type: 'discharge-summary' | 'discharge-instructions';
  simplifiedPath: string;
  translatedPath: string;
  language: string;
}

/**
 * Service for Google Cloud Storage operations
 */
export class StorageService {
  private storage: Storage;

  constructor() {
    this.storage = new Storage();
    logger.info('StorageService initialized');
  }

  /**
   * Read simplified file from GCS
   */
  async readSimplifiedFile(bucketName: string, filePath: string): Promise<string> {
    logger.info('Reading simplified file from GCS', {
      bucket: bucketName,
      file: filePath,
    });

    try {
      const bucket = this.storage.bucket(bucketName);
      const file = bucket.file(filePath);

      const [contents] = await file.download();
      const content = contents.toString('utf-8');

      logger.info('Successfully read simplified file', {
        bucket: bucketName,
        file: filePath,
        contentLength: content.length,
      });

      return content;
    } catch (error) {
      logger.error('Failed to read simplified file', error as Error, {
        bucket: bucketName,
        file: filePath,
      });
      throw error;
    }
  }

  /**
   * Write translated files to GCS (tenant-specific translated bucket)
   */
  async writeTranslatedFiles(
    bucketName: string,
    compositionId: string,
    translatedContent: {
      dischargeSummary?: { content: string; language: string };
      dischargeInstructions?: { content: string; language: string };
    }
  ): Promise<TranslatedFile[]> {
    logger.info('Writing translated files to GCS', {
      bucket: bucketName,
      compositionId,
      hasDischargeSummary: !!translatedContent.dischargeSummary,
      hasDischargeInstructions: !!translatedContent.dischargeInstructions,
    });

    const translatedFiles: TranslatedFile[] = [];

    try {
      const bucket = this.storage.bucket(bucketName);

      // Write discharge summary if provided
      if (translatedContent.dischargeSummary) {
        const { content, language } = translatedContent.dischargeSummary;
        const simplifiedPath = `${compositionId}/discharge-summary-simplified.md`;
        const translatedPath = `${compositionId}/discharge-summary-${language}.md`;

        const file = bucket.file(translatedPath);
        await file.save(content, {
          contentType: 'text/markdown',
          metadata: {
            compositionId,
            type: 'discharge-summary',
            language,
            translatedFrom: simplifiedPath,
          },
        });

        translatedFiles.push({
          type: 'discharge-summary',
          simplifiedPath,
          translatedPath,
          language,
        });

        logger.info('Wrote translated discharge summary', {
          bucket: bucketName,
          file: translatedPath,
          language,
        });
      }

      // Write discharge instructions if provided
      if (translatedContent.dischargeInstructions) {
        const { content, language } = translatedContent.dischargeInstructions;
        const simplifiedPath = `${compositionId}/discharge-instructions-simplified.md`;
        const translatedPath = `${compositionId}/discharge-instructions-${language}.md`;

        const file = bucket.file(translatedPath);
        await file.save(content, {
          contentType: 'text/markdown',
          metadata: {
            compositionId,
            type: 'discharge-instructions',
            language,
            translatedFrom: simplifiedPath,
          },
        });

        translatedFiles.push({
          type: 'discharge-instructions',
          simplifiedPath,
          translatedPath,
          language,
        });

        logger.info('Wrote translated discharge instructions', {
          bucket: bucketName,
          file: translatedPath,
          language,
        });
      }

      logger.info('Successfully wrote all translated files', {
        bucket: bucketName,
        filesWritten: translatedFiles.length,
      });

      return translatedFiles;
    } catch (error) {
      logger.error('Failed to write translated files', error as Error, {
        bucket: bucketName,
        compositionId,
      });
      throw error;
    }
  }
}
