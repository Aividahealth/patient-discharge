#!/bin/bash

TOKEN=$(gcloud auth print-access-token)

echo "🔍 Checking ctest FHIR store for Patients, Encounters, and Compositions"
echo "="*80

echo -e "\n1. Searching for Patients..."
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://healthcare.googleapis.com/v1/projects/simtran-474018/locations/us-central1/datasets/ctest-dataset/fhirStores/ctest-fhir-store/fhir/Patient" \
  | jq -r 'if .entry then "✅ Found \(.total // .entry | length) patients:\n" + (.entry | map("   - Patient/\(.resource.id): \(.resource.name[0].given[0] // "N/A") \(.resource.name[0].family // "N/A")") | join("\n")) else "❌ No patients found" end'

echo -e "\n2. Searching for Encounters..."
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://healthcare.googleapis.com/v1/projects/simtran-474018/locations/us-central1/datasets/ctest-dataset/fhirStores/ctest-fhir-store/fhir/Encounter?_count=100" \
  | jq -r 'if .entry then "✅ Found \(.total // .entry | length) encounters" else "❌ No encounters found" end'

echo -e "\n3. Searching for Compositions..."
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://healthcare.googleapis.com/v1/projects/simtran-474018/locations/us-central1/datasets/ctest-dataset/fhirStores/ctest-fhir-store/fhir/Composition?_count=100" \
  | jq -r 'if .entry then "✅ Found \(.total // .entry | length) compositions:\n" + (.entry | map("   - \(.resource.id): Patient \(.resource.subject.reference)") | join("\n")) else "❌ No compositions found" end'

echo -e "\n="*80
