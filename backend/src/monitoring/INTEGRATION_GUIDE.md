# Monitoring Integration Guide

Quick guide to add monitoring to existing controllers and services in the patient-discharge backend.

## Prerequisites

Install monitoring dependencies:

```bash
cd backend
npm install --save \
  @google-cloud/logging \
  @google-cloud/monitoring \
  @google-cloud/opentelemetry-cloud-trace-exporter \
  @opentelemetry/api \
  @opentelemetry/sdk-trace-node \
  @opentelemetry/instrumentation-http \
  @opentelemetry/context-async-hooks \
  @opentelemetry/resources \
  @opentelemetry/semantic-conventions \
  @opentelemetry/sdk-trace-base
```

## Step 1: Enable Monitoring in main.ts

### Option A: Use the enhanced main.ts

```bash
# Backup current main.ts
cp src/main.ts src/main-original.ts

# Use the monitoring-enabled version
cp src/main-with-monitoring.ts src/main.ts
```

### Option B: Manual integration

Add to your existing `main.ts`:

```typescript
import { initializeTracing } from './monitoring/trace-context';
import { loggingMiddleware } from './monitoring/structured-logger';
import { TracingInterceptor } from './monitoring/trace-context';

async function bootstrap() {
  // Initialize tracing BEFORE creating the app
  initializeTracing('patient-discharge-backend');

  const app = await NestFactory.create(AppModule);

  // Add logging middleware
  app.use(loggingMiddleware);

  // Add tracing interceptor
  app.useGlobalInterceptors(new TracingInterceptor());

  // ... rest of your code
}
```

## Step 2: Add Monitoring to Controllers

### Example: Google Controller (FHIR Operations)

**File:** `src/google/google.controller.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { MetricsService, MetricType } from '../monitoring/metrics.service';
import { logger, ComponentType, OperationType } from '../monitoring/structured-logger';
import { withSpan } from '../monitoring/trace-context';

@Controller('google')
export class GoogleController {
  private readonly nestLogger = new Logger(GoogleController.name);

  constructor(
    private readonly googleService: GoogleService,
    private readonly metrics: MetricsService, // Inject metrics service
  ) {}

  @Post('fhir/:resourceType')
  async fhirCreate(
    @Param('resourceType') resourceType: string,
    @Body() body: unknown,
    @TenantContext() ctx: TenantContextType
  ) {
    const startTime = Date.now();

    try {
      // Log operation start
      await logger.info(
        ComponentType.FHIR_CLIENT,
        OperationType.FHIR_CREATE,
        `Creating ${resourceType}`,
        {
          tenantId: ctx.tenantId,
          correlationId: ctx.correlationId,
        },
        { resourceType }
      );

      // Execute with distributed tracing
      const result = await withSpan(
        `fhir.create.${resourceType}`,
        async (span) => {
          span.setAttribute('fhir.resource_type', resourceType);
          span.setAttribute('tenant.id', ctx.tenantId);
          return this.googleService.fhirCreate(resourceType, body, ctx);
        }
      );

      // Record metrics
      const duration = Date.now() - startTime;
      await this.metrics.recordFHIRRequest(
        'create',
        true, // success
        duration,
        ctx.tenantId
      );

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      // Log error
      await logger.error(
        ComponentType.FHIR_CLIENT,
        OperationType.FHIR_CREATE,
        `Failed to create ${resourceType}`,
        error,
        { tenantId: ctx.tenantId },
        { resourceType, httpStatusCode: error.status }
      );

      // Record error metric
      await this.metrics.recordFHIRRequest(
        'create',
        false, // failed
        duration,
        ctx.tenantId
      );

      throw error;
    }
  }

  @Delete('fhir/Patient/:patientId/with-dependencies')
  async deletePatientWithDependencies(
    @Param('patientId') patientId: string,
    @Query('compositionId') compositionId: string,
    @TenantContext() ctx: TenantContextType,
  ) {
    const startTime = Date.now();

    try {
      await logger.info(
        ComponentType.FHIR_CLIENT,
        OperationType.FHIR_DELETE,
        'Deleting patient with dependencies',
        {
          tenantId: ctx.tenantId,
          patientId: patientId, // Will be hashed automatically
        },
        { compositionId }
      );

      const result = await withSpan(
        'fhir.delete.patient.cascade',
        async (span) => {
          span.setAttribute('patient.id', patientId);
          span.setAttribute('composition.id', compositionId);
          return this.googleService.deletePatientWithDependencies(
            patientId,
            compositionId,
            ctx
          );
        }
      );

      const duration = Date.now() - startTime;

      // Log success with deleted resource counts
      await logger.info(
        ComponentType.FHIR_CLIENT,
        OperationType.FHIR_DELETE,
        'Patient deleted with dependencies',
        { tenantId: ctx.tenantId },
        {
          duration,
          deletedCount: result.deleted.length,
          deletedResources: result.deleted,
        }
      );

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      await logger.error(
        ComponentType.FHIR_CLIENT,
        OperationType.FHIR_DELETE,
        'Failed to delete patient with dependencies',
        error,
        { tenantId: ctx.tenantId },
        { duration }
      );

      throw error;
    }
  }
}
```

### Example: Expert Controller (Feedback API)

**File:** `src/expert/expert.controller.ts`

```typescript
import { MetricsService, MetricType } from '../monitoring/metrics.service';
import { logger, ComponentType, OperationType } from '../monitoring/structured-logger';

@Controller('expert')
export class ExpertController {
  constructor(
    private readonly expertService: ExpertService,
    private readonly metrics: MetricsService,
  ) {}

  @Post('feedback')
  async submitFeedback(
    @Body() dto: SubmitFeedbackDto,
    @TenantContext() ctx?: TenantContextType,
  ) {
    const startTime = Date.now();

    try {
      await logger.info(
        ComponentType.BACKEND,
        OperationType.DISCHARGE_EXPORT, // or create new operation type
        'Expert feedback submission started',
        {
          tenantId: ctx?.tenantId,
          compositionId: dto.dischargeSummaryId,
        },
        {
          expertName: dto.expertName,
          rating: dto.rating,
        }
      );

      const feedback = await this.expertService.submitFeedback(dto);

      const duration = Date.now() - startTime;

      // Record custom metric for feedback submissions
      await this.metrics.recordDuration(
        'discharge/feedback/submission' as any,
        duration,
        {
          tenant_id: ctx?.tenantId || 'unknown',
          status: 'success',
          rating: String(dto.rating),
        }
      );

      return { success: true, id: feedback.id };
    } catch (error) {
      const duration = Date.now() - startTime;

      await logger.error(
        ComponentType.BACKEND,
        OperationType.DISCHARGE_EXPORT,
        'Expert feedback submission failed',
        error,
        {
          tenantId: ctx?.tenantId,
          compositionId: dto.dischargeSummaryId,
        },
        { duration }
      );

      throw error;
    }
  }
}
```

## Step 3: Add Monitoring to Services

### Example: Discharge Export Service

**File:** `src/discharge-export/services/discharge-export.service.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { MetricsService, MetricType } from '../../monitoring/metrics.service';
import { logger, ComponentType, OperationType } from '../../monitoring/structured-logger';
import { TraceMethod } from '../../monitoring/trace-context';

@Injectable()
export class DischargeExportService {
  constructor(
    private readonly metrics: MetricsService,
    // ... other dependencies
  ) {}

  // Use @TraceMethod decorator for automatic span creation
  @TraceMethod('DischargeExportService.exportDischarge')
  async exportDischarge(patientId: string, tenantId: string) {
    const timer = this.metrics.startTimer();

    try {
      await logger.info(
        ComponentType.DISCHARGE_EXPORT,
        OperationType.DISCHARGE_EXPORT,
        'Starting discharge export',
        { tenantId, patientId },
        { patientId }
      );

      // Your existing logic here
      const result = await this.performExport(patientId, tenantId);

      // Record success
      await timer.end(MetricType.EXPORT_DURATION, {
        tenant_id: tenantId,
        status: 'success',
      });

      await this.metrics.recordExportResult(true, tenantId, timer.duration);

      return result;
    } catch (error) {
      await timer.end(MetricType.EXPORT_DURATION, {
        tenant_id: tenantId,
        status: 'error',
      });

      await this.metrics.recordExportResult(false, tenantId, timer.duration);

      await logger.error(
        ComponentType.DISCHARGE_EXPORT,
        OperationType.DISCHARGE_EXPORT,
        'Discharge export failed',
        error,
        { tenantId, patientId }
      );

      throw error;
    }
  }
}
```

## Step 4: Add Audit Logging

For HIPAA compliance, add audit logs whenever patient data is accessed:

```typescript
import { logger } from '../monitoring/structured-logger';

// In any controller/service that accesses patient data
async function accessPatientData(userId: string, tenantId: string, patientId: string) {
  // Record audit log (7-year retention)
  await logger.audit(
    OperationType.FHIR_READ,
    'User accessed patient discharge summary',
    {
      userId, // Will be hashed
      tenantId,
      patientId, // Will be hashed
    },
    {
      accessType: 'read',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    }
  );

  // Continue with your logic
  return this.fhirService.getPatient(patientId);
}
```

## Step 5: Environment Variables

Add to your `.env` file:

```bash
# Monitoring Configuration
MONITORING_ENABLED=true
GCP_PROJECT_ID=your-project-id
GCP_REGION=us-central1
APP_VERSION=1.0.0
NODE_ENV=production

# Optional: Adjust trace sampling rate (0.0 to 1.0)
TRACE_SAMPLE_RATE=0.1
```

## Step 6: Testing

### Local Testing (Console Logs)

```typescript
// In local development, monitoring gracefully falls back to console
NODE_ENV=development npm run start:dev
```

### Production Testing

```bash
# Deploy to Cloud Run
gcloud run deploy patient-discharge-backend \
  --source . \
  --region us-central1 \
  --set-env-vars MONITORING_ENABLED=true,GCP_PROJECT_ID=your-project-id

# Check logs
gcloud logging read "resource.type=cloud_run_revision" --limit=10

# Check metrics
gcloud monitoring time-series list \
  --filter='metric.type="custom.googleapis.com/discharge/export/duration"'

# View traces
gcloud trace traces list --limit=10
```

## Common Patterns

### 1. Simple Request Logging

```typescript
await logger.info(component, operation, message, context, metadata);
```

### 2. Error Logging

```typescript
await logger.error(component, operation, message, error, context, metadata);
```

### 3. Duration Tracking

```typescript
const timer = metrics.startTimer();
// ... do work ...
await timer.end(MetricType.EXPORT_DURATION, { tenant_id: tenantId });
```

### 4. Distributed Tracing

```typescript
await withSpan('operation.name', async (span) => {
  span.setAttribute('custom.attribute', 'value');
  return doWork();
});
```

### 5. Custom Metrics

```typescript
await metrics.recordDuration(MetricType.EXPORT_DURATION, durationMs, labels);
await metrics.incrementCounter(MetricType.FHIR_REQUESTS, 1, labels);
await metrics.setGauge(MetricType.PUBSUB_LAG, lagSeconds, labels);
```

## Troubleshooting

### "Cannot find module '@google-cloud/logging'"

```bash
npm install @google-cloud/logging @google-cloud/monitoring
```

### "Service account not found"

Set the service account path:
```bash
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
```

Or use Application Default Credentials in Cloud Run (automatic).

### Logs not appearing in Cloud Logging

1. Check service account has `roles/logging.logWriter`
2. Verify `GCP_PROJECT_ID` environment variable is set
3. Check Cloud Logging API is enabled

### Metrics not showing in dashboards

1. Ensure metric type matches exactly: `custom.googleapis.com/discharge/...`
2. Wait 1-2 minutes for metrics to propagate
3. Check alignment period in dashboard (must be >= 60s)

## Next Steps

1. ✅ Add monitoring to all controllers
2. ✅ Test locally with console output
3. ✅ Deploy to dev environment
4. ✅ Verify logs/metrics/traces in Cloud Console
5. ✅ Set up dashboards
6. ✅ Configure alerts
7. ✅ Deploy to production

See `monitoring/README.md` for complete setup instructions.
