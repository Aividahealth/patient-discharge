/**
 * Trace Context Utilities for Google Cloud Trace
 *
 * Implements distributed tracing across backend, Pub/Sub, and Cloud Functions.
 */

import { TraceExporter } from '@google-cloud/opentelemetry-cloud-trace-exporter';
import { GcpDetectorSync } from '@google-cloud/opentelemetry-resource-util';
import * as opentelemetry from '@opentelemetry/api';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import {
  BatchSpanProcessor,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

/**
 * Initialize OpenTelemetry tracing
 */
export function initializeTracing(serviceName: string = 'patient-discharge-backend') {
  const provider = new NodeTracerProvider({
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
      [SemanticResourceAttributes.SERVICE_VERSION]:
        process.env.APP_VERSION || '1.0.0',
    }).merge(new GcpDetectorSync().detect()),
  });

  // Use batch processor in production for efficiency
  const exporter = new TraceExporter();
  const processor =
    process.env.NODE_ENV === 'production'
      ? new BatchSpanProcessor(exporter, {
          maxQueueSize: 100,
          scheduledDelayMillis: 5000,
        })
      : new SimpleSpanProcessor(exporter);

  provider.addSpanProcessor(processor);

  // Use AsyncLocalStorageContextManager for context propagation
  const contextManager = new AsyncLocalStorageContextManager();
  contextManager.enable();
  opentelemetry.context.setGlobalContextManager(contextManager);

  // Register the provider globally
  provider.register();

  // Auto-instrument HTTP calls
  registerInstrumentations({
    instrumentations: [
      new HttpInstrumentation({
        ignoreIncomingPaths: ['/health', '/metrics'],
      }),
    ],
  });

  return provider;
}

/**
 * Trace context for propagation across services
 */
export interface TraceContext {
  traceId: string;
  spanId: string;
  traceSampled: boolean;
}

/**
 * Extract trace context from HTTP headers
 *
 * Supports both Cloud Trace format and W3C Trace Context
 */
export function extractTraceContext(headers: Record<string, string | string[]>): TraceContext | null {
  // Try Cloud Trace format first: X-Cloud-Trace-Context: TRACE_ID/SPAN_ID;o=TRACE_TRUE
  const cloudTraceHeader = headers['x-cloud-trace-context'];
  if (cloudTraceHeader && typeof cloudTraceHeader === 'string') {
    const [traceId, spanIdWithOptions] = cloudTraceHeader.split('/');
    const [spanId, options] = (spanIdWithOptions || '').split(';');

    if (traceId && spanId) {
      const traceSampled = options?.includes('o=1') ?? false;
      return { traceId, spanId, traceSampled };
    }
  }

  // Fallback to W3C Trace Context: traceparent: 00-TRACE_ID-SPAN_ID-FLAGS
  const traceparent = headers['traceparent'];
  if (traceparent && typeof traceparent === 'string') {
    const [version, traceId, spanId, flags] = traceparent.split('-');
    if (traceId && spanId) {
      const traceSampled = flags === '01';
      return { traceId, spanId, traceSampled };
    }
  }

  return null;
}

/**
 * Inject trace context into headers for downstream calls
 */
export function injectTraceContext(
  headers: Record<string, string>,
  traceContext: TraceContext,
): Record<string, string> {
  // Cloud Trace format
  headers['x-cloud-trace-context'] =
    `${traceContext.traceId}/${traceContext.spanId};o=${traceContext.traceSampled ? '1' : '0'}`;

  // W3C Trace Context (for compatibility)
  headers['traceparent'] =
    `00-${traceContext.traceId}-${traceContext.spanId}-${traceContext.traceSampled ? '01' : '00'}`;

  return headers;
}

/**
 * Get current trace context from OpenTelemetry
 */
export function getCurrentTraceContext(): TraceContext | null {
  const span = opentelemetry.trace.getActiveSpan();
  if (!span) return null;

  const spanContext = span.spanContext();
  return {
    traceId: spanContext.traceId,
    spanId: spanContext.spanId,
    traceSampled: (spanContext.traceFlags & opentelemetry.TraceFlags.SAMPLED) !== 0,
  };
}

/**
 * Tracer instance for manual span creation
 */
const tracer = opentelemetry.trace.getTracer('patient-discharge-backend');

/**
 * Create a custom span
 */
export async function withSpan<T>(
  name: string,
  fn: (span: opentelemetry.Span) => Promise<T>,
  attributes?: Record<string, string | number | boolean>,
): Promise<T> {
  return tracer.startActiveSpan(name, async (span) => {
    try {
      // Add custom attributes
      if (attributes) {
        for (const [key, value] of Object.entries(attributes)) {
          span.setAttribute(key, value);
        }
      }

      const result = await fn(span);
      span.setStatus({ code: opentelemetry.SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({
        code: opentelemetry.SpanStatusCode.ERROR,
        message: (error as Error).message,
      });
      throw error;
    } finally {
      span.end();
    }
  });
}

/**
 * NestJS interceptor for automatic trace context propagation
 */
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class TracingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url } = request;

    // Extract trace context from headers
    const traceContext = extractTraceContext(request.headers);

    // Create a span for this request
    return new Observable((observer) => {
      tracer.startActiveSpan(
        `${method} ${url}`,
        {
          attributes: {
            'http.method': method,
            'http.url': url,
            'http.target': request.path,
            'tenant.id': request.headers['x-tenant-id'] || 'unknown',
          },
        },
        async (span) => {
          try {
            // Attach trace context to request for downstream use
            request.traceContext = traceContext || getCurrentTraceContext();

            next.handle().subscribe({
              next: (value) => {
                span.setStatus({ code: opentelemetry.SpanStatusCode.OK });
                observer.next(value);
              },
              error: (error) => {
                span.recordException(error);
                span.setStatus({
                  code: opentelemetry.SpanStatusCode.ERROR,
                  message: error.message,
                });
                observer.error(error);
              },
              complete: () => {
                span.end();
                observer.complete();
              },
            });
          } catch (error) {
            span.recordException(error as Error);
            span.setStatus({
              code: opentelemetry.SpanStatusCode.ERROR,
              message: (error as Error).message,
            });
            span.end();
            observer.error(error);
          }
        },
      );
    });
  }
}

/**
 * Pub/Sub message attributes with trace context
 *
 * Adds trace context to Pub/Sub message attributes for propagation
 */
export function addTraceContextToMessage(
  attributes: Record<string, string>,
): Record<string, string> {
  const traceContext = getCurrentTraceContext();
  if (traceContext) {
    attributes['x-trace-id'] = traceContext.traceId;
    attributes['x-span-id'] = traceContext.spanId;
    attributes['x-trace-sampled'] = traceContext.traceSampled ? '1' : '0';
  }
  return attributes;
}

/**
 * Extract trace context from Pub/Sub message attributes
 */
export function extractTraceContextFromMessage(
  attributes: Record<string, string>,
): TraceContext | null {
  const traceId = attributes['x-trace-id'];
  const spanId = attributes['x-span-id'];
  const traceSampled = attributes['x-trace-sampled'] === '1';

  if (traceId && spanId) {
    return { traceId, spanId, traceSampled };
  }

  return null;
}

/**
 * Decorator for automatic span creation
 *
 * Usage:
 * @TraceMethod()
 * async myMethod() { ... }
 */
export function TraceMethod(spanName?: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;
    const methodName = spanName || `${target.constructor.name}.${propertyKey}`;

    descriptor.value = async function (...args: any[]) {
      return withSpan(methodName, async (span) => {
        return originalMethod.apply(this, args);
      });
    };

    return descriptor;
  };
}
