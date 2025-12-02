# EPIC EHR Integration Documentation

## Overview

This document provides comprehensive documentation for the EPIC EHR integration in the Patient Discharge application. EPIC integration enables:

- **Import**: Fetch patient data, encounters, and discharge summaries from EPIC EHR
- **Export**: Write simplified and translated discharge summaries back to EPIC EHR
- **Authentication**: JWT-based system-to-system authentication (RS384)

## Table of Contents

1. [Architecture](#architecture)
2. [Authentication Flow](#authentication-flow)
3. [Configuration](#configuration)
4. [Key Components](#key-components)
5. [Quick Start](#quick-start)
6. [API Reference](#api-reference)
7. [Troubleshooting](#troubleshooting)

---

## Architecture

### High-Level Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            EPIC Integration Flow                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌────────────┐ │
│  │   EPIC EHR  │────▶│  EPICAdapter│────▶│ Google FHIR │────▶│  Frontend  │ │
│  │  (Sandbox)  │     │             │     │    Store    │     │  Portals   │ │
│  └─────────────┘     └─────────────┘     └─────────────┘     └────────────┘ │
│        │                    │                    │                          │
│        │                    │                    │                          │
│        ▼                    ▼                    ▼                          │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐                    │
│  │ DocumentRef │     │  JWT Auth   │     │ Composition │                    │
│  │ Patient     │     │  (RS384)    │     │ Binary      │                    │
│  │ Encounter   │     │             │     │ DocumentRef │                    │
│  └─────────────┘     └─────────────┘     └─────────────┘                    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Import (Scheduler → EPIC → Google FHIR)**
   - `EncounterExportScheduler` discovers patients from EPIC
   - Fetches encounters, patients, and discharge summaries
   - Stores in Google FHIR with `original-cerner-id` tag on Encounters

2. **Simplification/Translation (Backend → AI → Google FHIR → EPIC)**
   - Content is simplified/translated and stored in Google FHIR
   - `SimplifiedContentService` checks for EPIC-integrated tenants
   - If Encounter has `original-cerner-id` tag, writes back to EPIC

---

## Authentication Flow

### EPIC JWT Authentication (RS384)

EPIC uses asymmetric JWT authentication, NOT Basic Auth like Cerner.

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        EPIC JWT Authentication Flow                        │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌─────────────┐                              ┌─────────────┐            │
│  │   Backend   │                              │    EPIC     │            │
│  │  (Private   │                              │   (Public   │            │
│  │    Key)     │                              │     Key)    │            │
│  └──────┬──────┘                              └──────┬──────┘            │
│         │                                            │                   │
│         │  1. Create JWT with claims:                │                   │
│         │     - iss: client_id                       │                   │
│         │     - sub: client_id                       │                   │
│         │     - aud: token_url                       │                   │
│         │     - jti: unique_id                       │                   │
│         │     - exp: now + 5 min                     │                   │
│         │                                            │                   │
│         │  2. Sign with RS384                        │                   │
│         │─────────────────────────────────────────▶│                   │
│         │                                            │                   │
│         │  3. EPIC fetches public key from:         │                   │
│         │     /.well-known/jwks/{tenantId}          │                   │
│         │◀─────────────────────────────────────────│                   │
│         │                                            │                   │
│         │  4. Returns access_token                   │                   │
│         │◀─────────────────────────────────────────│                   │
│         │                                            │                   │
│         │  5. Use Bearer token for API calls         │                   │
│         │─────────────────────────────────────────▶│                   │
│         │                                            │                   │
└─────────┴────────────────────────────────────────────┴───────────────────┘
```

### Key Differences from Cerner

| Feature | Cerner | EPIC |
|---------|--------|------|
| Auth Method | Basic Auth (client_id:secret) | JWT Assertion (RS384) |
| Key Type | Client Secret (symmetric) | RSA Key Pair (asymmetric) |
| Token Request | Form POST with credentials | Form POST with JWT assertion |
| Required Headers | `Authorization: Basic ...` | `Epic-Client-ID` header |
| Delete Support | Limited | Not supported |
| Update Support | Yes | Limited |

---

## Configuration

### Tenant Configuration (config.yaml or Firestore)

```yaml
tenants:
  etest:  # Example EPIC tenant
    ehr:
      vendor: epic  # Must be 'epic' for EPIC integration
      base_url: "https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4"

      # System-to-System App (backend service authentication)
      system_app:
        client_id: "1c9019b6-e5f9-425c-bd88-bef6ba914b5c"
        private_key_path: ".settings.dev/epic-system-private-key.pem"
        key_id: "epic-system-key-1764625902"
        token_url: "https://fhir.epic.com/interconnect-fhir-oauth/oauth2/token"
        scopes: "system/Patient.read system/DocumentReference.read system/Binary.read system/Observation.read"

      # Provider App (clinician-facing, optional)
      provider_app:
        client_id: ""
        private_key_path: ".settings.dev/epic-provider-private-key.pem"
        key_id: "epic-provider-key-1764625902"
        authorization_url: "https://fhir.epic.com/interconnect-fhir-oauth/oauth2/authorize"
        token_url: "https://fhir.epic.com/interconnect-fhir-oauth/oauth2/token"
        redirect_uri: "https://your-domain.com/auth/epic/callback"
        scopes: "launch/patient patient/Patient.read patient/DocumentReference.read"
```

### Environment Configuration

| Environment | Settings Directory | Key Files |
|-------------|-------------------|-----------|
| Development | `.settings.dev/` | `epic-system-private-key.pem`, `epic-system-public-key.pem` |
| Production | `.settings.prod/` | Same naming convention |

---

## Key Components

### 1. EPICAdapter (`backend/src/ehr/adapters/epic.adapter.ts`)

The main adapter implementing the `IEHRService` interface for EPIC.

**Key Methods:**

| Method | Description |
|--------|-------------|
| `authenticate(ctx, authType)` | JWT-based authentication |
| `createResource(resourceType, resource, ctx)` | Create FHIR resource |
| `fetchResource(resourceType, id, ctx)` | Fetch single resource |
| `searchResource(resourceType, query, ctx)` | Search with parameters |
| `searchDischargeSummaries(patientId, ctx)` | Find discharge summaries (LOINC: 18842-5) |
| `discoverPatients(ctx)` | Hybrid patient discovery |
| `fetchBinaryDocument(binaryId, ctx)` | Fetch binary attachments |

**Capabilities:**
- FHIR R4 ✅
- SMART on FHIR ✅
- Patient Access ✅
- Provider Access ✅
- Create Resources ✅
- Update Resources ⚠️ (Limited)
- Delete Resources ❌

### 2. JWKSController (`backend/src/ehr/controllers/jwks.controller.ts`)

Serves public keys in JWK format for EPIC to verify JWT signatures.

**Endpoints:**

```
GET /.well-known/jwks/{tenantId}          # System app public key
GET /.well-known/jwks/{tenantId}/provider # Provider app public key (optional)
```

**Response Format:**
```json
{
  "keys": [{
    "kty": "RSA",
    "n": "xGOr-H7A...",
    "e": "AQAB",
    "alg": "RS384",
    "use": "sig",
    "kid": "epic-system-key-1764625902"
  }]
}
```

### 3. JWKConverter (`backend/src/ehr/utils/jwk-converter.ts`)

Utility for converting PEM public keys to JWK format.

**Usage:**
```typescript
import { JWKConverter } from './jwk-converter';

// Convert single key
const jwk = JWKConverter.pemToJWK('/path/to/public-key.pem', 'my-key-id');

// Generate JWKS for EPIC
const jwks = JWKConverter.generateEPICJWKS('/path/to/public-key.pem', 'my-key-id');
```

### 4. SimplifiedContentService Write-back

When simplified/translated content is saved to Google FHIR, it's also written to EPIC:

```
POST /api/fhir/composition/:compositionId/simplified
POST /api/fhir/composition/:compositionId/translated
    │
    ▼
SimplifiedContentService.processContent()
    │
    ├──▶ Write to Google FHIR ✅
    │
    └──▶ writeToCernerEHR()
           │
           ├── isCernerTenant() → false (this is EPIC)
           │
           └── [Future: writeToEpicEHR() - same pattern]
```

> **Note:** Currently only Cerner write-back is implemented. EPIC write-back follows the same pattern and can be added.

---

## Quick Start

### Step 1: Generate RSA Keys

```bash
cd /path/to/patient-discharge/backend
./scripts/setup-epic-keys.sh

# Follow prompts:
# - Environment: dev
# - Tenant ID: etest
# - Client ID: (from EPIC App Orchard)
```

Or manually:

```bash
cd backend/.settings.dev

# Generate 4096-bit RSA key pair
openssl genrsa -out epic-system-private-key.pem 4096
openssl rsa -in epic-system-private-key.pem -pubout -out epic-system-public-key.pem

# Set permissions
chmod 600 epic-system-private-key.pem
chmod 644 epic-system-public-key.pem
```

### Step 2: Configure Tenant

Add to `config.yaml` or Firestore:

```yaml
tenants:
  etest:
    ehr:
      vendor: epic
      base_url: "https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4"
      system_app:
        client_id: "YOUR_CLIENT_ID"
        private_key_path: ".settings.dev/epic-system-private-key.pem"
        key_id: "epic-system-key-$(date +%s)"
        token_url: "https://fhir.epic.com/interconnect-fhir-oauth/oauth2/token"
        scopes: "system/Patient.read system/DocumentReference.read"
```

### Step 3: Deploy Backend

```bash
cd backend
./deploy-to-cloud-run-dev.sh
```

### Step 4: Configure EPIC App Orchard

1. Go to https://fhir.epic.com/
2. Open your System-to-System app
3. Set **JWK Set URL** to:
   ```
   https://your-backend-url/.well-known/jwks/etest
   ```
4. Save and validate

### Step 5: Test Integration

```bash
./scripts/test-epic-integration.sh

# Or manually:
curl https://your-backend-url/.well-known/jwks/etest
```

---

## API Reference

### EHR Controller Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/ehr/vendor` | Get EHR vendor info |
| `GET` | `/ehr/Patient/:id` | Fetch patient |
| `GET` | `/ehr/Encounter/:id` | Fetch encounter |
| `GET` | `/ehr/discharge-summaries/:patientId` | Search discharge summaries |
| `GET` | `/ehr/Binary/:id` | Fetch binary document |
| `POST` | `/ehr/DocumentReference` | Create document reference |

### JWKS Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/.well-known/jwks/:tenantId` | System app public key |
| `GET` | `/.well-known/jwks/:tenantId/provider` | Provider app public key |

---

## Troubleshooting

### Common Errors

#### "Failed to generate JWKS"
**Cause:** Public key file not found or malformed

**Solution:**
```bash
# Verify file exists
ls -la backend/.settings.dev/epic-system-public-key.pem

# Regenerate if needed
openssl rsa -in epic-system-private-key.pem -pubout -out epic-system-public-key.pem
```

#### "invalid_client" from EPIC
**Cause:** JWK mismatch or incorrect client_id

**Solution:**
1. Verify JWK endpoint is accessible: `curl https://your-domain/.well-known/jwks/etest`
2. Check `kid` in config matches JWK
3. Verify client_id matches EPIC App Orchard

#### "invalid_grant" during token exchange
**Cause:** JWT assertion is malformed or expired

**Solution:**
1. Sync system clock (JWT has 5-minute expiry)
2. Verify private key matches public key
3. Check algorithm is RS384

#### 403 Forbidden on API calls
**Cause:** Insufficient scopes

**Solution:**
1. Check scopes in EPIC App Orchard
2. Re-authenticate to get new token

---

## Security Best Practices

1. **Never commit private keys** to version control
2. **Add `*.pem` to `.gitignore`**
3. **Rotate keys regularly** (every 90 days recommended)
4. **Use separate keys** for dev/staging/production
5. **Store tokens securely** with short expiration
6. **Monitor access logs** for unusual activity
7. **Validate JWT claims** thoroughly

---

## Related Files

| File | Description |
|------|-------------|
| `backend/src/ehr/adapters/epic.adapter.ts` | Main EPIC adapter |
| `backend/src/ehr/controllers/jwks.controller.ts` | JWK Set endpoint |
| `backend/src/ehr/utils/jwk-converter.ts` | PEM to JWK converter |
| `backend/scripts/setup-epic-keys.sh` | Key generation script |
| `backend/scripts/test-epic-integration.sh` | Integration test script |
| `backend/docs/EPIC_SANDBOX_SETUP.md` | Detailed sandbox setup guide |
| `backend/EPIC_REGISTRATION_GUIDE.md` | App Orchard registration guide |

---

## References

- [EPIC FHIR Documentation](https://fhir.epic.com/Documentation)
- [EPIC Backend OAuth2 Guide](https://fhir.epic.com/Documentation?docId=oauth2&section=BackendOAuth2Guide)
- [SMART on FHIR](http://hl7.org/fhir/smart-app-launch/)
- [JWT Authentication RFC](https://datatracker.ietf.org/doc/html/rfc7523)
- [FHIR R4 Specification](https://hl7.org/fhir/R4/)

