# EPIC App Orchard Registration Guide for etest Tenant

## Quick Reference

### Backend Deployment
- **Service URL**: https://patient-discharge-backend-dev-qnzythtpnq-uc.a.run.app
- **JWK Set URL**: https://patient-discharge-backend-dev-qnzythtpnq-uc.a.run.app/.well-known/jwks/etest
- **Environment**: Development (DEV)
- **Region**: us-central1

### App Configuration (from config.yaml)

**Tenant ID**: `etest`

**System-to-System App:**
- **Client ID**: `1c9019b6-e5f9-425c-bd88-bef6ba914b5c`
- **Key ID**: `epic-system-key-1764625902`
- **Algorithm**: RS384
- **Token URL**: https://fhir.epic.com/interconnect-fhir-oauth/oauth2/token
- **Scopes**:
  - `system/Patient.read`
  - `system/DocumentReference.read`
  - `system/Binary.read`
  - `system/Observation.read`

**Provider App (Optional):**
- **Client ID**: (Not yet configured)
- **Key ID**: `epic-provider-key-1764625902`
- **Authorization URL**: https://fhir.epic.com/interconnect-fhir-oauth/oauth2/authorize
- **Token URL**: https://fhir.epic.com/interconnect-fhir-oauth/oauth2/token
- **Redirect URI**: https://your-domain.com/auth/epic/callback
- **Scopes**: `launch/patient patient/Patient.read patient/DocumentReference.read`

## Registration Steps

### 1. Log in to EPIC App Orchard
- Go to: https://fhir.epic.com/
- Sign in with your EPIC credentials

### 2. Configure System-to-System App

#### A. Navigate to Your App
1. Go to "My Apps"
2. Select your Backend Service app (Client ID: `1c9019b6-e5f9-425c-bd88-bef6ba914b5c`)

#### B. Add JWK Set URL
1. Find the "Public Key" or "JWK Set URL" section
2. **Enter**: `https://patient-discharge-backend-dev-qnzythtpnq-uc.a.run.app/.well-known/jwks/etest`
3. Click "Save" or "Validate"

**Important**: EPIC will immediately fetch this URL to verify:
- The URL is publicly accessible via HTTPS
- The response is valid JSON
- The JWK contains proper RSA public key fields
- The algorithm is RS384
- The key ID matches your configuration

#### C. Verify Configuration
Confirm the following in your app settings:
- ✅ **Grant Type**: Client Credentials
- ✅ **Authentication Method**: Private Key JWT (RS384)
- ✅ **Token Endpoint**: https://fhir.epic.com/interconnect-fhir-oauth/oauth2/token
- ✅ **Scopes**: All required scopes are enabled
- ✅ **FHIR Base URL**: https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4

### 3. Test the Integration

#### A. Verify JWK Endpoint Locally
```bash
curl https://patient-discharge-backend-dev-qnzythtpnq-uc.a.run.app/.well-known/jwks/etest
```

**Expected Response:**
```json
{
  "keys": [
    {
      "kty": "RSA",
      "n": "...",
      "e": "AQAB",
      "alg": "RS384",
      "use": "sig",
      "kid": "epic-system-key-1764625902"
    }
  ]
}
```

#### B. Test Authentication
From your backend directory:
```bash
cd /Users/sekharcidambi/patient-discharge/backend
./scripts/test-epic-integration.sh
```

When prompted:
- **Backend URL**: `https://patient-discharge-backend-dev-qnzythtpnq-uc.a.run.app`
- **Tenant ID**: `etest`

#### C. Test Patient Fetch
Once authentication is working, test fetching a patient:
```bash
curl -H "X-Tenant-ID: etest" \
  https://patient-discharge-backend-dev-qnzythtpnq-uc.a.run.app/ehr/Patient/Tbt3KuCY0B5PSrJvCu2j-PlK.aiHsu2xUjUM8bWpetXoB
```

(This is EPIC's sandbox test patient ID)

### 4. Common Issues & Solutions

#### Issue: JWK URL Not Accessible
**Symptoms**: EPIC returns error "Cannot fetch JWK Set URL"
**Solutions**:
1. Verify backend is deployed: `curl https://patient-discharge-backend-dev-qnzythtpnq-uc.a.run.app/.well-known/jwks/etest`
2. Check Cloud Run logs: `gcloud logs tail --service=patient-discharge-backend-dev --region=us-central1`
3. Ensure URL is HTTPS (not HTTP)

#### Issue: Invalid JWT Signature
**Symptoms**: Authentication fails with "invalid_client" or "invalid_grant"
**Solutions**:
1. Verify private key matches public key in JWK Set
2. Check key ID in config matches key ID in JWK
3. Ensure RS384 algorithm is used (not RS256)

#### Issue: Insufficient Scopes
**Symptoms**: API calls return 403 Forbidden
**Solutions**:
1. Verify all required scopes are enabled in EPIC App Orchard
2. Re-authenticate to get new token with updated scopes

### 5. Monitoring & Debugging

#### Check Backend Logs
```bash
# Real-time logs
gcloud logs tail --service=patient-discharge-backend-dev --region=us-central1 --follow

# Recent errors
gcloud logs read --service=patient-discharge-backend-dev --region=us-central1 --limit=50 \
  --format="table(timestamp,severity,textPayload)"
```

#### Check Authentication Status
Look for these log messages:
- ✅ `Authenticating with EPIC system app for tenant: etest`
- ✅ `EPIC system app authentication successful`
- ❌ `EPIC system app authentication failed`

### 6. Production Deployment

When ready for production:

1. **Generate Production Keys**:
   ```bash
   cd /Users/sekharcidambi/patient-discharge/backend/.settings.prod
   openssl genrsa -out epic-system-private-key.pem 4096
   openssl rsa -in epic-system-private-key.pem -pubout -out epic-system-public-key.pem
   ```

2. **Update Production Config**:
   - Edit `.settings.prod/config.yaml`
   - Use production EPIC base URL (not sandbox)
   - Use production Client ID from EPIC

3. **Deploy to Production**:
   ```bash
   ./deploy-to-cloud-run-prod.sh
   ```

4. **Update EPIC Registration**:
   - Provide production JWK Set URL: `https://api.aividahealth.ai/.well-known/jwks/your-tenant-id`
   - Re-validate in EPIC App Orchard

## Security Notes

⚠️ **Important Security Considerations:**

1. **Private Keys**: Never commit `.pem` files to git
2. **Key Rotation**: Rotate keys periodically (recommended: every 90 days)
3. **Access Control**: Ensure JWK endpoint is public, but private key files are secure
4. **Monitoring**: Set up alerts for authentication failures
5. **Rate Limiting**: EPIC has rate limits - implement exponential backoff

## Support

- **EPIC Documentation**: https://fhir.epic.com/Documentation
- **App Orchard Support**: https://fhir.epic.com/Support
- **Internal Issues**: Check `/backend/docs/EPIC_SANDBOX_SETUP.md`

## Next Steps

After successful registration:
1. Test patient discovery: `/ehr/discover-patients`
2. Test discharge summary search: `/ehr/discharge-summaries`
3. Implement automated polling (already configured via scheduler)
4. Monitor usage and performance
