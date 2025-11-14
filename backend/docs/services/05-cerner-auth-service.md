# Cerner Authentication Service

## Overview

The Cerner Authentication Service handles OAuth2 authentication flows for Cerner's SMART on FHIR integration. It manages SSO initiation, callbacks, token refresh, and session management.

## Business Logic

### Authentication Types

1. **System App**: Backend service account authentication (client credentials)
2. **Provider App**: User-initiated OAuth2 flow (authorization code)

### SSO Flow

1. **Initiation**: Generate authorization URL with state parameter
2. **User Authorization**: User redirected to Cerner login
3. **Callback**: Handle authorization code exchange
4. **Token Storage**: Store tokens in session
5. **Token Refresh**: Automatic refresh before expiration

### Session Management

- Sessions stored in memory (SessionService)
- Session expiration tracking
- Tenant-specific session isolation
- Session statistics and monitoring

## API Endpoints

### GET /auth/launch

Handle SMART on FHIR launch (no tenant ID required).

**Query Parameters:**
- `iss`: Issuer URL (required)
- `launch`: Launch context (required)

**Example:**
```bash
GET /auth/launch?iss=https://fhir-ehr-code.cerner.com/r4/ec2458f2-1e24-41c8-b71b-0e701af7583d&launch=abc123
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Launch initiated successfully",
  "authorization_url": "https://authorization.cerner.com/oauth2/authorize?...",
  "state": "tenant:ec2458f2-1e24-41c8-b71b-0e701af7583d:random123",
  "launch_context": "abc123",
  "issuer": "https://fhir-ehr-code.cerner.com/r4/ec2458f2-1e24-41c8-b71b-0e701af7583d",
  "tenant_id": "ec2458f2-1e24-41c8-b71b-0e701af7583d"
}
```

### GET /auth/cerner/authorize

Initiate Cerner SSO for provider app.

**Query Parameters:**
- `redirect_uri`: Optional, OAuth redirect URI
- `state`: Optional, state parameter for security
- `launch`: Optional, launch context

**Response (200 OK):**
```json
{
  "success": true,
  "authorization_url": "https://authorization.cerner.com/oauth2/authorize?...",
  "state": "generated-state"
}
```

### GET /auth/cerner/callback

Handle Cerner SSO callback (GET - for browser redirects).

**Query Parameters:**
- `code`: Authorization code (required)
- `state`: State parameter (required)
- `session_state`: Session state (optional)
- `error`: Error code (if authorization failed)
- `error_description`: Error description (if authorization failed)

**Response (200 OK):**
```json
{
  "success": true,
  "message": "SSO callback successful",
  "session_id": "session-uuid-123",
  "user_id": "user-123",
  "tenant_id": "ec2458f2-1e24-41c8-b71b-0e701af7583d",
  "auth_type": "provider",
  "expires_at": "2024-01-16T10:00:00Z"
}
```

**Error Response:**
```json
{
  "success": false,
  "message": "Cerner authorization failed",
  "error": "access_denied",
  "error_description": "User denied access"
}
```

### POST /auth/cerner/callback

Handle Cerner SSO callback (POST - for programmatic calls).

**Request Body:**
```json
{
  "code": "authorization-code-123",
  "state": "state-parameter",
  "session_state": "session-state-123"
}
```

**Response:** Same as GET callback.

### POST /auth/cerner/refresh

Refresh provider app tokens.

**Request Body:**
```json
{
  "session_id": "session-uuid-123"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "session_id": "session-uuid-123",
  "tokens": {
    "access_token": "new-access-token",
    "expires_in": 3600,
    "token_type": "Bearer"
  },
  "expires_at": "2024-01-16T11:00:00Z"
}
```

### GET /auth/session/:sessionId

Get session information.

**Response (200 OK):**
```json
{
  "success": true,
  "session": {
    "id": "session-uuid-123",
    "user_id": "user-123",
    "tenant_id": "ec2458f2-1e24-41c8-b71b-0e701af7583d",
    "auth_type": "provider",
    "expires_at": "2024-01-16T10:00:00Z",
    "created_at": "2024-01-16T09:00:00Z",
    "last_accessed_at": "2024-01-16T09:30:00Z",
    "is_valid": true
  }
}
```

### GET /auth/sessions

Get all active sessions for the tenant.

**Query Parameters:**
- `authType`: Optional, filter by auth type ('system' or 'provider')

**Response (200 OK):**
```json
{
  "success": true,
  "sessions": [
    {
      "id": "session-1",
      "user_id": "user-123",
      "auth_type": "provider",
      "expires_at": "2024-01-16T10:00:00Z",
      "created_at": "2024-01-16T09:00:00Z",
      "last_accessed_at": "2024-01-16T09:30:00Z"
    }
  ],
  "count": 1
}
```

### POST /auth/session/:sessionId/revoke

Revoke a session.

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Session revoked successfully",
  "session_id": "session-uuid-123"
}
```

### GET /auth/stats

Get session statistics.

**Response (200 OK):**
```json
{
  "success": true,
  "stats": {
    "total_sessions": 10,
    "active_sessions": 5,
    "expired_sessions": 5,
    "by_auth_type": {
      "system": 3,
      "provider": 2
    },
    "by_tenant": {
      "tenant-1": 3,
      "tenant-2": 2
    }
  }
}
```

## Business Rules

1. **State Parameter**: Generated for security, includes tenant ID
2. **Tenant Extraction**: Tenant ID extracted from ISS URL or state parameter
3. **Session Validation**: Sessions validated before use
4. **Token Refresh**: Automatic refresh before expiration
5. **Error Handling**: Comprehensive error logging and user-friendly messages

## Session Lifecycle

1. **Creation**: Session created on successful callback
2. **Usage**: Session accessed for API calls
3. **Refresh**: Tokens refreshed before expiration
4. **Expiration**: Sessions expire based on token expiration
5. **Revocation**: Sessions can be manually revoked

## Configuration

Requires tenant-specific Cerner provider app config:
- `client_id`: OAuth2 client ID
- `client_secret`: OAuth2 client secret
- `authorization_url`: OAuth2 authorization endpoint
- `token_url`: OAuth2 token endpoint
- `redirect_uri`: OAuth2 redirect URI
- `scopes`: OAuth2 scopes

