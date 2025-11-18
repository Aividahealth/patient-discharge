# Authentication & Authorization System Design
## Patient Discharge System

**Version:** 1.0
**Date:** 2025-11-18
**Status:** Design Specification

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication Design](#authentication-design)
3. [Authorization Design](#authorization-design)
4. [Database Schema](#database-schema)
5. [API Endpoints](#api-endpoints)
6. [Security Considerations](#security-considerations)
7. [Implementation Plan](#implementation-plan)
8. [Migration Strategy](#migration-strategy)

---

## Overview

This document outlines the design for a comprehensive authentication and authorization system for the patient discharge application, supporting multi-tenant architecture with role-based access control (RBAC).

### Current Stack
- **Backend:** NestJS 11 + TypeScript
- **Frontend:** Next.js 15 + React 19
- **Database:** Google Cloud Firestore
- **Auth Method:** JWT tokens (24-hour expiry)
- **Password Hashing:** bcrypt (10 salt rounds)

### Design Goals
1. Secure username/password authentication with account lockout
2. Preparation for future SSO/OAuth integration
3. Role-based access control with tenant isolation
4. Administrative user management via scripts
5. Minimal user self-service (no signup, no password reset)

---

## Authentication Design

### 1. Authentication Flow

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │ 1. POST /api/auth/login
       │    { username, password, tenantId }
       ▼
┌─────────────────────────────────┐
│      Auth Controller            │
└──────┬──────────────────────────┘
       │ 2. Check failed attempts
       ▼
┌─────────────────────────────────┐
│   Firestore: users collection   │
│   - Get user by username        │
│   - Check failedLoginAttempts   │
│   - Check isLocked              │
└──────┬──────────────────────────┘
       │ 3. If not locked
       ▼
┌─────────────────────────────────┐
│   Password Verification         │
│   - bcrypt.compare()            │
└──────┬──────────────────────────┘
       │ 4. If valid
       ▼
┌─────────────────────────────────┐
│   JWT Generation                │
│   Payload: {                    │
│     userId, username, role,     │
│     tenantId, iat, exp          │
│   }                             │
└──────┬──────────────────────────┘
       │ 5. Return token + user
       ▼
┌─────────────────────────────────┐
│   Client localStorage           │
│   - aivida_auth (token)         │
│   - aivida_auth_expiry          │
└─────────────────────────────────┘
```

### 2. Account Lockout Policy

**Requirements:**
- Lock account after **3 consecutive failed login attempts**
- Locked accounts can only be unlocked by backend script
- Track failed attempt count and last attempt timestamp
- Reset failed attempts counter on successful login

**Implementation Details:**
```typescript
// User document structure
{
  failedLoginAttempts: 0,          // Counter for failed attempts
  lastFailedLoginAt: Timestamp,    // Timestamp of last failed attempt
  isLocked: false,                 // Account lock status
  lockedAt: Timestamp | null,      // When account was locked
  lockedReason: string | null      // Reason for lock
}
```

**Lockout Flow:**
1. On failed login: increment `failedLoginAttempts`
2. If `failedLoginAttempts >= 3`: set `isLocked = true`
3. Before password check: validate `isLocked !== true`
4. On successful login: reset `failedLoginAttempts = 0`

### 3. User Management (No Self-Service)

**User Creation:**
- Backend script generates username and password
- Admin provides credentials to user out-of-band (email, secure message)
- No user registration endpoint exposed

**Password Reset:**
- NOT IMPLEMENTED - no forgot password flow
- Password changes only via backend script
- Future enhancement: allow authenticated users to change own password

**Account Unlock:**
- Backend script to unlock accounts
- Requires admin privileges
- Logs unlock action for audit trail

### 4. Future SSO/OAuth Integration

**Preparation:**
- Keep authentication logic abstracted in `AuthService`
- JWT payload structure supports multiple auth methods
- User model can store `authProvider` field (password, google, azure, etc.)

**Suggested OAuth Flow (Future):**
```typescript
// User model enhancement for OAuth
{
  authProvider: 'password' | 'google' | 'azure' | 'okta',
  ssoId?: string,              // External SSO user ID
  ssoMetadata?: object,        // SSO-specific data
  passwordHash?: string        // Only for password auth
}
```

**OAuth Integration Points:**
1. Add OAuth provider configuration in tenant config
2. Create OAuth callback endpoints: `/api/auth/oauth/callback`
3. Exchange OAuth code for tokens
4. Map external user to internal user record
5. Generate internal JWT for session management

---

## Authorization Design

### 1. Role Hierarchy

```
System Admin (Cross-tenant access)
    │
    ├── Tenant Admin (Tenant-scoped)
    │       │
    │       ├── Expert (Tenant-scoped)
    │       │
    │       ├── Clinician (Tenant-scoped)
    │       │
    │       └── Patient (Tenant + User-scoped)
```

### 2. Role Definitions

| Role | Enum Value | Tenant Scope | Data Access | Portal Access |
|------|-----------|--------------|-------------|---------------|
| **Patient** | `patient` | Single tenant | Own patient records only | Patient Portal |
| **Clinician** | `clinician` | Single tenant | All patients in tenant | Clinician Portal |
| **Expert** | `expert` | Single tenant | All patients in tenant | Expert Portal |
| **Tenant Admin** | `tenant_admin` | Single tenant | All data in tenant | Tenant Admin Portal (TBD) |
| **System Admin** | `system_admin` | ALL tenants | All data across all tenants | System Admin Portal (TBD) |

### 3. Permission Matrix

| Action | Patient | Clinician | Expert | Tenant Admin | System Admin |
|--------|---------|-----------|--------|--------------|--------------|
| View own patient data | ✅ | ✅ | ✅ | ✅ | ✅ |
| View all patients in tenant | ❌ | ✅ | ✅ | ✅ | ✅ |
| Edit patient data | ❌ | ✅ | ✅ | ✅ | ✅ |
| Access patient portal | ✅ | ❌ | ❌ | ✅ | ✅ |
| Access clinician portal | ❌ | ✅ | ❌ | ✅ | ✅ |
| Access expert portal | ❌ | ❌ | ✅ | ✅ | ✅ |
| Manage tenant config | ❌ | ❌ | ❌ | ✅ | ✅ |
| View all tenants | ❌ | ❌ | ❌ | ❌ | ✅ |
| Manage users (script) | ❌ | ❌ | ❌ | ❌ | ✅ |

### 4. Authorization Checks

**Multi-Level Security:**

1. **Authentication Check** (All endpoints)
   - Verify valid JWT token
   - Token not expired
   - User exists and is active

2. **Tenant Isolation** (Tenant-scoped roles)
   - Extract tenantId from JWT payload
   - Validate tenantId matches requested resource
   - Patients, Clinicians, Experts, Tenant Admins: MUST match tenant
   - System Admins: CAN access any tenant

3. **Role-Based Access** (Endpoint-level)
   - Check user role from JWT payload
   - Validate role has permission for requested action
   - Example: Only Clinician/Expert/Tenant Admin/System Admin can access `/api/patients/:id/edit`

4. **Resource-Level Access** (Patient role only)
   - Patients can ONLY access their own patient record
   - Extract `patientId` from user record
   - Validate requested `patientId` matches user's `patientId`

**Authorization Flow:**
```typescript
// Middleware chain
Request
  → AuthGuard (JWT validation)
  → TenantGuard (Tenant isolation check)
  → RoleGuard (Role-based permission)
  → ResourceGuard (Patient-specific check)
  → Controller
```

### 5. Authorization Decorators (NestJS)

```typescript
// Example usage in controllers

// Require authentication only
@UseGuards(AuthGuard)
@Get('/api/config')
getConfig() { ... }

// Require specific roles
@Roles('clinician', 'expert', 'tenant_admin', 'system_admin')
@UseGuards(AuthGuard, RolesGuard)
@Get('/api/patients')
getAllPatients() { ... }

// Require system admin only
@Roles('system_admin')
@UseGuards(AuthGuard, RolesGuard)
@Get('/api/admin/tenants')
getAllTenants() { ... }

// Patient can only access own data
@Roles('patient', 'clinician', 'expert', 'tenant_admin', 'system_admin')
@UseGuards(AuthGuard, RolesGuard, PatientResourceGuard)
@Get('/api/patient/:patientId/composition/:compositionId')
getPatientComposition(@Param('patientId') patientId: string) { ... }
```

---

## Database Schema

### 1. Users Collection (`users`)

**Firestore Document Path:** `/users/{userId}`

```typescript
interface User {
  // Identity
  id: string;                      // Firestore document ID
  username: string;                // Unique username (indexed)
  email?: string;                  // Optional email

  // Authentication
  passwordHash: string;            // bcrypt hash
  authProvider: 'password' | 'oauth'; // Auth method (future)
  ssoId?: string;                  // External SSO ID (future)

  // Account Status
  isActive: boolean;               // Account enabled/disabled
  isLocked: boolean;               // Account locked due to failed attempts
  lockedAt?: Timestamp;            // When account was locked
  lockedReason?: string;           // Reason for lock

  // Failed Login Tracking
  failedLoginAttempts: number;     // Counter (0-3)
  lastFailedLoginAt?: Timestamp;   // Last failed attempt
  lastSuccessfulLoginAt?: Timestamp; // Last successful login

  // Authorization
  role: 'patient' | 'clinician' | 'expert' | 'tenant_admin' | 'system_admin';
  tenantId: string | null;         // Null for system_admin only
  patientId?: string;              // Only for patient role

  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy?: string;              // Admin who created user
  lastUpdatedBy?: string;          // Admin who last modified
}
```

**Firestore Indexes:**
```typescript
// Required composite indexes
users:
  - username (unique)
  - tenantId + role
  - tenantId + isActive
  - isLocked
```

### 2. Config Collection (`config`)

**Firestore Document Path:** `/config/{tenantId}`

```typescript
interface TenantConfig {
  // Existing fields...
  tenantId: string;
  tenantName: string;
  branding: { ... };

  // Auth Configuration (New)
  auth?: {
    // SSO settings (future)
    ssoEnabled: boolean;
    ssoProvider?: 'google' | 'azure' | 'okta';
    ssoClientId?: string;
    ssoMetadata?: object;

    // Password policy
    passwordPolicy?: {
      minLength: number;           // Default: 8
      requireUppercase: boolean;   // Default: true
      requireLowercase: boolean;   // Default: true
      requireNumbers: boolean;     // Default: true
      requireSpecialChars: boolean; // Default: false
    };

    // Session settings
    sessionDuration: number;       // JWT expiry in seconds (default: 86400)
  };
}
```

### 3. Audit Logs Collection (New)

**Firestore Document Path:** `/audit_logs/{logId}`

```typescript
interface AuditLog {
  id: string;
  timestamp: Timestamp;
  tenantId: string | null;         // Null for system-level actions

  // Actor
  userId?: string;
  username?: string;
  role?: string;

  // Action
  action: 'login' | 'logout' | 'failed_login' | 'account_locked' |
          'account_unlocked' | 'user_created' | 'password_changed' |
          'data_accessed' | 'data_modified';

  // Target
  targetType?: 'user' | 'patient' | 'config' | 'fhir_resource';
  targetId?: string;

  // Details
  details?: object;
  ipAddress?: string;
  userAgent?: string;

  // Result
  success: boolean;
  errorMessage?: string;
}
```

---

## API Endpoints

### 1. Authentication Endpoints

#### POST `/api/auth/login`
**Description:** Authenticate user and return JWT token

**Request:**
```json
{
  "username": "clinician",
  "password": "SecurePassword123",
  "tenantId": "demo"
}
```

**Success Response (200):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 86400,
  "user": {
    "id": "user123",
    "username": "clinician",
    "role": "clinician",
    "tenantId": "demo"
  },
  "tenant": {
    "tenantId": "demo",
    "tenantName": "Demo Hospital"
  }
}
```

**Error Responses:**
- `400` - Invalid credentials
- `403` - Account locked
- `404` - User not found

#### POST `/api/auth/logout`
**Description:** Invalidate token (client-side only, stateless JWT)

**Headers:**
```
Authorization: Bearer {token}
```

**Response (200):**
```json
{
  "message": "Logged out successfully"
}
```

#### GET `/api/auth/me`
**Description:** Get current authenticated user info

**Headers:**
```
Authorization: Bearer {token}
X-Tenant-ID: demo
```

**Response (200):**
```json
{
  "id": "user123",
  "username": "clinician",
  "role": "clinician",
  "tenantId": "demo",
  "isActive": true
}
```

### 2. Protected Endpoints (Examples)

#### GET `/api/patients`
**Roles:** `clinician`, `expert`, `tenant_admin`, `system_admin`
**Tenant Isolation:** Yes (except system_admin)

**Returns:** All patients in the user's tenant

#### GET `/api/patient/:patientId/composition/:compositionId`
**Roles:** All roles
**Tenant Isolation:** Yes (except system_admin)
**Resource Guard:** Patients can only access their own `patientId`

**Returns:** Patient discharge composition

#### GET `/api/admin/tenants` (Future)
**Roles:** `system_admin` only
**Tenant Isolation:** No (cross-tenant)

**Returns:** List of all tenants

#### GET `/api/admin/users` (Future)
**Roles:** `tenant_admin` (own tenant), `system_admin` (all tenants)
**Tenant Isolation:** Yes for tenant_admin

**Returns:** List of users

---

## Security Considerations

### 1. Password Security

**Current Implementation:**
- bcrypt hashing with 10 salt rounds ✅
- Passwords not stored in plaintext ✅

**Recommendations:**
- Increase salt rounds to 12 for better security
- Enforce password complexity via policy
- Consider password expiration policy (90 days)

### 2. JWT Token Security

**Current Implementation:**
- HS256 signing algorithm ✅
- 24-hour expiration ✅
- Secret key from environment variable ✅

**Vulnerabilities:**
- No refresh token mechanism ❌
- No token revocation/blacklist ❌
- Stateless tokens can't be invalidated before expiry ❌

**Recommendations:**
- Implement refresh tokens for better UX
- Add token blacklist in Redis/Firestore for logout
- Consider shorter access token expiry (1-2 hours)

### 3. Account Lockout

**Security Benefits:**
- Prevents brute force attacks ✅
- Forces admin intervention for unlock ✅
- Audit trail of lockout events ✅

**Implementation:**
- Lock after 3 failed attempts ✅
- Track lockout timestamp and reason ✅
- Unlock only via admin script ✅

### 4. Tenant Isolation

**Current Implementation:**
- TenantId in JWT payload ✅
- TenantId validation in AuthGuard ✅
- Firestore queries filtered by tenantId ✅

**Additional Safeguards:**
- Double-check tenantId in all Firestore queries
- System admin role can bypass tenant checks
- Audit log all cross-tenant access by system admins

### 5. CORS and API Security

**Current Implementation:**
- CORS whitelist configured ✅
- Request origin validation ✅

**Recommendations:**
- Add rate limiting on login endpoint (prevent brute force)
- Implement CSRF protection for state-changing operations
- Add request signing for critical operations
- Monitor and alert on suspicious activity

### 6. Audit Logging

**Recommended Events to Log:**
- All login attempts (success and failure)
- Account lockouts and unlocks
- Password changes
- User creation and deletion
- Role changes
- Cross-tenant access by system admins
- Critical data access and modifications

**Log Retention:**
- Keep logs for minimum 90 days
- Archive older logs to Cloud Storage
- Enable log analysis for security monitoring

---

## Implementation Plan

### Phase 1: Core Authentication Enhancements

**Tasks:**
1. ✅ Update User model schema with lockout fields
2. ✅ Implement failed login tracking in AuthService
3. ✅ Add account lockout logic (3 failed attempts)
4. ✅ Update login endpoint to check lockout status
5. ✅ Add audit logging for authentication events

**Deliverables:**
- Updated `backend/src/auth/user.service.ts`
- Updated `backend/src/auth/auth.service.ts`
- Updated `backend/src/auth/auth.controller.ts`
- New audit logging utility

**Estimated Time:** 2-3 days

### Phase 2: User Management Scripts

**Tasks:**
1. ✅ Create script to create users with generated passwords
2. ✅ Create script to unlock locked accounts
3. ✅ Create script to change user passwords
4. ✅ Create script to list users by tenant
5. ✅ Add CLI arguments and documentation

**Deliverables:**
- `backend/scripts/create-user.ts`
- `backend/scripts/unlock-user.ts`
- `backend/scripts/change-password.ts`
- `backend/scripts/list-users.ts`
- `backend/scripts/README.md`

**Estimated Time:** 1-2 days

### Phase 3: Role-Based Authorization

**Tasks:**
1. ✅ Update role enum to include `tenant_admin` and `system_admin`
2. ✅ Create RolesGuard decorator
3. ✅ Create TenantGuard for tenant isolation
4. ✅ Create PatientResourceGuard for patient-specific access
5. ✅ Apply guards to all protected endpoints
6. ✅ Update existing seed data with new roles

**Deliverables:**
- `backend/src/auth/guards/roles.guard.ts`
- `backend/src/auth/guards/tenant.guard.ts`
- `backend/src/auth/guards/patient-resource.guard.ts`
- `backend/src/auth/decorators/roles.decorator.ts`
- Updated controllers with guard annotations

**Estimated Time:** 2-3 days

### Phase 4: Frontend Updates

**Tasks:**
1. ✅ Update TenantContext to handle new roles
2. ✅ Add role-based UI rendering
3. ✅ Update AuthGuard component for role checks
4. ✅ Add account locked error handling
5. ✅ Update login form with better error messages

**Deliverables:**
- Updated `frontend/contexts/tenant-context.tsx`
- Updated `frontend/components/auth-guard.tsx`
- Updated login page components
- Role-based navigation components

**Estimated Time:** 1-2 days

### Phase 5: Testing & Documentation

**Tasks:**
1. ✅ Unit tests for authentication logic
2. ✅ Integration tests for authorization guards
3. ✅ E2E tests for login flows
4. ✅ Security testing (brute force, tenant isolation)
5. ✅ Update API documentation
6. ✅ Create user management guide

**Deliverables:**
- Test suite for auth module
- Security test report
- Updated API documentation
- Administrator guide

**Estimated Time:** 2-3 days

### Phase 6: Future Enhancements (Optional)

**Tasks:**
1. ⏳ OAuth/SSO integration
2. ⏳ Refresh token mechanism
3. ⏳ Token blacklist for logout
4. ⏳ Password expiration policy
5. ⏳ Self-service password change (for authenticated users)
6. ⏳ Two-factor authentication (2FA)

**Estimated Time:** 4-6 weeks

---

## Migration Strategy

### Step 1: Database Migration

**Goal:** Update existing user documents with new fields

**Script:** `backend/scripts/migrate-users.ts`

```typescript
// Pseudocode
for each user in users collection:
  if (!user.failedLoginAttempts) {
    user.failedLoginAttempts = 0;
    user.isLocked = false;
    user.isActive = true;
    user.authProvider = 'password';

    // Rename 'admin' role to 'tenant_admin'
    if (user.role === 'admin') {
      user.role = 'tenant_admin';
    }

    save(user);
  }
```

**Safety:**
- Backup Firestore data before migration
- Run migration on staging environment first
- Validate data after migration
- Keep rollback script ready

### Step 2: Backend Deployment

**Steps:**
1. Deploy new backend code with feature flags disabled
2. Run database migration script
3. Verify migration success
4. Enable new authentication features
5. Monitor for errors

**Rollback Plan:**
- Revert backend deployment
- Restore Firestore backup if needed
- Document issues for fixing

### Step 3: Frontend Deployment

**Steps:**
1. Deploy new frontend code
2. Clear user browser cache (announce to users)
3. Users must re-login to get new tokens
4. Monitor for login issues

**Rollback Plan:**
- Revert frontend deployment
- Backend is backward compatible

### Step 4: Validation

**Checks:**
- ✅ Existing users can log in successfully
- ✅ Failed login attempts are tracked
- ✅ Account lockout works after 3 failures
- ✅ Tenant isolation is enforced
- ✅ Role-based access works correctly
- ✅ Audit logs are created

---

## Appendix

### A. Environment Variables

```bash
# backend/.env

# JWT Configuration
JWT_SECRET=your-secret-key-here
JWT_EXPIRES_IN=86400  # 24 hours in seconds

# Firestore
GOOGLE_CLOUD_PROJECT=your-project-id
FIRESTORE_EMULATOR_HOST=localhost:8080  # For local dev

# Security
BCRYPT_SALT_ROUNDS=12
MAX_LOGIN_ATTEMPTS=3

# CORS
CORS_ORIGIN=http://localhost:3000,https://yourdomain.com
```

### B. Sample User Creation

```bash
# Create a new clinician
npm run script:create-user \
  --username=doctor.smith \
  --role=clinician \
  --tenantId=acme-hospital \
  --email=smith@acme.com

# Output:
# ✅ User created successfully!
# Username: doctor.smith
# Password: xK9#mP2$qL5@wN8!
# Role: clinician
# Tenant: acme-hospital
#
# ⚠️  Save this password securely! It cannot be retrieved later.
```

### C. Sample Account Unlock

```bash
# Unlock a locked account
npm run script:unlock-user \
  --username=doctor.smith \
  --tenantId=acme-hospital

# Output:
# ✅ Account unlocked successfully!
# Username: doctor.smith
# Failed attempts reset to: 0
# Locked status: false
```

### D. Role Usage Examples

```typescript
// Patient accessing own data
GET /api/patient/patient123/composition/comp456
Headers: {
  Authorization: "Bearer <patient_token>",
  X-Tenant-ID: "demo"
}
// ✅ Allowed if patientId matches token

// Clinician accessing any patient in tenant
GET /api/patients
Headers: {
  Authorization: "Bearer <clinician_token>",
  X-Tenant-ID: "demo"
}
// ✅ Returns all patients in "demo" tenant

// System admin accessing different tenant
GET /api/patients
Headers: {
  Authorization: "Bearer <system_admin_token>",
  X-Tenant-ID: "acme-hospital"
}
// ✅ Allowed - system admin can access any tenant

// Tenant admin trying to access different tenant
GET /api/patients
Headers: {
  Authorization: "Bearer <tenant_admin_token>",  // tenantId: demo
  X-Tenant-ID: "acme-hospital"
}
// ❌ Forbidden - tenant mismatch
```

---

## Summary

This design provides:

✅ **Secure Authentication**
- Username/password with bcrypt hashing
- Account lockout after 3 failed attempts
- JWT-based sessions
- Prepared for future OAuth/SSO integration

✅ **Fine-Grained Authorization**
- 5 role types with clear permission boundaries
- Tenant isolation for multi-tenancy
- Resource-level access control for patients
- System admin with cross-tenant access

✅ **Administrative Control**
- Backend scripts for user management
- No self-service user registration
- No password reset flow (admin-controlled)
- Audit logging for compliance

✅ **Scalability & Maintainability**
- Clean separation of concerns
- Reusable guards and decorators
- Easy to extend for future requirements
- Compatible with existing architecture

**Next Steps:** Review this design, approve, and proceed with implementation phases.
