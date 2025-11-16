/**
 * Structured Logger for Google Cloud Logging
 *
 * Implements standardized JSON logging with trace context propagation
 * for HIPAA-compliant audit trails and operational monitoring.
 */

import { Logging, protos } from '@google-cloud/logging';

export enum LogSeverity {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL',
}

export enum ComponentType {
  BACKEND = 'backend',
  DISCHARGE_EXPORT = 'discharge-export',
  FHIR_CLIENT = 'fhir-client',
  GCS_SERVICE = 'gcs-service',
  PUBSUB_SERVICE = 'pubsub-service',
  CONFIG_SERVICE = 'config-service',
}

export enum OperationType {
  DISCHARGE_EXPORT = 'discharge-export',
  FHIR_CREATE = 'fhir-create',
  FHIR_UPDATE = 'fhir-update',
  FHIR_READ = 'fhir-read',
  FHIR_DELETE = 'fhir-delete',
  GCS_WRITE = 'gcs-write',
  GCS_READ = 'gcs-read',
  PUBSUB_PUBLISH = 'pubsub-publish',
  CONFIG_FETCH = 'config-fetch',
}

export interface LogContext {
  tenantId?: string;
  patientId?: string;
  compositionId?: string;
  userId?: string;
  sessionId?: string;
  correlationId?: string;
}

export interface LogMetadata {
  processingTimeMs?: number;
  geminiTokens?: number;
  retryCount?: number;
  errorCode?: string;
  apiEndpoint?: string;
  httpStatusCode?: number;
  requestId?: string;
  [key: string]: any;
}

export interface StructuredLogEntry {
  severity: LogSeverity;
  timestamp: string;
  trace?: string;
  spanId?: string;
  component: ComponentType;
  operation: OperationType;
  message: string;
  context?: LogContext;
  metadata?: LogMetadata;
  labels?: Record<string, string>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

export class StructuredLogger {
  private logging: Logging;
  private log: any;
  private projectId: string;
  private environment: string;
  private version: string;

  constructor(
    projectId: string,
    logName: string = 'patient-discharge-backend',
    environment: string = process.env.NODE_ENV || 'development',
    version: string = process.env.APP_VERSION || '1.0.0',
  ) {
    this.projectId = projectId;
    this.environment = environment;
    this.version = version;

    // Initialize Cloud Logging client
    this.logging = new Logging({ projectId });
    this.log = this.logging.log(logName);
  }

  /**
   * Write a structured log entry to Cloud Logging
   */
  async write(entry: StructuredLogEntry): Promise<void> {
    // Sanitize PII from patient IDs (hash for audit trail)
    const sanitizedContext = this.sanitizeContext(entry.context);

    const logEntry = {
      severity: entry.severity,
      timestamp: entry.timestamp || new Date().toISOString(),
      jsonPayload: {
        component: entry.component,
        operation: entry.operation,
        message: entry.message,
        context: sanitizedContext,
        metadata: entry.metadata,
        error: entry.error,
      },
      labels: {
        environment: this.environment,
        version: this.version,
        ...entry.labels,
      },
      trace: entry.trace,
      spanId: entry.spanId,
    };

    const metadata: protos.google.logging.v2.ILogEntry = {
      resource: {
        type: 'cloud_run_revision',
        labels: {
          project_id: this.projectId,
          service_name: 'patient-discharge-backend',
          location: process.env.GCP_REGION || 'us-central1',
        },
      },
      severity: entry.severity as any,
    };

    const cloudLogEntry = this.log.entry(metadata, logEntry);

    try {
      await this.log.write(cloudLogEntry);
    } catch (error) {
      // Fallback to console.error if Cloud Logging fails
      console.error('Failed to write to Cloud Logging:', error);
      console.error('Original log entry:', JSON.stringify(logEntry, null, 2));
    }
  }

  /**
   * Debug log (verbose, filtered in production)
   */
  async debug(
    component: ComponentType,
    operation: OperationType,
    message: string,
    context?: LogContext,
    metadata?: LogMetadata,
  ): Promise<void> {
    if (this.environment === 'production') {
      return; // Skip debug logs in production
    }

    await this.write({
      severity: LogSeverity.DEBUG,
      timestamp: new Date().toISOString(),
      component,
      operation,
      message,
      context,
      metadata,
    });
  }

  /**
   * Info log (standard operational logs)
   */
  async info(
    component: ComponentType,
    operation: OperationType,
    message: string,
    context?: LogContext,
    metadata?: LogMetadata,
  ): Promise<void> {
    await this.write({
      severity: LogSeverity.INFO,
      timestamp: new Date().toISOString(),
      component,
      operation,
      message,
      context,
      metadata,
    });
  }

  /**
   * Warning log (non-critical issues)
   */
  async warn(
    component: ComponentType,
    operation: OperationType,
    message: string,
    context?: LogContext,
    metadata?: LogMetadata,
  ): Promise<void> {
    await this.write({
      severity: LogSeverity.WARNING,
      timestamp: new Date().toISOString(),
      component,
      operation,
      message,
      context,
      metadata,
    });
  }

  /**
   * Error log (application errors, retryable)
   */
  async error(
    component: ComponentType,
    operation: OperationType,
    message: string,
    error: Error,
    context?: LogContext,
    metadata?: LogMetadata,
  ): Promise<void> {
    await this.write({
      severity: LogSeverity.ERROR,
      timestamp: new Date().toISOString(),
      component,
      operation,
      message,
      context,
      metadata,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
    });
  }

  /**
   * Critical log (system failures, immediate action required)
   */
  async critical(
    component: ComponentType,
    operation: OperationType,
    message: string,
    error: Error,
    context?: LogContext,
    metadata?: LogMetadata,
  ): Promise<void> {
    await this.write({
      severity: LogSeverity.CRITICAL,
      timestamp: new Date().toISOString(),
      component,
      operation,
      message,
      context,
      metadata,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
    });
  }

  /**
   * Audit log (HIPAA-compliant data access logging)
   *
   * Records who accessed what patient data and when.
   * Retention: 7 years (HIPAA requirement)
   */
  async audit(
    operation: OperationType,
    message: string,
    context: Required<Pick<LogContext, 'userId' | 'tenantId' | 'patientId'>>,
    metadata?: LogMetadata,
  ): Promise<void> {
    await this.write({
      severity: LogSeverity.INFO,
      timestamp: new Date().toISOString(),
      component: ComponentType.BACKEND,
      operation,
      message,
      context,
      metadata,
      labels: {
        audit: 'true',
        retention: '7-years',
      },
    });
  }

  /**
   * Sanitize PII from context (hash patient IDs)
   */
  private sanitizeContext(context?: LogContext): LogContext | undefined {
    if (!context) return undefined;

    return {
      ...context,
      patientId: context.patientId
        ? this.hashPII(context.patientId)
        : undefined,
      userId: context.userId ? this.hashPII(context.userId) : undefined,
    };
  }

  /**
   * Hash PII for audit trails (one-way hash)
   */
  private hashPII(value: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(value).digest('hex').slice(0, 16);
  }

  /**
   * Extract trace context from HTTP headers (Cloud Trace format)
   *
   * Header format: X-Cloud-Trace-Context: TRACE_ID/SPAN_ID;o=TRACE_TRUE
   */
  static extractTraceContext(headers: Record<string, string>): {
    trace?: string;
    spanId?: string;
  } {
    const traceHeader = headers['x-cloud-trace-context'];
    if (!traceHeader) return {};

    const [traceId, spanIdWithOptions] = traceHeader.split('/');
    const spanId = spanIdWithOptions?.split(';')[0];

    return {
      trace: traceId ? `projects/PROJECT_ID/traces/${traceId}` : undefined,
      spanId,
    };
  }
}

/**
 * Singleton instance for backend
 */
export const logger = new StructuredLogger(
  process.env.GCP_PROJECT_ID || 'patient-discharge-project',
  'patient-discharge-backend',
);

/**
 * NestJS middleware for request logging
 */
export function loggingMiddleware(req: any, res: any, next: any) {
  const startTime = Date.now();
  const { trace, spanId } = StructuredLogger.extractTraceContext(req.headers);

  // Attach trace context to request
  req.traceContext = { trace, spanId };

  res.on('finish', async () => {
    const processingTimeMs = Date.now() - startTime;

    await logger.info(
      ComponentType.BACKEND,
      OperationType.DISCHARGE_EXPORT,
      `${req.method} ${req.path}`,
      {
        tenantId: req.headers['x-tenant-id'],
        sessionId: req.headers['x-session-id'],
        correlationId: req.headers['x-correlation-id'],
      },
      {
        processingTimeMs,
        httpStatusCode: res.statusCode,
        requestId: req.id,
        apiEndpoint: `${req.method} ${req.path}`,
      },
    );
  });

  next();
}
