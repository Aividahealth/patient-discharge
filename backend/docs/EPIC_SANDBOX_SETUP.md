# EPIC Sandbox Integration Setup Guide

This guide walks you through integrating your application with EPIC's sandbox environment using both **System-to-System** (backend) and **Clinician-Facing** (SMART launch) authentication methods.

## Prerequisites

- EPIC App Orchard account at https://fhir.epic.com/
- Two apps created:
  - **System-to-System App** (backend service authentication)
  - **Clinician-Facing App** (SMART on FHIR launch)
- OpenSSL installed for key generation

## Table of Contents

1. [Generate RSA Key Pairs](#1-generate-rsa-key-pairs)
2. [Configure Your Backend](#2-configure-your-backend)
3. [Set Up EPIC App Orchard](#3-set-up-epic-app-orchard)
4. [Test the Integration](#4-test-the-integration)
5. [Troubleshooting](#5-troubleshooting)

---

## 1. Generate RSA Key Pairs

EPIC uses asymmetric JWT authentication (RS384 algorithm). You need to generate RSA key pairs for your apps.

### For System-to-System App:

```bash
cd backend/.settings.dev  # or .settings.prod for production

# Generate private key (2048-bit minimum, 4096-bit recommended)
openssl genrsa -out epic-system-private-key.pem 4096

# Generate corresponding public key
openssl rsa -in epic-system-private-key.pem -pubout -out epic-system-public-key.pem

# Verify the keys were created
ls -la epic-system-*.pem
```

### For Clinician-Facing App (Optional - if different from system app):

```bash
# Generate separate keys for provider app
openssl genrsa -out epic-provider-private-key.pem 4096
openssl rsa -in epic-provider-private-key.pem -pubout -out epic-provider-public-key.pem
```

**Important:**
- Keep private keys secure and never commit them to version control
- Add `*.pem` to your `.gitignore`
- Back up private keys securely

---

## 2. Configure Your Backend

### Step 1: Update Configuration File

Edit `.settings.dev/config.yaml` (or use Firestore for dynamic config):

```yaml
tenants:
  # Replace 'your-hospital' with your actual tenant ID
  your-hospital:
    ehr:
      vendor: epic  # Must be 'epic' for EPIC integration
      base_url: "https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4"

      # System-to-System App Configuration
      system_app:
        client_id: "YOUR_EPIC_SYSTEM_CLIENT_ID"  # From EPIC App Orchard
        private_key_path: ".settings.dev/epic-system-private-key.pem"
        key_id: "epic-system-key-1"  # Can be any unique identifier
        token_url: "https://fhir.epic.com/interconnect-fhir-oauth/oauth2/token"
        scopes: "system/Patient.read system/DocumentReference.read system/Binary.read system/Observation.read"

      # Clinician-Facing App Configuration (Optional)
      provider_app:
        client_id: "YOUR_EPIC_PROVIDER_CLIENT_ID"  # From EPIC App Orchard
        private_key_path: ".settings.dev/epic-provider-private-key.pem"
        key_id: "epic-provider-key-1"  # Can be any unique identifier
        authorization_url: "https://fhir.epic.com/interconnect-fhir-oauth/oauth2/authorize"
        token_url: "https://fhir.epic.com/interconnect-fhir-oauth/oauth2/token"
        redirect_uri: "https://your-domain.com/auth/epic/callback"
        scopes: "launch/patient patient/Patient.read patient/DocumentReference.read"
```

### Step 2: Verify Files Exist

```bash
# Check that private keys are in place
ls -la backend/.settings.dev/epic-*.pem

# Expected output:
# -rw------- 1 user user 3247 Dec 01 12:00 epic-system-private-key.pem
# -rw-r--r-- 1 user user  800 Dec 01 12:00 epic-system-public-key.pem
# -rw------- 1 user user 3247 Dec 01 12:00 epic-provider-private-key.pem
# -rw-r--r-- 1 user user  800 Dec 01 12:00 epic-provider-public-key.pem
```

---

## 3. Set Up EPIC App Orchard

### Understanding JWK Set URLs

**EPIC does NOT allow you to upload public key files directly.** Instead, you must:

1. **Host your public key** as a JWK (JSON Web Key) at a publicly accessible HTTPS URL
2. **Provide that URL** to EPIC in the "JWK Set URL" fields

We've created an endpoint in your backend that automatically serves your public keys in JWK format.

### Step 1: Deploy Your Backend (Required)

Your backend must be deployed and accessible via HTTPS for EPIC to fetch your JWK.

**For development/testing, you have two options:**

#### Option A: Use ngrok (Quick Testing)
```bash
# Start your backend locally
npm run start:dev

# In another terminal, expose it via ngrok
ngrok http 3000

# You'll get a URL like: https://abc123.ngrok.io
```

#### Option B: Deploy to Cloud Provider
Deploy to your staging/production environment with a real domain.

### Step 2: Get Your JWK Set URLs

Once your backend is running and accessible:

**For System-to-System App:**
```
https://your-domain.com/.well-known/jwks/your-hospital
```

**For Clinician-Facing App (if using separate keys):**
```
https://your-domain.com/.well-known/jwks/your-hospital/provider
```

**Test your JWK endpoint:**
```bash
curl https://your-domain.com/.well-known/jwks/your-hospital

# Expected response:
{
  "keys": [{
    "kty": "RSA",
    "n": "xGOr-H7A...",  # Long base64-encoded modulus
    "e": "AQAB",
    "alg": "RS384",
    "use": "sig",
    "kid": "epic-system-key-1"
  }]
}
```

### Step 3: Configure EPIC App Orchard

Log in to https://fhir.epic.com/ and open your System-to-System app:

#### Fill in the Form:

1. **Public Documentation URL**: Your app's documentation (can be placeholder)

2. **Incoming APIs**: Select the FHIR resources you need access to:
   - Binary.Read (Clinical Notes) (R4)
   - CarePlan.Read (Encounter) (R4)
   - CarePlan.Search (Encounter) (R4)
   - DocumentReference.Create (Clinical Notes) (R4)
   - MedicationRequest.Search (Order Template Medication) (R4)
   - MedicationRequest.Search (Signed Medication Order) (R4)
   - Observation.Create (Vital Signs) (R4)
   - And any others you need

3. **Non-Production JWK Set URL**:
   ```
   https://your-domain.com/.well-known/jwks/your-hospital
   ```

4. **Production JWK Set URL**:
   ```
   https://your-domain.com/.well-known/jwks/your-hospital
   ```
   (Can be same as non-production initially)

5. **SMART on FHIR Version**: Select **R4**

6. **SMART Scope Version**: Select **SMART v1** or **SMART v2** based on your needs

7. **FHIR ID Generation Scheme**:
   - Choose **Use Unconstrained FHIR IDs** (recommended for most cases)

8. **Summary**: Describe your app:
   ```
   Aivida Healthcare Technology is developing a secure, AI-assisted workflow
   application that integrates with Epic via FHIR APIs to help clinicians and
   administrators improve clarity, efficiency, and communication within care
   discharge workflows.
   ```

#### Save and Note Your Client ID

After saving, EPIC will assign you a **Client ID**. Copy this and update your `config.yaml`:

```yaml
system_app:
  client_id: "abc123-def456-ghi789"  # Paste your actual client ID here
```

### Step 4: Verify JWK Configuration

EPIC will attempt to fetch your JWK from the URL you provided. Check your backend logs:

```bash
# Watch for incoming requests from EPIC
npm run start:dev

# You should see:
GET /.well-known/jwks/your-hospital 200
```

If you see errors, verify:
- Your backend is accessible via HTTPS
- The tenant ID in the URL matches your config
- The private key file exists and is readable

---

## 4. Test the Integration

### Test 1: Verify JWK Endpoint

```bash
# Test locally first
curl http://localhost:3000/.well-known/jwks/your-hospital

# Test via your public domain
curl https://your-domain.com/.well-known/jwks/your-hospital
```

**Expected Response:**
```json
{
  "keys": [{
    "kty": "RSA",
    "n": "xGOr...",
    "e": "AQAB",
    "alg": "RS384",
    "use": "sig",
    "kid": "epic-system-key-1"
  }]
}
```

### Test 2: Authenticate with EPIC

```bash
# Start your backend
npm run start:dev

# Test authentication (this will create a JWT and exchange it for an access token)
curl -X GET \
  -H "X-Tenant-ID: your-hospital" \
  http://localhost:3000/ehr/vendor

# Expected response:
{
  "name": "EPIC",
  "status": "beta",
  "capabilities": [...],
  "fhirVersion": "R4"
}
```

### Test 3: Fetch a Patient

Use a test patient ID from EPIC's sandbox (e.g., `Tbt3KuCY0B5PSrJvCu2j-PlK.aiHsu2xUjUM8bWpetXoB`):

```bash
curl -X GET \
  -H "X-Tenant-ID: your-hospital" \
  http://localhost:3000/ehr/Patient/Tbt3KuCY0B5PSrJvCu2j-PlK.aiHsu2xUjUM8bWpetXoB

# You should get back a FHIR Patient resource
```

### Test 4: Search for Discharge Summaries

```bash
curl -X GET \
  -H "X-Tenant-ID: your-hospital" \
  "http://localhost:3000/ehr/discharge-summaries/Tbt3KuCY0B5PSrJvCu2j-PlK.aiHsu2xUjUM8bWpetXoB"

# You should get back DocumentReference resources
```

---

## 5. Troubleshooting

### Error: "Failed to generate JWKS"

**Cause:** Public key file not found or malformed

**Solutions:**
1. Verify file exists:
   ```bash
   ls -la backend/.settings.dev/epic-system-public-key.pem
   ```

2. Check file naming convention:
   - Private key must end with `-private-key.pem`
   - Public key must end with `-public-key.pem`

3. Regenerate keys if corrupted:
   ```bash
   openssl genrsa -out epic-system-private-key.pem 4096
   openssl rsa -in epic-system-private-key.pem -pubout -out epic-system-public-key.pem
   ```

### Error: "Tenant not found" when accessing JWK endpoint

**Cause:** Tenant ID in URL doesn't match config

**Solutions:**
1. Check your config file:
   ```bash
   grep -A 20 "tenants:" backend/.settings.dev/config.yaml
   ```

2. Ensure tenant ID matches exactly (case-sensitive):
   ```
   URL: /.well-known/jwks/your-hospital
   Config: tenants.your-hospital
   ```

### Error: "invalid_client" from EPIC

**Cause:** JWK mismatch or incorrect client_id

**Solutions:**
1. Verify your JWK endpoint is publicly accessible:
   ```bash
   curl https://your-domain.com/.well-known/jwks/your-hospital
   ```

2. Ensure `kid` (key ID) in JWK matches what you configured:
   ```yaml
   key_id: "epic-system-key-1"  # Must match kid in JWK
   ```

3. Verify client_id matches what EPIC provided

4. Check EPIC's logs in App Orchard for specific error messages

### Error: "invalid_grant" during token exchange

**Cause:** JWT assertion is malformed or expired

**Solutions:**
1. Check your system clock is synchronized (JWT has 5-minute expiry)

2. Verify private key matches the public key uploaded to EPIC:
   ```bash
   # Extract public key from private key
   openssl rsa -in epic-system-private-key.pem -pubout

   # Compare with your public key file
   cat epic-system-public-key.pem
   ```

3. Enable debug logging in EPICAdapter:
   ```typescript
   // In epic.adapter.ts, add console.log before token request
   console.log('JWT Assertion:', jwt);
   ```

### JWK Endpoint Returns 404

**Cause:** Controller not registered or route conflict

**Solutions:**
1. Verify EHR module is imported in your main app module

2. Check that JWKSController is in the controllers array:
   ```typescript
   // backend/src/ehr/ehr.module.ts
   controllers: [EHRController, JWKSController]
   ```

3. Restart your backend:
   ```bash
   npm run start:dev
   ```

4. Check registered routes:
   ```bash
   curl http://localhost:3000/  # Should list all routes
   ```

---

## Next Steps

Once your System-to-System app is working:

1. **Implement Clinician-Facing SMART Launch**
   - See `backend/src/ehr/adapters/epic.adapter.ts:182` for TODO
   - Implement OAuth2 authorization code flow
   - Handle launch context (patient, encounter, user)

2. **Add Production Configuration**
   - Move to `.settings.prod/` directory
   - Use proper domain (not ngrok)
   - Secure private keys with encryption/key management service

3. **Register for Production Access**
   - Complete EPIC's production review process
   - Provide security documentation
   - Configure production JWK Set URL

4. **Monitor and Audit**
   - All API calls are logged via AuditService
   - Monitor token expiration and refresh
   - Track API usage and rate limits

---

## Additional Resources

- **EPIC Documentation**: https://fhir.epic.com/Documentation
- **SMART on FHIR**: http://hl7.org/fhir/smart-app-launch/
- **JWT Authentication**: https://datatracker.ietf.org/doc/html/rfc7523
- **FHIR R4 Spec**: https://hl7.org/fhir/R4/

---

## Security Best Practices

1. **Never commit private keys** to version control
2. **Rotate keys regularly** (every 6-12 months)
3. **Use separate keys** for dev/staging/production
4. **Monitor access logs** for unusual activity
5. **Implement rate limiting** on JWK endpoint
6. **Use HTTPS only** for all endpoints
7. **Validate JWT claims** thoroughly (aud, iss, exp, jti)
8. **Store tokens securely** with short expiration times
