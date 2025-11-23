import { Firestore } from '@google-cloud/firestore';
import { QualityMetrics } from './common/utils/quality-metrics';
import { createLogger } from './common/utils/logger';

const logger = createLogger('QualityMetricsService');

/**
 * Service for storing and retrieving quality metrics in Firestore
 */
export class QualityMetricsService {
  private firestore: Firestore;
  private readonly collectionName = 'quality_metrics';

  constructor() {
    this.firestore = new Firestore();
    logger.info('QualityMetricsService initialized');
  }

  /**
   * Store quality metrics for a composition
   */
  async storeMetrics(
    compositionId: string,
    tenantId: string,
    qualityMetrics: QualityMetrics
  ): Promise<void> {
    try {
      const docRef = this.firestore
        .collection(this.collectionName)
        .doc(compositionId);

      const data = {
        compositionId,
        tenantId,
        qualityMetrics,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await docRef.set(data);

      logger.info('Quality metrics stored', {
        compositionId,
        tenantId,
        fleschKincaidGrade: qualityMetrics.readability.fleschKincaidGradeLevel,
        fleschReadingEase: qualityMetrics.readability.fleschReadingEase,
        smogIndex: qualityMetrics.readability.smogIndex,
      });
    } catch (error) {
      logger.error('Failed to store quality metrics', error as Error, {
        compositionId,
        tenantId,
      });
      throw error;
    }
  }

  /**
   * Get quality metrics for a composition
   */
  async getMetrics(compositionId: string): Promise<QualityMetrics | null> {
    try {
      const doc = await this.firestore
        .collection(this.collectionName)
        .doc(compositionId)
        .get();

      if (!doc.exists) {
        return null;
      }

      const data = doc.data();
      return data?.qualityMetrics || null;
    } catch (error) {
      logger.error('Failed to get quality metrics', error as Error, {
        compositionId,
      });
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
      const batches = [];

      for (let i = 0; i < compositionIds.length; i += batchSize) {
        const batch = compositionIds.slice(i, i + batchSize);
        batches.push(batch);
      }

      // Execute all batches in parallel
      const results = await Promise.all(
        batches.map(async (batch) => {
          const snapshot = await this.firestore
            .collection(this.collectionName)
            .where('compositionId', 'in', batch)
            .get();

          const batchMetrics = new Map<string, QualityMetrics>();
          snapshot.forEach((doc) => {
            const data = doc.data();
            if (data?.compositionId && data?.qualityMetrics) {
              batchMetrics.set(data.compositionId, data.qualityMetrics);
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

      logger.info('Batch quality metrics retrieved', {
        requested: compositionIds.length,
        found: metricsMap.size,
      });

      return metricsMap;
    } catch (error) {
      logger.error('Failed to get batch quality metrics', error as Error, {
        compositionIdsCount: compositionIds.length,
      });
      return metricsMap;
    }
  }
}
