/**
 * Cloud Function Monitoring Integration Example
 *
 * Shows how to add monitoring to existing Cloud Functions
 * (simplification-function and translation-function)
 */

import { Logging } from '@google-cloud/logging';
import { MetricServiceClient } from '@google-cloud/monitoring';
import { PubSubMessage } from '@google-cloud/pubsub';

// Initialize clients
const logging = new Logging();
const log = logging.log('patient-discharge-functions');
const metricsClient = new MetricServiceClient();
const projectId = process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;

/**
 * Structured log entry
 */
async function writeLog(
  severity: 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL',
  message: string,
  metadata?: any,
  traceContext?: { traceId: string; spanId: string }
) {
  const entry = log.entry(
    {
      severity,
      trace: traceContext?.traceId
        ? `projects/${projectId}/traces/${traceContext.traceId}`
        : undefined,
      spanId: traceContext?.spanId,
      resource: {
        type: 'cloud_function',
        labels: {
          function_name: process.env.FUNCTION_NAME || 'unknown',
          region: process.env.FUNCTION_REGION || 'us-central1',
        },
      },
    },
    {
      message,
      metadata,
      timestamp: new Date().toISOString(),
    }
  );

  await log.write(entry);
}

/**
 * Record custom metric
 */
async function writeMetric(
  metricType: string,
  value: number,
  labels: Record<string, string> = {}
) {
  const dataPoint = {
    interval: {
      endTime: {
        seconds: Math.floor(Date.now() / 1000),
      },
    },
    value: {
      doubleValue: value,
    },
  };

  const timeSeriesData = {
    metric: {
      type: `custom.googleapis.com/${metricType}`,
      labels,
    },
    resource: {
      type: 'cloud_function',
      labels: {
        function_name: process.env.FUNCTION_NAME || 'unknown',
        region: process.env.FUNCTION_REGION || 'us-central1',
        project_id: projectId,
      },
    },
    metricKind: 'GAUGE',
    valueType: 'DOUBLE',
    points: [dataPoint],
  };

  const request = {
    name: metricsClient.projectPath(projectId!),
    timeSeries: [timeSeriesData],
  };

  try {
    await metricsClient.createTimeSeries(request);
  } catch (error) {
    console.error('Failed to write metric:', error);
  }
}

/**
 * Extract trace context from Pub/Sub message
 */
function extractTraceContext(message: PubSubMessage): {
  traceId: string;
  spanId: string;
} | null {
  const traceId = message.attributes?.['x-trace-id'];
  const spanId = message.attributes?.['x-span-id'];

  if (traceId && spanId) {
    return { traceId, spanId };
  }

  return null;
}

/**
 * Simplification Function with Monitoring
 *
 * Enhanced version of existing simplification function
 */
export async function simplificationFunctionWithMonitoring(
  message: PubSubMessage,
  context: any
) {
  const startTime = Date.now();
  const traceContext = extractTraceContext(message);
  const messageData = JSON.parse(Buffer.from(message.data, 'base64').toString());
  const { tenantId, compositionId, patientId } = messageData;

  try {
    // Log function start
    await writeLog(
      'INFO',
      'Simplification function started',
      {
        tenantId,
        compositionId,
        patientId,
        eventId: context.eventId,
      },
      traceContext
    );

    // ======================
    // EXISTING LOGIC HERE
    // ======================

    // 1. Fetch tenant config
    const configStartTime = Date.now();
    const tenantConfig = await fetchTenantConfig(tenantId);
    const configDuration = Date.now() - configStartTime;

    await writeLog('INFO', 'Tenant config fetched', {
      tenantId,
      configDuration,
    });

    // 2. Fetch FHIR binaries
    const fhirStartTime = Date.now();
    const binaries = await fetchFHIRBinaries(compositionId, tenantConfig);
    const fhirDuration = Date.now() - fhirStartTime;

    // Record FHIR API metric
    await writeMetric('discharge/fhir/latency', fhirDuration, {
      tenant_id: tenantId,
      operation: 'fetch_binaries',
    });

    // 3. Write raw files to GCS
    const gcsWriteStartTime = Date.now();
    await writeRawFilesToGCS(binaries, compositionId);
    const gcsWriteDuration = Date.now() - gcsWriteStartTime;

    // 4. Simplify with Gemini
    const geminiStartTime = Date.now();
    const simplified = await simplifyWithGemini(binaries, tenantConfig);
    const geminiDuration = Date.now() - geminiStartTime;

    // Record Gemini metrics
    await writeMetric('discharge/simplification/duration', geminiDuration, {
      tenant_id: tenantId,
    });

    if (simplified.tokenUsage) {
      await writeMetric(
        'discharge/gemini/tokens',
        simplified.tokenUsage.inputTokens + simplified.tokenUsage.outputTokens,
        { tenant_id: tenantId }
      );

      // Estimate cost (Gemini 1.5 Flash pricing)
      const inputCost = (simplified.tokenUsage.inputTokens / 1_000_000) * 0.075;
      const outputCost = (simplified.tokenUsage.outputTokens / 1_000_000) * 0.3;
      const totalCost = inputCost + outputCost;

      await writeMetric('discharge/gemini/cost', totalCost, {
        tenant_id: tenantId,
      });
    }

    // 5. Write simplified files to GCS
    await writeSimplifiedFilesToGCS(simplified.content, compositionId);

    // 6. Update FHIR composition
    await updateFHIRComposition(compositionId, simplified.content, tenantConfig);

    // 7. Publish completion event
    await publishCompletionEvent(messageData);

    // ======================
    // END EXISTING LOGIC
    // ======================

    // Calculate total duration
    const totalDuration = Date.now() - startTime;

    // Log success
    await writeLog(
      'INFO',
      'Simplification completed successfully',
      {
        tenantId,
        compositionId,
        totalDuration,
        geminiDuration,
        fhirDuration,
        gcsWriteDuration,
      },
      traceContext
    );

    // Record success metric
    await writeMetric('discharge/simplification/duration', totalDuration, {
      tenant_id: tenantId,
      status: 'success',
    });

  } catch (error: any) {
    const totalDuration = Date.now() - startTime;

    // Log error
    await writeLog(
      'ERROR',
      `Simplification failed: ${error.message}`,
      {
        tenantId,
        compositionId,
        errorName: error.name,
        errorStack: error.stack,
        totalDuration,
      },
      traceContext
    );

    // Record failure metric
    await writeMetric('discharge/simplification/duration', totalDuration, {
      tenant_id: tenantId,
      status: 'error',
    });

    // Re-throw for Pub/Sub retry (if retryable)
    if (isRetryableError(error)) {
      throw error;
    }

    // For non-retryable errors, send to dead letter queue
    console.error('Non-retryable error:', error);
  }
}

/**
 * Translation Function with Monitoring
 */
export async function translationFunctionWithMonitoring(
  message: PubSubMessage,
  context: any
) {
  const startTime = Date.now();
  const traceContext = extractTraceContext(message);
  const messageData = JSON.parse(Buffer.from(message.data, 'base64').toString());
  const { tenantId, compositionId, targetLanguages } = messageData;

  try {
    await writeLog(
      'INFO',
      'Translation function started',
      {
        tenantId,
        compositionId,
        targetLanguages,
      },
      traceContext
    );

    // ======================
    // EXISTING LOGIC HERE
    // ======================

    for (const language of targetLanguages) {
      const langStartTime = Date.now();

      // 1. Fetch simplified content
      const simplifiedContent = await fetchSimplifiedContent(compositionId);

      // 2. Translate with Google Translate
      const translated = await translateContent(simplifiedContent, language);

      // 3. Write to GCS
      await writeTranslatedFile(translated, compositionId, language);

      // 4. Update FHIR
      await updateFHIRComposition(compositionId, translated, language);

      const langDuration = Date.now() - langStartTime;

      // Record per-language metric
      await writeMetric('discharge/translation/duration', langDuration, {
        tenant_id: tenantId,
        language,
        status: 'success',
      });

      await writeLog('INFO', `Translation completed for ${language}`, {
        tenantId,
        compositionId,
        language,
        duration: langDuration,
      });
    }

    // ======================
    // END EXISTING LOGIC
    // ======================

    const totalDuration = Date.now() - startTime;

    await writeLog(
      'INFO',
      'Translation completed for all languages',
      {
        tenantId,
        compositionId,
        totalDuration,
        languageCount: targetLanguages.length,
      },
      traceContext
    );

  } catch (error: any) {
    const totalDuration = Date.now() - startTime;

    await writeLog(
      'ERROR',
      `Translation failed: ${error.message}`,
      {
        tenantId,
        compositionId,
        errorName: error.name,
        errorStack: error.stack,
        totalDuration,
      },
      traceContext
    );

    // Re-throw for Pub/Sub retry
    if (isRetryableError(error)) {
      throw error;
    }
  }
}

/**
 * Determine if error is retryable
 */
function isRetryableError(error: any): boolean {
  // Retry on transient errors
  const retryableCodes = [408, 429, 500, 502, 503, 504];

  if (error.code && retryableCodes.includes(error.code)) {
    return true;
  }

  // Retry on network errors
  if (error.message?.includes('ECONNREFUSED') || error.message?.includes('ETIMEDOUT')) {
    return true;
  }

  // Don't retry on validation errors
  if (error.name === 'ValidationError') {
    return false;
  }

  // Default to non-retryable (send to DLQ for investigation)
  return false;
}

// ======================
// PLACEHOLDER FUNCTIONS
// (Replace with actual implementations)
// ======================

async function fetchTenantConfig(tenantId: string) {
  // Existing implementation
  return {};
}

async function fetchFHIRBinaries(compositionId: string, config: any) {
  // Existing implementation
  return [];
}

async function writeRawFilesToGCS(binaries: any[], compositionId: string) {
  // Existing implementation
}

async function simplifyWithGemini(binaries: any[], config: any) {
  // Existing implementation
  return {
    content: '',
    tokenUsage: { inputTokens: 5000, outputTokens: 1500 },
  };
}

async function writeSimplifiedFilesToGCS(content: string, compositionId: string) {
  // Existing implementation
}

async function updateFHIRComposition(compositionId: string, content: string, configOrLanguage: any) {
  // Existing implementation
}

async function publishCompletionEvent(messageData: any) {
  // Existing implementation
}

async function fetchSimplifiedContent(compositionId: string) {
  // Existing implementation
  return '';
}

async function translateContent(content: string, language: string) {
  // Existing implementation
  return '';
}

async function writeTranslatedFile(content: string, compositionId: string, language: string) {
  // Existing implementation
}
