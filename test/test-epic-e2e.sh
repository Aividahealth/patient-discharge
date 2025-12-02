#!/bin/bash

# EPIC End-to-End Test Script
# Tests the complete flow: EPIC → Backend → Simplification → FHIR Write-back → Portal Display

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

BACKEND_URL="https://patient-discharge-backend-dev-qnzythtpnq-uc.a.run.app"
TENANT_ID="etest"
FRONTEND_URL="http://localhost:3001"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}EPIC End-to-End Integration Test${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Step 1: Login and get token
echo -e "${YELLOW}Step 1: Authenticating...${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "${BACKEND_URL}/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"tenantId\":\"${TENANT_ID}\",\"username\":\"clinician\",\"password\":\"Test123!\"}")

TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.token')

if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
  echo -e "${RED}✗ Login failed${NC}"
  echo $LOGIN_RESPONSE | jq '.'
  exit 1
fi

echo -e "${GREEN}✓ Login successful${NC}"
echo ""

# Step 2: Check if EPIC test patient exists
echo -e "${YELLOW}Step 2: Checking EPIC test patient...${NC}"
PATIENT_ID="Tbt3KuCY0B5PSrJvCu2j-PlK.aiHsu2xUjUM8bWpetXoB"
echo "Testing with EPIC sandbox patient: $PATIENT_ID"

PATIENT_RESPONSE=$(curl -s -X GET "${BACKEND_URL}/ehr/Patient/${PATIENT_ID}" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "X-Tenant-ID: ${TENANT_ID}")

PATIENT_NAME=$(echo $PATIENT_RESPONSE | jq -r '.name[0].text // .name[0].family // "Unknown"' 2>/dev/null)

if [ "$PATIENT_NAME" != "Unknown" ] && [ "$PATIENT_NAME" != "null" ]; then
  echo -e "${GREEN}✓ Patient found: ${PATIENT_NAME}${NC}"
else
  echo -e "${YELLOW}⚠ Could not fetch patient details (this is OK if using sandbox)${NC}"
fi
echo ""

# Step 3: Trigger encounter export for EPIC tenant
echo -e "${YELLOW}Step 3: Triggering encounter export from EPIC...${NC}"
EXPORT_RESPONSE=$(curl -s -X POST "${BACKEND_URL}/scheduler/encounter-export/trigger?tenantId=${TENANT_ID}" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "X-Tenant-ID: ${TENANT_ID}")

echo $EXPORT_RESPONSE | jq '.'

SUCCESS=$(echo $EXPORT_RESPONSE | jq -r '.success')
if [ "$SUCCESS" == "true" ]; then
  echo -e "${GREEN}✓ Encounter export triggered${NC}"
else
  echo -e "${RED}✗ Failed to trigger encounter export${NC}"
  exit 1
fi
echo ""

# Step 4: Wait for processing
echo -e "${YELLOW}Step 4: Waiting for processing (30 seconds)...${NC}"
for i in {1..30}; do
  echo -n "."
  sleep 1
done
echo ""
echo -e "${GREEN}✓ Wait complete${NC}"
echo ""

# Step 5: Check discharge summaries in backend
echo -e "${YELLOW}Step 5: Checking for discharge summaries...${NC}"
SUMMARIES_RESPONSE=$(curl -s -X GET "${BACKEND_URL}/discharge-summaries?limit=10" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "X-Tenant-ID: ${TENANT_ID}")

SUMMARY_COUNT=$(echo $SUMMARIES_RESPONSE | jq -r '.data | length' 2>/dev/null || echo "0")
echo "Found $SUMMARY_COUNT discharge summaries"

if [ "$SUMMARY_COUNT" -gt "0" ]; then
  echo -e "${GREEN}✓ Discharge summaries found${NC}"
  echo ""
  echo "Latest discharge summaries:"
  echo $SUMMARIES_RESPONSE | jq -r '.data[0:3] | .[] | "  - \(.patientName // "Unknown Patient") - \(.documentType // "Discharge Summary") - \(.created // .createdAt)"'
else
  echo -e "${YELLOW}⚠ No discharge summaries found yet${NC}"
  echo "This is expected if:"
  echo "  1. No discharge summaries exist in EPIC sandbox for this patient"
  echo "  2. The patient hasn't had recent encounters"
  echo "  3. You need to create a discharge summary in EPIC sandbox first"
fi
echo ""

# Step 6: Check FHIR store
echo -e "${YELLOW}Step 6: Checking FHIR store for DocumentReferences...${NC}"
# Note: This would require FHIR store access - skipping for now
echo -e "${BLUE}ℹ  FHIR store check requires additional configuration${NC}"
echo ""

# Step 7: Instructions for portal testing
echo -e "${YELLOW}Step 7: Testing Portal Display${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${GREEN}To test the Clinician Portal:${NC}"
echo "1. Open: ${FRONTEND_URL}/${TENANT_ID}/clinician"
echo "2. Login with: clinician / Test123!"
echo "3. Look for the discharge summaries in the dashboard"
echo ""
echo -e "${GREEN}To test the Patient Portal:${NC}"
echo "1. First, you need to create a patient user linked to the EPIC patient"
echo "2. Or use an existing patient account if available"
echo ""

# Step 8: Summary
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Test Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "Backend URL: ${BACKEND_URL}"
echo "Tenant: ${TENANT_ID}"
echo "Patient ID: ${PATIENT_ID}"
echo "Discharge Summaries Found: ${SUMMARY_COUNT}"
echo ""
echo -e "${GREEN}Next Steps:${NC}"
echo "1. Create a discharge summary in EPIC sandbox for patient ${PATIENT_ID}"
echo "2. Wait 10 minutes for automated polling OR run this script again to trigger manual export"
echo "3. Check the Clinician portal for the discharge summary"
echo "4. Verify simplified content is generated"
echo "5. Check FHIR store for write-back"
echo ""
