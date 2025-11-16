import { CloudEvent } from '@google-cloud/functions-framework';
import { SimplificationCompletedEvent } from '../common/common/types';
import { TranslationService } from './translation.service';
import { BackendClientService } from './backend-client.service';
import { StorageService } from './storage.service';
import { createLogger } from '../common/utils/logger';

const logger = createLogger('TranslationPubSubHandler');

// Initialize services
let translationService: TranslationService;
let backendClient: BackendClientService;
let storageService: StorageService;

/**
 * Initialize services lazily (on first invocation)
 */
function initializeServices(): void {
  if (!translationService) {
    translationService = new TranslationService();
  }
  if (!backendClient) {
    const apiBaseUrl = process.env.BACKEND_API_URL || process.env.FHIR_API_BASE_URL || 'http://localhost:3000';
    backendClient = new BackendClientService(apiBaseUrl);
  }
  if (!storageService) {
    storageService = new StorageService();
  }
}

/**
 * Cloud Function triggered by Pub/Sub message from discharge-simplification-completed topic
 */
export async function processSimplificationCompletedEvent(cloudEvent: CloudEvent<unknown>): Promise<void> {
  const startTime = Date.now();

  try {
    // Initialize services
    initializeServices();

    // Parse the Pub/Sub message
    const messageData = cloudEvent.data as any;
    const message: SimplificationCompletedEvent = JSON.parse(
      Buffer.from(messageData.message.data, 'base64').toString()
    );

    logger.info('Translation function triggered', {
      tenantId: message.tenantId,
      compositionId: message.compositionId,
      filesCount: message.simplifiedFiles.length,
    });

    // Process the simplification completed event
    await processTranslation(message);

    const totalTime = Date.now() - startTime;

    logger.info('Translation processing completed successfully', {
      compositionId: message.compositionId,
      tenantId: message.tenantId,
      totalProcessingTimeMs: totalTime,
    });
  } catch (error) {
    const totalTime = Date.now() - startTime;
    logger.error('Translation processing failed', error as Error, {
      totalProcessingTimeMs: totalTime,
    });
    throw error;
  }
}

/**
 * Process translation for a simplified discharge summary
 */
async function processTranslation(event: SimplificationCompletedEvent): Promise<void> {
  const processingStartTime = Date.now();
  const tenantId = event.tenantId || 'default';

  logger.info('Starting translation processing', {
    compositionId: event.compositionId,
    tenantId,
    filesCount: event.simplifiedFiles.length,
  });

  try {
    // Step 1: Get tenant configuration from Backend
    logger.debug('Step 1: Fetching tenant configuration from Backend');
    const tenantConfig = await backendClient.getTenantConfig(tenantId);

    logger.info('Tenant configuration fetched', {
      tenantId,
      translatedBucket: tenantConfig.buckets.translatedBucket,
      translationEnabled: tenantConfig.translationConfig.enabled,
      supportedLanguages: tenantConfig.translationConfig.supportedLanguages,
    });

    // Check if translation is enabled for this tenant
    if (!tenantConfig.translationConfig.enabled) {
      logger.info('Translation disabled for tenant, skipping processing', { tenantId });
      return;
    }

    // Check if there are supported languages
    if (!tenantConfig.translationConfig.supportedLanguages || tenantConfig.translationConfig.supportedLanguages.length === 0) {
      logger.info('No supported languages configured for tenant, skipping translation', { tenantId });
      return;
    }

    // Step 2: Determine target language
    // Priority: 1) Patient's preferred language (if supported), 2) First supported language
    let targetLanguage = tenantConfig.translationConfig.supportedLanguages[0];

    if (event.preferredLanguage) {
      // Check if the preferred language is supported
      if (tenantConfig.translationConfig.supportedLanguages.includes(event.preferredLanguage)) {
        targetLanguage = event.preferredLanguage;
        logger.info('Using patient preferred language for translation', {
          preferredLanguage: event.preferredLanguage,
          patientId: event.patientId,
          compositionId: event.compositionId,
        });
      } else {
        logger.warning('Patient preferred language not supported, using default', {
          preferredLanguage: event.preferredLanguage,
          defaultLanguage: targetLanguage,
          supportedLanguages: tenantConfig.translationConfig.supportedLanguages,
          patientId: event.patientId,
          compositionId: event.compositionId,
        });
      }
    } else {
      logger.info('No patient preferred language provided, using first supported language', {
        targetLanguage,
        compositionId: event.compositionId,
      });
    }

    logger.info('Translating to target language', {
      targetLanguage,
      compositionId: event.compositionId,
    });

    const translatedResults: {
      dischargeSummary?: { content: string; language: string };
      dischargeInstructions?: { content: string; language: string };
    } = {};

    let totalTokensUsed = 0;

    // Translate discharge summary if available
    const summaryFile = event.simplifiedFiles.find((f: any) => f.type === 'discharge-summary');
    if (summaryFile) {
      logger.debug('Step 2a: Translating discharge summary');

      // Read simplified content from GCS
      const simplifiedContent = await storageService.readSimplifiedFile(
        tenantConfig.buckets.simplifiedBucket,
        summaryFile.simplifiedPath
      );

      // Translate the content
      const translationResult = await translationService.translateContent({
        content: simplifiedContent,
        fileName: summaryFile.simplifiedPath,
        targetLanguage,
      });

      translatedResults.dischargeSummary = {
        content: translationResult.translatedContent,
        language: targetLanguage,
      };

      logger.info('Discharge summary translated successfully', {
        targetLanguage,
        originalLength: simplifiedContent.length,
        translatedLength: translationResult.translatedContent.length,
      });
    }

    // Translate discharge instructions if available
    const instructionsFile = event.simplifiedFiles.find((f: any) => f.type === 'discharge-instructions');
    if (instructionsFile) {
      logger.debug('Step 2b: Translating discharge instructions');

      // Read simplified content from GCS
      const simplifiedContent = await storageService.readSimplifiedFile(
        tenantConfig.buckets.simplifiedBucket,
        instructionsFile.simplifiedPath
      );

      // Translate the content
      const translationResult = await translationService.translateContent({
        content: simplifiedContent,
        fileName: instructionsFile.simplifiedPath,
        targetLanguage,
      });

      translatedResults.dischargeInstructions = {
        content: translationResult.translatedContent,
        language: targetLanguage,
      };

      logger.info('Discharge instructions translated successfully', {
        targetLanguage,
        originalLength: simplifiedContent.length,
        translatedLength: translationResult.translatedContent.length,
      });
    }

    // Step 3: Write translated files to tenant-specific translated bucket
    logger.debug('Step 3: Writing translated files to GCS');
    const translatedFiles = await storageService.writeTranslatedFiles(
      tenantConfig.buckets.translatedBucket,
      event.compositionId,
      translatedResults
    );

    logger.info('Translated files written to GCS', {
      bucket: tenantConfig.buckets.translatedBucket,
      filesCount: translatedFiles.length,
    });

    // Step 4: Write translated content back to FHIR via Backend API
    logger.debug('Step 4: Writing translated content back to FHIR');
    await backendClient.writeTranslatedToFhir(
      event.compositionId,
      tenantId,
      {
        dischargeSummary: translatedResults.dischargeSummary ? {
          content: translatedResults.dischargeSummary.content,
          language: translatedResults.dischargeSummary.language,
          gcsPath: translatedFiles.find((f: any) => f.type === 'discharge-summary')?.translatedPath || '',
        } : undefined,
        dischargeInstructions: translatedResults.dischargeInstructions ? {
          content: translatedResults.dischargeInstructions.content,
          language: translatedResults.dischargeInstructions.language,
          gcsPath: translatedFiles.find((f: any) => f.type === 'discharge-instructions')?.translatedPath || '',
        } : undefined,
      }
    );

    logger.info('Translated content written back to FHIR', {
      compositionId: event.compositionId,
    });

    const processingTime = Date.now() - processingStartTime;

    logger.info('Translation processing completed', {
      compositionId: event.compositionId,
      tenantId,
      filesProcessed: translatedFiles.length,
      processingTimeMs: processingTime,
      targetLanguage,
    });
  } catch (error) {
    logger.error('Translation processing failed', error as Error, {
      compositionId: event.compositionId,
      tenantId,
    });
    throw error;
  }
}

// Export services for testing
export { translationService, backendClient, storageService };
