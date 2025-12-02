#!/bin/bash

# EPIC Sandbox Data Explorer
# Explores what data is available in EPIC sandbox for testing

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

BACKEND_URL="https://patient-discharge-backend-dev-qnzythtpnq-uc.a.run.app"
TENANT_ID="etest"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}EPIC Sandbox Data Explorer${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Login
echo -e "${YELLOW}Step 1: Authenticating...${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "${BACKEND_URL}/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"tenantId\":\"${TENANT_ID}\",\"username\":\"clinician\",\"password\":\"Test123!\"}")

TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.token')

if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
  echo -e "${RED}✗ Login failed${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Authenticated${NC}"
echo ""

# Test Patient IDs from EPIC documentation
PATIENT_IDS=(
  "Tbt3KuCY0B5PSrJvCu2j-PlK.aiHsu2xUjUM8bWpetXoB"  # Common test patient
  "erXuFYUfucBZaryVksYEcMg3"                        # Another test patient
  "eq081-VQEgP8drUUqCWzHfw3"                        # Another test patient
)

echo -e "${YELLOW}Step 2: Checking test patients...${NC}"
for PATIENT_ID in "${PATIENT_IDS[@]}"; do
  echo ""
  echo -e "${BLUE}Testing Patient: ${PATIENT_ID}${NC}"

  # Get Patient
  PATIENT=$(curl -s -X GET "${BACKEND_URL}/ehr/Patient/${PATIENT_ID}" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "X-Tenant-ID: ${TENANT_ID}")

  PATIENT_NAME=$(echo $PATIENT | jq -r '.name[0].text // .name[0].family // "Not found"' 2>/dev/null)

  if [ "$PATIENT_NAME" != "Not found" ] && [ "$PATIENT_NAME" != "null" ]; then
    echo -e "  ${GREEN}✓ Patient found: ${PATIENT_NAME}${NC}"

    # Check for DocumentReferences
    echo -e "  ${BLUE}Searching for DocumentReferences...${NC}"
    DOC_REFS=$(curl -s -X GET "${BACKEND_URL}/ehr/search?resourceType=DocumentReference&patient=${PATIENT_ID}" \
      -H "Authorization: Bearer ${TOKEN}" \
      -H "X-Tenant-ID: ${TENANT_ID}")

    DOC_COUNT=$(echo $DOC_REFS | jq -r '.entry | length' 2>/dev/null || echo "0")
    echo -e "  Found ${DOC_COUNT} DocumentReference(s)"

    if [ "$DOC_COUNT" -gt "0" ]; then
      echo -e "  ${GREEN}✓ DocumentReferences available!${NC}"
      echo ""
      echo "  Document details:"
      echo $DOC_REFS | jq -r '.entry[0:3] | .[] | "    - \(.resource.type.text // .resource.type.coding[0].display // "Clinical Document") (\(.resource.date // "No date"))"' 2>/dev/null || echo "    (Could not parse details)"
    fi

    # Check for Encounters
    echo -e "  ${BLUE}Searching for Encounters...${NC}"
    ENCOUNTERS=$(curl -s -X GET "${BACKEND_URL}/ehr/search?resourceType=Encounter&patient=${PATIENT_ID}" \
      -H "Authorization: Bearer ${TOKEN}" \
      -H "X-Tenant-ID: ${TENANT_ID}")

    ENC_COUNT=$(echo $ENCOUNTERS | jq -r '.entry | length' 2>/dev/null || echo "0")
    echo -e "  Found ${ENC_COUNT} Encounter(s)"

    if [ "$ENC_COUNT" -gt "0" ]; then
      echo -e "  ${GREEN}✓ Encounters available!${NC}"
      RECENT_ENC=$(echo $ENCOUNTERS | jq -r '.entry[0].resource.id' 2>/dev/null)
      if [ "$RECENT_ENC" != "null" ] && [ -n "$RECENT_ENC" ]; then
        echo "  Most recent encounter ID: ${RECENT_ENC}"

        # Try to find DocumentReferences for this encounter
        echo -e "  ${BLUE}Searching for documents in encounter ${RECENT_ENC}...${NC}"
        ENC_DOCS=$(curl -s -X GET "${BACKEND_URL}/ehr/search?resourceType=DocumentReference&encounter=${RECENT_ENC}" \
          -H "Authorization: Bearer ${TOKEN}" \
          -H "X-Tenant-ID: ${TENANT_ID}" 2>/dev/null)

        ENC_DOC_COUNT=$(echo $ENC_DOCS | jq -r '.entry | length' 2>/dev/null || echo "0")
        echo -e "  Found ${ENC_DOC_COUNT} document(s) for this encounter"
      fi
    fi

    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  else
    echo -e "  ${YELLOW}⚠ Patient not accessible${NC}"
  fi
done

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "1. If documents were found above, run the import:"
echo "   ./test-epic-e2e.sh"
echo ""
echo "2. If no documents found, you need to:"
echo "   a) Log in to EPIC App Orchard: https://fhir.epic.com/"
echo "   b) Navigate to your app (ID: 47095)"
echo "   c) Use the sandbox tools to create test data"
echo "   d) Or create a discharge summary in their test patient chart"
echo ""
echo "3. EPIC Sandbox Resources:"
echo "   - Test Patient Gallery: https://fhir.epic.com/Sandbox"
echo "   - API Documentation: https://fhir.epic.com/Documentation"
echo "   - Sample Data: Available in 'My Apps' > 'Sandbox' section"
echo ""
