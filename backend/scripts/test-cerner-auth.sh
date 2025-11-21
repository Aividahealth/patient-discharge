#!/bin/bash
# Test Cerner authentication credentials

CLIENT_ID="586c9547-92a4-49dd-8663-0ff3479c21fa"
CLIENT_SECRET="6Zxem8_cbX2ruxTPTmlBpdKAAoI78Bpb"
TOKEN_URL="https://authorization.cerner.com/tenants/ec2458f2-1e24-41c8-b71b-0e701af7583d/hosts/fhir-ehr-code.cerner.com/protocols/oauth2/profiles/smart-v1/token"

# Create Basic Auth header
AUTH_STRING="${CLIENT_ID}:${CLIENT_SECRET}"
AUTH_HEADER=$(echo -n "$AUTH_STRING" | base64)

echo "Testing Cerner authentication..."
echo "Client ID: $CLIENT_ID"
echo "Token URL: $TOKEN_URL"
echo ""

# Test with minimal scopes
echo "Making request..."
RESPONSE=$(curl -v -w "\nHTTP_STATUS:%{http_code}" -X POST "$TOKEN_URL" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -H "Authorization: Basic $AUTH_HEADER" \
  -d "grant_type=client_credentials&scope=system/Patient.read" 2>&1)

# Extract status code
HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | grep -v "HTTP_STATUS" | grep -v "^[<>*]" | grep -v "^{")

echo ""
echo "======================================"
echo "HTTP Status: $HTTP_STATUS"
echo "Response Body:"
echo "$BODY" | jq . 2>/dev/null || echo "$BODY"
