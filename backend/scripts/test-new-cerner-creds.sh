#!/bin/bash
# Test NEW Cerner authentication credentials

CLIENT_ID="70cb05e1-9e4c-4b90-ae8e-4de00c92d9e7"
CLIENT_SECRET="bEFd20RyzMktBu_5YTLEzrdzQw2-oSE9"
TENANT_ID="ec2458f2-1e24-41c8-b71b-0e701af7583d"
TOKEN_URL="https://authorization.cerner.com/tenants/${TENANT_ID}/hosts/fhir-ehr-code.cerner.com/protocols/oauth2/profiles/smart-v1/token"

# Create Basic Auth header
AUTH_STRING="${CLIENT_ID}:${CLIENT_SECRET}"
AUTH_HEADER=$(echo -n "$AUTH_STRING" | base64)

echo "========================================="
echo "Testing NEW Cerner Credentials"
echo "========================================="
echo "Client ID: $CLIENT_ID"
echo "Tenant ID: $TENANT_ID"
echo "Token URL: $TOKEN_URL"
echo ""

# Test with minimal scopes first
echo "Test 1: Authenticating with system/Patient.read scope..."
RESPONSE=$(curl --http1.1 -s -w "\nHTTP_STATUS:%{http_code}" -X POST "$TOKEN_URL" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -H "Authorization: Basic $AUTH_HEADER" \
  -d "grant_type=client_credentials&scope=system/Patient.read")

HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | grep -v "HTTP_STATUS")

echo "HTTP Status: $HTTP_STATUS"

if [ "$HTTP_STATUS" = "200" ]; then
    echo "✅ SUCCESS! Authentication worked!"
    echo ""
    echo "Response:"
    echo "$BODY" | jq .

    # Extract access token for testing
    ACCESS_TOKEN=$(echo "$BODY" | jq -r '.access_token')
    EXPIRES_IN=$(echo "$BODY" | jq -r '.expires_in')

    echo ""
    echo "✅ Access Token received (length: ${#ACCESS_TOKEN})"
    echo "✅ Expires in: $EXPIRES_IN seconds"

    # Test 2: Try fetching a patient resource
    echo ""
    echo "========================================="
    echo "Test 2: Fetching Patient Resource (ID: 1)"
    echo "========================================="

    PATIENT_RESPONSE=$(curl --http1.1 -s -w "\nHTTP_STATUS:%{http_code}" \
      "https://fhir-ehr-code.cerner.com/r4/${TENANT_ID}/Patient/1" \
      -H "Authorization: Bearer $ACCESS_TOKEN" \
      -H "Accept: application/fhir+json")

    PATIENT_STATUS=$(echo "$PATIENT_RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
    PATIENT_BODY=$(echo "$PATIENT_RESPONSE" | grep -v "HTTP_STATUS")

    echo "HTTP Status: $PATIENT_STATUS"

    if [ "$PATIENT_STATUS" = "200" ]; then
        echo "✅ SUCCESS! Patient fetch worked!"
        echo ""
        PATIENT_NAME=$(echo "$PATIENT_BODY" | jq -r '.name[0].given[0] + " " + .name[0].family')
        PATIENT_ID=$(echo "$PATIENT_BODY" | jq -r '.id')
        echo "Patient: $PATIENT_NAME (ID: $PATIENT_ID)"
    else
        echo "❌ FAILED to fetch patient"
        echo "Response: $PATIENT_BODY"
    fi

    # Test 3: Try searching for discharge summaries
    echo ""
    echo "========================================="
    echo "Test 3: Searching Discharge Summaries"
    echo "========================================="

    DOC_RESPONSE=$(curl --http1.1 -s -w "\nHTTP_STATUS:%{http_code}" \
      "https://fhir-ehr-code.cerner.com/r4/${TENANT_ID}/DocumentReference?patient=1&type=http://loinc.org|18842-5" \
      -H "Authorization: Bearer $ACCESS_TOKEN" \
      -H "Accept: application/fhir+json")

    DOC_STATUS=$(echo "$DOC_RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
    DOC_BODY=$(echo "$DOC_RESPONSE" | grep -v "HTTP_STATUS")

    echo "HTTP Status: $DOC_STATUS"

    if [ "$DOC_STATUS" = "200" ]; then
        echo "✅ SUCCESS! Discharge summary search worked!"
        DOC_COUNT=$(echo "$DOC_BODY" | jq -r '.total // 0')
        echo "Found $DOC_COUNT discharge summary/summaries"
    else
        echo "⚠️  Search completed with status: $DOC_STATUS"
        echo "Response: $DOC_BODY"
    fi

    echo ""
    echo "========================================="
    echo "✅ OVERALL: Credentials are VALID and WORKING!"
    echo "========================================="
    exit 0
else
    echo "❌ FAILED! Authentication did not work"
    echo ""
    echo "Response:"
    echo "$BODY"
    echo ""
    echo "========================================="
    echo "❌ OVERALL: Credentials are INVALID"
    echo "========================================="
    exit 1
fi
