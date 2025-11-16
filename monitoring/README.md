# Patient Discharge System - Monitoring Setup

Comprehensive Google Cloud-native monitoring for the patient-discharge system.

## Overview

This monitoring solution provides end-to-end observability across:
- **Cloud Logging**: Centralized structured logs
- **Cloud Monitoring**: Custom metrics and dashboards
- **Cloud Trace**: Distributed tracing
- **Error Reporting**: Automatic error aggregation
- **SLOs**: Service level objectives with error budgets
- **Alerting**: Multi-tier alerting (P1-P3)

## Quick Start

### Prerequisites

- GCP Project with billing enabled
- Terraform >= 1.0
- Node.js >= 18 (for backend)
- Permissions:
  - `roles/monitoring.admin`
  - `roles/logging.admin`
  - `roles/iam.serviceAccountAdmin`

### 1. Enable Required APIs

```bash
gcloud services enable \
  logging.googleapis.com \
  monitoring.googleapis.com \
  cloudtrace.googleapis.com \
  clouderrorreporting.googleapis.com
```

### 2. Install Dependencies

```bash
# Backend monitoring dependencies
cd backend
npm install @google-cloud/logging \
            @google-cloud/monitoring \
            @google-cloud/opentelemetry-cloud-trace-exporter \
            @opentelemetry/api \
            @opentelemetry/sdk-trace-node \
            @opentelemetry/instrumentation-http \
            @opentelemetry/context-async-hooks
```

### 3. Configure Backend Logging

Add to `backend/src/main.ts`:

```typescript
import { initializeTracing } from './monitoring/trace-context';
import { loggingMiddleware } from './monitoring/structured-logger';
import { MetricsService } from './monitoring/metrics.service';

async function bootstrap() {
  // Initialize tracing
  initializeTracing('patient-discharge-backend');

  const app = await NestFactory.create(AppModule);

  // Add logging middleware
  app.use(loggingMiddleware);

  // Register metrics service
  app.useGlobalInterceptors(new TracingInterceptor());

  await app.listen(3000);
}
```

### 4. Update Environment Variables

Add to `.env`:

```bash
GCP_PROJECT_ID=your-project-id
GCP_REGION=us-central1
APP_VERSION=1.0.0
NODE_ENV=production
```

### 5. Deploy Dashboards

```bash
# Import Executive Overview dashboard
gcloud monitoring dashboards create --config-from-file=monitoring/dashboards/executive-overview.json

# Import Operational Health dashboard
gcloud monitoring dashboards create --config-from-file=monitoring/dashboards/operational-health.json
```

### 6. Set Up Notification Channels

```bash
# Create PagerDuty channel
gcloud alpha monitoring channels create \
  --display-name="PagerDuty On-Call" \
  --type=pagerduty \
  --channel-labels=service_key=YOUR_PAGERDUTY_KEY

# Create Slack channel
gcloud alpha monitoring channels create \
  --display-name="Slack #alerts" \
  --type=slack \
  --channel-labels=url=YOUR_SLACK_WEBHOOK_URL

# Create Email channel
gcloud alpha monitoring channels create \
  --display-name="Team Email" \
  --type=email \
  --channel-labels=email_address=team@example.com
```

### 7. Deploy Alerts and SLOs

```bash
cd monitoring/terraform

# Initialize Terraform
terraform init

# Create terraform.tfvars
cat > terraform.tfvars <<EOF
project_id = "your-project-id"
notification_channel_pagerduty = "projects/YOUR_PROJECT/notificationChannels/CHANNEL_ID"
notification_channel_slack = "projects/YOUR_PROJECT/notificationChannels/CHANNEL_ID"
notification_channel_email = "projects/YOUR_PROJECT/notificationChannels/CHANNEL_ID"
EOF

# Apply configuration
terraform plan
terraform apply
```

## Architecture

### Logging Flow

```
Application Code
       ↓
StructuredLogger
       ↓
Cloud Logging API
       ↓
┌─────────────────────┐
│  Cloud Logging      │
│  ├─ Logs Router     │
│  ├─ Log Storage     │
│  └─ Log Analytics   │
└─────────────────────┘
       ↓
┌─────────────────────┐
│  Destinations       │
│  ├─ BigQuery        │ (Audit logs - 7 years)
│  ├─ Error Reporting │
│  └─ Log Metrics     │
└─────────────────────┘
```

### Metrics Flow

```
Application Code
       ↓
MetricsService.recordDuration()
       ↓
Cloud Monitoring API
       ↓
┌─────────────────────┐
│  Cloud Monitoring   │
│  ├─ Time Series DB  │
│  ├─ Dashboards      │
│  ├─ SLOs            │
│  └─ Alerts          │
└─────────────────────┘
```

### Trace Flow

```
HTTP Request → TracingInterceptor
                      ↓
            Create Root Span
                      ↓
         ┌────────────┴────────────┐
         │                         │
    Child Span                Child Span
  (FHIR API Call)         (Pub/Sub Publish)
         │                         │
         └────────────┬────────────┘
                      ↓
              Cloud Trace Exporter
                      ↓
         ┌────────────────────────┐
         │    Cloud Trace         │
         │    ├─ Trace Storage    │
         │    └─ Trace Viewer     │
         └────────────────────────┘
```

## Usage Examples

### 1. Structured Logging

```typescript
import { logger, ComponentType, OperationType } from './monitoring/structured-logger';

// Info log
await logger.info(
  ComponentType.DISCHARGE_EXPORT,
  OperationType.DISCHARGE_EXPORT,
  'Starting discharge export',
  {
    tenantId: 'tenant-123',
    patientId: 'patient-456',
    compositionId: 'comp-789',
  },
  {
    processingTimeMs: 1234,
  }
);

// Error log
await logger.error(
  ComponentType.FHIR_CLIENT,
  OperationType.FHIR_CREATE,
  'Failed to create FHIR composition',
  error,
  { tenantId: 'tenant-123' },
  { httpStatusCode: 500, errorCode: 'FHIR_API_ERROR' }
);

// Audit log (HIPAA compliance)
await logger.audit(
  OperationType.FHIR_READ,
  'User accessed patient discharge summary',
  {
    userId: 'user-123',
    tenantId: 'tenant-456',
    patientId: 'patient-789',
  },
  { accessType: 'read', ipAddress: '192.168.1.1' }
);
```

### 2. Custom Metrics

```typescript
import { MetricsService, MetricType } from './monitoring/metrics.service';

const metrics = new MetricsService();

// Record export duration
await metrics.recordDuration(
  MetricType.EXPORT_DURATION,
  1234, // milliseconds
  { tenant_id: 'tenant-123', status: 'success' }
);

// Record Gemini usage
await metrics.recordGeminiUsage(
  5000, // input tokens
  1500, // output tokens
  'tenant-123'
);

// Record FHIR request
await metrics.recordFHIRRequest(
  'create',
  true, // success
  856, // latency ms
  'tenant-123'
);

// Using timer helper
const timer = metrics.startTimer();
await processDischargeExport();
await timer.end(MetricType.EXPORT_DURATION, { tenant_id: 'tenant-123' });
```

### 3. Distributed Tracing

```typescript
import { withSpan, TraceMethod } from './monitoring/trace-context';

// Manual span creation
await withSpan('fetchPatientData', async (span) => {
  span.setAttribute('patient.id', patientId);
  span.setAttribute('tenant.id', tenantId);

  const data = await fhirClient.getPatient(patientId);
  return data;
}, {
  'operation.type': 'fhir-read',
  'tenant.id': tenantId,
});

// Using decorator
class DischargeExportService {
  @TraceMethod('DischargeExportService.export')
  async exportDischarge(patientId: string) {
    // Automatic span creation
    // ...
  }
}
```

### 4. Adding Trace Context to Pub/Sub

```typescript
import { addTraceContextToMessage, extractTraceContextFromMessage } from './monitoring/trace-context';

// Publisher (Backend)
const attributes = addTraceContextToMessage({
  tenantId: 'tenant-123',
  compositionId: 'comp-456',
});

await pubsub.topic('discharge-export-events').publish(messageBuffer, attributes);

// Subscriber (Cloud Function)
export async function simplificationFunction(message: PubSubMessage) {
  const traceContext = extractTraceContextFromMessage(message.attributes);

  // Use trace context to continue the trace
  // ...
}
```

## Dashboard Reference

### Executive Overview

**URL:** `https://console.cloud.google.com/monitoring/dashboards/custom/YOUR_DASHBOARD_ID`

**Widgets:**
- Export Volume (24h) - Total exports with success/failure breakdown
- Success Rate (24h) - Gauge showing SLO compliance
- P95 Latency (24h) - Processing time 95th percentile
- Export Volume by Status - Time series chart
- Processing Pipeline - Multi-stage latency visualization
- Top 10 Tenants - Usage by tenant
- Daily Cost Breakdown - Gemini API costs

**Use Cases:**
- Executive stakeholder updates
- Weekly team reviews
- Capacity planning

### Operational Health

**URL:** `https://console.cloud.google.com/monitoring/dashboards/custom/YOUR_DASHBOARD_ID`

**Widgets:**
- Active Incidents - Real-time error log feed
- Cloud Function Invocations - Invocation rate per function
- Cloud Function Execution Time - P50/P95/P99 latencies
- Pub/Sub Message Age - Queue health monitoring
- Pub/Sub Dead Letter Queue - Failed message count
- FHIR API Request Rate - API usage by operation
- FHIR API Error Rate - Error breakdown by type
- Cloud Run CPU/Memory - Resource utilization
- Recent Errors - Last 50 errors

**Use Cases:**
- On-call monitoring
- Incident investigation
- Performance debugging

## Alert Runbooks

### ALERT-001: SLO Error Budget Exhausted

**Severity:** P1 - Critical
**Response Time:** Immediate (page on-call)

**Symptoms:**
- Success rate < 99%
- Error budget consumption > 10%

**Investigation Steps:**

1. Check Error Reporting for top error types:
   ```bash
   gcloud error-reporting events list --service=patient-discharge-backend --time-range=1h
   ```

2. Verify FHIR API status:
   ```bash
   curl -H "Authorization: Bearer $(gcloud auth print-access-token)" \
     https://healthcare.googleapis.com/v1/projects/PROJECT/locations/LOCATION/datasets/DATASET/fhirStores/STORE/fhir/metadata
   ```

3. Check recent deployments:
   ```bash
   gcloud run revisions list --service=patient-discharge-backend --region=us-central1
   ```

4. Review Gemini API quotas:
   ```bash
   gcloud monitoring time-series list \
     --filter='metric.type="custom.googleapis.com/discharge/gemini/tokens"' \
     --interval-end-time=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
   ```

**Resolution:**
- If FHIR API down: Escalate to Google Cloud Support
- If Gemini quota exceeded: Request increase or throttle tenants
- If bad deployment: Rollback to previous revision
- If configuration issue: Fix and redeploy

**Post-Incident:**
- Write incident report (template: docs/incident-reports/template.md)
- Update runbook with new learnings
- Conduct blameless postmortem

### ALERT-002: Pub/Sub Dead Letter Queue Buildup

**Severity:** P1 - Critical
**Response Time:** Immediate

**Investigation:**

1. Inspect dead letter messages:
   ```bash
   gcloud pubsub subscriptions pull discharge-export-events-dead-letter --limit=10 --format=json
   ```

2. Identify error patterns (look for common fields)

3. Check Cloud Function logs:
   ```bash
   gcloud functions logs read simplification-function --region=us-central1 --limit=50
   ```

**Common Causes:**
- Invalid message format (missing fields)
- Tenant configuration not found
- FHIR API permission errors
- Gemini API content safety violations

**Resolution:**
- Fix root cause (configuration, code, permissions)
- Manually replay valid messages
- Discard invalid messages after investigation

## Cost Optimization

### Current Costs (Estimated)

- **Cloud Logging:** ~$30/month
- **Cloud Monitoring:** ~$230/month
- **Cloud Trace:** ~$0.02/month
- **Total:** ~$260/month (for 10,000 exports/month)

### Optimization Strategies

#### 1. Log Sampling (Save 40%)

```typescript
// Sample verbose logs in production
if (process.env.NODE_ENV === 'production' && Math.random() > 0.1) {
  return; // Skip 90% of debug logs
}
```

#### 2. Metric Aggregation (Save 30%)

```typescript
// Pre-aggregate metrics before sending
const batchMetrics = new Map<string, number>();

// Batch metrics for 1 minute
setInterval(() => {
  for (const [key, value] of batchMetrics) {
    metricsService.incrementCounter(MetricType.FHIR_REQUESTS, value);
  }
  batchMetrics.clear();
}, 60000);
```

#### 3. Trace Sampling (Adjustable)

```typescript
// Sample 10% of traces (adjustable based on traffic)
const provider = new NodeTracerProvider({
  sampler: new TraceIdRatioBasedSampler(0.1), // 10% sampling
});
```

#### 4. Log Exclusion Filters

```bash
# Exclude health check logs
gcloud logging sinks create exclude-health-checks \
  logging.googleapis.com/projects/PROJECT_ID/logs/excluded \
  --log-filter='resource.type="cloud_run_revision" AND httpRequest.requestUrl=~"/health"'
```

### Cost-Optimized Configuration

With all optimizations: **~$150/month** (40% savings)

## Troubleshooting

### Logs Not Appearing in Cloud Logging

**Check:**
1. Service account has `roles/logging.logWriter`
2. Cloud Logging API is enabled
3. Firewall allows outbound HTTPS to `logging.googleapis.com`
4. Log entries are properly formatted (JSON)

**Test:**
```bash
# Test Cloud Logging connectivity
gcloud logging write test-log "Test message" --severity=INFO
gcloud logging read "logName=projects/PROJECT_ID/logs/test-log" --limit=1
```

### Metrics Not Appearing in Dashboards

**Check:**
1. Metric type is correctly namespaced (`custom.googleapis.com/...`)
2. Resource type is valid (`cloud_run_revision`, `cloud_function`)
3. Time series has required labels
4. Alignment period is appropriate (>= 60s)

**Test:**
```bash
# List custom metrics
gcloud monitoring metrics-descriptors list --filter='metric.type:custom.googleapis.com/discharge'

# Query time series
gcloud monitoring time-series list \
  --filter='metric.type="custom.googleapis.com/discharge/export/duration"' \
  --interval-end-time=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
```

### Traces Not Showing in Cloud Trace

**Check:**
1. OpenTelemetry exporter is configured
2. Trace context is propagated across services
3. Sampling rate is > 0
4. Service account has `roles/cloudtrace.agent`

**Test:**
```bash
# List recent traces
gcloud trace traces list --limit=10
```

### Alerts Not Firing

**Check:**
1. Alert policy is enabled
2. Notification channels are verified
3. Condition threshold is correct
4. Metric data is flowing

**Test:**
```bash
# Test alert notification
gcloud alpha monitoring policies test-notification projects/PROJECT_ID/alertPolicies/POLICY_ID \
  --notification-channel=projects/PROJECT_ID/notificationChannels/CHANNEL_ID
```

## Maintenance

### Monthly Tasks
- [ ] Review error budget consumption
- [ ] Analyze cost trends
- [ ] Update alert thresholds based on traffic
- [ ] Archive old audit logs to BigQuery

### Quarterly Tasks
- [ ] Review and update SLOs
- [ ] Audit log retention policies
- [ ] Optimize metric cardinality
- [ ] Conduct monitoring system review

### Yearly Tasks
- [ ] HIPAA audit log compliance review
- [ ] Disaster recovery drill
- [ ] Monitoring architecture review
- [ ] Update runbooks

## Support

- **Documentation:** `/docs/monitoring-architecture.md`
- **Runbooks:** `/docs/runbooks/`
- **On-Call:** PagerDuty rotation
- **Slack:** `#patient-discharge-alerts`

## License

Internal use only - Healthcare data processing system.
