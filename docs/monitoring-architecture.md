# Google Cloud Native Monitoring Architecture
## Patient Discharge System

**Version:** 1.0
**Date:** 2025-11-16
**Status:** Design Proposal

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [System Overview](#system-overview)
3. [Monitoring Pillars](#monitoring-pillars)
4. [Key Metrics & SLIs](#key-metrics--slis)
5. [Dashboard Architecture](#dashboard-architecture)
6. [Alerting Strategy](#alerting-strategy)
7. [Implementation Roadmap](#implementation-roadmap)
8. [Cost Estimation](#cost-estimation)

---

## Executive Summary

This document outlines a comprehensive Google Cloud-native monitoring solution for the patient-discharge system, a multi-tenant healthcare data pipeline processing discharge summaries with AI-powered simplification and translation.

### Goals
- **Visibility**: End-to-end observability across all system components
- **Reliability**: Proactive alerting for failures and degradations
- **Performance**: Track latency, throughput, and resource utilization
- **Compliance**: Audit trail for HIPAA/healthcare data processing
- **Cost Control**: Monitor and optimize GCP service usage

### Core Services Used
- **Cloud Logging** - Centralized log aggregation
- **Cloud Monitoring** - Metrics, dashboards, and alerts
- **Cloud Trace** - Distributed tracing
- **Error Reporting** - Error aggregation and analysis
- **Log Analytics** - Advanced log querying and analysis

---

## System Overview

### Architecture Flow

```
┌─────────────────┐
│  Frontend (UI)  │
│  Vercel/Next.js │
└────────┬────────┘
         │ 1. Upload discharge summary
         ▼
┌─────────────────────────────────────┐
│  NestJS Backend (Cloud Run)         │
│  ├─ Discharge Export Controller     │
│  ├─ FHIR Composition Creator        │
│  └─ Pub/Sub Publisher               │
└────────┬────────────────────────────┘
         │ 2. Publish event: discharge-export-events
         ▼
┌─────────────────────────────────────┐
│  Simplification Cloud Function      │
│  ├─ Fetch Tenant Config             │
│  ├─ Fetch FHIR Binaries             │
│  ├─ Write Raw Files → GCS           │
│  ├─ Gemini AI Simplification        │
│  ├─ Write Simplified → GCS          │
│  ├─ Update FHIR Composition         │
│  └─ Publish: simplification-done    │
└────────┬────────────────────────────┘
         │ 3. Publish event: discharge-simplification-completed
         ▼
┌─────────────────────────────────────┐
│  Translation Cloud Function         │
│  ├─ Fetch Simplified Content        │
│  ├─ Google Translate API            │
│  ├─ Write Translated → GCS          │
│  └─ Update FHIR Composition         │
└────────┬────────────────────────────┘
         │ 4. GCS Object Created
         ▼
┌─────────────────────────────────────┐
│  Firestore Sync Cloud Function      │
│  └─ Sync metadata to Firestore      │
└─────────────────────────────────────┘
```

### Components to Monitor

| Component | Type | Key Concerns |
|-----------|------|--------------|
| NestJS Backend | Cloud Run | Request latency, error rate, cold starts |
| Simplification CF | Cloud Function | Processing time, Gemini API quotas, retries |
| Translation CF | Cloud Function | Translation API quotas, batch efficiency |
| Firestore Sync CF | Cloud Function | Sync lag, duplicate processing |
| Pub/Sub Topics | Messaging | Message age, dead letters, delivery latency |
| GCS Buckets | Storage | Write latency, storage costs, versioning |
| FHIR API | External API | Response time, rate limits, errors |
| Gemini API | AI Service | Token usage, latency, quota exhaustion |

---

## Monitoring Pillars

### 1. Cloud Logging

**Structured Logging Strategy**

All services will emit structured JSON logs with consistent fields:

```json
{
  "severity": "INFO|WARNING|ERROR|CRITICAL",
  "timestamp": "2025-11-16T12:00:00.000Z",
  "trace": "projects/PROJECT_ID/traces/TRACE_ID",
  "spanId": "SPAN_ID",
  "component": "backend|simplification-cf|translation-cf|firestore-sync-cf",
  "operation": "discharge-export|simplification|translation|firestore-sync",
  "tenantId": "tenant-123",
  "patientId": "patient-456",
  "compositionId": "composition-789",
  "message": "Human-readable message",
  "metadata": {
    "processingTimeMs": 1234,
    "geminiTokens": 5678,
    "retryCount": 0,
    "errorCode": "FHIR_API_ERROR"
  },
  "labels": {
    "environment": "production",
    "version": "1.2.3"
  }
}
```

**Log Types**

1. **Audit Logs** - Healthcare data access (HIPAA compliance)
2. **Application Logs** - Business logic, processing flow
3. **Error Logs** - Exceptions, API failures, retries
4. **Performance Logs** - Latency, token usage, throughput

**Log Retention**

- Audit Logs: **7 years** (HIPAA compliance)
- Error Logs: **90 days**
- Application Logs: **30 days**
- Debug Logs: **7 days**

### 2. Cloud Monitoring Metrics

**System Metrics** (Automatically Collected)

- Cloud Run: Request count, latency, CPU, memory, instance count
- Cloud Functions: Invocations, execution time, memory, cold starts
- Pub/Sub: Message count, oldest unacked message age, dead letters
- GCS: Request count, throughput, storage size

**Custom Metrics** (To Be Implemented)

| Metric Name | Type | Description | Unit |
|-------------|------|-------------|------|
| `discharge/export/duration` | Distribution | End-to-end processing time | ms |
| `discharge/simplification/duration` | Distribution | Gemini processing time | ms |
| `discharge/translation/duration` | Distribution | Translation time per language | ms |
| `discharge/gemini/tokens` | Counter | Total tokens consumed | count |
| `discharge/gemini/cost` | Counter | Estimated Gemini API cost | USD |
| `discharge/fhir/requests` | Counter | FHIR API requests by operation | count |
| `discharge/fhir/errors` | Counter | FHIR API errors by type | count |
| `discharge/pubsub/lag` | Gauge | Message processing lag | seconds |
| `discharge/export/success_rate` | Gauge | Successful exports ratio | percent |
| `discharge/export/per_tenant` | Counter | Exports per tenant | count |

**Metric Collection Methods**

1. **Cloud Monitoring API** - Direct metric writes from application
2. **Log-Based Metrics** - Extract metrics from structured logs
3. **OpenTelemetry** - Standardized instrumentation (future)

### 3. Cloud Trace

**Distributed Tracing Implementation**

Track a discharge summary export across all services:

```
Trace: discharge-export-abc123 (total: 45.2s)
│
├─ Span: backend.createComposition (2.1s)
│  ├─ Span: fhir.createComposition (1.8s)
│  └─ Span: pubsub.publish (0.3s)
│
├─ Span: simplification.process (35.5s)
│  ├─ Span: config.fetchTenant (0.2s)
│  ├─ Span: fhir.fetchBinaries (3.1s)
│  ├─ Span: gcs.writeRaw (1.2s)
│  ├─ Span: gemini.simplify (28.5s)
│  │  ├─ Span: gemini.api.call (28.3s)
│  │  └─ Span: retry.backoff (0.2s)
│  ├─ Span: gcs.writeSimplified (0.8s)
│  ├─ Span: fhir.updateComposition (1.2s)
│  └─ Span: pubsub.publish (0.5s)
│
├─ Span: translation.process (7.2s)
│  ├─ Span: gcs.readSimplified (0.3s)
│  ├─ Span: translate.api.call (5.5s)
│  ├─ Span: gcs.writeTranslated (0.9s)
│  └─ Span: fhir.updateComposition (0.5s)
│
└─ Span: firestore.sync (0.4s)
   └─ Span: firestore.write (0.3s)
```

**Trace Attributes**

- `tenant.id` - Tenant identifier
- `patient.id` - Patient identifier
- `composition.id` - FHIR Composition ID
- `operation.type` - export|simplification|translation
- `language.target` - Translation target language
- `retry.count` - Number of retries

### 4. Error Reporting

**Automatic Error Aggregation**

Cloud Error Reporting automatically groups similar errors:

- **FHIR API Errors** - 401, 403, 404, 500 responses
- **Gemini API Errors** - Quota exceeded, content safety violations
- **Pub/Sub Errors** - Message too large, encoding issues
- **GCS Errors** - Permission denied, bucket not found
- **Application Errors** - Validation failures, tenant not found

**Error Enrichment**

Each error includes:
- Stack trace with source maps
- User context (tenant, patient IDs - hashed for privacy)
- Request context (headers, body - sanitized)
- Similar errors count
- First/last seen timestamps

---

## Key Metrics & SLIs

### Service Level Indicators (SLIs)

| SLI | Target | Measurement Window | Definition |
|-----|--------|-------------------|------------|
| **Availability** | 99.5% | 30 days | Percentage of successful discharge exports |
| **Latency (p50)** | < 30s | 30 days | Median end-to-end processing time |
| **Latency (p95)** | < 60s | 30 days | 95th percentile processing time |
| **Latency (p99)** | < 120s | 30 days | 99th percentile processing time |
| **Error Rate** | < 1% | 7 days | Percentage of failed exports (non-retryable) |
| **Data Quality** | 99% | 30 days | Percentage of exports with valid FHIR data |

### Service Level Objectives (SLOs)

**SLO 1: End-to-End Export Success Rate**

```
SLO: 99.5% of discharge exports complete successfully within 120 seconds
Error Budget: 0.5% (allows ~216 failures per month for 1000 exports/day)
Alerting Threshold: 98% (burn rate: 3x)
```

**SLO 2: Simplification Processing Time**

```
SLO: 95% of simplifications complete within 60 seconds
Error Budget: 5%
Alerting Threshold: 90%
```

**SLO 3: FHIR API Reliability**

```
SLO: 99.9% of FHIR API calls succeed
Error Budget: 0.1%
Alerting Threshold: 99.5%
```

### Error Budget Policy

**When Error Budget is Exhausted:**

1. **Freeze non-critical features** - Focus on reliability
2. **Root cause analysis** - Investigate top failure modes
3. **Runbook updates** - Document new failure scenarios
4. **Capacity planning** - Review resource allocation

---

## Dashboard Architecture

### Dashboard 1: Executive Overview

**Purpose:** High-level system health for stakeholders

**Widgets:**

1. **Export Volume** - Line chart (24h, 7d, 30d)
   - Total exports by status (success/failed/in-progress)
   - Exports per tenant (top 10)

2. **SLO Compliance** - Scorecard
   - Availability (current vs target)
   - P95 latency (current vs target)
   - Error rate (current vs target)
   - Error budget remaining (%)

3. **Processing Pipeline** - Sankey diagram
   - Flow through each stage with drop-off rates

4. **Cost Overview** - Stacked area chart
   - Gemini API costs
   - Cloud Function costs
   - Storage costs
   - Total daily spend

### Dashboard 2: Operational Health

**Purpose:** Real-time monitoring for on-call engineers

**Widgets:**

1. **Active Incidents** - Alert table
   - Firing alerts with severity and duration

2. **Recent Errors** - Error log table
   - Last 50 errors with frequency and first seen

3. **Pub/Sub Queue Health** - Heatmap
   - Message age by topic
   - Dead letter queue count

4. **Cloud Function Metrics** - Multi-line chart
   - Invocation rate (per function)
   - Execution time (p50, p95, p99)
   - Error rate (%)
   - Cold start rate (%)

5. **FHIR & Gemini API** - Line charts
   - Request rate
   - Error rate by status code
   - P95 latency

### Dashboard 3: Performance Deep Dive

**Purpose:** Performance optimization and capacity planning

**Widgets:**

1. **End-to-End Latency** - Histogram
   - Distribution of processing times
   - Breakdown by stage (backend, simplification, translation)

2. **Gemini Token Usage** - Time series
   - Tokens per request (input/output)
   - Total tokens per day
   - Cost per 1M tokens

3. **GCS Performance** - Charts
   - Write throughput (MB/s)
   - Object count by bucket
   - Storage size trend

4. **Resource Utilization** - Gauges
   - Cloud Run CPU/Memory usage
   - Cloud Function concurrency
   - Pub/Sub subscription backlog

### Dashboard 4: Business Analytics

**Purpose:** Product insights and tenant usage patterns

**Widgets:**

1. **Tenant Activity** - Table
   - Exports per tenant (7d, 30d)
   - Average processing time
   - Error rate per tenant

2. **Language Distribution** - Pie chart
   - Translation requests by language

3. **Content Analysis** - Charts
   - Average document size (PDF)
   - Simplified content reduction ratio
   - Gemini tokens per document

4. **User Engagement** - Time series
   - Unique patients processed
   - Documents per patient
   - Repeat exports

---

## Alerting Strategy

### Alerting Principles

1. **Actionable** - Every alert requires human intervention
2. **Contextual** - Include runbook links and suggested actions
3. **Escalated** - Route to appropriate on-call tier
4. **Documented** - All alerts have runbook entries

### Alert Definitions

#### Critical Alerts (P1) - Page immediately

**ALERT-001: SLO Error Budget Exhausted**

```yaml
condition: error_budget_remaining < 10%
duration: 5 minutes
notification: PagerDuty (on-call engineer)
runbook: docs/runbooks/slo-breach.md
actions:
  - Investigate top error types in Error Reporting
  - Check FHIR API status
  - Review recent deployments
```

**ALERT-002: Pub/Sub Dead Letter Queue Buildup**

```yaml
condition: dead_letter_message_count > 10
duration: 5 minutes
notification: PagerDuty (on-call engineer)
runbook: docs/runbooks/pubsub-dlq.md
actions:
  - Inspect messages in DLQ for patterns
  - Check Cloud Function logs for errors
  - Manually replay or discard messages
```

**ALERT-003: FHIR API Complete Failure**

```yaml
condition: fhir_error_rate > 50%
duration: 2 minutes
notification: PagerDuty (on-call engineer + escalation)
runbook: docs/runbooks/fhir-outage.md
actions:
  - Check Google Cloud Healthcare API status
  - Verify service account permissions
  - Contact Google Cloud support
```

#### High Alerts (P2) - Email/Slack immediately

**ALERT-004: Gemini API Quota Approaching Limit**

```yaml
condition: gemini_tokens_used > 80% of daily quota
duration: 5 minutes
notification: Slack #alerts, Email (team)
runbook: docs/runbooks/gemini-quota.md
actions:
  - Review token usage by tenant
  - Throttle non-critical tenants
  - Request quota increase from Google
```

**ALERT-005: Cloud Function Timeout Rate High**

```yaml
condition: function_timeout_rate > 5%
duration: 10 minutes
notification: Slack #alerts
runbook: docs/runbooks/function-timeouts.md
actions:
  - Check Gemini API latency
  - Review function timeout configuration
  - Investigate slow FHIR queries
```

**ALERT-006: Processing Latency SLO Violation**

```yaml
condition: p95_processing_time > 90s
duration: 15 minutes
notification: Slack #alerts
runbook: docs/runbooks/high-latency.md
actions:
  - Check Cloud Trace for slow spans
  - Review Gemini API performance
  - Check concurrent processing limits
```

#### Medium Alerts (P3) - Email during business hours

**ALERT-007: Elevated Error Rate**

```yaml
condition: error_rate > 2% AND error_rate < 5%
duration: 30 minutes
notification: Email (team)
runbook: docs/runbooks/elevated-errors.md
actions:
  - Monitor error trend
  - Review error types in Error Reporting
  - Plan investigation during business hours
```

**ALERT-008: GCS Storage Cost Anomaly**

```yaml
condition: daily_storage_cost > 150% of 7-day average
duration: 6 hours
notification: Email (team)
runbook: docs/runbooks/cost-anomaly.md
actions:
  - Check for unusual export volume
  - Review bucket lifecycle policies
  - Audit tenant activity
```

### Alert Routing

```
Critical (P1) → PagerDuty → On-Call Engineer
High (P2) → Slack #alerts + Email → Team
Medium (P3) → Email → Team (business hours only)
Info → Dashboard only
```

### Alert Fatigue Prevention

1. **Snooze during deployments** - 15-minute alert pause
2. **Grouping** - Combine related alerts (e.g., all FHIR errors)
3. **Auto-resolution** - Close alerts when condition resolves
4. **Weekly review** - Team reviews alert effectiveness

---

## Implementation Roadmap

### Phase 1: Foundation (Week 1-2)

**Objective:** Establish centralized logging and basic metrics

- [ ] Migrate to structured JSON logging (all services)
- [ ] Implement Cloud Logging SDK in NestJS backend
- [ ] Add trace context propagation (correlation IDs)
- [ ] Create log-based metrics for error rates
- [ ] Set up log retention policies
- [ ] Deploy Executive Overview dashboard

**Deliverables:**
- Unified log schema documentation
- Backend logging middleware
- Cloud Function logging utilities
- 1 dashboard live in Cloud Monitoring

### Phase 2: Custom Metrics (Week 3-4)

**Objective:** Instrument application for business metrics

- [ ] Implement Cloud Monitoring API client
- [ ] Add custom metrics to discharge export flow
- [ ] Track Gemini token usage and costs
- [ ] Instrument FHIR API calls
- [ ] Create Operational Health dashboard
- [ ] Deploy Performance Deep Dive dashboard

**Deliverables:**
- 8 custom metrics published
- 2 additional dashboards
- Metrics documentation

### Phase 3: Distributed Tracing (Week 5-6)

**Objective:** Enable end-to-end request tracing

- [ ] Integrate Cloud Trace SDK (backend)
- [ ] Add trace context to Pub/Sub messages
- [ ] Instrument Cloud Functions with spans
- [ ] Create trace exemplars from logs
- [ ] Link traces to Cloud Logging
- [ ] Document trace analysis workflows

**Deliverables:**
- Full trace coverage (backend → CF → CF)
- Trace analysis runbook
- Average trace collection rate: 10%

### Phase 4: Alerting & SLOs (Week 7-8)

**Objective:** Proactive monitoring and SLO tracking

- [ ] Define SLOs in Cloud Monitoring
- [ ] Create 8 alerting policies (P1-P3)
- [ ] Set up PagerDuty integration
- [ ] Configure Slack notifications
- [ ] Create runbooks for each alert
- [ ] Deploy Business Analytics dashboard
- [ ] Conduct alert testing exercise

**Deliverables:**
- 3 SLOs tracked with error budgets
- 8 alerting policies active
- 8 runbook documents
- Alert escalation process documented

### Phase 5: Optimization & Audit (Week 9-10)

**Objective:** Fine-tune monitoring and ensure compliance

- [ ] Implement HIPAA-compliant audit logging
- [ ] Create audit log export to BigQuery
- [ ] Set up 7-year retention for audit logs
- [ ] Configure log anonymization for PII
- [ ] Optimize metric cardinality
- [ ] Create cost optimization dashboard
- [ ] Conduct monitoring system review

**Deliverables:**
- Audit log pipeline (Logging → BigQuery)
- HIPAA compliance documentation
- Monthly cost analysis report template
- Monitoring playbook v1.0

---

## Cost Estimation

### Monthly Cost Breakdown (assuming 10,000 exports/month)

| Service | Usage | Unit Cost | Monthly Cost |
|---------|-------|-----------|--------------|
| **Cloud Logging** | | | |
| - Log ingestion | 50 GB | $0.50/GB | $25 |
| - Log storage (30d) | 50 GB | $0.01/GB/month | $0.50 |
| - Audit logs (7yr) | 5 GB/month × 84 months | $0.01/GB/month | $4.20 |
| **Cloud Monitoring** | | | |
| - Metrics ingestion | 1M data points | $0.2580/1k points (>150k) | $232 |
| - API calls | 100k reads | $0.01/1k calls | $1 |
| **Cloud Trace** | | | |
| - Span ingestion (10%) | 10k traces × 8 spans | $0.20/1M spans | $0.016 |
| **Error Reporting** | | | |
| - Error events | 1k errors | Free tier | $0 |
| **Dashboards & Alerts** | | | |
| - Custom dashboards | 4 dashboards | Free | $0 |
| - Alerting policies | 8 policies | Free | $0 |
| **BigQuery (Audit Logs)** | | | |
| - Storage | 5 GB/month (cumulative) | $0.02/GB | $0.10 |
| - Queries | 10 GB scanned/month | $5/TB | $0.05 |
| **Total** | | | **~$263/month** |

### Cost Optimization Strategies

1. **Log Sampling** - Sample 10% of verbose logs (saves 90% on non-critical logs)
2. **Metric Aggregation** - Pre-aggregate metrics before sending (reduce data points)
3. **Trace Sampling** - 10% trace collection (adjustable based on needs)
4. **Log Exclusion Filters** - Exclude health checks and debug logs in production
5. **Retention Tuning** - Shorter retention for non-audit logs

**Optimized Cost:** ~$150/month (40% reduction)

---

## Appendix

### A. Structured Log Schema

See `/home/user/patient-discharge/backend/src/common/logging/log-schema.ts`

### B. Custom Metric Definitions

See `/home/user/patient-discharge/backend/src/monitoring/metrics.ts`

### C. Trace Context Propagation

See `/home/user/patient-discharge/backend/src/common/tracing/trace-context.ts`

### D. Alert Runbook Template

See `/home/user/patient-discharge/docs/runbooks/template.md`

### E. Dashboard JSON Exports

See `/home/user/patient-discharge/monitoring/dashboards/`

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-11-16 | Claude | Initial architecture design |

---

**Next Steps:**
1. Review and approve this architecture design
2. Prioritize implementation phases
3. Assign engineering resources
4. Set up GCP project monitoring infrastructure
5. Begin Phase 1 implementation
