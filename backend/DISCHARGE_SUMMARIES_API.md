# Discharge Summaries API Documentation

## Overview

The Discharge Summaries API provides access to patient discharge summaries stored in Google Cloud Storage (GCS) buckets with metadata indexed in Firestore for efficient querying.

**Base URL**: `http://localhost:3000` (development) or your production URL

**Architecture**:
- **GCS Buckets**: Store raw, simplified, and translated discharge summary files
- **Firestore**: Indexes metadata for fast searching and filtering
- **NestJS Backend**: Provides REST API to access discharge summaries
- **Cloud Functions**: Automatically sync new files from GCS to Firestore

---

## Endpoints

### 1. List Discharge Summaries

Get a paginated list of discharge summaries with optional filtering.

**Endpoint**: `GET /discharge-summaries`

**Query Parameters**:
| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `patientId` | string | Filter by patient ID | `patient_123` |
| `patientName` | string | Filter by patient name (exact match) | `John Smith` |
| `startDate` | string | Filter by admission date (ISO format) | `2024-01-01` |
| `endDate` | string | Filter by admission date (ISO format) | `2024-12-31` |
| `status` | string | Filter by status | `simplified`, `translated` |
| `limit` | number | Number of results per page | `20` (default: 20) |
| `offset` | number | Pagination offset | `0` (default: 0) |
| `orderBy` | string | Order by field | `admissionDate`, `updatedAt` |
| `orderDirection` | string | Order direction | `asc`, `desc` (default: `desc`) |

**Example Request**:
```bash
curl "http://localhost:3000/discharge-summaries?patientName=Smith&status=simplified&limit=10"
```

**Example Response**:
```json
{
  "items": [
    {
      "id": "abc123",
      "patientName": "Adult - DKA discharge",
      "status": "translated",
      "files": {
        "raw": "Adult - DKA discharge.md",
        "simplified": "Adult - DKA discharge-simplified.md",
        "translated": {
          "es": "Adult - DKA discharge-simplified-es.md"
        }
      },
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T12:00:00Z",
      "simplifiedAt": "2024-01-15T11:00:00Z",
      "translatedAt": "2024-01-15T12:00:00Z",
      "metadata": {
        "diagnosis": ["DKA discharge"]
      }
    }
  ],
  "total": 14,
  "limit": 10,
  "offset": 0
}
```

---

### 2. Get Discharge Summary Metadata

Get metadata for a specific discharge summary without content.

**Endpoint**: `GET /discharge-summaries/:id`

**Path Parameters**:
- `id`: Discharge summary ID

**Example Request**:
```bash
curl "http://localhost:3000/discharge-summaries/abc123"
```

**Example Response**:
```json
{
  "id": "abc123",
  "patientName": "Adult - DKA discharge",
  "status": "translated",
  "files": {
    "raw": "Adult - DKA discharge.md",
    "simplified": "Adult - DKA discharge-simplified.md",
    "translated": {
      "es": "Adult - DKA discharge-simplified-es.md"
    }
  },
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T12:00:00Z",
  "simplifiedAt": "2024-01-15T11:00:00Z",
  "translatedAt": "2024-01-15T12:00:00Z"
}
```

---

### 3. Get Discharge Summary Content

Get the full content of a discharge summary (metadata + markdown content).

**Endpoint**: `GET /discharge-summaries/:id/content`

**Path Parameters**:
- `id`: Discharge summary ID

**Query Parameters**:
| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `version` | string | No | Version to retrieve | `raw`, `simplified`, `translated` (default: `simplified`) |
| `language` | string | No | Language for translated version | `es`, `fr`, `de`, etc. |

**Example Request**:
```bash
# Get simplified English version
curl "http://localhost:3000/discharge-summaries/abc123/content?version=simplified"

# Get Spanish translation
curl "http://localhost:3000/discharge-summaries/abc123/content?version=translated&language=es"

# Get raw version
curl "http://localhost:3000/discharge-summaries/abc123/content?version=raw"
```

**Example Response**:
```json
{
  "metadata": {
    "id": "abc123",
    "patientName": "Adult - DKA discharge",
    "status": "translated",
    "files": { ... },
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T12:00:00Z"
  },
  "content": {
    "content": "## Overview\n\n### Reasons for Hospital Stay\n...",
    "version": "simplified",
    "language": "en",
    "fileSize": 6543,
    "lastModified": "2024-01-15T11:00:00Z"
  }
}
```

---

### 4. Get Statistics

Get overview statistics for discharge summaries.

**Endpoint**: `GET /discharge-summaries/stats/overview`

**Example Request**:
```bash
curl "http://localhost:3000/discharge-summaries/stats/overview"
```

**Example Response**:
```json
{
  "firestore": {
    "total": 14,
    "byStatus": {
      "translated": 14,
      "simplified": 0,
      "raw_only": 0
    }
  },
  "gcs": {
    "raw": 35,
    "simplified": 15,
    "translated": 17
  }
}
```

---

### 5. Sync All Files

Manually trigger a full sync of all GCS files to Firestore.

**Endpoint**: `POST /discharge-summaries/sync/all`

**Example Request**:
```bash
curl -X POST "http://localhost:3000/discharge-summaries/sync/all"
```

**Example Response**:
```json
{
  "success": true,
  "synced": 14,
  "failed": 0,
  "errors": []
}
```

---

### 6. Sync Single File

Manually trigger sync of a single file from GCS to Firestore.

**Endpoint**: `POST /discharge-summaries/sync/file`

**Query Parameters**:
- `bucket`: GCS bucket name
- `file`: File name

**Example Request**:
```bash
curl -X POST "http://localhost:3000/discharge-summaries/sync/file?bucket=discharge-summaries-raw&file=Adult%20-%20DKA%20discharge.md"
```

**Example Response**:
```json
{
  "id": "abc123",
  "patientName": "Adult - DKA discharge",
  "status": "raw_only",
  "files": {
    "raw": "Adult - DKA discharge.md"
  },
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:30:00Z"
}
```

---

## Data Models

### DischargeSummaryMetadata

```typescript
{
  id: string;                    // Unique identifier
  patientId?: string;            // Patient identifier
  patientName?: string;          // Patient name
  mrn?: string;                  // Medical Record Number
  encounterId?: string;          // Encounter/admission ID
  admissionDate?: Date;          // Admission date
  dischargeDate?: Date;          // Discharge date
  status: DischargeSummaryStatus;
  files: DischargeSummaryFiles;
  createdAt: Date;
  updatedAt: Date;
  simplifiedAt?: Date;
  translatedAt?: Date;
  metadata?: {
    facility?: string;
    department?: string;
    attendingPhysician?: string;
    diagnosis?: string[];
  };
}
```

### DischargeSummaryStatus

- `raw_only`: Only raw version available
- `simplified`: Simplified version available
- `translated`: Translated version(s) available
- `processing`: Currently being processed
- `error`: Processing error occurred

### DischargeSummaryVersion

- `raw`: Original discharge summary
- `simplified`: Simplified to 9th-10th grade reading level
- `translated`: Translated to another language

### Supported Languages

- `en`: English
- `es`: Spanish
- `fr`: French
- `de`: German
- `it`: Italian
- `pt`: Portuguese
- `ru`: Russian
- `ja`: Japanese
- `ko`: Korean
- `zh`: Chinese
- `hi`: Hindi

---

## Error Responses

All errors follow the FHIR OperationOutcome format:

```json
{
  "statusCode": 404,
  "message": {
    "resourceType": "OperationOutcome",
    "issue": [
      {
        "severity": "error",
        "code": "not-found",
        "details": {
          "text": "Discharge summary not found: abc123"
        }
      }
    ]
  },
  "error": "Not Found"
}
```

**Common Error Codes**:
- `400 Bad Request`: Invalid parameters
- `404 Not Found`: Resource not found
- `500 Internal Server Error`: Server error

---

## Usage Examples

### Frontend Integration (React)

```typescript
// API client
const API_BASE_URL = 'http://localhost:3000';

export async function listDischargeSummaries(query: {
  patientName?: string;
  status?: string;
  limit?: number;
  offset?: number;
}) {
  const params = new URLSearchParams(query as any);
  const response = await fetch(
    `${API_BASE_URL}/discharge-summaries?${params}`
  );
  return response.json();
}

export async function getDischargeSummaryContent(
  id: string,
  version: 'raw' | 'simplified' | 'translated' = 'simplified',
  language?: string
) {
  const params = new URLSearchParams({ version });
  if (language) params.append('language', language);

  const response = await fetch(
    `${API_BASE_URL}/discharge-summaries/${id}/content?${params}`
  );
  return response.json();
}

// Usage in component
const { items } = await listDischargeSummaries({
  status: 'translated',
  limit: 20
});

const summary = await getDischargeSummaryContent(
  items[0].id,
  'translated',
  'es'
);
console.log(summary.content.content); // Markdown content
```

---

## Deployment

### Backend (NestJS)

```bash
cd backend
npm install
npm run build
npm run start:prod
```

### Cloud Functions (Auto-sync)

```bash
cd backend/cloud-functions/firestore-sync
export PROJECT_ID=your-project-id
./deploy.sh
```

### Initial Sync

```bash
cd backend
npm run sync-discharge-summaries
```

---

## Architecture Diagram

```
┌─────────────────┐
│  React Frontend │
│    (Vercel)     │
└────────┬────────┘
         │ HTTPS
         ▼
┌─────────────────────┐
│  NestJS Backend     │
│  (Cloud Run)        │
└──────┬──────┬───────┘
       │      │
       │      └──────────────┐
       ▼                     ▼
┌──────────────┐     ┌──────────────┐
│  Firestore   │     │  GCS Buckets │
│  (Metadata)  │     │  (Content)   │
└──────────────┘     └──────┬───────┘
                             │
                             ▼
                     ┌──────────────┐
                     │ Cloud Function│
                     │  (Auto-sync) │
                     └──────────────┘
```

---

## Next Steps

1. Deploy NestJS backend to Cloud Run
2. Deploy Cloud Functions for auto-sync
3. Run initial sync to populate Firestore
4. Integrate with React frontend
5. Add authentication and authorization
6. Add audit logging for HIPAA compliance
