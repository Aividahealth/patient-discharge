#!/bin/bash

# EPIC Integration Test Script
# Tests the JWK endpoint and basic EPIC connectivity

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}EPIC Integration Test Suite${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Configuration
read -p "Backend URL [http://localhost:3000]: " BACKEND_URL
BACKEND_URL=${BACKEND_URL:-http://localhost:3000}

read -p "Tenant ID [hospital-epic]: " TENANT_ID
TENANT_ID=${TENANT_ID:-hospital-epic}

echo ""
echo -e "${BLUE}Testing against: ${GREEN}$BACKEND_URL${NC}"
echo -e "${BLUE}Tenant ID: ${GREEN}$TENANT_ID${NC}"
echo ""

# Test 1: JWK Endpoint
echo -e "${BLUE}Test 1: JWK Endpoint${NC}"
echo "-------------------"
echo "GET $BACKEND_URL/.well-known/jwks/$TENANT_ID"
echo ""

HTTP_CODE=$(curl -s -o /tmp/jwk_response.json -w "%{http_code}" "$BACKEND_URL/.well-known/jwks/$TENANT_ID")

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ JWK endpoint accessible (HTTP $HTTP_CODE)${NC}"
    echo ""
    echo "Response:"
    cat /tmp/jwk_response.json | jq '.' 2>/dev/null || cat /tmp/jwk_response.json
    echo ""

    # Validate JWK structure
    if command -v jq &> /dev/null; then
        KTY=$(cat /tmp/jwk_response.json | jq -r '.keys[0].kty')
        ALG=$(cat /tmp/jwk_response.json | jq -r '.keys[0].alg')
        USE=$(cat /tmp/jwk_response.json | jq -r '.keys[0].use')
        KID=$(cat /tmp/jwk_response.json | jq -r '.keys[0].kid')

        echo -e "${BLUE}JWK Validation:${NC}"
        [ "$KTY" = "RSA" ] && echo -e "  ${GREEN}✓ Key Type: $KTY${NC}" || echo -e "  ${RED}✗ Key Type: $KTY (expected RSA)${NC}"
        [ "$ALG" = "RS384" ] && echo -e "  ${GREEN}✓ Algorithm: $ALG${NC}" || echo -e "  ${RED}✗ Algorithm: $ALG (expected RS384)${NC}"
        [ "$USE" = "sig" ] && echo -e "  ${GREEN}✓ Use: $USE${NC}" || echo -e "  ${RED}✗ Use: $USE (expected sig)${NC}"
        [ ! -z "$KID" ] && echo -e "  ${GREEN}✓ Key ID: $KID${NC}" || echo -e "  ${RED}✗ Key ID missing${NC}"
    fi
else
    echo -e "${RED}✗ JWK endpoint failed (HTTP $HTTP_CODE)${NC}"
    cat /tmp/jwk_response.json
    exit 1
fi

echo ""

# Test 2: Vendor Registry
echo -e "${BLUE}Test 2: Vendor Registry${NC}"
echo "----------------------"
echo "GET $BACKEND_URL/ehr/vendor (with X-Tenant-ID: $TENANT_ID)"
echo ""

HTTP_CODE=$(curl -s -o /tmp/vendor_response.json -w "%{http_code}" \
    -H "X-Tenant-ID: $TENANT_ID" \
    "$BACKEND_URL/ehr/vendor")

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ Vendor endpoint accessible (HTTP $HTTP_CODE)${NC}"
    echo ""
    echo "Response:"
    cat /tmp/vendor_response.json | jq '.' 2>/dev/null || cat /tmp/vendor_response.json
    echo ""
else
    echo -e "${RED}✗ Vendor endpoint failed (HTTP $HTTP_CODE)${NC}"
    cat /tmp/vendor_response.json
fi

echo ""

# Test 3: Test Patient Fetch (optional)
echo -e "${BLUE}Test 3: EPIC Patient Fetch (Optional)${NC}"
echo "--------------------------------------"
read -p "Test patient fetch from EPIC? Requires valid EPIC client_id (y/N): " TEST_PATIENT
echo ""

if [ "$TEST_PATIENT" = "y" ]; then
    # Use EPIC's test patient ID
    PATIENT_ID="Tbt3KuCY0B5PSrJvCu2j-PlK.aiHsu2xUjUM8bWpetXoB"

    echo "Fetching test patient: $PATIENT_ID"
    echo "GET $BACKEND_URL/ehr/Patient/$PATIENT_ID"
    echo ""

    HTTP_CODE=$(curl -s -o /tmp/patient_response.json -w "%{http_code}" \
        -H "X-Tenant-ID: $TENANT_ID" \
        "$BACKEND_URL/ehr/Patient/$PATIENT_ID")

    if [ "$HTTP_CODE" = "200" ]; then
        echo -e "${GREEN}✓ Patient fetch successful (HTTP $HTTP_CODE)${NC}"
        echo ""
        if command -v jq &> /dev/null; then
            PATIENT_NAME=$(cat /tmp/patient_response.json | jq -r '.name[0].text')
            echo "Patient Name: $PATIENT_NAME"
        fi
        echo ""
        echo "Full response:"
        cat /tmp/patient_response.json | jq '.' 2>/dev/null || cat /tmp/patient_response.json
    else
        echo -e "${RED}✗ Patient fetch failed (HTTP $HTTP_CODE)${NC}"
        cat /tmp/patient_response.json
        echo ""
        echo -e "${YELLOW}This is expected if you haven't configured EPIC client_id yet${NC}"
    fi
fi

echo ""

# Summary
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Test Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Cleanup
rm -f /tmp/jwk_response.json /tmp/vendor_response.json /tmp/patient_response.json

echo -e "${GREEN}JWK Endpoint Setup Complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Deploy your backend to a public HTTPS domain"
echo "2. Configure EPIC App Orchard with your JWK Set URL:"
echo "   https://your-domain.com/.well-known/jwks/$TENANT_ID"
echo "3. Add your EPIC client_id to config.yaml"
echo "4. Test patient fetch again"
echo ""
echo "For more information, see:"
echo "  backend/docs/EPIC_SANDBOX_SETUP.md"
echo ""
