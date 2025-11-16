/**
 * Metrics Service for Google Cloud Monitoring
 *
 * Publishes custom metrics for business and operational insights.
 */

import { MetricServiceClient } from '@google-cloud/monitoring';
import { Injectable, Logger } from '@nestjs/common';

export enum MetricType {
  // Processing duration metrics
  EXPORT_DURATION = 'discharge/export/duration',
  SIMPLIFICATION_DURATION = 'discharge/simplification/duration',
  TRANSLATION_DURATION = 'discharge/translation/duration',

  // Gemini API metrics
  GEMINI_TOKENS = 'discharge/gemini/tokens',
  GEMINI_COST = 'discharge/gemini/cost',

  // FHIR API metrics
  FHIR_REQUESTS = 'discharge/fhir/requests',
  FHIR_ERRORS = 'discharge/fhir/errors',
  FHIR_LATENCY = 'discharge/fhir/latency',

  // System metrics
  PUBSUB_LAG = 'discharge/pubsub/lag',
  SUCCESS_RATE = 'discharge/export/success_rate',
  EXPORTS_PER_TENANT = 'discharge/export/per_tenant',
}

export enum MetricKind {
  GAUGE = 'GAUGE',
  CUMULATIVE = 'CUMULATIVE',
  DELTA = 'DELTA',
}

export enum ValueType {
  INT64 = 'INT64',
  DOUBLE = 'DOUBLE',
  DISTRIBUTION = 'DISTRIBUTION',
}

interface MetricLabels {
  tenant_id?: string;
  operation?: string;
  status?: string;
  language?: string;
  error_type?: string;
  [key: string]: string | undefined;
}

@Injectable()
export class MetricsService {
  private client: MetricServiceClient;
  private projectId: string;
  private projectPath: string;
  private readonly logger = new Logger(MetricsService.name);

  constructor() {
    this.projectId = process.env.GCP_PROJECT_ID || 'patient-discharge-project';
    this.client = new MetricServiceClient();
    this.projectPath = this.client.projectPath(this.projectId);
  }

  /**
   * Record processing duration (distribution metric)
   */
  async recordDuration(
    metricType: MetricType,
    durationMs: number,
    labels: MetricLabels = {},
  ): Promise<void> {
    try {
      const dataPoint = {
        interval: {
          endTime: {
            seconds: Math.floor(Date.now() / 1000),
          },
        },
        value: {
          doubleValue: durationMs,
        },
      };

      await this.writeTimeSeries(
        metricType,
        ValueType.DOUBLE,
        MetricKind.GAUGE,
        dataPoint,
        labels,
      );
    } catch (error) {
      this.logger.error(`Failed to record duration metric: ${error.message}`);
    }
  }

  /**
   * Increment counter (cumulative metric)
   */
  async incrementCounter(
    metricType: MetricType,
    value: number = 1,
    labels: MetricLabels = {},
  ): Promise<void> {
    try {
      const dataPoint = {
        interval: {
          endTime: {
            seconds: Math.floor(Date.now() / 1000),
          },
        },
        value: {
          int64Value: value,
        },
      };

      await this.writeTimeSeries(
        metricType,
        ValueType.INT64,
        MetricKind.CUMULATIVE,
        dataPoint,
        labels,
      );
    } catch (error) {
      this.logger.error(`Failed to increment counter: ${error.message}`);
    }
  }

  /**
   * Set gauge value (point-in-time metric)
   */
  async setGauge(
    metricType: MetricType,
    value: number,
    labels: MetricLabels = {},
  ): Promise<void> {
    try {
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

      await this.writeTimeSeries(
        metricType,
        ValueType.DOUBLE,
        MetricKind.GAUGE,
        dataPoint,
        labels,
      );
    } catch (error) {
      this.logger.error(`Failed to set gauge: ${error.message}`);
    }
  }

  /**
   * Record Gemini API usage
   */
  async recordGeminiUsage(
    inputTokens: number,
    outputTokens: number,
    tenantId: string,
  ): Promise<void> {
    const totalTokens = inputTokens + outputTokens;

    // Record token count
    await this.incrementCounter(MetricType.GEMINI_TOKENS, totalTokens, {
      tenant_id: tenantId,
    });

    // Estimate cost (Gemini 1.5 Flash pricing: $0.075 per 1M input, $0.30 per 1M output)
    const inputCost = (inputTokens / 1_000_000) * 0.075;
    const outputCost = (outputTokens / 1_000_000) * 0.3;
    const totalCost = inputCost + outputCost;

    await this.setGauge(MetricType.GEMINI_COST, totalCost, {
      tenant_id: tenantId,
    });
  }

  /**
   * Record FHIR API request
   */
  async recordFHIRRequest(
    operation: string,
    success: boolean,
    latencyMs: number,
    tenantId?: string,
  ): Promise<void> {
    // Increment request counter
    await this.incrementCounter(MetricType.FHIR_REQUESTS, 1, {
      tenant_id: tenantId,
      operation,
      status: success ? 'success' : 'error',
    });

    // Record latency
    await this.recordDuration(MetricType.FHIR_LATENCY, latencyMs, {
      tenant_id: tenantId,
      operation,
    });

    // Increment error counter if failed
    if (!success) {
      await this.incrementCounter(MetricType.FHIR_ERRORS, 1, {
        tenant_id: tenantId,
        operation,
      });
    }
  }

  /**
   * Record export success/failure
   */
  async recordExportResult(
    success: boolean,
    tenantId: string,
    durationMs: number,
  ): Promise<void> {
    // Record export duration
    await this.recordDuration(MetricType.EXPORT_DURATION, durationMs, {
      tenant_id: tenantId,
      status: success ? 'success' : 'error',
    });

    // Increment tenant export counter
    await this.incrementCounter(MetricType.EXPORTS_PER_TENANT, 1, {
      tenant_id: tenantId,
      status: success ? 'success' : 'error',
    });

    // Calculate and update success rate (simplified - should use window)
    // In production, use log-based metrics or aggregate in BigQuery
  }

  /**
   * Record Pub/Sub message age (lag)
   */
  async recordPubSubLag(topic: string, ageSeconds: number): Promise<void> {
    await this.setGauge(MetricType.PUBSUB_LAG, ageSeconds, {
      topic,
    });
  }

  /**
   * Write time series data to Cloud Monitoring
   */
  private async writeTimeSeries(
    metricType: MetricType,
    valueType: ValueType,
    metricKind: MetricKind,
    dataPoint: any,
    labels: MetricLabels,
  ): Promise<void> {
    const timeSeriesData = {
      metric: {
        type: `custom.googleapis.com/${metricType}`,
        labels: this.sanitizeLabels(labels),
      },
      resource: {
        type: 'cloud_run_revision',
        labels: {
          project_id: this.projectId,
          service_name: 'patient-discharge-backend',
          revision_name: process.env.K_REVISION || 'unknown',
          location: process.env.GCP_REGION || 'us-central1',
        },
      },
      metricKind,
      valueType,
      points: [dataPoint],
    };

    const request = {
      name: this.projectPath,
      timeSeries: [timeSeriesData],
    };

    try {
      await this.client.createTimeSeries(request);
    } catch (error) {
      // Log error but don't throw (monitoring should not break application)
      this.logger.error(
        `Failed to write time series for ${metricType}: ${error.message}`,
      );
    }
  }

  /**
   * Sanitize labels (remove undefined values, ensure string type)
   */
  private sanitizeLabels(labels: MetricLabels): Record<string, string> {
    const sanitized: Record<string, string> = {};

    for (const [key, value] of Object.entries(labels)) {
      if (value !== undefined && value !== null) {
        sanitized[key] = String(value);
      }
    }

    return sanitized;
  }

  /**
   * Helper: Start a timer for duration measurement
   */
  startTimer(): { end: (metricType: MetricType, labels?: MetricLabels) => Promise<void> } {
    const startTime = Date.now();

    return {
      end: async (metricType: MetricType, labels?: MetricLabels) => {
        const durationMs = Date.now() - startTime;
        await this.recordDuration(metricType, durationMs, labels);
      },
    };
  }
}

/**
 * Decorator for automatic method duration tracking
 *
 * Usage:
 * @TrackDuration(MetricType.EXPORT_DURATION, { operation: 'export' })
 * async exportDischarge() { ... }
 */
export function TrackDuration(
  metricType: MetricType,
  labels: MetricLabels = {},
) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const startTime = Date.now();
      const metricsService = new MetricsService();

      try {
        const result = await originalMethod.apply(this, args);
        const durationMs = Date.now() - startTime;

        await metricsService.recordDuration(metricType, durationMs, {
          ...labels,
          status: 'success',
        });

        return result;
      } catch (error) {
        const durationMs = Date.now() - startTime;

        await metricsService.recordDuration(metricType, durationMs, {
          ...labels,
          status: 'error',
        });

        throw error;
      }
    };

    return descriptor;
  };
}
