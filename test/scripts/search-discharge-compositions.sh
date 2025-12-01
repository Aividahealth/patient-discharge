#!/bin/bash

TOKEN=$(gcloud auth print-access-token)

echo "🔍 Searching for discharge summary compositions (type=18842-5)"
echo "="*80

curl -s -H "Authorization: Bearer $TOKEN" \
  "https://healthcare.googleapis.com/v1/projects/simtran-474018/locations/us-central1/datasets/ctest-dataset/fhirStores/ctest-fhir-store/fhir/Composition?type=http://loinc.org|18842-5&_count=10" \
  | jq -r 'if .entry then "✅ Found \(.total // .entry | length) discharge summary compositions:\n" + (.entry | map("   - \(.resource.id): \(.resource.subject.reference)") | join("\n")) else "❌ No discharge summary compositions found" end'

echo -e "\n="*80

echo -e "\nChecking all composition types in the store:"
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://healthcare.googleapis.com/v1/projects/simtran-474018/locations/us-central1/datasets/ctest-dataset/fhirStores/ctest-fhir-store/fhir/Composition?_count=5" \
  | jq -r '.entry | map("   - \(.resource.id): type=\(.resource.type.coding[0].code // "N/A")") | join("\n")'
