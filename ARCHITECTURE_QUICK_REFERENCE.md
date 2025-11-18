# Patient Discharge Portal: Architecture Quick Reference

## Core Architecture Patterns

### 1. Authentication Flow

```
User Login
  ↓ POST /api/auth/login
  ↓ AuthService.login()
  ├─ Query Firestore: users WHERE (tenantId, username)
  ├─ Verify password with bcryptjs
  ├─ Generate JWT token (HS256, 24-hour expiry)
  └─ Return JWT + User + Tenant config + Branding
```

**Key Files:**
- `/backend/src/auth/auth.service.ts` - Token generation & verification
- `/backend/src/auth/auth.guard.ts` - Request protection (APP_GUARD)
- `/backend/src/auth/user.service.ts` - User CRUD from Firestore

### 2. Multi-Tenancy Model

**Every request requires:**
- `Authorization: Bearer {jwt-token}` header
- `X-Tenant-ID: {tenantId}` header

**Validation:**
1. AuthGuard extracts & validates both headers
2. Verifies token's tenantId matches header's tenantId
3. Checks tenant exists in Firestore `config` collection

**Isolation Pattern:**
```typescript
// All queries MUST filter by tenantId:
db.collection('users')
  .where('tenantId', '==', tenantId)
  .where('username', '==', username)
  .get()
```

### 3. Portal Architecture

| Portal | URL | Auth | Roles | Purpose |
|--------|-----|------|-------|---------|
| **Patient** | `/:tenantId/patient` | Yes | patient | View discharge summary |
| **Clinician** | `/:tenantId/clinician` | Yes | clinician | Review summaries |
| **Expert** | `/:tenantId/expert` | Optional | expert | Quality feedback |
| **Admin** | `/:tenantId/admin` | Yes | admin | System management |

### 4. Database Layout

**Firestore Collections:**

```
users/
├─ id: uuid
├─ tenantId: string ← ALWAYS included
├─ username: string (unique per tenant)
├─ passwordHash: string (bcryptjs)
├─ role: 'admin'|'clinician'|'expert'|'patient'
└─ linkedPatientId?: string

config/
├─ {tenantId} ← Document ID is the tenant
├─ branding: {logo, colors}
├─ features: {aiGeneration, multiLanguage, ...}
└─ config: {simplificationEnabled, defaultLanguage}

discharge_summaries/
├─ id: uuid
├─ tenantId?: string
├─ status: 'raw_only'|'simplified'|'translated'
├─ files: {raw, simplified, translated}
└─ metadata: {patientName, mrn, facility}

expert_feedback/
├─ id: uuid
├─ dischargeSummaryId: string
├─ reviewType: 'simplification'|'translation'
├─ rating: 1-5
└─ quality flags: {hasHallucination, hasMissingInfo}
```

### 5. Frontend State Management

**TenantProvider Context:**
```typescript
interface TenantContextType {
  tenantId: string | null        // From URL path
  tenant: Tenant | null          // Config from backend
  user: User | null              // Authenticated user
  token: string | null           // JWT token
  isAuthenticated: boolean       // Auth status
}
```

**Storage:** `localStorage`
- `aivida_auth` → {token, user, tenant, expiresIn}
- `aivida_auth_expiry` → timestamp (milliseconds)

**Usage:**
```typescript
const { tenantId, token, user } = useTenant()
const apiClient = createApiClient({ tenantId, token })
// All API calls auto-include: X-Tenant-ID & Authorization headers
```

---

## API Endpoint Summary

### Authentication
```
POST /api/auth/login
  Body: {tenantId, username, password}
  Response: {token, expiresIn, user, tenant}
```

### Discharge Summaries (Optional Auth)
```
GET /discharge-summaries                          # List
GET /discharge-summaries/:id                      # Get metadata
GET /discharge-summaries/:id/content?version=...  # Get content
POST /discharge-summaries/sync/all                # Sync GCS→Firestore
DELETE /discharge-summaries/:id                   # Delete
```

### Patient Queue (Required Auth)
```
GET /api/patients/discharge-queue
  Headers: Authorization, X-Tenant-ID
  Response: {patients[], meta}
```

### Expert Feedback (Public)
```
POST /expert/feedback                             # Submit
GET /expert/feedback/:id                          # Get
PUT /expert/feedback/:id                          # Update
GET /expert/feedback/summary/:summaryId           # Stats
```

---

## Key Design Decisions

### 1. Guard-Based Auth (vs. Middleware)
- **Why:** NestJS best practice for route-level control
- **How:** `AuthGuard` implements `CanActivate` interface
- **Benefit:** Can use `@Public()` decorator for bypass

### 2. Tenant Header (vs. JWT Only)
- **Why:** Explicit tenant validation on every request
- **How:** Both JWT token and header must match
- **Benefit:** Catches token-tampering attacks

### 3. Firestore (vs. SQL Database)
- **Why:** Serverless, scales with Cloud Run
- **How:** No schema management, flexible documents
- **Limitation:** No ACID transactions across collections (minor)

### 4. Symmetric JWT (HS256)
- **Current:** Secret in config.yaml or environment
- **Issue:** Secret shared with all services
- **Future:** Consider RS256 with public/private keys

### 5. Password-Based Login (vs. OAuth)
- **Current:** Simple username/password authentication
- **Limitation:** No SSO, requires password management
- **Future:** Add SAML/OAuth for enterprise

---

## Security Checklist

### Current (Development)
- ✅ JWT tokens with expiration
- ✅ Password hashing (bcryptjs 10 rounds)
- ✅ Tenant isolation enforcement
- ✅ CORS configuration
- ✅ Google OIDC support (service-to-service)

### Recommended (Production)
- ⚠️ Rate limiting on login endpoint
- ⚠️ Token refresh mechanism
- ⚠️ Audit logging for all auth events
- ⚠️ Role-based route guards
- ⚠️ Secret management (Cloud Secret Manager)

---

## Common Development Tasks

### Add New User (Firestore)
```typescript
// Using UserService
const user = await userService.create({
  tenantId: 'demo',
  username: 'newuser',
  passwordHash: await authService.hashPassword('password'),
  name: 'New User',
  role: 'clinician'
})
```

### Add New Tenant
```typescript
// 1. Create in Firestore config collection
db.collection('config').doc('tenant-id').set({
  id: 'tenant-id',
  name: 'Hospital Name',
  status: 'active',
  branding: {...},
  features: {...},
  config: {...}
})

// 2. Users must specify tenantId in login request
POST /api/auth/login
{
  "tenantId": "tenant-id",
  "username": "...",
  "password": "..."
}
```

### Make Authenticated API Call
```typescript
// Frontend
const apiClient = createApiClient({ tenantId, token })
const response = await apiClient.get('/api/patients/discharge-queue')

// Headers auto-included:
// X-Tenant-ID: {tenantId}
// Authorization: Bearer {token}
```

---

## Troubleshooting

### 401 Unauthorized

**Check:**
1. Is `Authorization: Bearer {token}` header present?
2. Is token valid (not expired)? Check JWT `exp` claim
3. Is `X-Tenant-ID` header present?
4. Does token's `tenantId` match header's value?
5. Does tenant exist in Firestore `config` collection?

### 403 Forbidden

**Check:**
1. Is route protected? Look for `@Public()` decorator
2. Does user have required role? Check JWT `role` claim
3. Is user trying to access another tenant's data?

### Null/Empty Auth in Controller

**Check:**
1. Is route public? Use `@Public()` decorator only for public routes
2. Are you using `@CurrentUser()` or `@TenantContext()`?
3. Did AuthGuard attach `request.auth` and `request.user`?

---

## File Navigation

**Quick Find Commands:**
```bash
# Find authentication files
find ./backend/src/auth -name "*.ts"

# Find tenant-related files
find ./backend/src -name "*tenant*"

# Find controllers (API routes)
find ./backend/src -name "*.controller.ts"

# Find services (business logic)
find ./backend/src -name "*.service.ts"

# Find frontend portal pages
find ./frontend/app -name "page.tsx"
```

---

## Reference Documents

- **Full Architecture:** `/ARCHITECTURE_DEEP_DIVE.md`
- **Multi-Tenant Guide:** `/MULTI_TENANT_IMPLEMENTATION.md`
- **Data Architecture:** `/DATA_ARCHITECTURE_EXPLANATION.md`
- **API Overview:** `/ARCHITECTURE_OVERVIEW.md`

---

**Version:** 1.0
**Date:** November 18, 2025
**Status:** Quick Reference for Development
