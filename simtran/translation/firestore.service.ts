import { Firestore } from '@google-cloud/firestore';
import { createLogger } from './common/utils/logger';

const logger = createLogger('FirestoreService');

export class FirestoreService {
  private firestore: Firestore;
  private readonly collection = 'discharge_summaries';
  private readonly metricsCollection = 'quality_metrics';

  constructor() {
    // Use Application Default Credentials in Cloud Run
    this.firestore = new Firestore();
    logger.info('FirestoreService initialized');
  }

  /**
   * Update a discharge summary record with translation info
   */
  async updateTranslation(
    simplifiedFileName: string,
    translatedFileName: string,
    targetLanguage: string,
  ): Promise<void> {
    try {
      const now = new Date();

      // Find the record with this simplified file
      const existingSnapshot = await this.firestore
        .collection(this.collection)
        .where('files.simplified', '==', simplifiedFileName)
        .limit(1)
        .get();

      if (!existingSnapshot.empty) {
        // Update existing record with translation
        const doc = existingSnapshot.docs[0];
        const data = doc.data();

        // Get existing translations or create new object
        const translations = data.files?.translated || {};
        translations[targetLanguage] = translatedFileName;

        await doc.ref.update({
          [`files.translated.${targetLanguage}`]: translatedFileName,
          status: 'translated',
          translatedAt: now,
          updatedAt: now,
        });

        logger.info('Updated Firestore record with translation', {
          id: doc.id,
          simplifiedFileName,
          translatedFileName,
          targetLanguage,
        });
      } else {
        logger.warning('No Firestore record found for simplified file', {
          simplifiedFileName,
        });
      }
    } catch (error) {
      logger.error('Failed to update Firestore with translation', error as Error, {
        simplifiedFileName,
        translatedFileName,
        targetLanguage,
      });
      // Don't throw - Firestore errors shouldn't fail the whole function
      // The file is already processed and saved to GCS
    }
  }

  /**
   * Update quality metrics with translation information
   */
  async updateTranslationMetrics(
    compositionId: string,
    targetLanguage: string,
    translationMetrics: {
      translatedWordCount: number;
      processingTimeMs: number;
      detectedSourceLanguage?: string;
    }
  ): Promise<void> {
    try {
      const metricsRef = this.firestore
        .collection(this.metricsCollection)
        .doc(compositionId);

      // Get existing metrics document
      const metricsDoc = await metricsRef.get();

      if (metricsDoc.exists) {
        // Update existing document with translation metrics
        await metricsRef.update({
          'qualityMetrics.translation': {
            targetLanguage,
            translatedWordCount: translationMetrics.translatedWordCount,
            processingTimeMs: translationMetrics.processingTimeMs,
            detectedSourceLanguage: translationMetrics.detectedSourceLanguage || 'en',
          },
          updatedAt: new Date(),
        });

        logger.info('Updated quality metrics with translation info', {
          compositionId,
          targetLanguage,
          translatedWordCount: translationMetrics.translatedWordCount,
        });
      } else {
        logger.warning('No quality metrics document found for composition', {
          compositionId,
        });
      }
    } catch (error) {
      logger.error('Failed to update translation metrics', error as Error, {
        compositionId,
        targetLanguage,
      });
      // Don't throw - metrics errors shouldn't fail the whole function
    }
  }
}
