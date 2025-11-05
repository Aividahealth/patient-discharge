# Multi-Tenant Implementation Guide

## Overview

This document describes the multi-tenant architecture implemented for the Aivida Patient Discharge platform. The system now supports multiple tenants (hospitals/organizations) with tenant-specific authentication, branding, and configuration.

## Architecture

### URL Structure

The application uses tenant ID as part of the URL path:

```
aividia.com/:tenantId/:portal
```

**Examples:**
- `aividia.com/demo/patient` - Demo tenant, patient portal
- `aividia.com/demo/clinician` - Demo tenant, clinician portal
- `aividia.com/demo/admin` - Demo tenant, admin portal
- `aividia.com/demo/expert` - Demo tenant, expert portal

### Authentication Flow

1. **User visits login page** (`/login`)
2. **Enters credentials:**
   - Tenant ID (e.g., "demo")
   - Username (e.g., "patient", "clinician", "admin", "expert")
   - Password (default: "Adyar2Austin")
3. **Frontend calls** `POST /api/auth/login` with credentials
4. **Backend validates** and returns:
   - JWT token
   - User information (id, name, role)
   - Tenant information (id, name, branding)
5. **Frontend stores** auth data in localStorage and TenantContext
6. **User redirected** to `/:tenantId/:portal` based on role
7. **All subsequent API calls** include:
   - `X-Tenant-ID` header with tenant ID
   - `Authorization: Bearer {token}` header

### HTTP Headers

All authenticated API requests must include:

```
X-Tenant-ID: demo
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Frontend Implementation

### 1. Tenant Context Provider

**Location:** `frontend/contexts/tenant-context.tsx`

Manages global tenant state including:
- Tenant ID (extracted from URL)
- Tenant configuration (branding, features, settings)
- User information
- Authentication token
- Login/logout functions

**Usage:**

```typescript
import { useTenant } from '@/contexts/tenant-context'

function MyComponent() {
  const { tenantId, tenant, user, token, login, logout } = useTenant()

  // Access tenant branding
  const primaryColor = tenant?.branding.primaryColor

  // Check user role
  if (user?.role === 'clinician') {
    // Show clinician-specific features
  }
}
```

### 2. API Client

**Location:** `frontend/lib/api-client.ts`

Centralized HTTP client that automatically includes tenant ID and auth headers.

**Usage:**

```typescript
import { createApiClient } from '@/lib/api-client'
import { useTenant } from '@/contexts/tenant-context'

function MyComponent() {
  const { tenantId, token } = useTenant()
  const apiClient = createApiClient({ tenantId, token })

  // Make API calls
  const data = await apiClient.get('/api/some-endpoint')
  const result = await apiClient.post('/api/another-endpoint', { key: 'value' })
}
```

### 3. Authentication API

**Location:** `frontend/lib/api/auth.ts`

Functions for login and fetching tenant config:

```typescript
import { login, getTenantConfig } from '@/lib/api/auth'

// Login
const authData = await login({
  tenantId: 'demo',
  username: 'patient',
  password: 'Adyar2Austin'
})

// Get tenant configuration
const config = await getTenantConfig('demo', token)
```

### 4. Dynamic Routes

Portal pages are organized under dynamic `[tenantId]` routes:

```
frontend/app/
  [tenantId]/
    patient/
      page.tsx
      layout.tsx
    clinician/
      page.tsx
      layout.tsx
      discharge-summaries/
        page.tsx
    admin/
      page.tsx
      layout.tsx
    expert/
      page.tsx
      review/
        [id]/
          page.tsx
```

## Backend Implementation

### 1. Authentication Endpoints

#### POST /api/auth/login

Simple password-based login for demo/basic auth.

**Request:**

```json
{
  "tenantId": "demo",
  "username": "patient",
  "password": "Adyar2Austin"
}
```

**Response:**

```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 86400,
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
      "logo": "https://storage.googleapis.com/aivida-assets/logos/demo.png",
      "primaryColor": "#3b82f6",
      "secondaryColor": "#60a5fa"
    }
  }
}
```

#### GET /api/config

Get tenant configuration and branding.

**Request Headers:**

```
X-Tenant-ID: demo
Authorization: Bearer {token}
```

**Response:**

```json
{
  "success": true,
  "tenant": {
    "id": "demo",
    "name": "Demo Hospital",
    "status": "active",
    "type": "demo",
    "branding": {
      "logo": "https://storage.googleapis.com/aivida-assets/logos/demo.png",
      "favicon": "https://storage.googleapis.com/aivida-assets/favicons/demo.ico",
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

### 2. Tenant Service

**Location:** `backend/src/tenant/tenant.service.ts`

Extracts and validates tenant ID from request headers:

```typescript
// Required tenant ID
const tenantId = tenantService.extractTenantId(request)

// Optional tenant ID
const tenantId = tenantService.extractTenantIdOptional(request)
```

### 3. Tenant Decorator

**Location:** `backend/src/tenant/tenant.decorator.ts`

NestJS decorator for extracting tenant context:

```typescript
@Get('some-endpoint')
async getSomeData(@TenantContext() ctx: TenantContextType) {
  // ctx.tenantId contains the tenant ID
  // ctx.requestId contains unique request ID
  // ctx.timestamp contains request timestamp
}
```

### 4. CORS Configuration

**Location:** `backend/src/main.ts`

Updated to accept tenant-related headers:

```typescript
res.setHeader('Access-Control-Allow-Headers',
  'Content-Type,Authorization,Accept,X-Tenant-ID,X-Request-ID')
res.setHeader('Access-Control-Expose-Headers',
  'Content-Type,Authorization,X-Tenant-ID,X-Request-ID')
```

## Configuration

### Frontend Environment Variables

**File:** `frontend/.env.local`

```bash
# Backend API URL
NEXT_PUBLIC_API_URL=http://localhost:3000
```

For production:

```bash
NEXT_PUBLIC_API_URL=https://api.aividahealth.ai
```

### Backend Environment Variables

No additional environment variables are required for multi-tenancy. The existing configuration works with the new tenant system.

## Demo Credentials

### Tenant ID
- `demo` (default tenant for testing)

### Users (password for all: `Adyar2Austin`)

1. **Patient Portal**
   - Username: `patient`
   - Role: `patient`

2. **Clinician Portal**
   - Username: `clinician`
   - Role: `clinician`

3. **Admin Portal**
   - Username: `admin`
   - Role: `admin`

4. **Expert Portal**
   - Username: `expert`
   - Role: `expert`

## Testing

### 1. Start Backend

```bash
cd backend
npm install
npm run start:dev
```

Backend runs on: `http://localhost:3000`

### 2. Start Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on: `http://localhost:3001`

### 3. Test Login Flow

1. Visit `http://localhost:3001/login`
2. Enter tenant ID: `demo`
3. Click on any portal button (Patient, Clinician, Admin)
4. Should redirect to `http://localhost:3001/demo/{portal}`
5. Verify auth token is stored in localStorage
6. Verify subsequent API calls include headers

### 4. Test API Endpoints

```bash
# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "demo",
    "username": "patient",
    "password": "Adyar2Austin"
  }'

# Get tenant config (use token from login response)
curl http://localhost:3000/api/config \
  -H "X-Tenant-ID: demo" \
  -H "Authorization: Bearer {token}"
```

## Migration from Old Routes

Old routes will still work for backward compatibility, but should be updated:

| Old Route | New Route |
|-----------|-----------|
| `/patient` | `/demo/patient` |
| `/clinician` | `/demo/clinician` |
| `/admin` | `/demo/admin` |
| `/expert` | `/demo/expert` |

## Security Considerations

### Current Implementation (Demo/Development)

1. **Simple token generation** - Uses base64 encoding (NOT secure for production)
2. **Hardcoded password** - Single password for all users
3. **No token expiration validation** - Tokens are long-lived
4. **No refresh tokens** - Users must re-login when token expires

### Production Requirements

Before going to production, implement:

1. **Proper JWT tokens** - Use `jsonwebtoken` library with secret key
2. **Database authentication** - Store user credentials securely (bcrypt)
3. **Token expiration** - Validate token expiry on every request
4. **Refresh tokens** - Implement token refresh flow
5. **Rate limiting** - Prevent brute force attacks
6. **HTTPS only** - Require secure connections
7. **CSRF protection** - Implement CSRF tokens
8. **Input validation** - Validate all user inputs
9. **SQL injection prevention** - Use parameterized queries
10. **XSS prevention** - Sanitize outputs

## Adding New Tenants

Currently, tenants are mocked in the backend. To add a new tenant:

### 1. Backend

Update `backend/src/auth/auth.controller.ts` in the `simpleLogin` and `getTenantConfig` methods to include the new tenant data.

### 2. Frontend

No changes needed - the system automatically works with any tenant ID.

### 3. Production Database

In production, implement a database table:

```sql
CREATE TABLE tenants (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL,
  type VARCHAR(50) NOT NULL,
  branding JSON,
  features JSON,
  config JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

## Troubleshooting

### Issue: "Tenant ID is required" error

**Solution:** Make sure the `X-Tenant-ID` header is included in the request.

### Issue: Login fails with CORS error

**Solution:** Verify that:
1. Backend CORS allows the frontend origin
2. Headers include `X-Tenant-ID` in allowed headers
3. Frontend is using correct API URL

### Issue: Token not persisted after login

**Solution:** Check browser console for localStorage errors. Ensure cookies/localStorage are enabled.

### Issue: Redirects to wrong portal

**Solution:** Verify the user role in the login response matches the expected portal.

## Future Enhancements

1. **Multi-language support per tenant** - Allow tenants to configure supported languages
2. **Custom branding** - Upload custom logos and color schemes
3. **Tenant-specific features** - Enable/disable features per tenant
4. **Usage analytics** - Track usage per tenant
5. **Billing integration** - Track API usage for billing
6. **White-label support** - Custom domains per tenant
7. **SSO integration** - SAML/OAuth for enterprise tenants
8. **Audit logging** - Track all tenant activities
9. **Data isolation** - Ensure tenant data is completely isolated
10. **Backup/restore** - Tenant-specific backup and restore

## Support

For questions or issues, contact:
- Email: support@aividahealth.ai
- GitHub Issues: https://github.com/anthropics/aivida-discharge/issues
