# Monitoring Quick Start Guide

**Updated:** 2025-11-16 (After merging main branch changes)

This guide helps you quickly enable Google Cloud monitoring for the patient-discharge system.

## What's Included

All monitoring code is already in the repository:
- ✅ Structured logging with Cloud Logging
- ✅ Custom metrics with Cloud Monitoring
- ✅ Distributed tracing with Cloud Trace
- ✅ Pre-configured dashboards (Executive & Operational)
- ✅ 8 alert policies with runbooks
- ✅ 3 SLOs with error budgets
- ✅ HIPAA-compliant audit logging

## Prerequisites

- GCP Project with billing enabled
- Node.js 18+ installed
- Cloud Run service deployed (or local development)
- Permissions: `roles/logging.logWriter`, `roles/monitoring.metricWriter`, `roles/cloudtrace.agent`

## Quick Setup (5 minutes)

### 1. Enable GCP APIs

```bash
gcloud services enable \
  logging.googleapis.com \
  monitoring.googleapis.com \
  cloudtrace.googleapis.com \
  clouderrorreporting.googleapis.com
```

### 2. Install Dependencies

```bash
cd backend

# Install all monitoring dependencies
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

### 3. Enable Monitoring in Backend

**Option A: Use the pre-configured main.ts**

```bash
# Backup original
cp src/main.ts src/main-original.ts

# Use monitoring-enabled version
cp src/main-with-monitoring.ts src/main.ts
```

**Option B: Set environment variable only (monitoring is optional)**

The MonitoringModule is already imported in `app.module.ts`. The enhanced `main-with-monitoring.ts` will gracefully degrade if dependencies aren't installed.

### 4. Set Environment Variables

Add to `.env`:

```bash
# Monitoring Configuration
MONITORING_ENABLED=true
GCP_PROJECT_ID=your-project-id
GCP_REGION=us-central1
APP_VERSION=1.0.0
NODE_ENV=production
```

### 5. Test Locally

```bash
# Start the backend
npm run start:dev

# Make a test request
curl http://localhost:3000/google/token

# Check console for monitoring logs
# You should see: "✅ Monitoring modules loaded successfully"
```

### 6. Deploy to Cloud Run

```bash
# Build and deploy
gcloud run deploy patient-discharge-backend \
  --source ./backend \
  --region us-central1 \
  --set-env-vars MONITORING_ENABLED=true,GCP_PROJECT_ID=your-project-id,NODE_ENV=production \
  --allow-unauthenticated
```

### 7. Verify Monitoring is Working

**Check Logs:**
```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=patient-discharge-backend" --limit=10
```

**Check Metrics:**
```bash
gcloud monitoring time-series list \
  --filter='metric.type:custom.googleapis.com/discharge' \
  --interval-end-time=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
```

**Check Traces:**
```bash
gcloud trace traces list --limit=10
```

## Deploy Dashboards (Optional)

```bash
# Executive Overview
gcloud monitoring dashboards create \
  --config-from-file=monitoring/dashboards/executive-overview.json

# Operational Health
gcloud monitoring dashboards create \
  --config-from-file=monitoring/dashboards/operational-health.json
```

View dashboards: https://console.cloud.google.com/monitoring/dashboards

## Add Monitoring to Your Code

### In Controllers

```typescript
import { MetricsService } from './monitoring/metrics.service';
import { logger, ComponentType, OperationType } from './monitoring/structured-logger';

@Controller('google')
export class GoogleController {
  constructor(private readonly metrics: MetricsService) {}

  @Post('fhir/:resourceType')
  async fhirCreate(@Param('resourceType') type: string, @Body() body: any) {
    const startTime = Date.now();

    try {
      const result = await this.googleService.fhirCreate(type, body);

      // Log success
      await logger.info(
        ComponentType.FHIR_CLIENT,
        OperationType.FHIR_CREATE,
        `Created ${type}`,
        { tenantId: 'tenant-123' }
      );

      // Record metric
      await this.metrics.recordFHIRRequest('create', true, Date.now() - startTime);

      return result;
    } catch (error) {
      // Log error
      await logger.error(
        ComponentType.FHIR_CLIENT,
        OperationType.FHIR_CREATE,
        'FHIR create failed',
        error
      );

      throw error;
    }
  }
}
```

See `backend/src/monitoring/INTEGRATION_GUIDE.md` for detailed examples.

## What Gets Monitored Automatically

Once enabled, the following is automatically tracked:

### HTTP Requests
- Request duration
- Status codes
- Endpoints
- Tenant IDs

### FHIR Operations
- Create/Read/Update/Delete operations
- Success/failure rates
- Latency by operation type

### Distributed Traces
- End-to-end request flow
- Cross-service traces (Backend → Cloud Functions)
- Performance bottlenecks

## Key New Features (After Main Merge)

The recent merge from main added:

1. **Patient Deletion with Dependencies** (`/google/fhir/Patient/:id/with-dependencies`)
   - Cascading delete of Patient, Compositions, Binaries
   - Should be monitored for success/failure rates
   - Recommended: Add custom metric for deletion operations

2. **Expert Feedback API** (`/expert/feedback`)
   - Track feedback submission rates
   - Monitor feedback ratings distribution
   - Recommended: Add custom metric `discharge/feedback/submission`

3. **Clinician Publish API**
   - New publishing workflow
   - Recommended: Add metrics for publish success rate

4. **Tenant Logos**
   - Static assets in `frontend/public/tenant/`
   - No monitoring needed (static files)

## Integration with New Features

### Monitor Patient Deletion

Add to `src/google/google.controller.ts`:

```typescript
@Delete('fhir/Patient/:patientId/with-dependencies')
async deletePatientWithDependencies(@Param('patientId') id: string) {
  const timer = this.metrics.startTimer();

  try {
    const result = await this.googleService.deletePatientWithDependencies(id);

    await timer.end('discharge/patient/deletion' as any, {
      status: 'success',
      deleted_count: String(result.deleted.length),
    });

    return result;
  } catch (error) {
    await timer.end('discharge/patient/deletion' as any, { status: 'error' });
    throw error;
  }
}
```

### Monitor Expert Feedback

Add to `src/expert/expert.controller.ts`:

```typescript
@Post('feedback')
async submitFeedback(@Body() dto: SubmitFeedbackDto) {
  const timer = this.metrics.startTimer();

  try {
    const result = await this.expertService.submitFeedback(dto);

    await timer.end('discharge/feedback/submission' as any, {
      status: 'success',
      rating: String(dto.rating),
    });

    return result;
  } catch (error) {
    await timer.end('discharge/feedback/submission' as any, { status: 'error' });
    throw error;
  }
}
```

## Troubleshooting

### "Cannot find module '@google-cloud/logging'"

Install dependencies:
```bash
cd backend
npm install --save @google-cloud/logging @google-cloud/monitoring
```

### "Monitoring modules not available"

This warning is normal if monitoring dependencies aren't installed. The app will still work, just without monitoring.

To enable monitoring:
1. Install dependencies (see step 2)
2. Set `MONITORING_ENABLED=true` in `.env`
3. Restart the app

### Local development without monitoring

Monitoring is optional. If you don't want it locally:

```bash
MONITORING_ENABLED=false npm run start:dev
```

### Cloud Run: Service account permissions

Grant the Cloud Run service account these roles:

```bash
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:SERVICE_ACCOUNT@PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/logging.logWriter"

gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:SERVICE_ACCOUNT@PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/monitoring.metricWriter"

gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:SERVICE_ACCOUNT@PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/cloudtrace.agent"
```

## Next Steps

1. ✅ **Complete this quick start** (5 minutes)
2. ⏭️ **Review monitoring architecture** (`docs/monitoring-architecture.md`)
3. ⏭️ **Deploy dashboards** (see Step 7 above)
4. ⏭️ **Set up alerts** (`monitoring/terraform/`)
5. ⏭️ **Configure SLOs** (`monitoring/terraform/slos.tf`)
6. ⏭️ **Add monitoring to all endpoints** (`backend/src/monitoring/INTEGRATION_GUIDE.md`)

## Full Documentation

- **Architecture Design:** `docs/monitoring-architecture.md`
- **Implementation Guide:** `monitoring/README.md`
- **Integration Examples:** `backend/src/monitoring/INTEGRATION_GUIDE.md`
- **Implementation Checklist:** `monitoring/IMPLEMENTATION_CHECKLIST.md`

## Support

- **Documentation Issues:** Check `monitoring/README.md` troubleshooting section
- **Missing Dependencies:** See `backend/monitoring-dependencies.txt`
- **Cloud Console:** https://console.cloud.google.com/monitoring

---

**Estimated Time:** 5-10 minutes to get basic monitoring working
**Cost:** ~$30/month (dev) to ~$260/month (prod with full features)
