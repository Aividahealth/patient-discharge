# GCP Dev Monitoring – Lightweight Plan (Integration, Pipeline, Errors)

## Scope

Minimal monitoring for the dev environment focused on:
- Integration health (Cloud Run, Cloud Functions, Pub/Sub, external APIs)
- Pipeline flow (documents moving through key stages)
- Errors (counts, recent failures, alerting)

This intentionally omits advanced analytics, tenant dashboards, and cost tracking.

## What we monitor

### 1) Integration health (basic)
- Cloud Run services: request count, error rate, p95 latency
- Cloud Functions: invocations, errors
- Pub/Sub: unacked messages, oldest unacked age
- External dependencies (via error logs): FHIR, Gemini, Translation

### 2) Pipeline flow (essential stages)
Monitor documents across these stages via log-based metrics:
1. frontend_upload
2. backend_publish_to_topic
3. simplify
4. store_in_fhir
5. publish_simplified
6. translate
7. store_translated_in_fhir

### 3) Errors
- Error counts by stage
- Recent failed pipeline instances with basic context

## Structured logs (required)

All pipeline events should emit `pipeline_event` entries to Cloud Logging:

```json
{
  "type": "pipeline_event",
  "compositionId": "composition-uuid-123",
  "tenantId": "demo",
  "step": "simplify",
  "status": "completed",
  "durationMs": 1250,
  "metadata": {
    "patientId": "patient-123"
  },
  "error": null,
  "timestamp": "2025-11-17T10:30:00Z"
}
```

Minimum fields used by metrics/alerts: `type`, `tenantId`, `step`, `status`, `durationMs`, `error`.

## Log-based metrics (3 only)

1) pipeline_step_count (counter)
- Filter: `jsonPayload.type="pipeline_event"`
- Labels: `step`, `status`, `tenant_id`

2) pipeline_step_duration (distribution)
- Filter: `jsonPayload.type="pipeline_event" AND jsonPayload.durationMs>0`
- Value: `jsonPayload.durationMs`
- Labels: `step`, `tenant_id`

3) pipeline_error_count (counter)
- Filter: `jsonPayload.type="pipeline_event" AND jsonPayload.status="failed"`
- Labels: `step`, `tenant_id`

Note: Use a simple label set to keep dev costs and cardinality low.

## Dashboards (3 small pages)

1) Pipeline Overview
- Time series: total documents processed (pipeline_step_count where status=completed)
- Stacked by step (optional)
- Gauge: success rate = completed / (completed + failed) last 24h
- In-flight estimate: count status=in_progress (if emitted)

2) Errors & Alerts
- Time series: pipeline_error_count by step
- Table: recent failed pipeline instances (logs table on `pipeline_event AND status=failed`)

3) Service Health
- Cloud Run: requests, error rate, p95 latency
- Pub/Sub: unacked messages, oldest unacked age
- Cloud Functions: invocations, error count

### Make “Uploaded, Simplified, Translated” obvious

Add three scorecards and one bar chart to Pipeline Overview:
- Uploaded (last 24h): completed `frontend_upload`
- Simplified (last 24h): completed `simplify` or `publish_simplified`
- Translated (last 24h): completed `store_translated_in_fhir`

Recommended MQL scorecards:
- Uploaded (24h):
  - `fetch logging.googleapis.com/user/pipeline_completed_frontend_upload | align rate(24h) | group_by [], [sum(value)]`
- Simplified (24h) [use whichever metric you emit]:
  - `fetch logging.googleapis.com/user/pipeline_completed_simplify | align rate(24h) | group_by [], [sum(value)]`
  - or `fetch logging.googleapis.com/user/pipeline_completed_publish_simplified | align rate(24h) | group_by [], [sum(value)]`
- Translated (24h):
  - `fetch logging.googleapis.com/user/pipeline_completed_store_translated_in_fhir | align rate(24h) | group_by [], [sum(value)]`

Bar chart (by step, last 24h):
- Include: `pipeline_completed_frontend_upload`, `pipeline_completed_simplify` (or `pipeline_completed_publish_simplified`), `pipeline_completed_store_translated_in_fhir`
- Plot as bars to show the funnel at-a-glance.

Prerequisite:
- Ensure all services emit `pipeline_event` logs for these steps. The backend already emits `frontend_upload` and store-in-FHIR steps; add emissions in Cloud Functions for `simplify`, `publish_simplified`, and `translate` so the scorecards populate.

## Alerts (minimal)

Critical
- High error rate: error_rate > 10% for any step over 15m
- Pipeline stalled: no completed documents over last 30m (business hours)
- Service down: Cloud Run error rate > 50% for 5m

Warning
- High latency: p95 latency > 30s for 10m (Cloud Run)

## Implementation checklist (1–2 hours)

1) Ensure `pipeline_event` structured logs are emitted (backend, functions)
2) Create the 3 log-based metrics
3) Build the 3 dashboards with the listed widgets
4) Add the 3 alert policies and email notifications

## Useful log queries

- All pipeline events:
  - `jsonPayload.type="pipeline_event"`
- Failed by step:
  - `jsonPayload.type="pipeline_event" AND jsonPayload.status="failed" AND jsonPayload.step="simplify"`
- Recent failures (last 1h):
  - `jsonPayload.type="pipeline_event" AND jsonPayload.status="failed" timestamp>="-1h"`

## Access

- Viewers: devs, QA (read dashboards)
- Editors: DevOps/SRE (edit dashboards/alerts)


