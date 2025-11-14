# Composition Simplified Service

## Overview

The Composition Simplified Service handles writing simplified and translated content back to the FHIR store. It creates Binary resources with appropriate tags and links them to Composition resources.

## Business Logic

### Content Processing Flow

1. Receive simplified/translated content
2. Create or update Binary resources in FHIR store
3. Tag Binary resources appropriately:
   - `discharge-summary-simplified` for simplified summaries
   - `discharge-instructions-simplified` for simplified instructions
   - `discharge-summary-translated` for translated summaries
   - `discharge-instructions-translated` for translated instructions
4. Link Binary resources to Composition sections
5. Optionally store content in GCS

### Tag Management

- Tags used to categorize and filter Binary resources
- Tag system: `http://aivida.com/fhir/tags`
- Tag codes indicate content type and processing stage

## API Endpoints

### POST /api/fhir/composition/:compositionId/simplified

Write simplified content back to FHIR store.

**Request Body:**
```json
{
  "tenantId": "demo",
  "simplifiedContent": {
    "dischargeSummary": {
      "content": "Simplified discharge summary text...",
      "gcsPath": "gs://bucket/simplified/summary-123.txt"
    },
    "dischargeInstructions": {
      "content": "Simplified discharge instructions text...",
      "gcsPath": "gs://bucket/simplified/instructions-123.txt"
    }
  }
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "fhirResourceId": "binary-uuid-123",
  "documentReferenceIds": ["doc-ref-1", "doc-ref-2"],
  "timestamp": "2024-01-15T10:30:00Z"
}
```

**Error Responses:**
- **400 Bad Request**: Invalid content format
- **404 Not Found**: Composition not found
- **500 Internal Server Error**: Failed to process content

### POST /api/fhir/composition/:compositionId/translated

Write translated content back to FHIR store.

**Request Body:**
```json
{
  "tenantId": "demo",
  "translatedContent": {
    "dischargeSummary": {
      "content": "Resumen del alta traducido...",
      "gcsPath": "gs://bucket/translated/es/summary-123.txt"
    },
    "dischargeInstructions": {
      "content": "Instrucciones del alta traducidas...",
      "gcsPath": "gs://bucket/translated/es/instructions-123.txt"
    }
  }
}
```

**Response:** Same structure as simplified endpoint.

## Business Rules

1. **Content Format**: Content must be text/plain, stored as base64 in Binary resource
2. **Tag Requirements**: Binary resources must be tagged appropriately
3. **Composition Linking**: Binary resources linked to Composition sections
4. **GCS Storage**: Optional GCS path for content storage
5. **Tenant Isolation**: All operations are tenant-specific

## FHIR Resource Structure

### Binary Resource Created
```json
{
  "resourceType": "Binary",
  "id": "binary-uuid-123",
  "contentType": "text/plain",
  "data": "base64-encoded-content",
  "meta": {
    "tag": [
      {
        "system": "http://aivida.com/fhir/tags",
        "code": "discharge-summary-simplified"
      }
    ]
  }
}
```

### Composition Update
- Binary resources added to Composition sections
- Section entries reference Binary resources
- Composition status remains 'final'

