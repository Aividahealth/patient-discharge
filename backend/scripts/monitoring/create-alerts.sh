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

echo "Creating alerting policies (alpha API)..."
gcloud alpha monitoring policies create --policy-from-file="${DIR}/alerts/policies.yaml" || echo "Alert policies exist or failed; continuing"

echo "Done creating alerting policies."


