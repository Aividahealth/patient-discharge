# Service Token Payload Structure

## Expected JSON Payload for Google OIDC Service Token

When a service account generates an ID token, the backend expects the following payload structure:

### Required Fields

```json
{
  "aud": "105833083285007921344",
  "iss": "https://accounts.google.com",
  "email": "discharge-export-processor-sa@simtran-474018.iam.gserviceaccount.com",
  "email_verified": true,
  "exp": 1763096360,
  "iat": 1763092760,
  "sub": "105833083285007921344",
  "azp": "discharge-export-processor-sa@simtran-474018.iam.gserviceaccount.com"
}
```

### Field Descriptions

| Field | Type | Required | Description | Validation |
|-------|------|----------|-------------|------------|
| `aud` | string | ✅ Yes | Audience - must match service account `client_id` | Must equal `client_id` from `service_authn.json` |
| `iss` | string | ✅ Yes | Issuer - Google's token issuer | Must be `"accounts.google.com"` or `"https://accounts.google.com"` |
| `email` | string | ✅ Yes | Service account email address | Must exist and match service account email |
| `email_verified` | boolean | ✅ Yes | Email verification status | Must be `true` |
| `exp` | number | ✅ Yes | Expiration timestamp (Unix epoch) | Must be in the future |
| `iat` | number | ✅ Yes | Issued at timestamp (Unix epoch) | Must be in the past |
| `sub` | string | ⚠️ Optional | Subject identifier | Usually same as `client_id` |
| `azp` | string | ⚠️ Optional | Authorized party | Usually same as `email` |

### Validation Rules

1. **Token Format**: Must be a valid JWT with 3 segments (header.payload.signature)
2. **Signature**: Verified against Google's public certificates
3. **Audience (`aud`)**: Must exactly match the `client_id` from `service_authn.json`
4. **Issuer (`iss`)**: Must be one of:
   - `"accounts.google.com"`
   - `"https://accounts.google.com"`
5. **Email Verification**: `email_verified` must be `true`
6. **Email**: Must be present and match the service account email

### Example Valid Payload

```json
{
  "aud": "105833083285007921344",
  "azp": "discharge-export-processor-sa@simtran-474018.iam.gserviceaccount.com",
  "email": "discharge-export-processor-sa@simtran-474018.iam.gserviceaccount.com",
  "email_verified": true,
  "exp": 1763096360,
  "iat": 1763092760,
  "iss": "https://accounts.google.com",
  "sub": "105833083285007921344"
}
```

### What Gets Set in `req.auth`

After successful verification, the backend sets:

```json
{
  "type": "service",
  "email": "discharge-export-processor-sa@simtran-474018.iam.gserviceaccount.com",
  "tenantId": "demo"
}
```

The `tenantId` comes from the `X-Tenant-ID` header in the request.

### Generating a Valid Token

Use the provided script:

```bash
npm run generate-service-token -- --tenant-id demo
```

This will generate a token with the correct payload structure.

