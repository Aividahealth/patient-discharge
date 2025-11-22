# Troubleshooting Authentication Issues

## Overview

This document helps diagnose authentication failures between Cloud Functions and the backend, specifically for service-to-service authentication using Google Identity tokens.

## Enhanced Logging

We've added comprehensive logging to help identify root causes of authentication failures. All authentication-related logs are prefixed with `[GoogleOIDC]` or `[AuthGuard]` for easy filtering.

## Key Log Prefixes

- `[GoogleOIDC]` - Google OIDC token verification logs
- `[AuthGuard]` - Authentication guard logs

## Common Authentication Flow

1. **Cloud Function** gets Google Identity token using `getIdTokenClient(backendUrl)`
2. **Cloud Function** sends token to backend with:
   - `Authorization: Bearer {token}`
   - `X-Tenant-ID: {tenantId}`
3. **Backend AuthGuard** receives request and:
   - Decodes token header and payload (for debugging)
   - Attempts Google OIDC verification
   - Falls back to app JWT verification if OIDC fails
4. **Backend RolesGuard/TenantGuard** check permissions (service accounts bypass these)

## Diagnostic Steps

### Step 1: Check Backend Logs

Filter for authentication-related logs:

```bash
# View all authentication logs
gcloud logs tail --service=patient-discharge-backend-dev --region=us-central1 | grep -E "\[GoogleOIDC\]|\[AuthGuard\]"

# View only errors
gcloud logs tail --service=patient-discharge-backend-dev --region=us-central1 | grep -E "\[GoogleOIDC\].*❌|\[GoogleOIDC\].*ERROR|\[AuthGuard\].*ERROR"
```

### Step 2: Check Token Details

Look for these log entries to understand the token:

```
[GoogleOIDC] Decoded token payload:
  - aud: Token audience (should be backend Cloud Run URL for Cloud Run tokens)
  - iss: Token issuer (should be 'accounts.google.com' or 'https://accounts.google.com')
  - email: Service account email
  - email_verified: Should be true
  - exp: Token expiration time
  - iat: Token issued at time
```

### Step 3: Identify Verification Method

The logs will show which verification method was attempted:

- `cloud-run-token` - Cloud Run identity token detected
- `verifyIdToken-no-audience` - Verification without audience check
- `verifyIdToken-with-audience` - Verification with audience check
- `fallback-no-audience` - Fallback verification method

### Step 4: Check for Specific Errors

#### Error: "Service account file not found"

**Log Message:**
```
[GoogleOIDC] Service account file not found at {path}, will verify without audience check
```

**Possible Causes:**
- Service account file path not configured correctly in `config.yaml`
- Service account file doesn't exist at the specified path
- File permissions issue

**Solution:**
1. Check `config.yaml` has `service_authn_path` set correctly
2. Verify the file exists at the resolved path
3. Check file permissions

#### Error: "Token verification failed"

**Log Message:**
```
[GoogleOIDC] Token verification failed
```

**Check the detailed error log for:**
- `errorCode`: Specific error code from Google Auth library
- `errorName`: Error type
- `tokenAudience`: What audience the token has
- `tokenIssuer`: Token issuer
- `errorStack`: Stack trace

**Common Error Codes:**
- `invalid_token`: Token signature invalid or expired
- `ENOTFOUND`: Network issue reaching Google's token verification service
- `ETIMEDOUT`: Timeout verifying token

#### Error: "Invalid issuer"

**Log Message:**
```
[GoogleOIDC] Invalid issuer: {issuer}
```

**Possible Causes:**
- Token not issued by Google
- Token from wrong issuer

**Solution:**
- Verify the token is a Google Identity token
- Check token issuer matches expected values: `accounts.google.com` or `https://accounts.google.com`

#### Error: "Email not verified"

**Log Message:**
```
[GoogleOIDC] Email not verified
```

**Possible Causes:**
- Service account email not verified
- Token doesn't have `email_verified: true` claim

**Solution:**
- Verify the service account exists and is active
- Check token payload has `email_verified: true`

#### Error: "Token missing email claim"

**Log Message:**
```
[GoogleOIDC] Token missing email claim
```

**Possible Causes:**
- Token doesn't include email in payload
- Token is not a service account token

**Solution:**
- Verify the Cloud Function is using the correct service account
- Check the token includes email claim

### Step 5: Check Cloud Function Logs

```bash
# View Cloud Function logs
gcloud functions logs read discharge-export-processor --gen2 --region=us-central1 --limit=50

# Filter for authentication errors
gcloud functions logs read discharge-export-processor --gen2 --region=us-central1 --limit=50 | grep -i "auth\|token\|failed"
```

## Common Root Causes

### 1. Service Account Configuration

**Symptoms:**
- "Service account file not found" in logs
- Token verification fails

**Check:**
```bash
# Verify service account exists
gcloud iam service-accounts describe discharge-export-processor-sa@PROJECT_ID.iam.gserviceaccount.com

# Check service account has permission to invoke Cloud Run
gcloud run services get-iam-policy patient-discharge-backend-dev --region=us-central1
```

**Solution:**
- Ensure service account file exists at configured path
- Grant service account permission to invoke Cloud Run:
  ```bash
  gcloud run services add-iam-policy-binding patient-discharge-backend-dev \
    --member="serviceAccount:discharge-export-processor-sa@PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/run.invoker" \
    --region=us-central1
  ```

### 2. Token Audience Mismatch

**Symptoms:**
- Token verification fails
- Logs show token audience doesn't match expected value

**Check:**
- Verify `BACKEND_API_URL` environment variable in Cloud Function matches backend URL
- Check token audience in logs matches backend URL

**Solution:**
- Update Cloud Function environment variable:
  ```bash
  gcloud functions deploy discharge-export-processor \
    --gen2 \
    --update-env-vars BACKEND_API_URL=https://patient-discharge-backend-dev-xxx.run.app \
    --region=us-central1
  ```

### 3. Network/Connectivity Issues

**Symptoms:**
- `ENOTFOUND` or `ETIMEDOUT` errors
- Token verification times out

**Check:**
- Verify Cloud Function can reach Google's token verification service
- Check VPC/firewall rules if using VPC connector

**Solution:**
- Ensure Cloud Function has internet access
- Check VPC connector configuration if applicable

### 4. Token Expiration

**Symptoms:**
- Token verification fails
- Logs show token expiration time in the past

**Check:**
- Look for `exp` field in decoded token payload logs
- Compare with current time

**Solution:**
- This should be handled automatically by the Google Auth library
- If persistent, check Cloud Function's token refresh logic

## Log Analysis Checklist

When investigating authentication failures, check these log entries in order:

1. ✅ `[AuthGuard] Token header decoded` - Token format is valid
2. ✅ `[AuthGuard] Token payload preview` - Token contains expected claims
3. ✅ `[GoogleOIDC] Starting token verification` - Verification process started
4. ✅ `[GoogleOIDC] Decoded token payload` - Token decoded successfully
5. ✅ `[GoogleOIDC] Detected Cloud Run identity token` - Token type identified
6. ✅ `[GoogleOIDC] getTokenInfo() succeeded` or `[GoogleOIDC] verifyIdToken() succeeded` - Verification successful
7. ✅ `[GoogleOIDC] ✅ Token verified successfully` - Final success
8. ✅ `[AuthGuard] ✅ Google OIDC authentication successful` - Authentication complete

If any step fails, the logs will show the exact error with context.

## Quick Diagnostic Command

Run this to get a comprehensive view of authentication issues:

```bash
gcloud logs tail --service=patient-discharge-backend-dev --region=us-central1 \
  --format="table(timestamp,severity,textPayload)" \
  | grep -E "\[GoogleOIDC\]|\[AuthGuard\]" \
  | tail -50
```

## Prevention

To prevent authentication issues:

1. **Always verify service account configuration** before deployment
2. **Check environment variables** are set correctly in Cloud Functions
3. **Monitor logs** for authentication failures
4. **Test service-to-service authentication** after deployments
5. **Keep service account files** in secure, accessible locations

## Related Documentation

- [Google Cloud Identity Tokens](https://cloud.google.com/run/docs/authenticating/service-to-service)
- [NestJS Authentication](backend/docs/services/01-authentication-service.md)
- [Service Account Setup](backend/docs/SERVICE_TOKEN_PAYLOAD.md)

