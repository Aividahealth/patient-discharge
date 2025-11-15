import { CloudEvent } from '@google-cloud/functions-framework';
import { DischargeExportEvent, FHIRAPIError, ValidationError } from './common/types';
import { FHIRAPIService } from './fhir-api.service';
import { SimplificationService } from './simplification.service';
import { BackendClientService } from './backend-client.service';
import { StorageService } from './storage.service';
import { PubSubPublisherService } from './pubsub-publisher.service';
import { createLogger } from './common/utils/logger';

const logger = createLogger('PubSubHandler');

// Initialize services
let fhirApiService: FHIRAPIService;
let simplificationService: SimplificationService;
let backendClient: BackendClientService;
let storageService: StorageService;
let pubsubPublisher: PubSubPublisherService;

/**
 * Initialize services lazily (on first invocation)
 */
function initializeServices(): void {
  if (!fhirApiService) {
    const apiBaseUrl = process.env.FHIR_API_BASE_URL || process.env.BACKEND_API_URL || 'http://localhost:3000';
    fhirApiService = new FHIRAPIService(apiBaseUrl);
  }
  if (!simplificationService) {
    simplificationService = new SimplificationService();
  }
  if (!backendClient) {
    const apiBaseUrl = process.env.BACKEND_API_URL || process.env.FHIR_API_BASE_URL || 'http://localhost:3000';
    backendClient = new BackendClientService(apiBaseUrl);
  }
  if (!storageService) {
    storageService = new StorageService();
  }
  if (!pubsubPublisher) {
    pubsubPublisher = new PubSubPublisherService();
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
    // For Gen2 Cloud Functions, CloudEvent.data can be:
    // 1. A base64 string directly (when using gcloud pubsub topics publish)
    // 2. An object with { message: { data: base64string, ... } }
    const eventData = cloudEvent.data;

    let base64Data: string;

    // Check if eventData is a string (base64-encoded message directly)
    if (typeof eventData === 'string') {
      logger.debug('CloudEvent data is base64 string directly');
      base64Data = eventData;
    } else if (eventData && typeof eventData === 'object') {
      // Check for wrapped format
      const wrappedData = eventData as any;
      logger.debug('Received CloudEvent data structure', {
        hasMessage: !!wrappedData?.message,
        hasData: !!wrappedData?.message?.data,
        dataKeys: Object.keys(eventData)
      });

      if (wrappedData?.message?.data) {
        // Standard Gen2 Pub/Sub format
        base64Data = wrappedData.message.data;
      } else if (wrappedData?.data) {
        // Alternative format where message is at root level
        base64Data = wrappedData.data;
      } else {
        throw new ValidationError(`Invalid Pub/Sub message format: missing data field`);
      }
    } else {
      throw new ValidationError(`Invalid Pub/Sub message format: unexpected type ${typeof eventData}`);
    }

    // Decode the base64-encoded message data
    const decodedData = Buffer.from(base64Data, 'base64').toString('utf-8');
    logger.debug('Decoded Pub/Sub message', { decodedData: decodedData.substring(0, 200) });

    // Parse the message wrapper (contains eventType, timestamp, and data)
    const messageWrapper = JSON.parse(decodedData);

    // Extract the actual event from the 'data' field
    const event: DischargeExportEvent = messageWrapper.data || messageWrapper;

    logger.info('Parsed discharge export event', {
      eventType: messageWrapper.eventType,
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
    await processDischargeExport(event);

    const totalTime = Date.now() - startTime;

    logger.info('Discharge export processing completed successfully', {
      googleCompositionId: event.googleCompositionId,
      tenantId: event.tenantId,
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
 * Process a discharge export event: fetch binaries, simplify, write back to FHIR, and publish to translation
 */
async function processDischargeExport(event: DischargeExportEvent): Promise<void> {
  const processingStartTime = Date.now();
  const tenantId = event.tenantId || 'default';

  logger.info('Starting discharge export processing', {
    googleCompositionId: event.googleCompositionId,
    tenantId,
  });

  try {
    // Step 1: Get tenant configuration from Backend
    logger.debug('Step 1: Fetching tenant configuration from Backend');
    const tenantConfig = await backendClient.getTenantConfig(tenantId);

    logger.info('Tenant configuration fetched', {
      tenantId,
      rawBucket: tenantConfig.buckets.rawBucket,
      simplifiedBucket: tenantConfig.buckets.simplifiedBucket,
      simplificationEnabled: tenantConfig.simplificationConfig.enabled,
    });

    // Check if simplification is enabled for this tenant
    if (!tenantConfig.simplificationConfig.enabled) {
      logger.info('Simplification disabled for tenant, skipping processing', { tenantId });
      return;
    }

    // Step 2: Fetch binaries from FHIR API
    logger.debug('Step 2: Fetching binaries from FHIR API');
    const binariesResponse = await fhirApiService.fetchBinaries(
      event.googleCompositionId,
      tenantId
    );

    logger.info('Binaries fetched successfully', {
      compositionId: binariesResponse.compositionId,
      dischargeSummaries: binariesResponse.dischargeSummaries.length,
      dischargeInstructions: binariesResponse.dischargeInstructions.length,
    });

    // Validate response
    if (!fhirApiService.validateBinariesResponse(binariesResponse)) {
      throw new ValidationError('FHIR API response missing required binaries');
    }

    // Step 3: Write raw files to tenant-specific raw bucket
    logger.debug('Step 3: Writing raw files to GCS');
    await storageService.writeRawFiles(
      tenantConfig.buckets.rawBucket,
      event.googleCompositionId,
      binariesResponse.dischargeSummaries,
      binariesResponse.dischargeInstructions
    );

    logger.info('Raw files written to GCS', {
      bucket: tenantConfig.buckets.rawBucket,
      compositionId: event.googleCompositionId,
    });

    // Step 4: Simplify discharge summaries and instructions
    logger.debug('Step 4: Simplifying content');
    const simplifiedResults = await simplifyBinaries(
      binariesResponse.dischargeSummaries,
      binariesResponse.dischargeInstructions
    );

    logger.info('Content simplified successfully', {
      dischargeSummarySimplified: !!simplifiedResults.dischargeSummary,
      dischargeInstructionsSimplified: !!simplifiedResults.dischargeInstructions,
    });

    // Step 5: Write simplified files to tenant-specific simplified bucket
    logger.debug('Step 5: Writing simplified files to GCS');
    const simplifiedFiles = await storageService.writeSimplifiedFiles(
      tenantConfig.buckets.simplifiedBucket,
      event.googleCompositionId,
      simplifiedResults
    );

    logger.info('Simplified files written to GCS', {
      bucket: tenantConfig.buckets.simplifiedBucket,
      filesCount: simplifiedFiles.length,
    });

    // Step 6: Write simplified content back to FHIR via Backend API
    logger.debug('Step 6: Writing simplified content back to FHIR');
    await backendClient.writeSimplifiedToFhir(
      event.googleCompositionId,
      tenantId,
      {
        dischargeSummary: simplifiedResults.dischargeSummary ? {
          content: simplifiedResults.dischargeSummary.content,
          gcsPath: simplifiedFiles.find(f => f.type === 'discharge-summary')?.simplifiedPath || '',
        } : undefined,
        dischargeInstructions: simplifiedResults.dischargeInstructions ? {
          content: simplifiedResults.dischargeInstructions.content,
          gcsPath: simplifiedFiles.find(f => f.type === 'discharge-instructions')?.simplifiedPath || '',
        } : undefined,
      }
    );

    logger.info('Simplified content written back to FHIR', {
      compositionId: event.googleCompositionId,
    });

    // Step 7: Publish to discharge-simplification-completed topic (triggers Translation service)
    logger.debug('Step 7: Publishing to discharge-simplification-completed topic');
    const totalTokens = (simplifiedResults.dischargeSummary?.tokensUsed || 0) +
                       (simplifiedResults.dischargeInstructions?.tokensUsed || 0);

    const messageId = await pubsubPublisher.publishSimplificationCompleted({
      tenantId,
      compositionId: event.googleCompositionId,
      simplifiedFiles,
      processingTimeMs: Date.now() - processingStartTime,
      tokensUsed: totalTokens,
      timestamp: new Date().toISOString(),
    });

    logger.info('Published to discharge-simplification-completed topic', {
      messageId,
      compositionId: event.googleCompositionId,
    });

    const processingTime = Date.now() - processingStartTime;

    logger.info('Discharge export processing completed', {
      compositionId: event.googleCompositionId,
      tenantId,
      filesProcessed: simplifiedFiles.length,
      processingTimeMs: processingTime,
      tokensUsed: totalTokens,
    });
  } catch (error) {
    logger.error('Discharge export processing failed', error as Error, {
      compositionId: event.googleCompositionId,
      tenantId,
    });
    throw error;
  }
}

/**
 * Simplify discharge summaries and instructions
 */
async function simplifyBinaries(
  dischargeSummaries: Array<{ id: string; text: string }>,
  dischargeInstructions: Array<{ id: string; text: string }>
): Promise<{
  dischargeSummary?: { content: string; tokensUsed: number };
  dischargeInstructions?: { content: string; tokensUsed: number };
}> {
  const results: {
    dischargeSummary?: { content: string; tokensUsed: number };
    dischargeInstructions?: { content: string; tokensUsed: number };
  } = {};

  // Simplify discharge summary (if available)
  if (dischargeSummaries && dischargeSummaries.length > 0) {
    logger.debug('Simplifying discharge summary', {
      summariesCount: dischargeSummaries.length,
    });

    // Take first summary if multiple exist
    const summary = dischargeSummaries[0];

    // Validate content
    const isValidMedicalContent = simplificationService.validateMedicalContent(summary.text);
    if (!isValidMedicalContent) {
      logger.warning('Discharge summary validation failed, but continuing processing');
    }

    // Simplify using Vertex AI
    const simplificationResult = await simplificationService.simplify({
      content: summary.text,
      fileName: 'discharge-summary',
    });

    results.dischargeSummary = {
      content: simplificationResult.simplifiedContent,
      tokensUsed: simplificationResult.tokensUsed || 0,
    };

    logger.info('Discharge summary simplified', {
      originalLength: summary.text.length,
      simplifiedLength: simplificationResult.simplifiedContent.length,
      tokensUsed: simplificationResult.tokensUsed,
    });
  }

  // Simplify discharge instructions (if available)
  if (dischargeInstructions && dischargeInstructions.length > 0) {
    logger.debug('Simplifying discharge instructions', {
      instructionsCount: dischargeInstructions.length,
    });

    // Take first instructions if multiple exist
    const instruction = dischargeInstructions[0];

    // Validate content
    const isValidMedicalContent = simplificationService.validateMedicalContent(instruction.text);
    if (!isValidMedicalContent) {
      logger.warning('Discharge instructions validation failed, but continuing processing');
    }

    // Simplify using Vertex AI
    const simplificationResult = await simplificationService.simplify({
      content: instruction.text,
      fileName: 'discharge-instructions',
    });

    results.dischargeInstructions = {
      content: simplificationResult.simplifiedContent,
      tokensUsed: simplificationResult.tokensUsed || 0,
    };

    logger.info('Discharge instructions simplified', {
      originalLength: instruction.text.length,
      simplifiedLength: simplificationResult.simplifiedContent.length,
      tokensUsed: simplificationResult.tokensUsed,
    });
  }

  return results;
}

// Export services for testing
export { fhirApiService, simplificationService, backendClient, storageService, pubsubPublisher };
