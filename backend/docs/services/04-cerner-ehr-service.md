# Cerner EHR Service

## Overview

The Cerner EHR Service provides integration with Cerner's FHIR API. It handles authentication, resource operations, and specialized discharge summary operations.

## Business Logic

### Authentication Types

Supports two authentication methods:
1. **System App**: Backend service account authentication
2. **Provider App**: User-initiated OAuth2 flow (SMART on FHIR)

### Token Management

- Access tokens are cached and reused
- Token expiration is handled automatically
- Separate tokens for system and provider apps
- Session management for provider app tokens

### Discharge Summary Processing

Specialized endpoints for:
- Creating discharge summaries as Composition resources
- Searching discharge summaries for patients
- Fetching binary document content
- Parsing DocumentReference resources

## API Endpoints

### Generic FHIR CRUD Operations

#### POST /cerner/:resourceType

Create a Cerner FHIR resource.

**Request Body:**
```json
{
  "resourceType": "Patient",
  "name": [{"family": "Smith", "given": ["John"]}]
}
```

**Response (201 Created):**
```json
{
  "resourceType": "Patient",
  "id": "123456",
  ...
}
```

#### GET /cerner/:resourceType/:id

Read a Cerner FHIR resource.

**Response (200 OK):**
```json
{
  "resourceType": "Patient",
  "id": "123456",
  ...
}
```

#### PUT /cerner/:resourceType/:id

Update a Cerner FHIR resource.

#### DELETE /cerner/:resourceType/:id

Delete a Cerner FHIR resource.

#### GET /cerner/:resourceType

Search Cerner FHIR resources.

**Query Parameters:**
- `authType`: Optional, 'system' or 'provider' (default: 'system')
- Standard FHIR search parameters

**Example:**
```bash
GET /cerner/Patient?name=Smith&authType=system
```

### Specialized Operations

#### POST /cerner/discharge-summary

Create a discharge summary Composition resource.

**Request Body:**
```json
{
  "patientId": "123",
  "encounterId": "456",
  "summaryData": {
    "patient_name": "John Smith",
    "mrn": "MRN123",
    "admission_date": "2024-01-01",
    "discharge_date": "2024-01-05",
    "chief_complaint": "Chest pain",
    "hospital_course": "Patient admitted for evaluation",
    "discharge_diagnosis": "Acute myocardial infarction",
    "author": "Dr. Smith"
  }
}
```

**Response (201 Created):**
```json
{
  "resourceType": "Composition",
  "id": "composition-789",
  "status": "final",
  "type": {
    "coding": [{
      "system": "http://loinc.org",
      "code": "18842-5",
      "display": "Discharge summary"
    }]
  },
  ...
}
```

#### GET /cerner/discharge-summaries/:patientId

Search discharge summaries for a specific patient.

**Response (200 OK):**
```json
{
  "resourceType": "Bundle",
  "type": "searchset",
  "total": 3,
  "entry": [
    {
      "resource": {
        "resourceType": "DocumentReference",
        "id": "doc-1",
        "type": {
          "coding": [{
            "code": "18842-5",
            "display": "Discharge summary"
          }]
        },
        "content": [{
          "attachment": {
            "url": "Binary/binary-123"
          }
        }]
      }
    }
  ]
}
```

#### GET /cerner/binary/:binaryId

Fetch binary document content.

**Query Parameters:**
- `accept`: Accept header value (default: 'application/octet-stream')
  - Options: 'application/pdf', 'text/plain', etc.

**Response (200 OK):**
```json
{
  "resourceType": "Binary",
  "id": "binary-123",
  "contentType": "application/pdf",
  "data": "base64-encoded-content..."
}
```

#### POST /cerner/parse-document-reference

Parse a DocumentReference resource to extract metadata.

**Request Body:**
```json
{
  "resourceType": "DocumentReference",
  "id": "doc-1",
  "type": { ... },
  "content": [ ... ]
}
```

**Response (200 OK):**
```json
{
  "id": "doc-1",
  "type": "Discharge summary",
  "date": "2024-01-05",
  "author": "Dr. Smith",
  "content": [
    {
      "url": "Binary/binary-123",
      "contentType": "application/pdf"
    }
  ]
}
```

#### POST /cerner/document-reference

Create a DocumentReference in Cerner.

**Request Body:**
```json
{
  "resourceType": "DocumentReference",
  "status": "current",
  "type": {
    "coding": [{
      "code": "18842-5",
      "display": "Discharge summary"
    }]
  },
  "content": [{
    "attachment": {
      "contentType": "application/pdf",
      "data": "base64-encoded-content"
    }
  }]
}
```

### Test Endpoints

#### GET /cerner/test/token-reuse

Test token reuse efficiency (makes 3 requests to verify caching).

**Response (200 OK):**
```json
{
  "message": "Token reuse test completed",
  "results": [
    { "attempt": 1, "hasResult": true },
    { "attempt": 2, "hasResult": true },
    { "attempt": 3, "hasResult": true }
  ]
}
```

#### GET /cerner/test/discharge-summary-pipeline/:patientId

Test the complete discharge summary pipeline:
1. Search for discharge summaries
2. Parse DocumentReference
3. Fetch binary content

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Discharge summary pipeline test completed",
  "patientId": "123",
  "summaries": {
    "total": 3,
    "parsedDocument": { ... },
    "binaryContent": {
      "id": "binary-123",
      "contentType": "application/pdf",
      "size": 12345,
      "hasData": true
    }
  }
}
```

## Business Rules

1. **Authentication**: System app used by default, provider app requires OAuth flow
2. **Resource Types**: All standard FHIR resource types supported
3. **Error Handling**: OperationOutcome errors returned as 400 Bad Request
4. **Token Caching**: Tokens cached per tenant and auth type
5. **Tenant Isolation**: Each tenant has separate Cerner configuration

## Configuration

Requires tenant-specific Cerner config:
- `base_url`: Cerner FHIR base URL
- `system_app`: System app credentials (client_id, client_secret, token_url, scopes)
- `provider_app`: Provider app credentials (for OAuth flow)
- `patients`: List of patient IDs to process (optional)

## Authentication Flow

### System App
1. Client credentials grant
2. Token cached per tenant
3. Automatic refresh on expiration

### Provider App
1. OAuth2 authorization code flow
2. Session management via SessionService
3. Token refresh supported

