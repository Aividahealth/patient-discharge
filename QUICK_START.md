# Multi-Tenant Quick Start Guide

## What Changed

Your application is now **multi-tenant**! Each hospital/organization (tenant) has its own isolated space.

## New URL Structure

**Before:**
```
aividia.com/patient
aividia.com/clinician
```

**After:**
```
aividia.com/:tenantId/patient
aividia.com/:tenantId/clinician

Example: aividia.com/demo/patient
```

## Quick Test

### 1. Start Both Services

**Terminal 1 - Backend:**
```bash
cd backend
npm run start:dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

### 2. Login

1. Visit: `http://localhost:3001/login`
2. Enter Tenant ID: `demo`
3. Click any portal button
4. You'll be redirected to: `http://localhost:3001/demo/{portal}`

### 3. Test API

The login page now calls your backend at `http://localhost:3000/api/auth/login`

## Files Created

### Frontend
- ✅ `contexts/tenant-context.tsx` - Manages tenant state
- ✅ `lib/api-client.ts` - API client with headers
- ✅ `lib/api/auth.ts` - Auth functions
- ✅ `app/[tenantId]/patient/page.tsx` - Dynamic patient route
- ✅ `app/[tenantId]/clinician/page.tsx` - Dynamic clinician route
- ✅ `app/[tenantId]/admin/page.tsx` - Dynamic admin route
- ✅ `app/[tenantId]/expert/page.tsx` - Dynamic expert route

### Backend
- ✅ Updated `src/auth/auth.controller.ts` - Added login & config endpoints
- ✅ Updated `src/main.ts` - Added X-Tenant-ID to CORS
- ✅ Updated `src/tenant/tenant.service.ts` - Optional tenant extraction
- ✅ Updated `src/tenant/tenant.decorator.ts` - Optional tenant context

## Key Concepts

### 1. Tenant Context (Frontend)

```typescript
import { useTenant } from '@/contexts/tenant-context'

function MyComponent() {
  const { tenantId, user, token } = useTenant()
  // tenantId: "demo"
  // user: { id, name, role, ... }
  // token: "eyJ..."
}
```

### 2. API Calls (Frontend)

```typescript
import { createApiClient } from '@/lib/api-client'
import { useTenant } from '@/contexts/tenant-context'

const { tenantId, token } = useTenant()
const api = createApiClient({ tenantId, token })

// Automatically includes X-Tenant-ID and Authorization headers
const data = await api.get('/api/some-endpoint')
```

### 3. Tenant Validation (Backend)

```typescript
@Get('some-endpoint')
async getData(@TenantContext() ctx: TenantContextType) {
  // ctx.tenantId is automatically extracted from X-Tenant-ID header
  return this.service.getData(ctx.tenantId)
}
```

## HTTP Headers

All authenticated API requests automatically include:

```
X-Tenant-ID: demo
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Testing the Backend

### Test Login Endpoint

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "demo",
    "username": "patient",
    "password": "Adyar2Austin"
  }'
```

Expected response:
```json
{
  "success": true,
  "token": "eyJ...",
  "user": { "id": "user-demo-patient", ... },
  "tenant": { "id": "demo", ... }
}
```

### Test Config Endpoint

```bash
# Replace {TOKEN} with token from login response
curl http://localhost:3000/api/config \
  -H "X-Tenant-ID: demo" \
  -H "Authorization: Bearer {TOKEN}"
```

## Common Issues

### ❌ "Tenant ID is required"
- **Cause:** Missing `X-Tenant-ID` header
- **Fix:** Use the API client, it adds headers automatically

### ❌ CORS error
- **Cause:** Frontend origin not allowed
- **Fix:** Check `backend/src/main.ts` - add your origin to `allowedOrigins`

### ❌ Login redirects to `/undefined/patient`
- **Cause:** Tenant ID not set
- **Fix:** Make sure you enter a tenant ID in the login form

## Demo Credentials

| Tenant ID | Username | Password | Role |
|-----------|----------|----------|------|
| demo | patient | Adyar2Austin | patient |
| demo | clinician | Adyar2Austin | clinician |
| demo | admin | Adyar2Austin | admin |
| demo | expert | Adyar2Austin | expert |

## What's Next?

1. **Test the login flow** - Make sure it works end-to-end
2. **Update existing API calls** - Use the new API client
3. **Add tenant branding** - Customize colors/logos per tenant
4. **Add database storage** - Store tenants in a real database
5. **Add proper JWT** - Replace base64 tokens with real JWTs

## Need Help?

- Read full docs: `/MULTI_TENANT_IMPLEMENTATION.md`
- Check API specs: `/frontend/APISpecs.md`
- Report issues: Create a GitHub issue

---

**Remember:** The old routes (`/patient`, `/clinician`) still exist but won't have tenant context. Always use the new routes (`/demo/patient`) for multi-tenant features!
