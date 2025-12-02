#!/bin/bash

# Test EPIC Integration

TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJiWTM3WmhKYk1pWEw5YkJBTUhqNSIsInRlbmFudElkIjoiZXRlc3QiLCJ1c2VybmFtZSI6ImNsaW5pY2lhbiIsIm5hbWUiOiJEci4gRXBpYyBUZXN0Iiwicm9sZSI6ImNsaW5pY2lhbiIsImxpbmtlZFBhdGllbnRJZCI6bnVsbCwiZXhwIjoxNzY0NzI2Mjk0LCJpYXQiOjE3NjQ2Mzk4OTR9.Mm1dLG-MFP4MD1nBHuFYvmiqeqOYRhq7NoJRTaHg4zs"
PATIENT_ID="Tbt3KuCY0B5PSrJvCu2j-PlK.aiHsu2xUjUM8bWpetXoB"

echo "Testing EPIC Integration..."
echo "=========================="
echo ""

echo "1. Testing discharge summaries endpoint..."
curl -X GET \
  "https://patient-discharge-backend-dev-qnzythtpnq-uc.a.run.app/ehr/discharge-summaries/${PATIENT_ID}" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "X-Tenant-ID: etest" \
  -w "\nHTTP Status: %{http_code}\n"

echo ""
echo "=========================="
