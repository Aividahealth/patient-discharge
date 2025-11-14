# Authentication Service

## Overview

The Authentication Service provides user authentication and authorization for the application. It supports two authentication methods:

1. **User Authentication**: Password-based login with JWT tokens
2. **Service Account Authentication**: Google OIDC ID token verification

## Business Logic

### Authentication Decision Tree

The `AuthGuard` implements a decision tree for authentication:

1. **Check Authorization Header**: If missing → 401 Unauthorized
2. **Try Google OIDC Verification**:
   - Verifies JWT signature against Google certificates
   - Checks `iss`, `aud`, `email_verified`
   - If valid → `req.auth = { type: 'service', email, tenantId }`
3. **Try App JWT Verification** (if OIDC fails):
   - Verifies JWT signature with app secret
   - Checks expiration, tenantId match
   - If valid → `req.auth = { type: 'user', userId, username, name, role, tenantId }`
4. **If Both Fail**: → 401 Unauthorized

### User Authentication Flow

1. User submits credentials (tenantId, username, password)
2. System looks up user in Firestore by tenantId + username
3. Password is verified using bcrypt
4. Tenant configuration is validated
5. JWT token is generated with user claims
6. Token expires in 24 hours

### Service Account Authentication Flow

1. Service account generates Google OIDC ID token
2. Token is verified against Google's public certificates
3. Token claims are validated (iss, aud, email_verified)
4. Email is extracted and set in `req.auth`

## API Endpoints

### POST /api/auth/login

User login endpoint that authenticates users and returns a JWT token.

**Request Body:**
```json
{
  "tenantId": "demo",
  "username": "patient",
  "password": "Adyar2Austin"
}
```

**Response (200 OK):**
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
      "logo": "https://storage.googleapis.com/logos/demo.png",
      "primaryColor": "#3b82f6",
      "secondaryColor": "#60a5fa"
    }
  }
}
```

**Error Responses:**

- **400 Bad Request**: Missing required fields
- **401 Unauthorized**: Invalid credentials or tenant not found
- **500 Internal Server Error**: Login processing failed

## Authentication Headers

All protected endpoints require:

1. **Authorization**: `Bearer <token>`
   - For user auth: JWT token from `/api/auth/login`
   - For service auth: Google OIDC ID token

2. **X-Tenant-ID**: `<tenant-id>`
   - Required for all authenticated requests
   - Must match tenantId in token (for user auth)

## Request Authentication Object

After successful authentication, `req.auth` is set with:

**For User Authentication:**
```typescript
{
  type: 'user',
  userId: string,
  username: string,
  name: string,
  role: string,
  tenantId: string
}
```

**For Service Authentication:**
```typescript
{
  type: 'service',
  email: string,
  tenantId: string
}
```

## Public Endpoints

Endpoints marked with `@Public()` decorator skip authentication:
- `POST /api/auth/login` - Login endpoint
- `POST /expert/feedback` - Expert feedback submission
- `GET /expert/feedback/:id` - Get feedback by ID
- `PUT /expert/feedback/:id` - Update feedback
- `GET /expert/feedback/summary/:summaryId` - Get feedback for summary

## Security Features

- Passwords are hashed using bcrypt (10 salt rounds)
- JWT tokens are signed with configurable secret
- Token expiration enforced (24 hours for user tokens, 1 hour for service tokens)
- Tenant ID validation ensures users can only access their tenant's resources
- Google OIDC tokens verified against Google's public certificates

## Configuration

Authentication requires:
- `jwt_secret` in `config.yaml` or `JWT_SECRET` environment variable
- `service_authn_path` in `config.yaml` for Google OIDC verification
- Firestore access for user lookup and tenant configuration

