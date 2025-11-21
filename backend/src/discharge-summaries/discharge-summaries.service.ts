import { Injectable, Logger } from '@nestjs/common';
import { GcsService } from './gcs.service';
import { FirestoreService } from './firestore.service';
import { QualityMetricsService } from '../quality-metrics/quality-metrics.service';
import {
  DischargeSummaryMetadata,
  DischargeSummaryResponse,
  DischargeSummaryListQuery,
  DischargeSummaryListResponse,
  DischargeSummaryContentQuery,
  DischargeSummaryVersion,
  DischargeSummaryStatus,
  SyncResult,
} from './discharge-summary.types';

@Injectable()
export class DischargeSummariesService {
  private readonly logger = new Logger(DischargeSummariesService.name);

  constructor(
    private gcsService: GcsService,
    private firestoreService: FirestoreService,
    private qualityMetricsService: QualityMetricsService,
  ) {}

  /**
   * List discharge summaries with filtering and pagination
   */
  async list(
    query: DischargeSummaryListQuery,
    tenantId: string,
  ): Promise<DischargeSummaryListResponse> {
    const response = await this.firestoreService.list(query, tenantId);

    // Skip quality metrics fetch if no items
    if (!response.items || response.items.length === 0) {
      return response;
    }

    try {
      // Fetch quality metrics for all discharge summaries
      const compositionIds = response.items.map(item => item.id);
      const qualityMetricsMap = await this.qualityMetricsService.getBatchMetrics(compositionIds);

      // Merge quality metrics into discharge summary metadata
      const itemsWithMetrics = response.items.map(item => {
        const metrics = qualityMetricsMap.get(item.id);
        return {
          ...item,
          qualityMetrics: (metrics as any) || item.qualityMetrics,
        };
      });

      return {
        ...response,
        items: itemsWithMetrics,
      };
    } catch (error) {
      this.logger.error(`Failed to fetch quality metrics: ${error.message}`);
      // Return response without quality metrics if fetching fails
      return response;
    }
  }

  /**
   * Get discharge summary by ID (metadata only)
   */
  async getById(id: string, tenantId: string): Promise<DischargeSummaryMetadata> {
    const metadata = await this.firestoreService.getById(id, tenantId);

    // Fetch quality metrics for this discharge summary
    const qualityMetrics = await this.qualityMetricsService.getMetrics(id);

    return {
      ...metadata,
      qualityMetrics: (qualityMetrics as any) || metadata.qualityMetrics,
    };
  }

  /**
   * Get discharge summary with content
   */
  async getWithContent(
    query: DischargeSummaryContentQuery,
    tenantId: string,
  ): Promise<DischargeSummaryResponse> {
    // Get metadata from Firestore
    const metadata = await this.firestoreService.getById(query.id, tenantId);

    // Determine which file to fetch
    let fileName: string | undefined;

    switch (query.version) {
      case DischargeSummaryVersion.RAW:
        fileName = metadata.files.raw;
        break;
      case DischargeSummaryVersion.SIMPLIFIED:
        fileName = metadata.files.simplified;
        break;
      case DischargeSummaryVersion.TRANSLATED:
        if (query.language && metadata.files.translated) {
          fileName = metadata.files.translated[query.language];
        }
        break;
    }

    if (!fileName) {
      return { metadata };
    }

    // Get content from GCS
    const content = await this.gcsService.getFileContent(
      query.version,
      fileName,
      query.language,
    );

    return {
      metadata,
      content,
    };
  }

  /**
   * Get statistics
   */
  async getStats(tenantId: string): Promise<{
    firestore: {
      total: number;
      byStatus: { [key: string]: number };
    };
    gcs: {
      raw: number;
      simplified: number;
      translated: number;
    };
  }> {
    const [firestoreStats, gcsStats] = await Promise.all([
      this.firestoreService.getStats(tenantId),
      this.gcsService.getBucketStats(),
    ]);

    return {
      firestore: firestoreStats,
      gcs: gcsStats,
    };
  }

  /**
   * Sync all GCS files to Firestore
   * This should be run initially to populate Firestore from existing GCS files
   */
  async syncFromGcs(tenantId: string): Promise<SyncResult> {
    const result: SyncResult = {
      success: true,
      synced: 0,
      failed: 0,
      errors: [],
    };

    try {
      // Get all raw files as the source of truth
      const rawFiles = await this.gcsService.listFiles(
        DischargeSummaryVersion.RAW,
      );

      this.logger.log(`Found ${rawFiles.length} raw files to sync`);

      for (const rawFile of rawFiles) {
        try {
          // Check if already exists in Firestore
          const existing = await this.firestoreService.findByFilePath(rawFile, tenantId);

          if (existing) {
            this.logger.debug(`Skipping existing file: ${rawFile}`);
            continue;
          }

          // Find related files (simplified, translated)
          const relatedFiles = await this.gcsService.findRelatedFiles(rawFile);

          // Parse filename for patient info
          const fileInfo = this.gcsService.parseFilename(rawFile);

          // Get file metadata
          const rawMetadata = await this.gcsService.getFileMetadata(
            DischargeSummaryVersion.RAW,
            rawFile,
          );

          // Determine status
          let status = DischargeSummaryStatus.RAW_ONLY;
          if (Object.keys(relatedFiles.translated || {}).length > 0) {
            status = DischargeSummaryStatus.TRANSLATED;
          } else if (relatedFiles.simplified) {
            status = DischargeSummaryStatus.SIMPLIFIED;
          }

          // Create Firestore document
          await this.firestoreService.create({
            tenantId,
            patientName: fileInfo.patientName,
            status,
            files: {
              raw: rawFile,
              simplified: relatedFiles.simplified,
              translated: relatedFiles.translated,
            },
            metadata: {
              diagnosis: fileInfo.description ? [fileInfo.description] : [],
            },
          }, tenantId);

          result.synced++;
          this.logger.log(`Synced: ${rawFile}`);
        } catch (error) {
          result.failed++;
          const errorMsg = `Failed to sync ${rawFile}: ${error.message}`;
          result.errors.push(errorMsg);
          this.logger.error(errorMsg);
        }
      }

      this.logger.log(
        `Sync completed: ${result.synced} synced, ${result.failed} failed`,
      );
    } catch (error) {
      result.success = false;
      result.errors.push(`Sync failed: ${error.message}`);
      this.logger.error(`Sync failed: ${error.message}`);
    }

    return result;
  }

  /**
   * Sync a single file from GCS to Firestore
   * Used by Cloud Function trigger
   */
  async syncSingleFile(
    bucketName: string,
    fileName: string,
    tenantId: string,
  ): Promise<DischargeSummaryMetadata> {
    this.logger.log(`Syncing single file: ${bucketName}/${fileName}`);

    // Determine version from bucket name
    let version: DischargeSummaryVersion;
    if (bucketName.includes('raw')) {
      version = DischargeSummaryVersion.RAW;
    } else if (bucketName.includes('simplified')) {
      version = DischargeSummaryVersion.SIMPLIFIED;
    } else if (bucketName.includes('translated')) {
      version = DischargeSummaryVersion.TRANSLATED;
    } else {
      throw new Error(`Unknown bucket: ${bucketName}`);
    }

    // Find or create Firestore document
    let existing = await this.firestoreService.findByFilePath(fileName, tenantId);

    if (version === DischargeSummaryVersion.RAW) {
      // New raw file - create new document
      const fileInfo = this.gcsService.parseFilename(fileName);
      const relatedFiles = await this.gcsService.findRelatedFiles(fileName);

      if (!existing) {
        existing = await this.firestoreService.create({
          tenantId,
          patientName: fileInfo.patientName,
          status: DischargeSummaryStatus.RAW_ONLY,
          files: {
            raw: fileName,
            simplified: relatedFiles.simplified,
            translated: relatedFiles.translated,
          },
          metadata: {
            diagnosis: fileInfo.description ? [fileInfo.description] : [],
          },
        }, tenantId);
      }
    } else if (version === DischargeSummaryVersion.SIMPLIFIED) {
      // Simplified file - find base raw file and update
      const baseFileName = fileName.replace(/-simplified\.md$/, '.md');
      existing = await this.firestoreService.findByFilePath(baseFileName, tenantId);

      if (existing) {
        existing = await this.firestoreService.update(existing.id, {
          files: {
            ...existing.files,
            simplified: fileName,
          },
          status: DischargeSummaryStatus.SIMPLIFIED,
          simplifiedAt: new Date(),
        }, tenantId);
      }
    } else if (version === DischargeSummaryVersion.TRANSLATED) {
      // Translated file - find base file and update
      const baseFileName = fileName.replace(/-simplified-[a-z]{2}\.md$/, '.md');
      existing = await this.firestoreService.findByFilePath(baseFileName, tenantId);

      if (existing) {
        // Extract language code
        const langMatch = fileName.match(/-([a-z]{2})\.md$/);
        const language = langMatch ? langMatch[1] : 'es';

        const updatedTranslated = {
          ...(existing.files.translated || {}),
          [language]: fileName,
        };

        existing = await this.firestoreService.update(existing.id, {
          files: {
            ...existing.files,
            translated: updatedTranslated,
          },
          status: DischargeSummaryStatus.TRANSLATED,
          translatedAt: new Date(),
        }, tenantId);
      }
    }

    return existing!;
  }

  /**
   * Delete discharge summary and associated files from GCS and Firestore
   */
  async delete(id: string, tenantId: string): Promise<{ success: boolean; message: string }> {
    try {
      // Get metadata to find files
      const metadata = await this.firestoreService.getById(id, tenantId);

      // Delete files from GCS
      const filesToDelete: string[] = [];

      if (metadata.files.raw) {
        filesToDelete.push(metadata.files.raw);
      }
      if (metadata.files.simplified) {
        filesToDelete.push(metadata.files.simplified);
      }
      if (metadata.files.translated) {
        Object.values(metadata.files.translated).forEach(file => {
          if (file) filesToDelete.push(file);
        });
      }

      // Delete each file from GCS
      for (const fileName of filesToDelete) {
        try {
          // Determine bucket based on file type
          let version: DischargeSummaryVersion;
          if (fileName === metadata.files.raw) {
            version = DischargeSummaryVersion.RAW;
          } else if (fileName === metadata.files.simplified) {
            version = DischargeSummaryVersion.SIMPLIFIED;
          } else {
            version = DischargeSummaryVersion.TRANSLATED;
          }

          await this.gcsService.deleteFile(version, fileName);
          this.logger.log(`Deleted file from GCS: ${fileName}`);
        } catch (error) {
          this.logger.warn(`Failed to delete file ${fileName}: ${error.message}`);
        }
      }

      // Delete from Firestore
      await this.firestoreService.delete(id, tenantId);
      this.logger.log(`Deleted discharge summary: ${id} for tenant: ${tenantId}`);

      return {
        success: true,
        message: `Successfully deleted discharge summary ${id} and ${filesToDelete.length} associated files`,
      };
    } catch (error) {
      this.logger.error(`Failed to delete discharge summary ${id}: ${error.message}`);
      throw error;
    }
  }
}
