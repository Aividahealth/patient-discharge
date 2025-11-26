import { CloudEvent } from '@google-cloud/functions-framework';
import { TranslationService } from './translation.service';
import { GCSService } from './gcs.service';
import { FirestoreService } from './firestore.service';
import { TranslationRequest, TranslationError } from './common/types';
import { createLogger } from './common/utils/logger';

const logger = createLogger('TranslationFunction');

// Initialize services
let translationService: TranslationService;
let gcsService: GCSService;
let firestoreService: FirestoreService;

/**
 * Initialize services
 */
function initializeServices(): void {
  translationService = new TranslationService();
  gcsService = new GCSService();
  firestoreService = new FirestoreService();
  logger.info('Translation services initialized');
}

/**
 * Main translation function triggered by GCS events
 */
export async function translateDischargeSummary(cloudEvent: CloudEvent<unknown>): Promise<void> {
  const startTime = Date.now();

  try {
    // Initialize services if not already done
    if (!translationService || !gcsService) {
      initializeServices();
    }

    // Parse the cloud event
    // For Gen2 CloudEvents with GCS triggers, bucket and file info are in the eventId
    const eventIdParts = cloudEvent.id.split('/');
    const bucketName = eventIdParts[0];
    const fileName = eventIdParts.slice(1, -1).join('/');

    logger.info('Translation function triggered', {
      bucket: bucketName,
      fileName: fileName,
      eventType: cloudEvent.type,
    });

    // Validate file
    if (!fileName || !fileName.endsWith('-simplified.md')) {
      logger.info('Skipping non-simplified file', { fileName });
      return;
    }

    // Extract language parameter from filename or metadata
    const targetLanguage = extractLanguageFromFileName(fileName);
    if (!targetLanguage) {
      logger.info('No target language specified, skipping translation', { fileName });
      return;
    }

    // Read the simplified content
    logger.info('Reading simplified content', { fileName, targetLanguage });
    const content = await gcsService.readFile(bucketName, fileName);

    // Validate that this is simplified content
    if (!translationService.validateSimplifiedContent(content)) {
      logger.warning('Content does not appear to be a simplified discharge summary', { fileName });
      return;
    }

    // Translate the content
    const translationRequest: TranslationRequest = {
      content,
      fileName,
      targetLanguage,
    };

    logger.info('Starting translation', { fileName, targetLanguage });
    const translationResult = await translationService.translateContent(translationRequest);

    // Generate output filename
    const outputFileName = generateTranslatedFileName(fileName, targetLanguage);

    // Write translated content to output bucket
    const outputBucket = process.env.OUTPUT_BUCKET || 'discharge-summaries-translated';
    await gcsService.writeFile(outputBucket, outputFileName, translationResult.translatedContent);

    // Extract composition ID from filename for metrics storage
    const compositionId = extractCompositionId(fileName);

    // Update Firestore with translation info and quality metrics
    logger.info('Updating Firestore with translation', { fileName, outputFileName, targetLanguage });
    await firestoreService.updateTranslation(fileName, outputFileName, targetLanguage);

    // Store translation quality metrics if we have a composition ID
    if (compositionId && translationResult.qualityMetrics) {
      await firestoreService.updateTranslationMetrics(
        compositionId,
        targetLanguage,
        translationResult.qualityMetrics
      );
    }

    const processingTime = Date.now() - startTime;
    logger.info('Translation completed successfully', {
      fileName,
      targetLanguage,
      outputFileName,
      processingTimeMs: processingTime,
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    logger.error('Translation function failed', error as Error, {
      processingTimeMs: processingTime,
    });

    // Re-throw the error to trigger retry mechanism
    throw error;
  }
}

/**
 * Extract target language from filename
 * Expected format: filename-simplified.md -> language parameter from metadata or filename
 */
function extractLanguageFromFileName(fileName: string): string | null {
  // Check if language is specified in filename pattern
  // e.g., "discharge-simplified-es.md" or "discharge-simplified-fr.md"
  const languageMatch = fileName.match(/-simplified-([a-z]{2})\.md$/);
  if (languageMatch) {
    return languageMatch[1];
  }

  // Default languages to translate to (can be configured)
  const defaultLanguages = ['es', 'fr', 'hi', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh'];
  
  // For now, return Spanish as default
  // In production, this could be determined by:
  // 1. Metadata in the file
  // 2. Configuration
  // 3. User preferences
  return 'es'; // Default to Spanish
}

/**
 * Generate translated filename
 */
function generateTranslatedFileName(originalFileName: string, targetLanguage: string): string {
  // Convert: "discharge-simplified.md" -> "discharge-simplified-es.md"
  const baseName = originalFileName.replace('-simplified.md', '');
  return `${baseName}-simplified-${targetLanguage}.md`;
}

/**
 * Extract composition ID from filename
 * Expected format: tenantId/patientId/compositionId/discharge-summary-simplified.md
 */
function extractCompositionId(fileName: string): string | null {
  const parts = fileName.split('/');
  // The composition ID is typically the third part in the path
  if (parts.length >= 3) {
    return parts[2];
  }
  return null;
}
