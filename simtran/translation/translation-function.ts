import { CloudEvent } from '@google-cloud/functions-framework';
import { TranslationService } from './translation.service';
import { GCSService } from './gcs.service';
import { FirestoreService } from './firestore.service';
import { BackendClientService } from './backend-client.service';
import { TranslationRequest, SimplificationCompletedEvent } from './common/types';
import { createLogger } from './common/utils/logger';

const logger = createLogger('TranslationFunction');

// Initialize services
let translationService: TranslationService;
let gcsService: GCSService;
let firestoreService: FirestoreService;
let backendClient: BackendClientService;

/**
 * Initialize services
 */
function initializeServices(): void {
  translationService = new TranslationService();
  gcsService = new GCSService();
  firestoreService = new FirestoreService();
  const backendUrl = process.env.BACKEND_URL || 'https://patient-discharge-backend-dev-647433528821.us-central1.run.app';
  backendClient = new BackendClientService(backendUrl);
  logger.info('Translation services initialized');
}

/**
 * Main translation function triggered by Pub/Sub events from simplification completion
 */
export async function translateDischargeSummary(cloudEvent: CloudEvent<any>): Promise<void> {
  const startTime = Date.now();

  try {
    // Initialize services if not already done
    if (!translationService || !gcsService || !firestoreService || !backendClient) {
      initializeServices();
    }

    logger.info('Received cloud event', {
      type: cloudEvent.type,
      source: cloudEvent.source,
      hasData: !!cloudEvent.data,
    });

    // Parse the Pub/Sub message - try both Gen2 CloudEvent formats
    let messageData: string | undefined;

    // Gen2 Pub/Sub format: cloudEvent.data.message.data
    if (cloudEvent.data?.message?.data) {
      messageData = cloudEvent.data.message.data;
    }
    // Alternative format: cloudEvent.data might BE the message
    else if (typeof cloudEvent.data === 'string') {
      messageData = cloudEvent.data;
    }
    // Alternative format: direct data field
    else if (cloudEvent.data?.data) {
      messageData = cloudEvent.data.data;
    }

    if (!messageData) {
      const errorData = {
        dataKeys: cloudEvent.data ? Object.keys(cloudEvent.data) : [],
        dataType: typeof cloudEvent.data,
      };
      logger.error('No message data in cloud event', new Error('Missing message data'), errorData);
      return;
    }

    // Decode the base64 message data
    const decodedData = Buffer.from(messageData, 'base64').toString('utf-8');
    logger.info('Decoded message data', {
      decodedLength: decodedData.length,
      preview: decodedData.substring(0, 200),
    });

    const event: SimplificationCompletedEvent = JSON.parse(decodedData);

    logger.info('Translation function triggered by simplification completion', {
      tenantId: event.tenantId,
      compositionId: event.compositionId,
      preferredLanguage: event.preferredLanguage,
      filesCount: event.simplifiedFiles?.length || 0,
    });

    // Get the target language from the event
    const targetLanguage = event.preferredLanguage || 'es'; // Default to Spanish
    if (!targetLanguage) {
      logger.info('No preferred language specified, skipping translation', { event });
      return;
    }

    // Skip if target language is English (no need to translate)
    if (targetLanguage.toLowerCase() === 'en') {
      logger.info('Target language is English, skipping translation', { targetLanguage });
      return;
    }

    // Accumulate translated content for FHIR write-back
    const translatedContentForFhir: {
      dischargeSummary?: { content: string; language: string; gcsPath: string };
      dischargeInstructions?: { content: string; language: string; gcsPath: string };
    } = {};

    // Process each simplified file
    for (const file of event.simplifiedFiles || []) {
      try {
        logger.info('Processing file for translation', {
          type: file.type,
          simplifiedPath: file.simplifiedPath,
          targetLanguage,
        });

        // Extract bucket and file path from simplifiedPath (format: gs://bucket/path or just path)
        let bucketName: string;
        let fileName: string;

        if (!file.simplifiedPath) {
          logger.error('File has no simplifiedPath', new Error('Missing simplifiedPath'), { fileType: file.type });
          continue;
        }

        if (file.simplifiedPath.startsWith('gs://')) {
          const parts = file.simplifiedPath.replace('gs://', '').split('/');
          bucketName = parts[0];
          fileName = parts.slice(1).join('/');
        } else {
          // Assume it's a filename and construct from tenant config
          bucketName = `discharge-summaries-simplified-${event.tenantId}`;
          fileName = file.simplifiedPath;
        }

        logger.info('Reading simplified content from GCS', {
          bucket: bucketName,
          file: fileName,
        });

        // Read the simplified content from GCS
        const content = await gcsService.readFile(bucketName, fileName);

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

        logger.info('Translated content written to GCS', {
          bucket: outputBucket,
          file: outputFileName,
        });

        // Store translated content for FHIR write-back
        const gcsPath = `gs://${outputBucket}/${outputFileName}`;
        if (file.type === 'discharge-summary') {
          translatedContentForFhir.dischargeSummary = {
            content: translationResult.translatedContent,
            language: targetLanguage,
            gcsPath,
          };
        } else if (file.type === 'discharge-instructions') {
          translatedContentForFhir.dischargeInstructions = {
            content: translationResult.translatedContent,
            language: targetLanguage,
            gcsPath,
          };
        }

        // Update Firestore with translation metrics
        if (event.compositionId && translationResult.qualityMetrics) {
          await firestoreService.updateTranslationMetrics(
            event.compositionId,
            targetLanguage,
            translationResult.qualityMetrics
          );

          logger.info('Translation metrics stored in Firestore', {
            compositionId: event.compositionId,
            targetLanguage,
          });
        }

        logger.info('File translation completed successfully', {
          inputFile: fileName,
          outputFile: outputFileName,
          targetLanguage,
        });
      } catch (fileError) {
        logger.error('Failed to translate file', fileError as Error, {
          file: file.simplifiedPath,
          targetLanguage,
        });
        // Continue processing other files even if one fails
      }
    }

    // Write translated content to FHIR via Backend API
    if (event.compositionId && (translatedContentForFhir.dischargeSummary || translatedContentForFhir.dischargeInstructions)) {
      try {
        logger.info('Writing translated content to FHIR', {
          compositionId: event.compositionId,
          tenantId: event.tenantId,
          hasDischargeSummary: !!translatedContentForFhir.dischargeSummary,
          hasDischargeInstructions: !!translatedContentForFhir.dischargeInstructions,
        });

        await backendClient.writeTranslatedToFhir(
          event.compositionId,
          event.tenantId,
          translatedContentForFhir
        );

        logger.info('Translated content written to FHIR successfully', {
          compositionId: event.compositionId,
        });
      } catch (fhirError) {
        logger.error('Failed to write translated content to FHIR', fhirError as Error, {
          compositionId: event.compositionId,
        });
        // Don't throw - we still want to report success for the translation itself
      }
    }

    const processingTime = Date.now() - startTime;
    logger.info('Translation function completed successfully', {
      compositionId: event.compositionId,
      targetLanguage,
      filesProcessed: event.simplifiedFiles?.length || 0,
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
 * Generate translated filename
 */
function generateTranslatedFileName(originalFileName: string, targetLanguage: string): string {
  // Convert: "discharge-summary-simplified.txt" -> "discharge-summary-simplified-es.txt"
  // or: "composition-id/discharge-summary-simplified.txt" -> "composition-id/discharge-summary-simplified-es.txt"

  const parts = originalFileName.split('/');
  const filename = parts[parts.length - 1];
  const pathPrefix = parts.length > 1 ? parts.slice(0, -1).join('/') + '/' : '';

  // Replace -simplified.txt or -simplified.md with -simplified-{lang}.txt/md
  const translatedFilename = filename.replace(
    /-simplified\.(txt|md)$/,
    `-simplified-${targetLanguage}.$1`
  );

  return pathPrefix + translatedFilename;
}
