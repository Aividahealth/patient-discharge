# Monitoring Implementation Checklist

Use this checklist to track your monitoring implementation progress.

## Phase 1: Foundation (Week 1-2)

### Setup & Configuration

- [ ] Enable GCP APIs
  - [ ] Cloud Logging API
  - [ ] Cloud Monitoring API
  - [ ] Cloud Trace API
  - [ ] Error Reporting API

- [ ] Create service accounts
  - [ ] Backend service account with logging/monitoring/trace permissions
  - [ ] Cloud Function service account with logging/monitoring permissions

- [ ] Install NPM dependencies
  ```bash
  npm install @google-cloud/logging \
              @google-cloud/monitoring \
              @google-cloud/opentelemetry-cloud-trace-exporter \
              @opentelemetry/api \
              @opentelemetry/sdk-trace-node
  ```

### Backend Integration

- [ ] Copy monitoring files to backend
  - [ ] `backend/src/monitoring/structured-logger.ts`
  - [ ] `backend/src/monitoring/metrics.service.ts`
  - [ ] `backend/src/monitoring/trace-context.ts`

- [ ] Update `backend/src/main.ts`
  - [ ] Import monitoring modules
  - [ ] Initialize tracing
  - [ ] Add logging middleware
  - [ ] Register TracingInterceptor

- [ ] Update environment variables
  - [ ] Add `GCP_PROJECT_ID`
  - [ ] Add `GCP_REGION`
  - [ ] Add `APP_VERSION`

- [ ] Update existing services
  - [ ] Replace console.log with StructuredLogger
  - [ ] Add metrics tracking to critical paths
  - [ ] Add trace context to Pub/Sub messages

### Testing

- [ ] Test structured logging
  ```bash
  # Check logs appear in Cloud Logging
  gcloud logging read "resource.type=cloud_run_revision" --limit=10
  ```

- [ ] Test metrics
  ```bash
  # Verify custom metrics are created
  gcloud monitoring metrics-descriptors list --filter='metric.type:custom.googleapis.com/discharge'
  ```

- [ ] Test tracing
  ```bash
  # View traces in Cloud Console
  gcloud trace traces list --limit=10
  ```

## Phase 2: Dashboards (Week 3)

### Dashboard Deployment

- [ ] Create Executive Overview dashboard
  ```bash
  gcloud monitoring dashboards create --config-from-file=monitoring/dashboards/executive-overview.json
  ```

- [ ] Create Operational Health dashboard
  ```bash
  gcloud monitoring dashboards create --config-from-file=monitoring/dashboards/operational-health.json
  ```

- [ ] Verify dashboards are rendering correctly
  - [ ] All widgets show data
  - [ ] Time ranges are appropriate
  - [ ] Colors and thresholds are correct

### Dashboard Customization

- [ ] Update dashboard JSON with your project ID
  - [ ] Replace `${PROJECT_ID}` placeholders
  - [ ] Update resource labels (service names, regions)

- [ ] Add custom widgets as needed
  - [ ] Per-tenant usage breakdown
  - [ ] Language distribution charts
  - [ ] Cost trends

## Phase 3: Alerting (Week 4)

### Notification Channels

- [ ] Create PagerDuty notification channel
  ```bash
  gcloud alpha monitoring channels create \
    --display-name="PagerDuty On-Call" \
    --type=pagerduty \
    --channel-labels=service_key=YOUR_KEY
  ```

- [ ] Create Slack notification channel
  ```bash
  gcloud alpha monitoring channels create \
    --display-name="Slack #alerts" \
    --type=slack \
    --channel-labels=url=YOUR_WEBHOOK
  ```

- [ ] Create Email notification channel
  ```bash
  gcloud alpha monitoring channels create \
    --display-name="Team Email" \
    --type=email \
    --channel-labels=email_address=team@example.com
  ```

- [ ] Test notification channels
  ```bash
  gcloud alpha monitoring policies test-notification CHANNEL_ID
  ```

### Terraform Setup

- [ ] Initialize Terraform
  ```bash
  cd monitoring/terraform
  terraform init
  ```

- [ ] Create `terraform.tfvars`
  - [ ] Set `project_id`
  - [ ] Set notification channel IDs
  - [ ] Set region

- [ ] Review Terraform plan
  ```bash
  terraform plan
  ```

- [ ] Apply Terraform configuration
  ```bash
  terraform apply
  ```

### Alert Validation

- [ ] Test each alert policy (trigger manually if possible)
  - [ ] ALERT-001: SLO Error Budget Exhausted
  - [ ] ALERT-002: Pub/Sub DLQ Buildup
  - [ ] ALERT-003: FHIR API Failure
  - [ ] ALERT-004: Gemini Quota Limit
  - [ ] ALERT-005: Function Timeout Rate
  - [ ] ALERT-006: Latency SLO Violation
  - [ ] ALERT-007: Elevated Error Rate
  - [ ] ALERT-008: Storage Cost Anomaly

- [ ] Verify alert notifications
  - [ ] PagerDuty incidents created (P1 alerts)
  - [ ] Slack messages sent (P2 alerts)
  - [ ] Emails received (P3 alerts)

## Phase 4: SLOs (Week 5)

### SLO Configuration

- [ ] Deploy SLO definitions
  ```bash
  cd monitoring/terraform
  terraform apply
  ```

- [ ] Verify SLOs in Cloud Console
  - [ ] Export Availability (99.5%)
  - [ ] Export Latency P95 (<60s)
  - [ ] FHIR API Reliability (99.9%)

- [ ] Set up SLO burn rate alerts
  - [ ] Fast burn alert (14.4x rate)
  - [ ] Slow burn alert (2.4x rate)

### Error Budget Tracking

- [ ] Create error budget dashboard
- [ ] Set up weekly error budget reports
- [ ] Define error budget policy
  - [ ] Freeze thresholds
  - [ ] Escalation procedures
  - [ ] Incident review process

## Phase 5: Cloud Functions (Week 6)

### Simplification Function

- [ ] Add monitoring imports
- [ ] Extract trace context from Pub/Sub message
- [ ] Add structured logging
  - [ ] Function start
  - [ ] Tenant config fetch
  - [ ] FHIR binaries fetch
  - [ ] Gemini API call
  - [ ] GCS writes
  - [ ] Function completion

- [ ] Add custom metrics
  - [ ] Simplification duration
  - [ ] Gemini token usage
  - [ ] Gemini cost
  - [ ] FHIR API latency

- [ ] Add error handling
  - [ ] Log errors with context
  - [ ] Record failure metrics
  - [ ] Determine retry eligibility

### Translation Function

- [ ] Add monitoring imports
- [ ] Extract trace context
- [ ] Add structured logging
  - [ ] Function start
  - [ ] Per-language translation
  - [ ] Function completion

- [ ] Add custom metrics
  - [ ] Translation duration (per language)
  - [ ] Translation API calls

### Firestore Sync Function

- [ ] Add monitoring
- [ ] Track sync lag
- [ ] Monitor duplicate processing

## Phase 6: Audit Logging (Week 7)

### HIPAA Compliance

- [ ] Configure BigQuery dataset for audit logs
  ```bash
  bq mk --dataset --location=us audit_logs
  ```

- [ ] Create log sink to BigQuery
  ```bash
  gcloud logging sinks create audit-log-sink \
    bigquery.googleapis.com/projects/PROJECT/datasets/audit_logs \
    --log-filter='labels.audit="true"'
  ```

- [ ] Set 7-year retention policy
  ```bash
  bq update --time_partitioning_expiration=220752000 audit_logs.logs
  ```

- [ ] Create audit log queries
  - [ ] Patient data access by user
  - [ ] Export activity by tenant
  - [ ] Failed authentication attempts

### Audit Implementation

- [ ] Add audit logging to all FHIR operations
  - [ ] Patient read
  - [ ] Composition create
  - [ ] Binary read
  - [ ] Document delete

- [ ] Sanitize PII in logs (hash patient IDs)

- [ ] Test audit log pipeline
  - [ ] Perform auditable action
  - [ ] Verify log in BigQuery
  - [ ] Query audit trail

## Phase 7: Optimization (Week 8)

### Cost Optimization

- [ ] Implement log sampling (10% debug logs)
- [ ] Add log exclusion filters (health checks)
- [ ] Optimize metric cardinality (reduce labels)
- [ ] Adjust trace sampling rate (10%)

- [ ] Review monthly costs
  - [ ] Compare to budget ($260/month)
  - [ ] Identify optimization opportunities
  - [ ] Adjust retention policies

### Performance Tuning

- [ ] Profile logging overhead (< 5ms per log)
- [ ] Profile metrics overhead (< 10ms per metric)
- [ ] Optimize trace context propagation

- [ ] Load test monitoring system
  - [ ] 100 exports/minute
  - [ ] Verify metrics accuracy
  - [ ] Check latency impact

## Phase 8: Documentation (Week 9)

### Runbooks

- [ ] Create runbook for each alert
  - [ ] ALERT-001: SLO Error Budget Exhausted
  - [ ] ALERT-002: Pub/Sub DLQ Buildup
  - [ ] ALERT-003: FHIR API Failure
  - [ ] ALERT-004: Gemini Quota Limit
  - [ ] ALERT-005: Function Timeout Rate
  - [ ] ALERT-006: Latency SLO Violation
  - [ ] ALERT-007: Elevated Error Rate
  - [ ] ALERT-008: Storage Cost Anomaly

- [ ] Document common troubleshooting scenarios
  - [ ] Logs not appearing
  - [ ] Metrics missing
  - [ ] Traces incomplete
  - [ ] Alerts not firing

### Team Training

- [ ] Conduct dashboard walkthrough
- [ ] Train on-call on alert response
- [ ] Document monitoring architecture
- [ ] Create monitoring playbook

## Phase 9: Continuous Improvement (Ongoing)

### Monthly Reviews

- [ ] Review SLO compliance
- [ ] Analyze incident trends
- [ ] Update alert thresholds
- [ ] Optimize costs

### Quarterly Tasks

- [ ] Audit monitoring coverage
- [ ] Review error budgets
- [ ] Update SLO targets
- [ ] Conduct disaster recovery drill

---

## Validation Checklist

Before marking implementation complete, verify:

- [ ] All logs are flowing to Cloud Logging
- [ ] All custom metrics are being recorded
- [ ] Traces are complete end-to-end
- [ ] Dashboards show real data (not placeholders)
- [ ] All 8 alerts are enabled and tested
- [ ] SLOs are tracking correctly
- [ ] Error budgets are calculating properly
- [ ] Audit logs are persisting to BigQuery
- [ ] On-call team is trained
- [ ] Runbooks are accessible and up-to-date
- [ ] Monthly cost is within budget

## Success Criteria

- [ ] **Observability**: Can diagnose any system issue within 5 minutes
- [ ] **Reliability**: SLO compliance > 99.5% for 30 days
- [ ] **Incident Response**: Mean time to detect (MTTD) < 2 minutes
- [ ] **Cost**: Monthly monitoring cost < $300
- [ ] **Compliance**: 100% of data access logged for HIPAA audit

---

**Implementation Status:** 0% Complete

**Last Updated:** 2025-11-16

**Assigned To:** DevOps Team

**Target Completion:** Week 9 (2025-12-18)
