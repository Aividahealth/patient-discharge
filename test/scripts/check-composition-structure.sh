#!/bin/bash

TOKEN=$(gcloud auth print-access-token)
COMPOSITION_ID="da180b84-3e5b-4f3f-be2f-c5c8b5baf750"

echo "🔍 Checking composition structure: $COMPOSITION_ID"
echo "="*80

curl -s -H "Authorization: Bearer $TOKEN" \
  "https://healthcare.googleapis.com/v1/projects/simtran-474018/locations/us-central1/datasets/ctest-dataset/fhirStores/ctest-fhir-store/fhir/Composition/$COMPOSITION_ID" \
  | jq '{
      id: .id,
      subject: .subject.reference,
      encounter: .encounter.reference,
      status: .status,
      type: .type.coding[0].code
    }'

echo -e "\n="*80
