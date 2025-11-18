# Comprehensive Authentication & Tech Stack Overview

## 1. BACKEND TECHNOLOGY STACK

### Framework & Runtime
- **Runtime:** Node.js (TypeScript)
- **Framework:** NestJS 11.x (enterprise-grade Node.js framework)
- **Build Tool:** nest-cli
- **Language:** TypeScript 5.7.3
- **Package Manager:** npm

### Key Backend Dependencies
- **Authentication:**
  - `jsonwebtoken` (9.0.2) - JWT token generation and verification
  - `bcryptjs` (3.0.3) - Password hashing (bcrypt with 10 salt rounds)
  - `google-auth-library` (9.15.0) - Google OIDC token verification

- **Database:**
  - `@google-cloud/firestore` (7.10.0) - NoSQL document database (Google Cloud)
  - `@google-cloud/storage` (7.7.0) - Cloud storage for files
  - `@google-cloud/pubsub` (5.2.0) - Event streaming

- **AI/ML:**
  - `@google-cloud/vertexai` (1.9.0) - Google Vertex AI for LLMs (Gemini)

- **HTTP:**
  - `cors` (2.8.5) - CORS middleware
  - `axios` (1.12.2) - HTTP client

- **Utilities:**
  - `class-validator` (0.14.2) - Request validation
  - `class-transformer` (0.5.1) - DTO transformation
  - `yaml` (2.8.1) - YAML config parsing
  - `dotenv` (17.2.3) - Environment variables

---

## 2. FRONTEND TECHNOLOGY STACK

### Framework & Runtime
- **Framework:** Next.js 15.2.4 (React 19)
- **Build Tool:** Next.js built-in
- **Language:** TypeScript 5
- **Package Manager:** npm
- **CSS:** Tailwind CSS 4.1.9

### Key Frontend Dependencies
- **UI Components:**
  - Radix UI (comprehensive component library)
  - shadcn/ui (component system)
  - Lucide React (icons)
  - Sonner (toast notifications)
  - Recharts (charting)

- **Forms & Validation:**
  - React Hook Form (7.60.0) - Form state management
  - Zod (3.25.76) - Schema validation
  - @hookform/resolvers (3.10.0) - Form validation integration

- **Utilities:**
  - next-themes (0.4.6) - Dark mode support
  - date-fns (4.1.0) - Date utilities
  - jspdf & html2canvas - PDF export
  - clsx & tailwind-merge - CSS utilities

---

## 3. CURRENT AUTHENTICATION IMPLEMENTATION

### 3.1 Authentication Methods (Dual Support)

#### Method 1: App JWT Authentication (Primary)
```
User → Login Endpoint → AuthService → JWT Generation → Token Storage
```

**Flow:**
1. User submits credentials: `{tenantId, username, password}`
2. Backend validates against Firestore user collection
3. Password compared with bcrypt hash
4. JWT token generated with payload:
   - userId, tenantId, username, name, role, linkedPatientId
   - exp: 24 hours, iat: current time
5. Token signed with JWT_SECRET (configured via config.yaml)
6. Frontend stores token in localStorage (key: `aivida_auth`)

**JWT Structure:**
```javascript
{
  userId: "user-id",
  tenantId: "demo",
  username: "patient",
  name: "John Smith",
  role: "patient",
  linkedPatientId: "patient-demo-001",
  exp: 1700500000,    // Expiry timestamp (24 hours)
  iat: 1700413600     // Issued at
}
```

#### Method 2: Google OIDC Authentication (Service-to-Service)
```
Cloud Run Service → Google OIDC Token → AuthGuard Verification → Access
```

**Verification Flow:**
1. Google identity token sent in Authorization header
2. Verified against Google's public certificates
3. Checks token issuer (accounts.google.com)
4. Validates email_verified claim
5. Verifies token signature and audience

**Use Case:**
- Cloud Run service-to-service authentication
- Service account tokens from Google Cloud

---

### 3.2 Authentication Guard (Middleware)

**Location:** `/backend/src/auth/auth.guard.ts`

**Implementation:** NestJS Guard applied globally
```
Request → AuthGuard → Extract Token → Verify JWT or Google OIDC → Attach to Request
```

**Verification Order:**
1. Check Authorization header exists
2. Validate header format: "Bearer {token}"
3. Validate token structure (3 JWT segments)
4. Try Google OIDC verification first
5. Fallback to app JWT verification
6. Check token expiration
7. Verify X-Tenant-ID header matches token tenantId
8. Verify tenant exists in Firestore

**Public Routes** (skip auth):
- POST `/api/auth/login` - Login endpoint

---

### 3.3 Request Headers (Required for All Protected Endpoints)

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
X-Tenant-ID: demo
X-Request-ID: unique-request-id (optional)
```

**CORS Configuration:**
- Allowed origins: localhost:3000, localhost:3001, aividahealth.ai
- Allowed headers: Content-Type, Authorization, Accept, X-Tenant-ID, X-Request-ID
- Credentials: true

---

## 4. DATABASE SCHEMA & MODELS

### 4.1 Database: Google Cloud Firestore (NoSQL)

**Collections:**

#### 1. Users Collection (`users`)
```javascript
Document ID: auto-generated
{
  tenantId: string,           // Organization ID
  username: string,           // Login username
  passwordHash: string,       // bcrypt hash
  name: string,              // Display name
  role: enum['patient' | 'clinician' | 'expert' | 'admin'],
  linkedPatientId: string,   // For patient role: link to patient record
  createdAt: timestamp,
  updatedAt: timestamp,
  
  // Indexes:
  // - tenantId + username (compound unique)
}
```

**Example User:**
```javascript
{
  tenantId: "demo",
  username: "patient",
  passwordHash: "$2a$10$...",  // bcrypt hash
  name: "John Smith",
  role: "patient",
  linkedPatientId: "patient-demo-001",
  createdAt: 2025-01-01T00:00:00Z,
  updatedAt: 2025-01-01T00:00:00Z
}
```

#### 2. Config Collection (`config`)
```javascript
Document ID: tenantId
{
  id: string,                    // Tenant ID
  name: string,                 // Tenant name
  status: enum['active' | 'inactive' | 'suspended'],
  type: string,                 // 'default' or 'custom'
  
  branding: {
    logo: string (URL),         // Tenant logo
    favicon: string (URL),      // Favicon
    primaryColor: string,       // HEX color
    secondaryColor: string,     // HEX color
    accentColor: string        // HEX color
  },
  
  features: {
    aiGeneration: boolean,
    multiLanguage: boolean,
    supportedLanguages: string[],
    fileUpload: boolean,
    expertPortal: boolean,
    clinicianPortal: boolean,
    adminPortal: boolean
  },
  
  config: {
    simplificationEnabled: boolean,
    translationEnabled: boolean,
    defaultLanguage: string,
    service_account_path: string,
    jwt_secret: string,
    gcp: { project_id, location, dataset, fhir_store },
    tenantConfig: { google, cerner, pubsub }
  },
  
  createdAt: timestamp,
  updatedAt: timestamp
}
```

#### 3. Other Collections (FHIR-Related)
- Composition, Patient, Encounter, MedicationRequest, etc. (FHIR resources)
- Managed by Google Healthcare API FHIR Store

---

### 4.2 User Types & Roles

**Roles:**

| Role | Purpose | Features |
|------|---------|----------|
| **patient** | Patient portal access | View own discharge summary, chat with AI |
| **clinician** | Clinical portal | Review discharge summaries, upload documents |
| **expert** | Expert review portal | Review and approve summaries |
| **admin** | Administrative access | Manage tenants, users, configurations |

**Demo User Credentials:**
```
Tenant: demo
Password: Adyar2Austin (for all users)

- Username: patient   (Role: patient)
- Username: clinician (Role: clinician)
- Username: expert    (Role: expert)
- Username: admin     (Role: admin)
```

---

## 5. API STRUCTURE & ROUTING

### 5.1 Authentication Endpoints

#### POST `/api/auth/login` - Simple Login
```
Request:
{
  "tenantId": "demo",
  "username": "patient",
  "password": "Adyar2Austin"
}

Response:
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 86400,          // seconds (24 hours)
  "user": {
    "id": "user-demo-patient",
    "tenantId": "demo",
    "username": "patient",
    "name": "John Smith",
    "role": "patient",
    "linkedPatientId": "patient-demo-001"
  },
  "tenant": {
    "id": "demo",
    "name": "Demo Hospital",
    "branding": {
      "logo": "https://...",
      "primaryColor": "#3b82f6",
      "secondaryColor": "#60a5fa"
    }
  }
}
```

#### GET `/api/config` - Get Tenant Configuration
```
Headers:
  X-Tenant-ID: demo
  Authorization: Bearer {token}

Response:
{
  "success": true,
  "tenant": {
    "id": "demo",
    "name": "Demo Hospital",
    "status": "active",
    "branding": {...},
    "features": {...},
    "config": {...}
  }
}
```

### 5.2 Modules & Controllers

**Backend Modules:**
```
AppModule
├── AuthModule              (login, JWT verification)
├── TenantModule            (tenant context extraction)
├── ConfigModule            (config service, dev config)
├── GoogleModule            (FHIR/Google Healthcare)
├── CernerModule            (EHR integration)
├── DischargeSummariesModule (summaries management)
├── ExpertModule            (expert review portal)
├── PatientChatbotModule    (AI chatbot)
└── ... other modules
```

**Key Controllers:**
- `AuthController` - Login endpoints
- `ConfigController` - Tenant config endpoints
- `GoogleController` - FHIR endpoints
- `PatientChatbotController` - Chat endpoints

---

## 6. FRONTEND STATE MANAGEMENT

### 6.1 Tenant Context Provider

**Location:** `/frontend/contexts/tenant-context.tsx`

**State Structure:**
```typescript
interface TenantContextType {
  tenantId: string | null                  // From URL path
  tenant: Tenant | null                    // Full tenant config
  user: User | null                        // Authenticated user
  token: string | null                     // JWT token
  isLoading: boolean                       // Loading state
  isAuthenticated: boolean                 // Auth status
  login: (authData: AuthData) => void     // Login function
  logout: () => void                       // Logout function
  updateTenant: (tenant: Tenant) => void   // Update tenant config
}
```

### 6.2 Storage

**localStorage Keys:**
```javascript
aivida_auth: {
  token: string,
  expiresIn: number,
  user: User,
  tenant: Tenant
}

aivida_auth_expiry: number  // Unix timestamp
```

### 6.3 Token Expiration Handling

```typescript
// On app load:
1. Check if token exists in localStorage
2. Check if expired: Date.now() > expiryTime
3. If expired: clear storage and redirect to /login
4. If valid: restore user session
5. Fetch latest tenant config from backend
```

### 6.4 API Client Integration

**Location:** `/frontend/lib/api-client.ts`

```typescript
const client = createApiClient({ tenantId, token })

// Automatically adds headers:
// Authorization: Bearer {token}
// X-Tenant-ID: {tenantId}
// Content-Type: application/json
```

---

## 7. SESSION MANAGEMENT APPROACH

### 7.1 Token-Based Sessions (Stateless)

**No Server-Side Sessions** - uses JWT instead

**Characteristics:**
- ✅ Stateless (no session storage needed)
- ✅ Scalable (works across multiple backend instances)
- ✅ Mobile-friendly (suitable for apps)
- ✅ Single Sign-On ready

### 7.2 Token Lifecycle

```
1. LOGIN
   └─ POST /api/auth/login → JWT + expiry time

2. REQUEST
   └─ Include Authorization: Bearer {token}

3. VERIFICATION
   └─ AuthGuard validates token signature & expiration

4. REFRESH
   └─ None currently (long-lived 24h tokens)
   └─ User must re-login when expired

5. LOGOUT
   └─ Clear localStorage on client side
   └─ No server-side cleanup needed
```

### 7.3 Multi-Tenancy

**Tenant Isolation:**
```
- Tenant ID in URL path: /demo/patient
- Tenant ID in token: payload.tenantId
- Tenant ID in headers: X-Tenant-ID
- Validated on every request
```

**Tenant Context Extraction:**
1. Extract from URL path: `/:tenantId/...`
2. Validate against X-Tenant-ID header
3. Verify tenant exists in Firestore
4. Load tenant-specific configuration

---

## 8. SECURITY MEASURES

### Current Implementation

✅ **Implemented:**
- bcrypt password hashing (10 salt rounds)
- JWT token signing with secret key
- CORS protection with origin whitelist
- Request header validation (Authorization, X-Tenant-ID)
- Token expiration checking
- Tenant validation on every request
- Public route decorator for login endpoint
- Google OIDC token verification (for service accounts)

⚠️ **Missing for Production:**
- Refresh token mechanism
- Rate limiting on login endpoint
- Token revocation/blacklisting
- CSRF protection
- Input sanitization
- SQL injection prevention (Firestore is NoSQL, but still important)
- XSS prevention
- HTTPS enforcement
- Secure cookie flags (HttpOnly, Secure, SameSite)
- Audit logging
- 2FA/MFA support

### JWT Secret Configuration
```yaml
# In .settings.dev/config.yaml
jwt_secret: "your-secret-key-change-in-production"

# Or via environment variable
JWT_SECRET=your-secret-key-change-in-production
```

---

## 9. MULTI-TENANT ARCHITECTURE

### 9.1 Tenant Isolation Model

**Database Level:**
```
Firestore
├── users collection
│   └── Documents filtered by tenantId field
├── config collection
│   └── Documents keyed by tenantId
└── Other collections (FHIR resources)
    └── Tenant-specific field indexing
```

**Application Level:**
```
Request → Extract tenantId → Validate → 
Filter all queries by tenantId → Return scoped data
```

**URL Level:**
```
/:tenantId/:portal/...

Examples:
- /demo/patient
- /demo/clinician
- /hospital-abc/admin
```

### 9.2 Tenant Configuration

Stored in Firestore `config` collection, includes:
- Branding (logo, colors)
- Features (enabled portals, AI, translations)
- Settings (simplification, translation, default language)

---

## 10. ENVIRONMENT VARIABLES

### Backend (.env or config.yaml)
```bash
NODE_ENV=dev
PORT=3000
JWT_SECRET=your-jwt-secret-key
GCP_PROJECT_ID=simtran-474018
GCP_LOCATION=us-central1
DEFAULT_GOOGLE_DATASET=aivida-dev
DEFAULT_GOOGLE_FHIR_STORE=aivida
```

### Frontend (.env.local)
```bash
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_CHATBOT_SERVICE_URL=http://localhost:3000/api/patient-chatbot/chat
```

---

## 11. KEY FILES REFERENCE

### Backend Authentication
- `/backend/src/auth/auth.controller.ts` - Login endpoint
- `/backend/src/auth/auth.service.ts` - JWT generation, verification
- `/backend/src/auth/auth.guard.ts` - Global auth guard
- `/backend/src/auth/user.service.ts` - User CRUD operations
- `/backend/src/auth/types/user.types.ts` - Types definitions

### Frontend Authentication
- `/frontend/contexts/tenant-context.tsx` - Auth state management
- `/frontend/lib/api/auth.ts` - Login, config API functions
- `/frontend/components/auth-guard.tsx` - Protected route wrapper
- `/frontend/lib/api-client.ts` - HTTP client with auth headers

### Configuration
- `/backend/src/tenant/tenant.service.ts` - Tenant ID extraction
- `/backend/src/config/config.service.ts` - Tenant config from Firestore
- `/backend/scripts/seed-users.ts` - User seeding script
- `/backend/scripts/seed-config.ts` - Config seeding script

---

## 12. AUTHENTICATION FLOW DIAGRAM

```
┌─────────────────┐
│  Frontend App   │
│  (Next.js 15)   │
└────────┬────────┘
         │
         │ 1. User enters credentials
         │    (tenantId, username, password)
         │
         ▼
┌─────────────────────────────────────┐
│   POST /api/auth/login              │
│   Body: {tenantId, username, pwd}   │
└────────┬────────────────────────────┘
         │
         │ 2. Backend validates
         ▼
┌─────────────────────────────────────┐
│  AuthController.login()             │
│  ↓                                  │
│  AuthService.login()                │
│  ├─ Find user in Firestore          │
│  ├─ Compare password (bcrypt)       │
│  ├─ Verify tenant exists            │
│  └─ Generate JWT token              │
└────────┬────────────────────────────┘
         │
         │ 3. Return token + user info
         ▼
┌──────────────────────────────────────┐
│  TenantContext.login()               │
│  ├─ Store token in localStorage      │
│  ├─ Store user & tenant              │
│  └─ Fetch full tenant config         │
└────────┬──────────────────────────────┘
         │
         │ 4. Redirect to portal
         ▼
┌──────────────────────────────────────┐
│  /:tenantId/:portal (protected)      │
│  ↓                                   │
│  AuthGuard checks token              │
│  ├─ Verify JWT signature             │
│  ├─ Check expiration                 │
│  ├─ Validate X-Tenant-ID header      │
│  └─ Attach user to request           │
└─────────────────────────────────────┘
```

---

## 13. SUMMARY TABLE

| Aspect | Technology | Details |
|--------|-----------|---------|
| **Backend** | NestJS + TypeScript | Framework for API |
| **Frontend** | Next.js 15 + React 19 | Full-stack React |
| **Database** | Google Firestore | NoSQL, cloud-hosted |
| **Auth Method** | JWT + Google OIDC | Token-based, stateless |
| **Password Hashing** | bcrypt | 10 salt rounds |
| **State Management** | React Context | TenantContext for auth |
| **Session Storage** | localStorage | Browser-side persistence |
| **Multi-Tenancy** | URL + Header + Token | Tenant ID validation |
| **API Style** | REST | Standard HTTP methods |
| **Token Expiry** | 24 hours | No refresh token |
| **Cloud Provider** | Google Cloud | Cloud Run, Vertex AI |
| **CORS** | Custom middleware | Origin whitelist |

