#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${1:-}"
if [[ -z "${PROJECT_ID}" ]]; then
  echo "Usage: $0 <PROJECT_ID>"
  exit 1
fi

echo "Using project: ${PROJECT_ID}"
gcloud config set project "${PROJECT_ID}" >/dev/null

echo "Creating log-based metrics (per-step counters)..."

STEPS=(
  frontend_upload
  backend_publish_to_topic
  simplify
  store_in_fhir
  publish_simplified
  translate
  store_translated_in_fhir
)

# Totals (completed/failed) across all steps
gcloud logging metrics create pipeline_completed_total \
  --description="Total completed pipeline events (all steps)" \
  --log-filter='jsonPayload.type="pipeline_event" AND jsonPayload.status="completed"' \
  --project="${PROJECT_ID}" || echo "pipeline_completed_total exists or failed; continuing"

gcloud logging metrics create pipeline_failed_total \
  --description="Total failed pipeline events (all steps)" \
  --log-filter='jsonPayload.type="pipeline_event" AND jsonPayload.status="failed"' \
  --project="${PROJECT_ID}" || echo "pipeline_failed_total exists or failed; continuing"

# Per-step completed and failed counters
for step in "${STEPS[@]}"; do
  gcloud logging metrics create "pipeline_completed_${step}" \
    --description="Completed events for step: ${step}" \
    --log-filter="jsonPayload.type=\"pipeline_event\" AND jsonPayload.status=\"completed\" AND jsonPayload.step=\"${step}\"" \
    --project="${PROJECT_ID}" || echo "pipeline_completed_${step} exists or failed; continuing"

  gcloud logging metrics create "pipeline_failed_${step}" \
    --description="Failed events for step: ${step}" \
    --log-filter="jsonPayload.type=\"pipeline_event\" AND jsonPayload.status=\"failed\" AND jsonPayload.step=\"${step}\"" \
    --project="${PROJECT_ID}" || echo "pipeline_failed_${step} exists or failed; continuing"
done

echo "Done creating log-based metrics."


