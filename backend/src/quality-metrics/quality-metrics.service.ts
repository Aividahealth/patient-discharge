import { Injectable, Logger } from '@nestjs/common';
import { Firestore } from '@google-cloud/firestore';
import { DevConfigService } from '../config/dev-config.service';
import { resolveServiceAccountPath } from '../utils/path.helper';

export interface ReadabilityMetrics {
  fleschKincaidGradeLevel: number;
  fleschReadingEase: number;
  smogIndex: number;
  colemanLiauIndex?: number;
  automatedReadabilityIndex?: number;
}

export interface LexicalMetrics {
  typeTokenRatio?: number;
  wordCount: number;
  sentenceCount: number;
  syllableCount?: number;
  complexWordCount?: number;
}

export interface TranslationQualityMetrics {
  translationConfidence?: number;
  detectedSourceLanguage?: string;
  targetLanguage: string;
  translatedWordCount: number;
  processingTimeMs: number;
  readability?: ReadabilityMetrics;
}

export interface QualityMetrics {
  // Simplified version metrics
  fleschKincaidGradeLevel: number;
  fleschReadingEase: number;
  smogIndex: number;
  compressionRatio: number;
  avgSentenceLength: number;

  // Raw discharge summary metrics (for comparison)
  raw?: {
    readability: ReadabilityMetrics;
    lexical: LexicalMetrics;
  };

  // Translation metrics (if translated)
  translation?: TranslationQualityMetrics;
}

interface QualityMetricsDocument {
  compositionId: string;
  tenantId: string;
  qualityMetrics: any; // Full metrics from cloud function
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class QualityMetricsService {
  private readonly logger = new Logger(QualityMetricsService.name);
  private firestore: Firestore | null = null;
  private readonly collectionName = 'quality_metrics';

  constructor(private configService: DevConfigService) {}

  /**
   * Initialize Firestore client lazily (only when first needed)
   */
  private getFirestore(): Firestore {
    if (!this.firestore) {
      let serviceAccountPath: string | undefined;

      try {
        const config = this.configService.get();
        if (config.service_account_path) {
          // Resolve the path - handles both full paths and filenames
          const resolved = resolveServiceAccountPath(config.service_account_path);
          const fs = require('fs');
          if (fs.existsSync(resolved)) {
            serviceAccountPath = resolved;
            this.logger.log(`Using Firestore service account for QualityMetrics: ${resolved}`);
          } else {
            this.logger.log(`Firestore service account not found at ${resolved}, using Application Default Credentials`);
          }
        }
      } catch (error) {
        // Config not loaded yet or running in Cloud Run with ADC
        this.logger.log('Config not available, using Application Default Credentials');
      }

      // Use ADC (Application Default Credentials) if no service account path
      this.firestore = new Firestore(
        serviceAccountPath ? { keyFilename: serviceAccountPath } : {},
      );

      this.logger.log('QualityMetrics Firestore Service initialized');
    }
    return this.firestore;
  }

  /**
   * Get quality metrics for a single composition
   */
  async getMetrics(compositionId: string): Promise<QualityMetrics | null> {
    try {
      const doc = await this.getFirestore()
        .collection(this.collectionName)
        .doc(compositionId)
        .get();

      if (!doc.exists) {
        return null;
      }

      const data = doc.data() as QualityMetricsDocument;
      return this.extractMetrics(data.qualityMetrics);
    } catch (error) {
      this.logger.error(`Failed to get quality metrics for ${compositionId}:`, error);
      return null;
    }
  }

  /**
   * Get quality metrics for multiple compositions
   */
  async getBatchMetrics(compositionIds: string[]): Promise<Map<string, QualityMetrics>> {
    const metricsMap = new Map<string, QualityMetrics>();

    if (compositionIds.length === 0) {
      return metricsMap;
    }

    try {
      // Firestore 'in' queries support up to 10 items, so we need to batch
      const batchSize = 10;
      const batches: string[][] = [];

      for (let i = 0; i < compositionIds.length; i += batchSize) {
        const batch = compositionIds.slice(i, i + batchSize);
        batches.push(batch);
      }

      // Execute all batches in parallel
      const results = await Promise.all(
        batches.map(async (batch) => {
          const snapshot = await this.getFirestore()
            .collection(this.collectionName)
            .where('compositionId', 'in', batch)
            .get();

          const batchMetrics = new Map<string, QualityMetrics>();
          snapshot.forEach((doc) => {
            const data = doc.data() as QualityMetricsDocument;
            if (data?.compositionId && data?.qualityMetrics) {
              const metrics = this.extractMetrics(data.qualityMetrics);
              if (metrics) {
                batchMetrics.set(data.compositionId, metrics);
              }
            }
          });

          return batchMetrics;
        })
      );

      // Merge all batch results
      results.forEach((batchMap) => {
        batchMap.forEach((metrics, id) => {
          metricsMap.set(id, metrics);
        });
      });

      this.logger.log(`Batch quality metrics retrieved: ${metricsMap.size}/${compositionIds.length}`);

      return metricsMap;
    } catch (error) {
      this.logger.error(`Failed to get batch quality metrics for ${compositionIds.length} compositions:`, error);
      return metricsMap;
    }
  }

  /**
   * Extract the key metrics from the full quality metrics object
   */
  private extractMetrics(fullMetrics: any): QualityMetrics | null {
    if (!fullMetrics) {
      return null;
    }

    try {
      const metrics: QualityMetrics = {
        fleschKincaidGradeLevel: fullMetrics.readability?.fleschKincaidGradeLevel ?? 0,
        fleschReadingEase: fullMetrics.readability?.fleschReadingEase ?? 0,
        smogIndex: fullMetrics.readability?.smogIndex ?? 0,
        compressionRatio: fullMetrics.simplification?.compressionRatio ?? 0,
        avgSentenceLength: fullMetrics.simplification?.avgSentenceLength ?? 0,
      };

      // Include raw metrics if available
      if (fullMetrics.raw?.readability) {
        metrics.raw = {
          readability: {
            fleschKincaidGradeLevel: fullMetrics.raw.readability.fleschKincaidGradeLevel ?? 0,
            fleschReadingEase: fullMetrics.raw.readability.fleschReadingEase ?? 0,
            smogIndex: fullMetrics.raw.readability.smogIndex ?? 0,
            colemanLiauIndex: fullMetrics.raw.readability.colemanLiauIndex,
            automatedReadabilityIndex: fullMetrics.raw.readability.automatedReadabilityIndex,
          },
          lexical: {
            typeTokenRatio: fullMetrics.raw.lexical?.typeTokenRatio,
            wordCount: fullMetrics.raw.lexical?.wordCount ?? 0,
            sentenceCount: fullMetrics.raw.lexical?.sentenceCount ?? 0,
            syllableCount: fullMetrics.raw.lexical?.syllableCount,
            complexWordCount: fullMetrics.raw.lexical?.complexWordCount,
          },
        };
      }

      // Include translation metrics if available
      if (fullMetrics.translation) {
        metrics.translation = {
          translationConfidence: fullMetrics.translation.translationConfidence,
          detectedSourceLanguage: fullMetrics.translation.detectedSourceLanguage,
          targetLanguage: fullMetrics.translation.targetLanguage ?? 'unknown',
          translatedWordCount: fullMetrics.translation.translatedWordCount ?? 0,
          processingTimeMs: fullMetrics.translation.processingTimeMs ?? 0,
          readability: fullMetrics.translation.readability ? {
            fleschKincaidGradeLevel: fullMetrics.translation.readability.fleschKincaidGradeLevel ?? 0,
            fleschReadingEase: fullMetrics.translation.readability.fleschReadingEase ?? 0,
            smogIndex: fullMetrics.translation.readability.smogIndex ?? 0,
            colemanLiauIndex: fullMetrics.translation.readability.colemanLiauIndex,
            automatedReadabilityIndex: fullMetrics.translation.readability.automatedReadabilityIndex,
          } : undefined,
        };
      }

      return metrics;
    } catch (error) {
      this.logger.error('Failed to extract quality metrics:', error);
      return null;
    }
  }
}
