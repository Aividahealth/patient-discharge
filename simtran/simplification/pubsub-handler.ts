import { CloudEvent } from '@google-cloud/functions-framework';
import { DischargeExportEvent, FHIRAPIError, ValidationError, SimplificationResult } from '../common/types';
import { FHIRAPIService } from './fhir-api.service';
import { GCSService } from './gcs.service';
import { SimplificationService } from './simplification.service';
import { FirestoreService } from './firestore.service';
import { getConfig } from '../common/utils/config';
import { createLogger } from '../common/utils/logger';

const logger = createLogger('PubSubHandler');

// Initialize services
let fhirApiService: FHIRAPIService;
let gcsService: GCSService;
let simplificationService: SimplificationService;
let firestoreService: FirestoreService;

/**
 * Initialize services lazily (on first invocation)
 */
function initializeServices(): void {
  if (!fhirApiService) {
    // Get API base URL from environment variable or use default
    const apiBaseUrl = process.env.FHIR_API_BASE_URL || 'http://localhost:3000';
    fhirApiService = new FHIRAPIService(apiBaseUrl);
  }
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
 * Main Cloud Function handler for Pub/Sub messages
 * Triggered by discharge export events
 */
export async function processDischargeExportEvent(cloudEvent: CloudEvent<unknown>): Promise<void> {
  const startTime = Date.now();

  logger.info('Pub/Sub message received', {
    eventId: cloudEvent.id,
    eventType: cloudEvent.type,
  });

  try {
    // Initialize services
    initializeServices();

    // Parse the Pub/Sub message
    const messageData = cloudEvent.data as { message?: { data?: string } };

    if (!messageData || !messageData.message || !messageData.message.data) {
      throw new ValidationError('Invalid Pub/Sub message format: missing message.data');
    }

    // Decode the base64-encoded message data
    const decodedData = Buffer.from(messageData.message.data, 'base64').toString('utf-8');
    const event: DischargeExportEvent = JSON.parse(decodedData);

    logger.info('Parsed discharge export event', {
      tenantId: event.tenantId,
      patientId: event.patientId,
      googleCompositionId: event.googleCompositionId,
      status: event.status,
    });

    // Validate event status
    if (event.status !== 'success') {
      logger.warning('Ignoring event with non-success status', {
        status: event.status,
        googleCompositionId: event.googleCompositionId,
      });
      return;
    }

    // Validate required fields
    if (!event.googleCompositionId) {
      throw new ValidationError('Missing googleCompositionId in event');
    }

    // Process the discharge export
    const result = await processDischargeExport(event);

    const totalTime = Date.now() - startTime;

    logger.info('Discharge export processing completed successfully', {
      ...result,
      totalProcessingTimeMs: totalTime,
    });
  } catch (error) {
    const totalTime = Date.now() - startTime;

    if (error instanceof ValidationError) {
      logger.warning('Validation error', {
        error: error.message,
        totalProcessingTimeMs: totalTime,
      });
      // Don't throw - validation errors should not retry
      return;
    }

    if (error instanceof FHIRAPIError) {
      logger.error('FHIR API error', error, {
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
      totalProcessingTimeMs: totalTime,
    });
    throw error;
  }
}

/**
 * Process a discharge export event: fetch binaries, write to files, and simplify
 */
async function processDischargeExport(event: DischargeExportEvent): Promise<{
  dischargeSummaryResults: SimplificationResult[];
  dischargeInstructionResults: SimplificationResult[];
}> {
  const processingStartTime = Date.now();
  const config = getConfig();

  logger.info('Starting discharge export processing', {
    googleCompositionId: event.googleCompositionId,
  });

  try {
    // Step 1: Fetch binaries from FHIR API
    logger.debug('Step 1: Fetching binaries from FHIR API');
    const binariesResponse = await fhirApiService.fetchBinaries(event.googleCompositionId);

    logger.info('Binaries fetched successfully', {
      compositionId: binariesResponse.compositionId,
      dischargeSummaries: binariesResponse.dischargeSummaries.length,
      dischargeInstructions: binariesResponse.dischargeInstructions.length,
    });

    // Validate response
    if (!fhirApiService.validateBinariesResponse(binariesResponse)) {
      throw new ValidationError('FHIR API response missing required binaries');
    }

    // Step 2: Process discharge summaries
    logger.debug('Step 2: Processing discharge summaries');
    const dischargeSummaryResults: SimplificationResult[] = [];

    for (const summary of binariesResponse.dischargeSummaries) {
      const fileName = `${event.googleCompositionId}-discharge-summary.txt`;

      // Write original content to input bucket
      await gcsService.writeFile(config.inputBucket, fileName, summary.text);

      logger.info('Wrote discharge summary to file', {
        fileName,
        contentLength: summary.text.length,
      });

      // Process through simplification pipeline
      const result = await processBinary(fileName, summary.text, 'discharge-summary');
      dischargeSummaryResults.push(result);
    }

    // Step 3: Process discharge instructions
    logger.debug('Step 3: Processing discharge instructions');
    const dischargeInstructionResults: SimplificationResult[] = [];

    for (const instruction of binariesResponse.dischargeInstructions) {
      const fileName = `${event.googleCompositionId}-discharge-instructions.txt`;

      // Write original content to input bucket
      await gcsService.writeFile(config.inputBucket, fileName, instruction.text);

      logger.info('Wrote discharge instructions to file', {
        fileName,
        contentLength: instruction.text.length,
      });

      // Process through simplification pipeline
      const result = await processBinary(fileName, instruction.text, 'discharge-instructions');
      dischargeInstructionResults.push(result);
    }

    const processingTime = Date.now() - processingStartTime;

    logger.info('Discharge export processing completed', {
      compositionId: event.googleCompositionId,
      summariesProcessed: dischargeSummaryResults.length,
      instructionsProcessed: dischargeInstructionResults.length,
      processingTimeMs: processingTime,
    });

    return {
      dischargeSummaryResults,
      dischargeInstructionResults,
    };
  } catch (error) {
    logger.error('Discharge export processing failed', error as Error, {
      compositionId: event.googleCompositionId,
    });
    throw error;
  }
}

/**
 * Process a single binary: simplify and write output
 */
async function processBinary(
  fileName: string,
  content: string,
  category: string
): Promise<SimplificationResult> {
  const processingStartTime = Date.now();
  const config = getConfig();

  logger.info('Starting binary processing', {
    fileName,
    category,
    contentLength: content.length,
  });

  try {
    const originalSize = Buffer.byteLength(content, 'utf-8');

    // Step 1: Validate content
    logger.debug('Step 1: Validating medical content');
    const isValidMedicalContent = simplificationService.validateMedicalContent(content);

    if (!isValidMedicalContent) {
      logger.warning('Content validation failed, but continuing processing', {
        fileName,
        category,
      });
    }

    // Step 2: Simplify using Vertex AI
    logger.debug('Step 2: Simplifying content with Vertex AI');
    const simplificationResult = await simplificationService.simplify({
      content,
      fileName,
    });

    logger.info('Content simplified successfully', {
      fileName,
      category,
      originalLength: content.length,
      simplifiedLength: simplificationResult.simplifiedContent.length,
      tokensUsed: simplificationResult.tokensUsed,
    });

    // Step 3: Generate output filename
    const outputFileName = gcsService.generateOutputFileName(fileName);

    logger.debug('Step 3: Writing simplified content to GCS', {
      outputFileName,
    });

    // Step 4: Write simplified content to output bucket
    await gcsService.writeFile(
      config.outputBucket,
      outputFileName,
      simplificationResult.simplifiedContent
    );

    // Step 5: Update Firestore metadata
    logger.debug('Step 5: Updating Firestore metadata');
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

    logger.info('Binary processing completed', { ...result, category });

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

    logger.error('Binary processing failed', error as Error, { ...result, category });

    throw error;
  }
}

// Export services for testing
export { fhirApiService, gcsService, simplificationService, firestoreService };
