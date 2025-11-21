import { CloudEvent } from '@google-cloud/functions-framework';
import { SimplificationCompletedEvent, SimplifiedFile } from './common/types';
import { TranslationService } from './translation.service';
import { BackendClientService } from './backend-client.service';
import { StorageService } from './storage.service';
import { createLogger } from './common/utils/logger';

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

    // Log the raw cloudEvent for debugging
    logger.debug('Received CloudEvent', {
      id: cloudEvent.id,
      type: cloudEvent.type,
      source: cloudEvent.source,
      dataContentType: cloudEvent.datacontenttype,
      hasData: !!cloudEvent.data,
    });

    // Parse the Pub/Sub message
    // For Gen2 Cloud Functions with Pub/Sub triggers, the CloudEvent.data can be:
    // 1. An object with { message: { data: <base64>, attributes: {} } }
    // 2. Or directly the message object { data: <base64>, attributes: {} }
    const messageData = cloudEvent.data as any;
    
    if (!messageData) {
      throw new Error('CloudEvent data is undefined');
    }

    // Determine the format of cloudEvent.data
    let messageJson: string;
    const dataType = typeof messageData;
    const isBuffer = Buffer.isBuffer(messageData);
    const isString = dataType === 'string';
    
    if (isString) {
      // CloudEvent.data is a string - could be JSON or base64
      const dataString = messageData as string;
      
      // Check if it looks like base64 or JSON
      if (dataString.trim().startsWith('{')) {
        // Looks like JSON
        messageJson = dataString;
        logger.debug('CloudEvent data is a JSON string', {
          length: messageJson.length,
          preview: messageJson.substring(0, 100),
        });
      } else {
        // Assume it's base64
        messageJson = Buffer.from(dataString, 'base64').toString('utf-8');
        logger.debug('CloudEvent data is a base64 string', {
          base64Length: dataString.length,
          decodedLength: messageJson.length,
          preview: messageJson.substring(0, 100),
        });
      }
    } else if (isBuffer) {
      // CloudEvent.data is a Buffer
      messageJson = messageData.toString('utf-8');
      logger.debug('CloudEvent data is a Buffer', {
        length: messageJson.length,
        preview: messageJson.substring(0, 100),
      });
    } else if (messageData.message && messageData.message.data) {
      // Wrapped format: cloudEvent.data.message.data (base64)
      messageJson = Buffer.from(messageData.message.data, 'base64').toString();
      logger.debug('Using wrapped format with base64: cloudEvent.data.message.data', {
        length: messageJson.length,
        preview: messageJson.substring(0, 100),
      });
    } else if (messageData.data) {
      // Direct format: cloudEvent.data.data (base64)
      messageJson = Buffer.from(messageData.data, 'base64').toString();
      logger.debug('Using direct format with base64: cloudEvent.data.data', {
        length: messageJson.length,
        preview: messageJson.substring(0, 100),
      });
    } else {
      // Unknown format
      const errorDetails = {
        dataType,
        isBuffer,
        isString,
        hasMessage: !!messageData.message,
        hasData: !!messageData.data,
        length: messageData.length,
        keys: isBuffer || isString ? 'buffer/string' : Object.keys(messageData).slice(0, 10),
      };
      
      logger.error('CloudEvent data structure unknown', new Error('Unknown format'), errorDetails);
      
      throw new Error(`Unexpected CloudEvent data format. Type: ${dataType}, isBuffer: ${isBuffer}, isString: ${isString}`);
    }

    const message: SimplificationCompletedEvent = JSON.parse(messageJson);

    logger.info('Translation function triggered', {
      tenantId: message.tenantId,
      compositionId: message.compositionId,
      filesCount: message.simplifiedFiles.length,
      preferredLanguage: message.preferredLanguage,
      patientId: message.patientId,
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
    // Filter out English (source language) from supported languages
    const sourceLanguage = 'en';
    const targetLanguages = tenantConfig.translationConfig.supportedLanguages.filter(
      (lang: string) => lang !== sourceLanguage
    );

    if (targetLanguages.length === 0) {
      logger.warning('No target languages available after filtering source language, skipping translation', {
        sourceLanguage,
        supportedLanguages: tenantConfig.translationConfig.supportedLanguages,
        compositionId: event.compositionId,
      });
      return;
    }

    // Priority: 1) Patient's preferred language (if supported), 2) First non-source language
    let targetLanguage = targetLanguages[0];

    if (event.preferredLanguage && event.preferredLanguage !== sourceLanguage) {
      // Check if the preferred language is supported (and not the source language)
      if (targetLanguages.includes(event.preferredLanguage)) {
        targetLanguage = event.preferredLanguage;
        logger.info('Using patient preferred language for translation', {
          preferredLanguage: event.preferredLanguage,
          patientId: event.patientId,
          compositionId: event.compositionId,
        });
      } else {
        logger.warning('Patient preferred language not supported or is source language, using default', {
          preferredLanguage: event.preferredLanguage,
          defaultLanguage: targetLanguage,
          supportedLanguages: tenantConfig.translationConfig.supportedLanguages,
          patientId: event.patientId,
          compositionId: event.compositionId,
        });
      }
    } else {
      logger.info('No patient preferred language provided, using first non-source language', {
        targetLanguage,
        compositionId: event.compositionId,
      });
    }

    logger.info('Translating to target language', {
      targetLanguage,
      compositionId: event.compositionId,
    });

    // Step 2: Fetch simplified content from FHIR (source of truth)
    logger.debug('Step 2: Fetching simplified content from FHIR');
    const simplifiedContent = await backendClient.getSimplifiedFromFhir(
      event.compositionId,
      tenantId
    );

    if (!simplifiedContent.dischargeSummary && !simplifiedContent.dischargeInstructions) {
      logger.warning('No simplified content found in FHIR, skipping translation', {
        compositionId: event.compositionId,
        tenantId,
      });
      return;
    }

    logger.info('Simplified content fetched from FHIR', {
      hasDischargeSummary: !!simplifiedContent.dischargeSummary,
      hasDischargeInstructions: !!simplifiedContent.dischargeInstructions,
    });

    const translatedResults: {
      dischargeSummary?: { content: string; language: string };
      dischargeInstructions?: { content: string; language: string };
    } = {};

    let totalTokensUsed = 0;

    // Translate discharge summary if available
    if (simplifiedContent.dischargeSummary) {
      logger.debug('Step 2a: Translating discharge summary');

      // Translate the content
      const translationResult = await translationService.translateContent({
        content: simplifiedContent.dischargeSummary.content,
        fileName: `${event.compositionId}-discharge-summary-simplified.md`,
        targetLanguage,
      });

      translatedResults.dischargeSummary = {
        content: translationResult.translatedContent,
        language: targetLanguage,
      };

      logger.info('Discharge summary translated successfully', {
        targetLanguage,
        originalLength: simplifiedContent.dischargeSummary.content.length,
        translatedLength: translationResult.translatedContent.length,
      });
    }

    // Translate discharge instructions if available
    if (simplifiedContent.dischargeInstructions) {
      logger.debug('Step 2b: Translating discharge instructions');

      // Translate the content
      const translationResult = await translationService.translateContent({
        content: simplifiedContent.dischargeInstructions.content,
        fileName: `${event.compositionId}-discharge-instructions-simplified.md`,
        targetLanguage,
      });

      translatedResults.dischargeInstructions = {
        content: translationResult.translatedContent,
        language: targetLanguage,
      };

      logger.info('Discharge instructions translated successfully', {
        targetLanguage,
        originalLength: simplifiedContent.dischargeInstructions.content.length,
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
