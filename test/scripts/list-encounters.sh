#!/bin/bash

TOKEN=$(gcloud auth print-access-token)

echo "🔍 Listing encounters in ctest FHIR store"
echo "="*80

curl -s -H "Authorization: Bearer $TOKEN" \
  "https://healthcare.googleapis.com/v1/projects/simtran-474018/locations/us-central1/datasets/ctest-dataset/fhirStores/ctest-fhir-store/fhir/Encounter?_count=10" \
  | jq -r 'if .entry then "✅ Found \(.total // .entry | length) encounters:\n" + (.entry | map("   - \(.resource.id): Patient \(.resource.subject.reference), Status: \(.resource.status)") | join("\n")) else "❌ No encounters found" end'
