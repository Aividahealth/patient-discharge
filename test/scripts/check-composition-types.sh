#!/bin/bash

TOKEN=$(gcloud auth print-access-token)

echo "🔍 Checking composition da180b84-3e5b-4f3f-be2f-c5c8b5baf750 types"
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://healthcare.googleapis.com/v1/projects/simtran-474018/locations/us-central1/datasets/ctest-dataset/fhirStores/ctest-fhir-store/fhir/Composition/da180b84-3e5b-4f3f-be2f-c5c8b5baf750" \
  | jq '.type'
