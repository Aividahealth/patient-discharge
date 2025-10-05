# Environment Configuration

This document describes the environment variables used in the discharge summaries application.

## API Configuration

### `NEXT_PUBLIC_API_URL`
- **Description**: The base URL for the discharge summaries API (Google Cloud Backend)
- **Type**: String
- **Default**: `https://patient-discharge-backend-qnzythtpnq-uc.a.run.app` (production) or `http://localhost:3000` (development)
- **Example**: `https://patient-discharge-backend-qnzythtpnq-uc.a.run.app`
- **Usage**: Primary API endpoint for production (Google Cloud Run)

### `API_URL`
- **Description**: Alternative API URL (fallback)
- **Type**: String
- **Default**: `https://patient-discharge-backend-qnzythtpnq-uc.a.run.app` (production) or `http://localhost:3000` (development)
- **Example**: `https://patient-discharge-backend-qnzythtpnq-uc.a.run.app`
- **Usage**: Used if NEXT_PUBLIC_API_URL is not set

## Google Cloud Storage Configuration (Optional)

### `GOOGLE_CLOUD_PROJECT_ID`
- **Description**: Google Cloud Project ID
- **Type**: String
- **Example**: `aivida-health-123456`

### `GOOGLE_CLOUD_CLIENT_EMAIL`
- **Description**: Service account email for GCS access
- **Type**: String
- **Example**: `discharge-api@aivida-health-123456.iam.gserviceaccount.com`

### `GOOGLE_CLOUD_PRIVATE_KEY`
- **Description**: Service account private key for GCS access
- **Type**: String
- **Example**: `"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"`

## Environment Setup Examples

### Development
```bash
# .env.local
NEXT_PUBLIC_API_URL=http://localhost:3000
```

### Production (Google Cloud Run)
```bash
# .env.production
NEXT_PUBLIC_API_URL=https://patient-discharge-backend-qnzythtpnq-uc.a.run.app
```

### Staging (Google Cloud Run)
```bash
# .env.staging
NEXT_PUBLIC_API_URL=https://patient-discharge-backend-staging-qnzythtpnq-uc.a.run.app
```

## API Endpoints

The application expects the following API endpoints to be available:

- `GET /discharge-summaries` - List discharge summaries
- `GET /discharge-summaries/{id}` - Get specific discharge summary
- `GET /discharge-summaries/{id}/content` - Get discharge summary content
- `GET /discharge-summaries/stats/overview` - Get statistics
- `POST /discharge-summaries/sync/all` - Sync all summaries
- `POST /discharge-summaries/sync/file` - Sync specific file
- `DELETE /discharge-summaries/{id}` - Delete discharge summary
