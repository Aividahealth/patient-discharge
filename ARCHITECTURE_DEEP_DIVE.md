# Patient Discharge Portal: Architecture Deep Dive

**Date:** November 18, 2025
**Scope:** Authentication, Authorization, Multi-Tenancy, Database Schema, API Structure

---

## 1. AUTHENTICATION & AUTHORIZATION STRUCTURE

### 1.1 Authentication Types

The system supports **two authentication mechanisms**:

#### A. App JWT Authentication (Primary)

**Flow:**
```
User Credentials (tenantId, username, password)
        ↓
POST /api/auth/login
        ↓
AuthService.login()
        ↓
- Query Firestore: users collection
  WHERE tenantId = X AND username = Y
- Verify password with bcrypt
- Generate JWT token (HS256)
        ↓
Return JWT + User + Tenant info + Branding
```

**Token Generation:**
- **Algorithm:** HS256 (symmetric)
- **Secret:** From `config.yaml` (jwt_secret) or `JWT_SECRET` env var
- **Duration:** 24 hours (86400 seconds)
- **Payload Structure:**
```typescript
{
  userId: string;          // User document ID
  tenantId: string;        // Multi-tenant identifier
  username: string;        // Login username
  name: string;           // User's display name
  role: UserRole;         // 'admin' | 'clinician' | 'expert' | 'patient'
  linkedPatientId?: string; // For patient users
  exp: number;            // Expiration timestamp (seconds)
  iat: number;            // Issued at timestamp (seconds)
}
```

**File:** `/backend/src/auth/auth.service.ts` (lines 37-132)

#### B. Google OIDC Service-to-Service Authentication

**Use Case:** Cloud Run service-to-service communication

**Verification Process:**
1. Validate token format (must have 3 JWT segments)
2. Decode token header to check algorithm
3. Load service account JSON for client_id validation
4. Verify token signature against Google certificates
5. Check issuer (must be accounts.google.com)
6. Validate email_verified claim
7. Extract email as service identifier

**File:** `/backend/src/auth/auth.service.ts` (lines 159-294)

### 1.2 Authorization & Access Control

#### Guard-Based Protection (AuthGuard)

**Location:** `/backend/src/auth/auth.guard.ts`

**Flow:**
```
Request comes in
        ↓
AuthGuard.canActivate()
        ↓
1. Check if route is @Public()
   → Allow (skip auth)
        ↓
2. Extract & validate Authorization header
   Format: "Bearer {token}"
        ↓
3. Extract X-Tenant-ID header (REQUIRED)
        ↓
4. Try Google OIDC verification
   (if config.service_authn_path exists)
        ↓
5. If OIDC fails, try App JWT verification
   - Verify JWT signature
   - Check token expiration
   - Verify tenantId in token matches X-Tenant-ID header
        ↓
6. If both fail → 401 Unauthorized
        ↓
7. Verify tenant exists in Firestore
   (config collection)
        ↓
8. Attach auth payload to request.auth
   & request.user (for backward compatibility)
```

**Protected Routes vs. Public Routes:**
```
Protected (require @Public() decorator for public access):
- /api/patients/discharge-queue
- /discharge-summaries (most endpoints)
- /clinician/* endpoints
- /admin/* endpoints

Public Routes (@Public() decorator):
- POST /api/auth/login
- POST /expert/feedback
- GET /expert/feedback/:id
- PUT /expert/feedback/:id
- GET /expert/feedback/summary/:summaryId
```

**File:** `/backend/src/auth/auth.guard.ts` (lines 31-179)

#### Role-Based Access Control (RBAC)

Currently implemented at the **API level** through response filtering:

```typescript
export type UserRole = 'patient' | 'clinician' | 'expert' | 'admin';

// Roles have implicit access levels:
// admin    → Full system access
// clinician → Can review discharge summaries
// expert   → Can provide feedback
// patient  → Can view own discharge summary (via linkedPatientId)
```

**Implementation:**
- Roles stored in Firestore `users` collection
- Passed in JWT token payload
- Controllers can check `@CurrentUser() user` to enforce role restrictions
- **Note:** Role-based route guards not yet fully implemented on all endpoints

**File:** `/backend/src/auth/types/user.types.ts`

### 1.3 User Management

#### User Storage (Firestore)

**Collection:** `users`

**Document Structure:**
```typescript
{
  id: string;              // Document ID
  tenantId: string;        // Which tenant owns this user
  username: string;        // Unique per tenant (username + tenantId = unique)
  passwordHash: string;    // bcryptjs hash (10 rounds)
  name: string;           // Display name
  email?: string;         // Optional email
  role: UserRole;         // admin | clinician | expert | patient
  linkedPatientId?: string; // FHIR patient ID (for patient role)
  createdAt: Date;        // Timestamp
  updatedAt: Date;        // Timestamp
}
```

#### User Service (UserService)

**Location:** `/backend/src/auth/user.service.ts`

**Key Methods:**
```typescript
// Find user by tenantId + username
findByUsername(tenantId: string, username: string): Promise<User | null>

// Find user by ID
findById(id: string): Promise<User | null>

// Create new user
create(user: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User>

// Update user
update(id: string, updates: Partial<Omit<User, 'id' | 'createdAt'>>): Promise<User>
```

**Multi-Tenant Isolation:**
- All queries automatically filtered by `tenantId`
- Users cannot access other tenant's users
- Query: `users.where('tenantId', '==', tenantId).where('username', '==', username)`

---

## 2. TENANT MANAGEMENT

### 2.1 Multi-Tenant Architecture

**Key Principle:** Every user, document, and request is associated with a **tenantId**

#### Tenant Context Flow

```
Request arrives
        ↓
TenantContext Decorator extracts X-Tenant-ID header
        ↓
Returns TenantContext object:
{
  tenantId: string;        // From header
  timestamp: Date;         // Request timestamp
  requestId?: string;      // From X-Request-ID header or generated
  userId?: string;         // Populated if authenticated
}
        ↓
Available to all controllers via @TenantContext() parameter
```

**File:** `/backend/src/tenant/tenant.decorator.ts`

#### Tenant Service

**Location:** `/backend/src/tenant/tenant.service.ts`

**Key Methods:**
```typescript
// Required tenant ID (throws error if missing)
extractTenantId(request: Request): string

// Optional tenant ID (returns null if missing)
extractTenantIdOptional(request: Request): string | null

// Validate tenant ID format
isValidTenantId(tenantId: string): boolean
// Allows: alphanumeric, hyphens, underscores
// Example valid: "demo", "hospital-001", "test_tenant"
```

### 2.2 Tenant Configuration

#### Storage Location

Two-tier fallback system:

1. **Firestore (Primary)** - `config` collection
   - Document ID = tenantId
   - Dynamic, updatable at runtime

2. **YAML Config (Fallback)** - `backend/.settings.dev/config.yaml`
   - Static configuration
   - Development/testing

**File:** `/backend/src/config/config.service.ts`

#### Configuration Schema

```typescript
interface TenantConfigResponse {
  id: string;                          // Tenant ID
  name: string;                        // Display name
  status: 'active' | 'inactive' | 'suspended';
  type: string;                        // 'default' | 'custom'
  
  branding: {
    logo: string;                      // Logo URL
    favicon: string;                   // Favicon URL
    primaryColor: string;              // Hex color (#3b82f6)
    secondaryColor: string;            // Hex color (#60a5fa)
    accentColor: string;               // Hex color (#1e40af)
  };
  
  features: {
    aiGeneration: boolean;             // Enable AI-based simplification
    multiLanguage: boolean;            // Enable multi-language support
    supportedLanguages: string[];      // ['en', 'es', 'fr', 'hi', 'de', ...]
    fileUpload: boolean;               // Allow document upload
    expertPortal: boolean;             // Enable expert review portal
    clinicianPortal: boolean;          // Enable clinician portal
    adminPortal: boolean;              // Enable admin portal
  };
  
  config: {
    simplificationEnabled: boolean;    // Process through simplification
    translationEnabled: boolean;       // Process through translation
    defaultLanguage: string;           // Default UI language
  };
}
```

### 2.3 Tenant Isolation Enforcement

**Pattern 1: Query Filtering**
```typescript
// In any service method:
db.collection('documents')
  .where('tenantId', '==', tenantId)  // Always filter by tenant
  .get()
```

**Pattern 2: Tenant Header Validation**
```typescript
// In AuthGuard:
if (jwtPayload.tenantId !== tenantIdHeader) {
  throw new UnauthorizedException(
    'Tenant ID in token does not match X-Tenant-ID header'
  );
}
```

**Pattern 3: Document Structure**
```typescript
// Every document includes tenantId for safety:
{
  id: string;
  tenantId: string;  // ← Always present
  patientName: string;
  // ... other fields
}
```

---

## 3. PORTAL STRUCTURE

### 3.1 Portal Types & Access Patterns

#### A. Patient Portal

**URL Pattern:** `/:tenantId/patient`

**Access:** 
- Requires authentication
- Role: `patient`
- Accesses own records via `linkedPatientId`

**Features:**
- View own discharge summary
- Multi-language support
- Download as PDF
- AI chatbot for Q&A
- Medication tracking
- Follow-up appointments
- Diet and activity guidelines

**Frontend:** `/frontend/app/[tenantId]/patient/page.tsx`

**Backend Endpoint:**
```
GET /api/patients/discharge-queue
Headers: Authorization, X-Tenant-ID
Response: List of patients for current user's tenant
```

#### B. Clinician Portal

**URL Pattern:** `/:tenantId/clinician`

**Access:**
- Requires authentication
- Role: `clinician`

**Features:**
- Review discharge summaries queue
- Compare raw vs. simplified versions
- Review translations
- Track review status
- Provide feedback

**Frontend:** `/frontend/app/[tenantId]/clinician/page.tsx`

#### C. Expert Review Portal

**URL Pattern:** `/:tenantId/expert`

**Access:**
- Requires authentication
- Role: `expert`
- Can also be public (anonymous feedback)

**Features:**
- Review simplification quality
- Review translation accuracy
- Rate discharge summaries
- Flag hallucinations
- Track missing information

**Backend Endpoints:**
```
POST /expert/feedback          (public or authenticated)
GET /expert/feedback/:id       (public)
PUT /expert/feedback/:id       (public)
GET /expert/feedback/summary/:summaryId (public or authenticated)
GET /expert/list              (authenticated)
```

**File:** `/backend/src/expert/expert.controller.ts`

#### D. Admin Portal

**URL Pattern:** `/:tenantId/admin`

**Access:**
- Requires authentication
- Role: `admin`

**Features:**
- User management
- System configuration
- Audit logs (planned)
- Tenant settings

**Frontend:** `/frontend/app/[tenantId]/admin/page.tsx`

### 3.2 Frontend Portal Organization

**Structure:**
```
frontend/app/
├── [tenantId]/
│   ├── patient/
│   │   └── page.tsx
│   ├── clinician/
│   │   ├── page.tsx
│   │   └── discharge-summaries/
│   │       └── page.tsx
│   ├── expert/
│   │   ├── page.tsx
│   │   └── review/
│   │       └── [id]/
│   │           └── page.tsx
│   └── admin/
│       └── page.tsx
├── patient/          (backward compatibility)
├── clinician/        (backward compatibility)
├── expert/           (public expert portal)
└── login/            (authentication page)
```

### 3.3 Frontend Tenant Context Integration

**TenantProvider** provides global state:
```typescript
interface TenantContextType {
  tenantId: string | null;         // From URL
  tenant: Tenant | null;           // Configuration from backend
  user: User | null;               // Authenticated user
  token: string | null;            // JWT token
  isLoading: boolean;              // Loading state
  isAuthenticated: boolean;        // Auth status
  login: (authData: AuthData) => void;
  logout: () => void;
  updateTenant: (tenant: Tenant) => void;
}
```

**Storage:** localStorage
- Key: `aivida_auth` → Full auth data (token, user, tenant)
- Key: `aivida_auth_expiry` → Token expiration time (milliseconds)

**File:** `/frontend/contexts/tenant-context.tsx`

---

## 4. DATABASE SCHEMA

### 4.1 Firestore Collections Overview

```
Firestore Database
├── users/
│   ├── {userId}
│   │   ├── tenantId: string
│   │   ├── username: string
│   │   ├── passwordHash: string
│   │   ├── name: string
│   │   ├── role: UserRole
│   │   ├── linkedPatientId?: string
│   │   ├── createdAt: Date
│   │   └── updatedAt: Date
│   └── ... more users
│
├── config/
│   ├── demo/  (or any tenantId)
│   │   ├── id: string
│   │   ├── name: string
│   │   ├── status: string
│   │   ├── branding: object
│   │   ├── features: object
│   │   ├── config: object
│   │   └── ... more tenants
│
├── discharge_summaries/
│   ├── {summaryId}
│   │   ├── id: string (auto-generated UUID)
│   │   ├── tenantId?: string
│   │   ├── patientId?: string
│   │   ├── patientName?: string
│   │   ├── mrn?: string
│   │   ├── encounterId?: string
│   │   ├── admissionDate?: Date
│   │   ├── dischargeDate?: Date
│   │   ├── status: DischargeSummaryStatus
│   │   ├── files: {
│   │   │     raw?: string
│   │   │     simplified?: string
│   │   │     translated?: {
│   │   │       [language]: string
│   │   │     }
│   │   │   }
│   │   ├── createdAt: Date
│   │   ├── updatedAt: Date
│   │   ├── simplifiedAt?: Date
│   │   ├── translatedAt?: Date
│   │   └── metadata?: object
│   └── ... more summaries
│
├── expert_feedback/
│   ├── {feedbackId}
│   │   ├── dischargeSummaryId: string
│   │   ├── reviewType: 'simplification' | 'translation'
│   │   ├── language?: string
│   │   ├── reviewerName: string
│   │   ├── reviewerHospital?: string
│   │   ├── reviewDate: Date
│   │   ├── overallRating: 1-5
│   │   ├── whatWorksWell: string
│   │   ├── whatNeedsImprovement: string
│   │   ├── specificIssues: string
│   │   ├── hasHallucination: boolean
│   │   ├── hasMissingInfo: boolean
│   │   ├── createdAt: Date
│   │   └── updatedAt?: Date
│   └── ... more feedback
│
└── compositions/ (FHIR data from Google Healthcare)
    ├── {compositionId}
    │   ├── patient_id: string
    │   ├── ...FHIR composition data
    └── ... more compositions
```

### 4.2 Collection Details

#### A. Users Collection

**Index Recommended:**
```
Index on: (tenantId, username)
- Needed for: findByUsername() query
- Uniqueness: Combination of (tenantId, username) should be unique
```

**Example Document:**
```json
{
  "id": "user-demo-clinician-001",
  "tenantId": "demo",
  "username": "clinician1",
  "passwordHash": "$2a$10$...",  // bcryptjs hash
  "name": "Dr. Sarah Johnson",
  "email": "sarah@hospital.com",
  "role": "clinician",
  "createdAt": Timestamp("2024-11-01T10:00:00Z"),
  "updatedAt": Timestamp("2024-11-15T14:30:00Z")
}
```

#### B. Config Collection

**Index:** Document ID = tenantId (for fast lookup)

**Example Document:**
```json
{
  "id": "demo",
  "name": "Demo Hospital",
  "status": "active",
  "type": "default",
  "branding": {
    "logo": "https://storage.googleapis.com/logos/demo.png",
    "favicon": "https://storage.googleapis.com/favicons/demo.ico",
    "primaryColor": "#3b82f6",
    "secondaryColor": "#60a5fa",
    "accentColor": "#1e40af"
  },
  "features": {
    "aiGeneration": true,
    "multiLanguage": true,
    "supportedLanguages": ["en", "es", "fr", "hi", "de"],
    "fileUpload": true,
    "expertPortal": true,
    "clinicianPortal": true,
    "adminPortal": true
  },
  "config": {
    "simplificationEnabled": true,
    "translationEnabled": true,
    "defaultLanguage": "en"
  }
}
```

#### C. Discharge Summaries Collection

**Indexes Recommended:**
```
1. (status, createdAt DESC) - For listing by status
2. (patientName, createdAt DESC) - For search by patient
3. (updatedAt DESC) - For recent summaries
4. (tenantId, status) - For tenant-specific filtering
```

**Example Document:**
```json
{
  "id": "summary-uuid-12345",
  "tenantId": "demo",
  "patientId": "patient-xyz",
  "patientName": "Morgan King",
  "mrn": "MR123456",
  "encounterId": "ENC789",
  "admissionDate": Timestamp("2024-11-10T08:00:00Z"),
  "dischargeDate": Timestamp("2024-11-15T14:00:00Z"),
  "status": "translated",
  "files": {
    "raw": "gs://bucket-raw/Morgan-King-2024-11-15-summary.md",
    "simplified": "gs://bucket-simplified/Morgan-King-2024-11-15-summary-simplified.md",
    "translated": {
      "es": "gs://bucket-translated/Morgan-King-2024-11-15-summary-simplified-es.md",
      "fr": "gs://bucket-translated/Morgan-King-2024-11-15-summary-simplified-fr.md",
      "hi": "gs://bucket-translated/Morgan-King-2024-11-15-summary-simplified-hi.md"
    }
  },
  "createdAt": Timestamp("2024-11-15T14:15:00Z"),
  "updatedAt": Timestamp("2024-11-15T15:30:00Z"),
  "simplifiedAt": Timestamp("2024-11-15T14:45:00Z"),
  "translatedAt": Timestamp("2024-11-15T15:30:00Z"),
  "metadata": {
    "facility": "Cardiac Care Center",
    "department": "ICU",
    "attendingPhysician": "Dr. Jane Smith",
    "diagnosis": ["Myocardial Infarction", "Hypertension"]
  }
}
```

#### D. Expert Feedback Collection

**Indexes Recommended:**
```
1. (dischargeSummaryId, createdAt DESC) - For feedback on specific summary
2. (reviewType, rating) - For feedback filtering
3. (createdAt DESC) - For recent feedback
```

**Example Document:**
```json
{
  "id": "feedback-uuid-67890",
  "dischargeSummaryId": "summary-uuid-12345",
  "reviewType": "simplification",
  "reviewerName": "Dr. Michael Chen",
  "reviewerHospital": "Medical Center",
  "reviewDate": Timestamp("2024-11-16T10:00:00Z"),
  "overallRating": 5,
  "whatWorksWell": "Clear, concise language appropriate for patients",
  "whatNeedsImprovement": "Add more specific follow-up instructions",
  "specificIssues": "Medication dosing could be clearer",
  "hasHallucination": false,
  "hasMissingInfo": false,
  "createdAt": Timestamp("2024-11-16T10:00:00Z"),
  "updatedAt": Timestamp("2024-11-16T10:00:00Z")
}
```

### 4.3 Data Consistency Patterns

**Pattern: Tenant Isolation**
```typescript
// Every query must include tenantId filter:
db.collection('documents')
  .where('tenantId', '==', tenantId)
  .get()
```

**Pattern: Timestamp Management**
```typescript
// Firestore Timestamps (not JavaScript Dates):
{
  createdAt: admin.firestore.Timestamp.now(),
  updatedAt: admin.firestore.Timestamp.now()
}

// When retrieving:
const user = await userDoc.get();
const createdAt = user.data().createdAt.toDate(); // Convert to JS Date
```

**Pattern: Document ID Generation**
```typescript
// For most collections:
const docRef = db.collection('documents').doc();
// Auto-generates UUID

// For config:
const docRef = db.collection('config').doc(tenantId);
// Uses tenantId as document ID
```

---

## 5. API STRUCTURE & ROUTING

### 5.1 Backend Module Architecture

**NestJS Module Organization:**

```
AppModule
├── ConfigModule
│   └── Config Service (Firestore, YAML)
├── AuthModule
│   ├── AuthService
│   ├── UserService
│   ├── AuthGuard (APP_GUARD)
│   └── AuthController
│       └── POST /api/auth/login
├── TenantModule
│   ├── TenantService
│   ├── TenantDecorator (@TenantContext)
│   └── TenantContext (types)
├── GoogleModule
│   ├── GoogleService (FHIR client)
│   ├── PatientsController
│   │   └── GET /api/patients/discharge-queue
│   ├── DischargeUploadController
│   └── CompositionSimplifiedController
├── DischargeSummariesModule
│   ├── DischargeSummariesService
│   ├── FirestoreService
│   ├── GcsService
│   └── DischargeSummariesController
│       ├── GET /discharge-summaries
│       ├── GET /discharge-summaries/:id
│       ├── GET /discharge-summaries/:id/content
│       ├── POST /discharge-summaries/sync/all
│       ├── POST /discharge-summaries/sync/file
│       ├── DELETE /discharge-summaries/:id
│       └── GET /discharge-summaries/stats/overview
├── ExpertModule
│   ├── ExpertService
│   └── ExpertController
│       ├── POST /expert/feedback
│       ├── GET /expert/feedback/:id
│       ├── PUT /expert/feedback/:id
│       ├── GET /expert/feedback/summary/:summaryId
│       └── GET /expert/list
├── CernerModule
│   ├── CernerService
│   └── CernerController
├── CernerAuthModule
├── DischargeExportModule
├── AuditModule
├── SchedulerModule
├── PubSubModule
└── PatientChatbotModule
    ├── PatientChatbotService
    └── PatientChatbotController
        └── POST /api/chat
```

**File:** `/backend/src/app.module.ts`

### 5.2 Authentication Endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `POST` | `/api/auth/login` | Public | Login with credentials |

**Request:**
```json
{
  "tenantId": "demo",
  "username": "clinician1",
  "password": "secure-password"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 86400,
  "user": {
    "id": "user-001",
    "tenantId": "demo",
    "username": "clinician1",
    "name": "Dr. Sarah Johnson",
    "role": "clinician",
    "linkedPatientId": null
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

**File:** `/backend/src/auth/auth.controller.ts` (lines 17-51)

### 5.3 Discharge Summary Endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `GET` | `/discharge-summaries` | Optional | List summaries with filtering |
| `GET` | `/discharge-summaries/:id` | Optional | Get metadata by ID |
| `GET` | `/discharge-summaries/:id/content` | Optional | Get full content |
| `GET` | `/discharge-summaries/stats/overview` | Optional | Get statistics |
| `POST` | `/discharge-summaries/sync/all` | Optional | Sync GCS→Firestore |
| `POST` | `/discharge-summaries/sync/file` | Optional | Sync single file |
| `DELETE` | `/discharge-summaries/:id` | Optional | Delete summary & files |

**Example: Get Content**
```
GET /discharge-summaries/{id}/content?version=simplified&language=es

Headers:
X-Tenant-ID: demo
Authorization: Bearer {token}

Response (200):
{
  "metadata": {
    "id": "summary-123",
    "patientName": "Morgan King",
    "status": "translated",
    "dischargeDate": "2024-11-15T14:00:00Z"
  },
  "content": {
    "content": "# Discharge Instructions\n\n...",
    "version": "simplified",
    "language": "es",
    "fileSize": 2048,
    "lastModified": "2024-11-15T15:30:00Z"
  }
}
```

**File:** `/backend/src/discharge-summaries/discharge-summaries.controller.ts`

### 5.4 Patient Queue Endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `GET` | `/api/patients/discharge-queue` | Required | Get discharge queue |

**Request:**
```
Headers:
Authorization: Bearer {token}
X-Tenant-ID: demo
```

**Response (200):**
```json
{
  "patients": [
    {
      "id": "patient-001",
      "mrn": "12345",
      "name": "Morgan King",
      "room": "ICU-302",
      "unit": "ICU",
      "dischargeDate": "2024-11-15",
      "compositionId": "composition-id",
      "status": "review",
      "attendingPhysician": {
        "name": "Dr. Jane Doe",
        "id": "physician-001"
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

**File:** `/backend/src/google/patients.controller.ts` (lines 17-40)

### 5.5 Expert Feedback Endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `POST` | `/expert/feedback` | Public | Submit feedback |
| `GET` | `/expert/feedback/:id` | Public | Get feedback by ID |
| `PUT` | `/expert/feedback/:id` | Public | Update feedback |
| `GET` | `/expert/feedback/summary/:summaryId` | Public | Get stats for summary |
| `GET` | `/expert/list` | Required | Get review list |

**Example: Submit Feedback**
```
POST /expert/feedback

Body:
{
  "dischargeSummaryId": "summary-123",
  "reviewType": "simplification",
  "reviewerName": "Dr. Michael Chen",
  "overallRating": 5,
  "whatWorksWell": "Clear and concise",
  "whatNeedsImprovement": "Add more details",
  "specificIssues": "Medication dosing unclear",
  "hasHallucination": false,
  "hasMissingInfo": false
}

Response (201):
{
  "success": true,
  "id": "feedback-456",
  "message": "Expert feedback submitted successfully"
}
```

**File:** `/backend/src/expert/expert.controller.ts` (lines 42-96)

### 5.6 Configuration Endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `GET` | `/api/config` | Required | Get tenant config |

**Response (200):**
```json
{
  "success": true,
  "tenant": {
    "id": "demo",
    "name": "Demo Hospital",
    "status": "active",
    "type": "demo",
    "branding": {
      "logo": "https://...",
      "favicon": "https://...",
      "primaryColor": "#3b82f6",
      "secondaryColor": "#60a5fa",
      "accentColor": "#1e40af"
    },
    "features": {
      "aiGeneration": true,
      "multiLanguage": true,
      "supportedLanguages": ["en", "es", "hi", "vi", "fr"],
      "fileUpload": true,
      "expertPortal": true,
      "clinicianPortal": true,
      "adminPortal": true
    },
    "config": {
      "simplificationEnabled": true,
      "translationEnabled": true,
      "defaultLanguage": "en"
    }
  }
}
```

### 5.7 Frontend API Client

**Location:** `/frontend/lib/api-client.ts`

**Features:**
- Automatic tenant ID + auth header injection
- Singleton pattern with instance creation
- Support for GET, POST, PUT, PATCH, DELETE, OPTIONS

**Usage:**
```typescript
import { createApiClient } from '@/lib/api-client'
import { useTenant } from '@/contexts/tenant-context'

function MyComponent() {
  const { tenantId, token } = useTenant()
  const apiClient = createApiClient({ tenantId, token })

  // All requests automatically include:
  // X-Tenant-ID: {tenantId}
  // Authorization: Bearer {token}
  const data = await apiClient.get('/api/some-endpoint')
}
```

**Base URL Resolution (Priority Order):**
1. `NEXT_PUBLIC_API_URL` environment variable
2. `API_URL` environment variable
3. For development: `http://localhost:3000`
4. For production: Cloud Run URL

---

## 6. SECURITY CONSIDERATIONS

### Current Implementation (Development)

| Aspect | Status | Details |
|--------|--------|---------|
| JWT Tokens | ✅ Implemented | HS256, 24-hour expiry, bcryptjs passwords |
| Tenant Isolation | ✅ Implemented | All queries filtered by tenantId |
| CORS | ✅ Configured | Whitelist: aividahealth.ai, localhost:3000/3001 |
| HTTPS | ⚠️ Infrastructure | Enforced at Cloud Run level |
| Rate Limiting | ❌ Not Implemented | Recommended for production |
| Token Refresh | ❌ Not Implemented | Recommended for production |

### Recommended Enhancements for Production

1. **Implement Token Refresh Flow**
   - Add refresh tokens stored in secure httpOnly cookies
   - Implement token refresh endpoint

2. **Add Rate Limiting**
   - Limit login attempts (e.g., 5 per minute)
   - Rate limit API endpoints

3. **Implement Audit Logging**
   - Log all authentication events
   - Track data access by user
   - Store in Firestore `audit_logs` collection

4. **Add Role-Based Route Guards**
   - Implement `@RequireRole('admin')` decorator
   - Apply to all protected endpoints

5. **Secret Management**
   - Use Cloud Secret Manager instead of env vars
   - Rotate JWT secrets periodically

---

## 7. KEY FILES REFERENCE

### Authentication
- **Auth Service:** `/backend/src/auth/auth.service.ts`
- **Auth Controller:** `/backend/src/auth/auth.controller.ts`
- **Auth Guard:** `/backend/src/auth/auth.guard.ts`
- **User Service:** `/backend/src/auth/user.service.ts`
- **User Types:** `/backend/src/auth/types/user.types.ts`

### Tenant Management
- **Tenant Service:** `/backend/src/tenant/tenant.service.ts`
- **Tenant Decorator:** `/backend/src/tenant/tenant.decorator.ts`
- **Tenant Context:** `/backend/src/tenant/tenant-context.ts`
- **Config Service:** `/backend/src/config/config.service.ts`

### Data Models
- **Discharge Summary Types:** `/backend/src/discharge-summaries/discharge-summary.types.ts`
- **Expert Feedback Types:** `/backend/src/expert/expert.types.ts`
- **Tenant Config Interface:** `/backend/src/config/config.service.ts` (lines 6-32)

### Frontend
- **Tenant Context (React):** `/frontend/contexts/tenant-context.tsx`
- **API Client:** `/frontend/lib/api-client.ts`
- **Root Layout:** `/frontend/app/layout.tsx`

### Core Modules
- **App Module:** `/backend/src/app.module.ts`
- **Auth Module:** `/backend/src/auth/auth.module.ts`
- **Tenant Module:** `/backend/src/tenant/tenant.module.ts`
- **Config Module:** `/backend/src/config/config.module.ts`

---

## 8. SUMMARY TABLE

| Aspect | Current State | Storage | Access Pattern |
|--------|--------------|---------|-----------------|
| **Users** | Database | Firestore `users` collection | Query by (tenantId, username) |
| **Tenants** | Database + YAML | Firestore `config` OR `config.yaml` | Document ID = tenantId |
| **Sessions** | In-Memory JWT | Browser localStorage | JWT token (24hr expiry) |
| **Auth Types** | 2 types | JWT + Google OIDC | Header validation |
| **Isolation** | Per-Tenant | Explicit tenantId field | Query filtering |
| **Roles** | 4 types | Firestore `users.role` | JWT payload + header check |

---

**Document Generated:** November 18, 2025
**Last Updated:** Current session
**Status:** Comprehensive Architecture Review
