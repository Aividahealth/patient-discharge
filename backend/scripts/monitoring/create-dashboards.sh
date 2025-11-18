#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${1:-}"
if [[ -z "${PROJECT_ID}" ]]; then
  echo "Usage: $0 <PROJECT_ID>"
  exit 1
fi

echo "Using project: ${PROJECT_ID}"
gcloud config set project "${PROJECT_ID}" >/dev/null

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Creating dashboards..."
gcloud monitoring dashboards create --config-from-file="${DIR}/dashboards/pipeline-overview-dev.json" || echo "pipeline overview dashboard exists or failed; continuing"
gcloud monitoring dashboards create --config-from-file="${DIR}/dashboards/errors-alerts-dev.json" || echo "errors & alerts dashboard exists or failed; continuing"
gcloud monitoring dashboards create --config-from-file="${DIR}/dashboards/service-health-dev.json" || echo "service health dashboard exists or failed; continuing"

echo "Done creating dashboards."


