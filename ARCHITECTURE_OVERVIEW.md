# Patient Portal Codebase Architecture Overview

## Executive Summary

The patient discharge portal is a multi-tenant healthcare application built with:
- **Frontend:** Next.js 15.2.4 with React 19 and TypeScript
- **Backend:** NestJS with TypeScript
- **Database:** Google Cloud Firestore
- **File Storage:** Google Cloud Storage (GCS)
- **FHIR Integration:** Google Cloud Healthcare FHIR Store
- **Authentication:** JWT tokens + Google OIDC

---

## 1. PROJECT STRUCTURE

### Root Directory Layout
```
/home/user/patient-discharge/
├── frontend/               # Next.js React application
├── backend/                # NestJS backend service
├── simtran/                # Simplification/translation services
├── QUICK_START.md
├── LOGIN_FLOW.md
├── MULTI_TENANT_IMPLEMENTATION.md
└── TENANT_CONFIG_USAGE.md
```

### Frontend Structure (`/frontend`)
```
frontend/
├── app/                    # Next.js App Router
│   ├── [tenantId]/        # Dynamic tenant routing
│   ├── admin/             # Admin portal
│   ├── api/               # Next.js API routes (edge functions)
│   │   ├── chat/
│   │   └── discharge-summary/
│   ├── clinician/         # Clinician review portal
│   ├── expert/            # Expert review portal
│   ├── login/             # Authentication pages
│   ├── marketing/         # Public landing pages
│   ├── patient/           # Patient-facing portal
│   ├── layout.tsx
│   ├── page.tsx           # Landing page
│   └── globals.css
├── components/            # React components (Radix UI)
├── contexts/              # React contexts (tenant context)
├── hooks/                 # Custom React hooks
├── lib/                   # Utility libraries
│   ├── discharge-summaries.ts    # API client for discharge summaries
│   ├── expert-api.ts            # Expert review API client
│   ├── parsers/                 # Tenant-specific parsers
│   └── constants/
├── public/                # Static assets
├── styles/                # CSS/Tailwind
└── package.json
```

### Backend Structure (`/backend/src`)
```
backend/src/
├── app.module.ts                 # Root module
├── app.controller.ts             # Root controller
├── main.ts                       # Entry point
├── auth/                         # Authentication module
│   ├── auth.service.ts          # JWT & Google OIDC verification
│   ├── auth.guard.ts            # Auth middleware
│   ├── auth.controller.ts       # Login endpoints
│   ├── user.service.ts          # User management
│   └── types/
│       └── user.types.ts        # JWT payload interfaces
├── discharge-summaries/          # Core discharge summary module
│   ├── discharge-summaries.service.ts     # Business logic
│   ├── discharge-summaries.controller.ts  # REST endpoints
│   ├── discharge-summary.types.ts         # Type definitions
│   ├── firestore.service.ts              # Firestore operations
│   ├── gcs.service.ts                    # GCS operations
│   └── discharge-summaries.module.ts
├── google/                       # Google Cloud / FHIR integration
│   ├── patients.controller.ts           # Discharge queue endpoint
│   ├── discharge-upload.controller.ts   # File upload endpoints
│   ├── discharge-upload.service.ts
│   └── google.module.ts
├── expert/                       # Expert feedback module
│   ├── expert.service.ts         # Feedback storage & retrieval
│   ├── expert.controller.ts      # Feedback endpoints
│   └── expert.types.ts
├── config/                       # Configuration management
│   ├── config.service.ts         # YAML/Firestore config
│   ├── dev-config.service.ts     # Dev environment config
│   └── config.module.ts
├── tenant/                       # Multi-tenant support
│   ├── tenant.decorator.ts       # Tenant context injection
│   └── tenant-context.ts         # Tenant types
├── cerner/                       # Cerner EHR integration
├── cerner-auth/                  # Cerner OAuth2
├── audit/                        # Audit logging
├── pubsub/                       # Google Pub/Sub integration
├── scheduler/                    # Scheduled tasks
├── discharge-export/             # Document export
├── utils/                        # Helper utilities
└── test/                         # Tests
```

---

## 2. FRONTEND/BACKEND ARCHITECTURE

### Frontend Architecture

**Framework Stack:**
- **Next.js 15.2.4** - Full-stack React framework with API routes
- **React 19** - UI framework
- **TypeScript 5** - Type safety
- **Tailwind CSS 4.1.9** - Utility-first CSS
- **Radix UI** - Headless component library
- **React Hook Form** - Form state management
- **Zod** - Schema validation

**Portal Types:**
1. **Patient Portal** (`/patient`)
   - Patient-friendly view of discharge summaries
   - Multi-language support
   - Medication tracking
   - PDF download capability
   - Chatbot for Q&A

2. **Clinician Portal** (`/clinician`)
   - Discharge summary review queue
   - Comparison of raw vs. simplified versions
   - Translation review
   - Status tracking

3. **Expert Review Portal** (`/expert`)
   - Review of simplified/translated content
   - Feedback submission
   - Rating and quality assessment
   - Hallucination detection

4. **Admin Portal** (`/admin`)
   - User management
   - System configuration
   - Audit logs

5. **Multi-Tenant Support** (`/[tenantId]`)
   - Dynamic routing per tenant
   - Tenant-specific branding
   - Separate user bases

**API Communication:**
- Frontend to Backend: HTTP/REST
- Base URL Configuration: 
  - Production: `NEXT_PUBLIC_API_URL` environment variable
  - Development: `http://localhost:3000` (localhost backend)
  - Fallback: Cloud Run URL

**Authentication Flow:**
1. User logs in via `/api/auth/login`
2. Backend returns JWT token + tenant info
3. Token stored in browser (typically localStorage)
4. Subsequent requests include `Authorization: Bearer {token}` header
5. `X-Tenant-ID` header required for all requests

### Backend Architecture

**Framework Stack:**
- **NestJS 11** - Progressive Node.js framework
- **TypeScript 5.7** - Type safety
- **Express 5** - HTTP framework (built into NestJS)
- **Jest 30** - Testing
- **Google Cloud Client Libraries:**
  - `@google-cloud/firestore` v7.10
  - `@google-cloud/storage` v7.7
  - `@google-cloud/pubsub` v5.2
  - `google-auth-library` v9.15

**Module Organization:**
- **AuthModule** - JWT & Google OIDC authentication
- **DischargeSummariesModule** - Discharge document management
- **GoogleModule** - FHIR Store & Cloud integration
- **ExpertModule** - Expert feedback system
- **TenantModule** - Multi-tenant support
- **ConfigModule** - Configuration management
- **CernerModule** - Cerner EHR integration
- **PubSubModule** - Event publishing
- **SchedulerModule** - Cron jobs

---

## 3. DISCHARGE SUMMARY STORAGE & ACCESS

### Storage Architecture

**Metadata Layer: Google Cloud Firestore**
- Collection: `discharge_summaries`
- Document ID: Auto-generated UUID
- Fields:
  ```typescript
  {
    id: string;                    // Document ID
    patientId?: string;
    patientName?: string;
    mrn?: string;                  // Medical Record Number
    encounterId?: string;
    admissionDate?: Date;
    dischargeDate?: Date;
    status: 'raw_only' | 'simplified' | 'translated' | 'processing' | 'error';
    files: {
      raw?: string;                // GCS path
      simplified?: string;         // GCS path
      translated?: {
        [language]: string         // GCS paths by language code
      }
    };
    createdAt: Date;
    updatedAt: Date;
    simplifiedAt?: Date;
    translatedAt?: Date;
    metadata?: {
      facility?: string;
      department?: string;
      attendingPhysician?: string;
      diagnosis?: string[];
    }
  }
  ```

**Content Storage: Google Cloud Storage (GCS)**
Three separate buckets:
1. `discharge-summaries-raw` - Original medical documents
2. `discharge-summaries-simplified` - AI-simplified versions
3. `discharge-summaries-translated` - Multi-language translations

File naming convention:
- Raw: `{patientName}-{date}-summary.md`
- Simplified: `{patientName}-{date}-summary-simplified.md`
- Translated: `{patientName}-{date}-summary-simplified-{languageCode}.md`

### Access Flow

**Metadata Retrieval:**
```
GET /discharge-summaries
  → FirestoreService.list(query)
  → Query Firestore collection
  → Return DischargeSummaryMetadata[]
```

**Content Retrieval:**
```
GET /discharge-summaries/{id}/content?version=simplified&language=es
  → DischargeSummariesService.getWithContent()
  → Get metadata from Firestore
  → Determine GCS file path
  → GcsService.getFileContent()
  → Return content from GCS
```

**Sync Process:**
- Cloud Function triggers on GCS upload
- Calls backend sync endpoint
- Backend parses filename for patient info
- Creates/updates Firestore document
- Links to GCS files

File at: `/home/user/patient-discharge/backend/src/discharge-summaries/discharge-summaries.service.ts`

---

## 4. API ENDPOINTS

### Authentication Endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/auth/login` | Public | Login with username/password, returns JWT token |

**Request:**
```json
{
  "tenantId": "demo",
  "username": "clinician1",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGc...",
  "expiresIn": 86400,
  "user": {
    "id": "user-id",
    "tenantId": "demo",
    "username": "clinician1",
    "name": "Dr. Smith",
    "role": "clinician"
  },
  "tenant": {
    "id": "demo",
    "name": "Demo Hospital",
    "branding": {
      "logo": "https://...",
      "primaryColor": "#3b82f6"
    }
  }
}
```

File: `/home/user/patient-discharge/backend/src/auth/auth.controller.ts`

### Discharge Summary Endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/discharge-summaries` | No* | List discharge summaries with filtering |
| GET | `/discharge-summaries/{id}` | No* | Get summary metadata by ID |
| GET | `/discharge-summaries/{id}/content` | No* | Get full summary content |
| GET | `/discharge-summaries/stats/overview` | No* | Get statistics |
| POST | `/discharge-summaries/sync/all` | No* | Sync GCS to Firestore |
| POST | `/discharge-summaries/sync/file` | No* | Sync single file |
| DELETE | `/discharge-summaries/{id}` | No* | Delete summary & files |

**GET /discharge-summaries Query Parameters:**
```
?patientName=Smith
&status=simplified
&startDate=2024-01-01
&endDate=2024-12-31
&limit=20
&offset=0
&orderBy=updatedAt
&orderDirection=desc
```

**GET /discharge-summaries/{id}/content Query Parameters:**
```
?version=simplified    # 'raw', 'simplified', or 'translated'
&language=es          # Language code for translation
```

File: `/home/user/patient-discharge/backend/src/discharge-summaries/discharge-summaries.controller.ts`

### Patient/Queue Endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/patients/discharge-queue` | Yes | Get list of patients ready for discharge |

**Response:**
```json
{
  "patients": [
    {
      "id": "patient-id",
      "mrn": "12345",
      "name": "John Smith",
      "room": "ICU-302",
      "unit": "ICU",
      "dischargeDate": "2024-11-18",
      "compositionId": "composition-id",
      "status": "review",
      "attendingPhysician": {
        "name": "Dr. Jane Doe",
        "id": "physician-id"
      },
      "avatar": "https://..."
    }
  ],
  "meta": {
    "total": 15,
    "pending": 3,
    "review": 7,
    "approved": 5
  }
}
```

File: `/home/user/patient-discharge/backend/src/google/patients.controller.ts`

### Expert Feedback Endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/expert/feedback` | Public | Submit expert feedback |
| GET | `/expert/feedback/{id}` | Public | Get feedback by ID |
| PUT | `/expert/feedback/{id}` | Public | Update existing feedback |
| GET | `/expert/feedback/summary/{summaryId}` | Public | Get feedback stats for summary |

**POST /expert/feedback Request:**
```json
{
  "dischargeSummaryId": "summary-id",
  "reviewType": "simplification",
  "language": "es",
  "reviewerName": "Dr. Smith",
  "overallRating": 5,
  "whatWorksWell": "Clear and concise",
  "whatNeedsImprovement": "Add more details",
  "specificIssues": "...",
  "hasHallucination": false,
  "hasMissingInfo": false
}
```

File: `/home/user/patient-discharge/backend/src/expert/expert.controller.ts`

### File Upload Endpoints

| Method | Path | Frontend | Purpose |
|--------|------|----------|---------|
| POST | `/api/discharge-summary/upload` | Next.js | Upload discharge document |

**Frontend Route:** `/frontend/app/api/discharge-summary/upload/route.ts`
**Backend Route:** `/backend/src/google/discharge-upload.controller.ts`

**Validation:**
- Allowed types: PDF, DOC, DOCX, TXT
- Max size: 3MB
- Required fields: mrn, name

---

## 5. AUTHENTICATION & AUTHORIZATION

### Authentication Strategy

The system supports **two authentication types:**

#### 1. App JWT Authentication (Primary)
- Password-based login
- Issues custom JWT tokens
- Token includes user metadata

**JWT Payload Structure:**
```typescript
{
  userId: string;
  tenantId: string;
  username: string;
  name: string;
  role: 'admin' | 'clinician' | 'expert' | 'patient';
  linkedPatientId?: string;
  exp: number;      // Expiration timestamp
  iat: number;      // Issued at timestamp
}
```

**Token Generation:**
- Secret: From `config.yaml` or `JWT_SECRET` env variable
- Duration: 24 hours (86400 seconds)
- Algorithm: HS256 (symmetric)

**Verification Flow (AuthGuard):**
```
1. Extract Authorization header (Bearer token)
2. Validate token format (3 JWT segments)
3. Extract X-Tenant-ID header (required)
4. Try JWT verification
5. Check token expiration
6. Verify tenantId matches header
7. Verify tenant exists in Firestore
8. Attach auth payload to request
```

File: `/home/user/patient-discharge/backend/src/auth/auth.guard.ts`

#### 2. Google OIDC Authentication (Service-to-Service)
- For Cloud Run service-to-service authentication
- Verifies Google-signed tokens
- Claims validation (issuer, email verification)

**Verification Process:**
```
1. Check token format
2. Decode token header
3. Load service account for client_id
4. Detect if Cloud Run identity token
5. Verify token signature against Google certs
6. Check issuer (must be accounts.google.com)
7. Validate email_verified claim
8. Extract email as service identifier
```

File: `/home/user/patient-discharge/backend/src/auth/auth.service.ts`

### Authorization

**Role-Based Access Control (RBAC):**
- Admin: Full system access
- Clinician: Can review discharge summaries
- Expert: Can provide expert feedback
- Patient: Can view their own discharge summary

**Tenant Isolation:**
- Multi-tenant architecture enforced via `X-Tenant-ID` header
- TenantContext decorator extracts tenant info
- All queries filtered by tenantId
- Firestore documents include tenantId for additional safety

**Public Routes:**
- `/api/auth/login` - Public login
- `/expert/feedback` endpoints - Public (anonymous expert feedback)
- Some health check endpoints

**Protected Routes:**
- All `/api/patients/*` endpoints - Require auth
- All `/clinician/*` endpoints - Require auth
- All `/admin/*` endpoints - Require admin role

### User Management

**User Storage:** Firestore `users` collection
**Fields:**
```typescript
{
  id: string;
  tenantId: string;
  username: string;
  passwordHash: string;  // bcryptjs hash
  name: string;
  email?: string;
  role: 'admin' | 'clinician' | 'expert' | 'patient';
  linkedPatientId?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

**Password Hashing:** bcryptjs with 10 rounds salt
File: `/home/user/patient-discharge/backend/src/auth/user.service.ts`

### CORS Configuration

**Allowed Origins (from main.ts):**
- `https://www.aividahealth.ai`
- `https://aividahealth.ai`
- `http://localhost:3000` (development)
- `http://localhost:3001` (development)

**Allowed Methods:** GET, HEAD, PUT, PATCH, POST, DELETE, OPTIONS
**Allowed Headers:** Content-Type, Authorization, Accept, X-Tenant-ID, X-Request-ID

---

## 6. TECHNOLOGY STACK

### Frontend Dependencies
```
Core Framework:
  - next: 15.2.4
  - react: ^19
  - react-dom: ^19
  - typescript: ^5

UI Components:
  - @radix-ui/* (accordion, dialog, button, etc.)
  - lucide-react: ^0.454.0 (icons)
  - tailwindcss: ^4.1.9 (styling)

Forms & Validation:
  - react-hook-form: ^7.60.0
  - @hookform/resolvers: ^3.10.0
  - zod: ^3.25.76

Utilities:
  - date-fns: 4.1.0
  - jspdf: ^3.0.3 (PDF generation)
  - html2canvas: ^1.4.1 (screenshot for PDF)
  - sonner: ^1.7.4 (toast notifications)

Charts:
  - recharts: 2.15.4

Analytics:
  - @vercel/analytics: 1.3.1
  - @vercel/speed-insights: ^1.2.0

Next.js Plugins:
  - next-themes: ^0.4.6 (dark mode support)
```

### Backend Dependencies
```
Core Framework:
  - @nestjs/core: ^11.0.1
  - @nestjs/common: ^11.0.1
  - @nestjs/platform-express: ^11.0.1
  - express: (implicit)
  - typescript: ^5.7.3

Google Cloud:
  - @google-cloud/firestore: ^7.10.0
  - @google-cloud/storage: ^7.7.0
  - @google-cloud/pubsub: ^5.2.0
  - google-auth-library: ^9.15.0

Authentication:
  - jsonwebtoken: ^9.0.2
  - bcryptjs: ^3.0.3

Utilities:
  - cors: ^2.8.5
  - dotenv: ^17.2.3
  - uuid: ^13.0.0
  - yaml: ^2.8.1
  - axios: ^1.12.2
  - qs: ^6.14.0

Scheduling:
  - @nestjs/schedule: ^6.0.1

Testing:
  - jest: ^30.0.0
  - @nestjs/testing: ^11.0.1
  - supertest: ^7.0.0
```

### Infrastructure
- **Cloud Provider:** Google Cloud Platform
- **Compute:** Cloud Run (serverless)
- **Database:** Firestore (NoSQL)
- **Storage:** Cloud Storage (GCS)
- **Messaging:** Pub/Sub
- **Healthcare API:** Google Cloud Healthcare FHIR Store
- **Authentication:** Google Identity Platform

### Environment Configuration
- **Environment Variables:** `.env` files and process.env
- **Configuration Files:** `config.yaml` in `.settings.dev/`
- **Service Accounts:** JSON key files for Google Cloud authentication

---

## 7. DATA FLOW EXAMPLES

### Example 1: Patient Views Discharge Summary

```
1. Patient logs in
   POST /api/auth/login
   → Backend verifies credentials
   → Returns JWT token

2. Frontend stores token in localStorage
   → All subsequent requests include: Authorization: Bearer {token}

3. Frontend fetches discharge queue
   GET /api/patients/discharge-queue
   Headers: Authorization, X-Tenant-ID
   → Backend verifies token + tenant
   → Firestore query for compositions

4. User clicks on a patient summary
   GET /discharge-summaries/{id}/content?version=simplified
   → Firestore lookup (metadata)
   → GCS retrieval (content)
   → Return combined response

5. Frontend renders markdown content
   → Parses into sections (medications, follow-up, etc.)
   → Displays in patient-friendly UI
```

### Example 2: Simplification/Translation Pipeline

```
1. Raw discharge summary uploaded
   POST /api/discharge-summary/upload
   → File validation
   → Stored in GCS (raw bucket)

2. Backend triggers simplification
   → Calls SimTran service
   → Generates simplified version
   → Stores in GCS (simplified bucket)
   → Updates Firestore status to "simplified"

3. Backend triggers translation
   → For each language (es, fr, hi, de, etc.)
   → Calls SimTran translation service
   → Stores in GCS (translated bucket)
   → Updates Firestore files.translated map
   → Updates status to "translated"

4. Clinician reviews in portal
   GET /discharge-summaries/{id}/content?version=simplified
   → Displays simplified version
   → Can compare to raw version
   → Can review translations

5. Expert provides feedback
   POST /expert/feedback
   → Stores feedback in Firestore
   → Linked to discharge summary ID
   → Allows quality tracking
```

### Example 3: Multi-Tenant Access

```
1. User logs in (tenant: demo)
   POST /api/auth/login
   Body: { tenantId: "demo", username: "clinician1", password: "..." }
   → Firestore query: users where tenantId == "demo"
   → JWT includes tenantId: "demo"

2. All subsequent requests must include
   Headers: {
     Authorization: Bearer {token}
     X-Tenant-ID: demo
   }

3. AuthGuard validates
   → Extracts tenantId from token
   → Compares with X-Tenant-ID header
   → Must match exactly
   → Verifies tenant exists in Firestore

4. API calls automatically filtered
   GET /api/patients/discharge-queue?tenantId=demo
   → Only returns patients for "demo" tenant
   → Firestore composition queries filtered

5. Different tenant cannot access data
   X-Tenant-ID: acme
   → Token says tenantId: demo
   → 401 Unauthorized
```

---

## 8. KEY FILES & LOCATIONS

### Frontend
- **Main entry:** `/frontend/app/layout.tsx`
- **API client:** `/frontend/lib/discharge-summaries.ts`
- **Expert API:** `/frontend/lib/expert-api.ts`
- **Patient portal:** `/frontend/app/patient/page.tsx`
- **Clinician portal:** `/frontend/app/clinician/page.tsx`
- **Expert portal:** `/frontend/app/expert/` (directory)
- **Upload endpoint:** `/frontend/app/api/discharge-summary/upload/route.ts`
- **Chat endpoint:** `/frontend/app/api/chat/route.ts`

### Backend
- **Entry point:** `/backend/src/main.ts`
- **Root module:** `/backend/src/app.module.ts`
- **Auth module:** `/backend/src/auth/`
- **Discharge summaries:** `/backend/src/discharge-summaries/`
- **Expert module:** `/backend/src/expert/`
- **Google FHIR:** `/backend/src/google/`
- **Configuration:** `/backend/.settings.dev/config.yaml`
- **Scripts:** `/backend/scripts/` (seed, sync, generate tokens)

### Configuration
- **Dev config:** `/backend/.settings.dev/config.yaml`
  - FHIR base URL
  - Multi-tenant settings
  - Cerner OAuth credentials
  - Pub/Sub configuration
- **Package files:**
  - `/frontend/package.json`
  - `/backend/package.json`
  - `/simtran/package.json`

---

## 9. ENVIRONMENT VARIABLES & SECRETS

### Required for Backend
```
NODE_ENV=dev
PORT=3000
SERVICE_ACCOUNT_PATH=.settings.dev/fhir_store_sa.json
JWT_SECRET=<secure-random-string>
NEXT_PUBLIC_API_URL=<backend-url>
```

### Configuration File (config.yaml)
```yaml
jwt_secret: "your-secret-key"
fhir_base_url: "https://healthcare.googleapis.com/v1/..."
tenants:
  default:
    google:
      dataset: "aivida-dev"
      fhir_store: "aivida"
```

---

## 10. DEPLOYMENT ARCHITECTURE

**Frontend:** Cloud Run (Next.js)
- Runs as Docker container
- Listens on PORT 3000
- Serves Next.js app + API routes

**Backend:** Cloud Run (NestJS)
- Separate Cloud Run service
- Listens on PORT 3000 (different instance)
- REST API with CORS enabled

**Cloud Functions:**
- Firestore Sync trigger on GCS uploads

**Firestore:**
- Multi-tenant database
- Collections: users, discharge_summaries, expert_feedback

**Storage:**
- Three GCS buckets for summaries (raw, simplified, translated)

---

## 11. TESTING & SCRIPTS

### Available Scripts

**Backend:**
```bash
npm run build           # Compile TypeScript
npm run start          # Start production server
npm start:dev          # Start with hot reload
npm run test           # Run Jest tests
npm run test:cov       # Run with coverage
npm run lint           # Run ESLint
npm run seed-users     # Create test users
npm run seed-config    # Initialize configuration
npm run sync-discharge-summaries  # Sync GCS to Firestore
```

**Frontend:**
```bash
npm run dev            # Start dev server
npm run build          # Build for production
npm run start          # Start production server
npm run lint           # Run linting
```

---

## Summary

The patient portal is a comprehensive, multi-tenant healthcare application with:
1. **Separation of concerns** - Frontend, backend, and services clearly separated
2. **Multi-tenant support** - Full isolation via tenantId
3. **Dual authentication** - JWT + Google OIDC
4. **Robust storage** - Firestore + GCS combo
5. **Modular architecture** - NestJS modules for each feature
6. **FHIR compliance** - Google Cloud Healthcare integration
7. **Scalability** - Cloud Run serverless deployments

