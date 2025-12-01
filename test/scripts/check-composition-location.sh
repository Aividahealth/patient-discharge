#!/bin/bash

TOKEN=$(gcloud auth print-access-token)
COMPOSITION_ID="84fc1eb4-e977-4212-9221-bb960244e917"

echo "🔍 Checking for composition $COMPOSITION_ID in different FHIR stores"
echo "="*80

echo -e "\n1. Checking ctest-dataset/ctest-fhir-store..."
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://healthcare.googleapis.com/v1/projects/simtran-474018/locations/us-central1/datasets/ctest-dataset/fhirStores/ctest-fhir-store/fhir/Composition/$COMPOSITION_ID" \
  | jq -r 'if .id then "✅ FOUND - ID: \(.id), Subject: \(.subject.reference)" else "❌ NOT FOUND - \(.issue[0].diagnostics)" end'

echo -e "\n2. Checking aivida-dev/aivida..."
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://healthcare.googleapis.com/v1/projects/simtran-474018/locations/us-central1/datasets/aivida-dev/fhirStores/aivida/fhir/Composition/$COMPOSITION_ID" \
  | jq -r 'if .id then "✅ FOUND - ID: \(.id), Subject: \(.subject.reference)" else "❌ NOT FOUND - \(.issue[0].diagnostics)" end'

echo -e "\n="*80
