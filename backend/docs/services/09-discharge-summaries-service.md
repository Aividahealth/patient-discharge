# Discharge Summaries Service

## Overview

The Discharge Summaries Service provides access to discharge summaries stored in Google Cloud Storage (GCS) with metadata indexed in Firestore. It supports listing, retrieval, content access, and synchronization operations.

## Business Logic

### Storage Architecture

- **GCS Buckets**: Store raw, simplified, and translated discharge summary files
- **Firestore**: Indexes metadata for fast searching and filtering
- **Cloud Functions**: Automatically sync new files from GCS to Firestore

### Content Versions

Supports multiple versions:
- **Raw**: Original discharge summary
- **Simplified**: AI-simplified version
- **Translated**: Translated versions in multiple languages

### Synchronization

- Manual sync: Trigger sync for all files or single file
- Automatic sync: Cloud Functions watch GCS for new files
- Metadata extraction: Extracts patient info, dates, status from files

## API Endpoints

### GET /discharge-summaries

List discharge summaries with filtering and pagination.

**Query Parameters:**
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

**Example Request:**
```bash
GET /discharge-summaries?patientName=Smith&status=simplified&limit=10
```

**Response (200 OK):**
```json
{
  "items": [
    {
      "id": "summary-uuid-123",
      "patientId": "patient-123",
      "patientName": "John Smith",
      "mrn": "MRN123",
      "admissionDate": "2024-01-01",
      "dischargeDate": "2024-01-05",
      "status": "simplified",
      "languages": ["en", "es"],
      "createdAt": "2024-01-05T10:00:00Z",
      "updatedAt": "2024-01-15T11:00:00Z"
    }
  ],
  "total": 45,
  "limit": 10,
  "offset": 0
}
```

### GET /discharge-summaries/:id

Get discharge summary metadata by ID.

**Response (200 OK):**
```json
{
  "id": "summary-uuid-123",
  "patientId": "patient-123",
  "patientName": "John Smith",
  "mrn": "MRN123",
  "admissionDate": "2024-01-01",
  "dischargeDate": "2024-01-05",
  "status": "simplified",
  "languages": ["en", "es"],
  "gcsPaths": {
    "raw": "gs://bucket/raw/summary-123.txt",
    "simplified": "gs://bucket/simplified/summary-123.txt",
    "translated": {
      "es": "gs://bucket/translated/es/summary-123.txt"
    }
  },
  "createdAt": "2024-01-05T10:00:00Z",
  "updatedAt": "2024-01-15T11:00:00Z"
}
```

### GET /discharge-summaries/:id/content

Get discharge summary content.

**Query Parameters:**
- `version`: Content version - 'raw', 'simplified', 'translated' (default: 'simplified')
- `language`: Language code for translated version (required if version='translated')

**Example:**
```bash
GET /discharge-summaries/summary-123/content?version=translated&language=es
```

**Response (200 OK):**
```json
{
  "id": "summary-uuid-123",
  "version": "translated",
  "language": "es",
  "content": "Resumen del alta del paciente...",
  "metadata": {
    "patientName": "John Smith",
    "dischargeDate": "2024-01-05",
    "gcsPath": "gs://bucket/translated/es/summary-123.txt"
  }
}
```

### GET /discharge-summaries/stats/overview

Get discharge summaries statistics.

**Response (200 OK):**
```json
{
  "total": 150,
  "byStatus": {
    "raw": 50,
    "simplified": 75,
    "translated": 25
  },
  "byLanguage": {
    "en": 100,
    "es": 30,
    "hi": 15,
    "vi": 5
  },
  "recentActivity": {
    "last24Hours": 10,
    "last7Days": 45,
    "last30Days": 120
  }
}
```

### POST /discharge-summaries/sync/all

Sync all files from GCS to Firestore.

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Sync completed",
  "synced": 25,
  "failed": 2,
  "duration": "45.2s"
}
```

### POST /discharge-summaries/sync/file

Sync single file from GCS to Firestore.

**Query Parameters:**
- `bucket`: GCS bucket name (required)
- `file`: File path in bucket (required)

**Example:**
```bash
POST /discharge-summaries/sync/file?bucket=discharge-summaries&file=raw/summary-123.txt
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "File synced successfully",
  "fileId": "summary-uuid-123",
  "bucket": "discharge-summaries",
  "fileName": "raw/summary-123.txt"
}
```

### DELETE /discharge-summaries/:id

Delete discharge summary and associated files.

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Discharge summary deleted",
  "id": "summary-uuid-123",
  "filesDeleted": 3
}
```

## Business Rules

1. **Content Versions**: Raw, simplified, and translated versions stored separately
2. **Language Support**: Multiple languages supported per summary
3. **Metadata Indexing**: All metadata indexed in Firestore for fast queries
4. **File Synchronization**: Manual and automatic sync from GCS
5. **Status Tracking**: Status indicates processing stage (raw, simplified, translated)

## Data Model

### Discharge Summary Metadata
```typescript
{
  id: string;
  patientId: string;
  patientName: string;
  mrn: string;
  admissionDate: string;        // ISO date
  dischargeDate: string;         // ISO date
  status: 'raw' | 'simplified' | 'translated';
  languages: string[];           // ISO 639-1 codes
  gcsPaths: {
    raw: string;
    simplified?: string;
    translated?: Record<string, string>;  // language -> path
  };
  createdAt: Date;
  updatedAt: Date;
}
```

