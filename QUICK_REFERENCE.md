# Quick Reference Guide - Patient Portal Architecture

## Key Endpoints at a Glance

### Authentication
```
POST /api/auth/login
Request:  { tenantId, username, password }
Response: { token, user, tenant }
```

### Discharge Summaries
```
GET    /discharge-summaries
GET    /discharge-summaries/{id}
GET    /discharge-summaries/{id}/content?version=simplified&language=es
GET    /discharge-summaries/stats/overview
POST   /discharge-summaries/sync/all
POST   /discharge-summaries/sync/file
DELETE /discharge-summaries/{id}
```

### Patient Queue
```
GET /api/patients/discharge-queue
Headers: Authorization, X-Tenant-ID
```

### Expert Feedback
```
POST   /expert/feedback
GET    /expert/feedback/{id}
PUT    /expert/feedback/{id}
GET    /expert/feedback/summary/{summaryId}
```

---

## Data Storage Strategy

### Firestore Collections
- `users` - User accounts (encrypted passwords, roles)
- `discharge_summaries` - Metadata only (status, dates, file paths)
- `expert_feedback` - Review scores and comments

### GCS Buckets
- `discharge-summaries-raw` - Original medical documents
- `discharge-summaries-simplified` - AI-simplified versions
- `discharge-summaries-translated` - Multi-language versions

**Why Split?**
- Metadata in Firestore for fast queries
- Files in GCS for scalable storage
- Metadata includes file paths for retrieval

---

## Authentication Flow

```
User Input
    ↓
POST /api/auth/login {tenantId, username, password}
    ↓
Verify password (bcrypt)
Verify tenant exists
Generate JWT (HS256, 24hr expiry)
    ↓
Return token + user + tenant info
    ↓
Frontend stores in localStorage
    ↓
All API calls: Authorization: Bearer {token}
              X-Tenant-ID: {tenantId}
    ↓
AuthGuard validates
- Checks signature
- Checks expiration
- Checks tenantId matches
- Verifies tenant in Firestore
    ↓
Request allowed/denied
```

---

## Portal Access Patterns

### Patient Portal
- View discharge summaries (simplified)
- Download as PDF
- Multi-language support
- Medication checklist
- Chatbot Q&A

### Clinician Portal
- Review discharge queue
- Compare raw vs simplified
- Review translations
- Approve/reject

### Expert Portal
- Provide quality feedback
- Rate simplifications
- Rate translations
- Mark hallucinations

### Admin Portal
- User management
- System configuration
- Audit logs

---

## Storage Access Example

### Get Discharge Summary with Content

```
GET /discharge-summaries/{id}/content?version=simplified

Step 1: Firestore Lookup
  db.collection('discharge_summaries').doc(id).get()
  Returns: {
    id: "abc-123",
    patientName: "Smith, John",
    files: {
      simplified: "john-smith-2024-11-01-summary-simplified.md"
    }
  }

Step 2: Extract File Path
  From metadata.files.simplified

Step 3: GCS Retrieval
  storage.bucket('discharge-summaries-simplified')
         .file('john-smith-2024-11-01-summary-simplified.md')
         .download()

Step 4: Return Combined
  {
    metadata: {...},
    content: {
      content: "# Discharge Summary\n...",
      version: "simplified",
      language: "en",
      fileSize: 1024,
      lastModified: "2024-11-01T10:00:00Z"
    }
  }
```

---

## Multi-Tenant Isolation

### Enforcement Points

1. **Database Level**
   ```typescript
   // All queries include tenantId filter
   where('tenantId', '==', tenantId)
   ```

2. **API Level**
   ```typescript
   // X-Tenant-ID header required
   // Must match tenant in JWT token
   if (token.tenantId !== header['x-tenant-id']) {
     throw 401 Unauthorized
   }
   ```

3. **Configuration Level**
   ```yaml
   tenants:
     demo:
       google: { dataset, fhir_store }
       cerner: { base_url, credentials }
   ```

### Tenant Context Injection
```typescript
@Get('path')
async myHandler(
  @TenantContext() ctx: TenantContextType,  // Injected by decorator
  @CurrentUser() user: any                   // User from auth
) {
  // ctx.tenantId is already validated
  // All queries automatically scoped
}
```

---

## File Organization Reference

### Frontend Structure
```
lib/
  ├── discharge-summaries.ts  - API client (GET/POST/DELETE)
  ├── expert-api.ts           - Expert endpoints (feedback)
  └── parsers/                - Tenant-specific parsers

app/
  ├── patient/                - Patient-facing UI
  ├── clinician/              - Clinician review UI
  ├── expert/                 - Expert feedback UI
  ├── admin/                  - Admin panel
  └── api/                    - Next.js API routes
      ├── chat/               - Chatbot API
      └── discharge-summary/upload/  - File upload
```

### Backend Structure
```
src/
  ├── auth/                   - JWT + Google OIDC
  ├── discharge-summaries/    - Core business logic
  │   ├── firestore.service   - Metadata queries
  │   ├── gcs.service         - File operations
  │   └── controller          - REST endpoints
  ├── expert/                 - Feedback system
  ├── google/                 - FHIR integration
  ├── tenant/                 - Multi-tenant support
  └── config/                 - Configuration
```

---

## Technology Stack Summary

| Layer | Technology | Version |
|-------|-----------|---------|
| **Frontend** | Next.js | 15.2.4 |
| | React | 19 |
| | TypeScript | 5 |
| | Tailwind CSS | 4.1.9 |
| | Radix UI | Latest |
| **Backend** | NestJS | 11 |
| | TypeScript | 5.7.3 |
| | Express | 5 (implicit) |
| **Database** | Firestore | Google Cloud |
| **Storage** | GCS (Cloud Storage) | Google Cloud |
| **Auth** | JWT/bcrypt/Google OIDC | Standard |
| **Messaging** | Pub/Sub | Google Cloud |
| **Healthcare** | FHIR Store | Google Cloud |

---

## Configuration Management

### Config File Location
`/backend/.settings.dev/config.yaml`

### Key Settings
```yaml
jwt_secret: "..."                    # Token signing key
fhir_base_url: "https://..."         # FHIR endpoint
firestore_service_account_path: "..."
service_authn_path: "..."            # Google OIDC

tenants:
  demo:                              # Tenant ID
    google:
      dataset: "aivida-dev"          # GCP dataset
      fhir_store: "aivida"           # FHIR store name
    cerner:
      base_url: "https://..."        # Cerner FHIR endpoint
      system_app: {...}              # OAuth2 credentials
      provider_app: {...}            # User auth credentials
```

---

## Common Development Tasks

### Add New API Endpoint
1. Create controller method in `/src/{module}/{name}.controller.ts`
2. Add service method in `/src/{module}/{name}.service.ts`
3. Define types in `/src/{module}/{name}.types.ts`
4. Add route decorator: `@Get()`, `@Post()`, etc.
5. Mark with `@Public()` if no auth needed, or `@UseGuards(AuthGuard)` if protected

### Query Discharge Summaries
```typescript
// With filtering
await dischargeSummariesService.list({
  patientName: 'Smith',
  status: 'simplified',
  limit: 20
});

// Get with content
await dischargeSummariesService.getWithContent({
  id: 'abc-123',
  version: 'simplified',
  language: 'es'
});
```

### Store in GCS
```typescript
// Files automatically stored in versioned buckets
// Path: {version}/{patientName}-{date}-summary-{simplified}-{language}.md
// Firestore document.files tracks the paths
```

### Add Multi-Language Support
1. Define language code in `DischargeSummaryLanguage` enum
2. Call translation service for new language
3. Store in `discharge-summaries-translated` bucket
4. Update Firestore `files.translated[languageCode]` map
5. Frontend can query with `&language={code}`

---

## Debugging Tips

### Check Authentication
```javascript
// In browser console
localStorage.getItem('token')  // Check token stored
// Decode at https://jwt.io to see payload
```

### Monitor API Calls
```javascript
// Network tab in browser DevTools
// Look for Authorization header and X-Tenant-ID
```

### Firestore Query
```bash
# Via gcloud CLI
gcloud firestore documents list --collection discharge_summaries
```

### GCS Files
```bash
# Via gsutil
gsutil ls gs://discharge-summaries-raw/
gsutil cat gs://discharge-summaries-raw/smith-2024-11-01.md
```

---

## Security Checklist

- [x] JWT tokens include expiration (24 hours)
- [x] Passwords hashed with bcryptjs (10 rounds)
- [x] Multi-tenant isolation enforced
- [x] CORS configured for allowed origins only
- [x] Google OIDC for service-to-service auth
- [x] All API endpoints require Auth (except public ones)
- [x] Sensitive config in .settings.dev/ (gitignored)
- [x] Service accounts use workload identity where possible

---

## Performance Considerations

1. **Firestore Queries**
   - Indexed on: status, patientName, tenantId
   - Pagination: 20 items per page default

2. **GCS Access**
   - Files compressed when possible
   - CDN enabled for global distribution

3. **Caching**
   - Metadata cached in-memory by AuthGuard
   - Token verified once per request

4. **Scaling**
   - Cloud Run auto-scales
   - Firestore scales automatically
   - GCS handles unlimited growth

