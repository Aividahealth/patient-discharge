import { CloudEvent } from '@google-cloud/functions-framework';
import { SimplificationResult, ValidationError, GCSError, VertexAIError } from './common/types';
import { GCSService } from './gcs.service';
import { SimplificationService } from './simplification.service';
import { FirestoreService } from './firestore.service';
import { getConfig } from './common/utils/config';
import { createLogger } from './common/utils/logger';

const logger = createLogger('CloudFunction');

// Initialize services
let gcsService: GCSService;
let simplificationService: SimplificationService;
let firestoreService: FirestoreService;

/**
 * Initialize services lazily (on first invocation)
 */
function initializeServices(): void {
  if (!gcsService) {
    gcsService = new GCSService();
  }
  if (!simplificationService) {
    simplificationService = new SimplificationService();
  }
  if (!firestoreService) {
    firestoreService = new FirestoreService();
  }
}

/**
 * Main Cloud Function handler
 * Triggered by file upload to GCS bucket
 */
export async function processDischargeSummary(cloudEvent: CloudEvent<unknown>): Promise<void> {
  const startTime = Date.now();
  const config = getConfig();

  // Type-safe event data extraction
  // For Gen2 CloudEvents with GCS triggers, bucket and file info are in the eventId
  // Format: "bucketName/objectName/generation"
  const eventIdParts = cloudEvent.id.split('/');
  const bucketName = eventIdParts[0];
  const fileName = eventIdParts.slice(1, -1).join('/'); // Everything between bucket and generation

  logger.info('Cloud Function triggered', {
    eventId: cloudEvent.id,
    eventType: cloudEvent.type,
    bucketName,
    fileName,
  });

  try {
    // Initialize services
    initializeServices();

    // Validate that this is from the input bucket
    if (bucketName !== config.inputBucket) {
      logger.warning('Ignoring file from unexpected bucket', {
        receivedBucket: bucketName,
        receivedBucketType: typeof bucketName,
        expectedBucket: config.inputBucket,
        expectedBucketType: typeof config.inputBucket,
        areEqual: bucketName === config.inputBucket,
      });
      return;
    }

    // Process the file
    const result = await processFile(bucketName, fileName);

    const totalTime = Date.now() - startTime;

    logger.info('Processing completed successfully', {
      ...result,
      totalProcessingTimeMs: totalTime,
    });
  } catch (error) {
    const totalTime = Date.now() - startTime;

    if (error instanceof ValidationError) {
      logger.warning('Validation error', {
        fileName,
        error: error.message,
        totalProcessingTimeMs: totalTime,
      });
      // Don't throw - validation errors should not retry
      return;
    }

    if (error instanceof GCSError) {
      logger.error('GCS error', error, {
        fileName,
        totalProcessingTimeMs: totalTime,
      });
      throw error; // Retry GCS errors
    }

    if (error instanceof VertexAIError) {
      logger.error('Vertex AI error', error, {
        fileName,
        retryable: error.retryable,
        totalProcessingTimeMs: totalTime,
      });

      if (error.retryable) {
        throw error; // Retry if error is retryable
      }
      return; // Don't retry non-retryable errors
    }

    // Unknown error
    logger.critical('Unexpected error', error as Error, {
      fileName,
      totalProcessingTimeMs: totalTime,
    });
    throw error;
  }
}

/**
 * Process a single file: read, simplify, write
 */
async function processFile(bucketName: string, fileName: string): Promise<SimplificationResult> {
  const processingStartTime = Date.now();

  logger.info('Starting file processing', { bucketName, fileName });

  try {
    // Step 1: Read the file from GCS
    logger.debug('Step 1: Reading file from GCS');
    const content = await gcsService.readFile(bucketName, fileName);
    const originalSize = Buffer.byteLength(content, 'utf-8');

    logger.info('File read successfully', {
      fileName,
      contentLength: content.length,
      sizeBytes: originalSize,
    });

    // Step 2: Validate content
    logger.debug('Step 2: Validating medical content');
    const isValidMedicalContent = simplificationService.validateMedicalContent(content);

    if (!isValidMedicalContent) {
      throw new ValidationError(
        'Content does not appear to be a medical discharge summary. Missing required medical terminology.'
      );
    }

    logger.info('Content validation passed', { fileName });

    // Step 3: Simplify using Vertex AI
    logger.debug('Step 3: Simplifying content with Vertex AI');
    const simplificationResult = await simplificationService.simplify({
      content,
      fileName,
    });

    logger.info('Content simplified successfully', {
      fileName,
      originalLength: content.length,
      simplifiedLength: simplificationResult.simplifiedContent.length,
      tokensUsed: simplificationResult.tokensUsed,
    });

    // Step 4: Generate output filename
    const outputFileName = gcsService.generateOutputFileName(fileName);

    logger.debug('Step 4: Writing simplified content to GCS', {
      outputFileName,
    });

    // Step 5: Write simplified content to output bucket
    const config = getConfig();
    await gcsService.writeFile(
      config.outputBucket,
      outputFileName,
      simplificationResult.simplifiedContent
    );

    // Step 6: Update Firestore metadata
    logger.debug('Step 6: Updating Firestore metadata');
    await firestoreService.upsertDischargeSummary(fileName, outputFileName);
    logger.info('Firestore metadata updated', { fileName, outputFileName });

    const simplifiedSize = Buffer.byteLength(simplificationResult.simplifiedContent, 'utf-8');
    const processingTime = Date.now() - processingStartTime;

    const result: SimplificationResult = {
      success: true,
      originalFileName: fileName,
      simplifiedFileName: outputFileName,
      originalSize,
      simplifiedSize,
      processingTimeMs: processingTime,
    };

    logger.info('File processing completed', { ...result });

    return result;
  } catch (error) {
    const processingTime = Date.now() - processingStartTime;

    const result: SimplificationResult = {
      success: false,
      originalFileName: fileName,
      simplifiedFileName: '',
      originalSize: 0,
      simplifiedSize: 0,
      processingTimeMs: processingTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    };

    logger.error('File processing failed', error as Error, { ...result });

    throw error;
  }
}

// Export Pub/Sub handler
export { processDischargeExportEvent } from './pubsub-handler';

// Export for local testing
export { gcsService, simplificationService };
