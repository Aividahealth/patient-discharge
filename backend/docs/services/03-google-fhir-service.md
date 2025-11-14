# Google FHIR Service

## Overview

The Google FHIR Service provides a proxy layer to Google Cloud Healthcare FHIR Store. It handles tenant-specific FHIR store routing, authentication, and resource management.

## Business Logic

### Tenant-Specific Routing

- Each tenant has its own Google Cloud dataset and FHIR store
- URLs are constructed dynamically: `projects/{project}/locations/{location}/datasets/{tenantDataset}/fhirStores/{tenantFhirStore}/fhir`
- Configuration loaded from Firestore or YAML config

### Resource Operations

Supports standard FHIR CRUD operations:
- **Create**: POST new resources
- **Read**: GET resource by ID
- **Update**: PUT existing resources
- **Delete**: DELETE resources
- **Search**: GET with query parameters
- **Bundle**: POST batch operations

### Composition Binary Processing

Special handling for Composition resources:
- Extracts Binary references from Composition sections
- Filters by tags (discharge-summary, discharge-instructions)
- Converts base64 content to text
- Supports simplified and translated variants

## API Endpoints

### Generic FHIR CRUD Operations

#### POST /google/fhir/:resourceType

Create a new FHIR resource.

**Request Body:**
```json
{
  "resourceType": "Patient",
  "name": [{"family": "Smith", "given": ["John"]}],
  "gender": "male",
  "birthDate": "1990-01-01"
}
```

**Response (201 Created):**
```json
{
  "resourceType": "Patient",
  "id": "patient-123",
  "name": [{"family": "Smith", "given": ["John"]}],
  ...
}
```

#### GET /google/fhir/:resourceType/:id

Read a FHIR resource by ID.

**Response (200 OK):**
```json
{
  "resourceType": "Patient",
  "id": "patient-123",
  ...
}
```

#### PUT /google/fhir/:resourceType/:id

Update an existing FHIR resource.

**Request Body:**
```json
{
  "resourceType": "Patient",
  "id": "patient-123",
  "active": true,
  ...
}
```

#### DELETE /google/fhir/:resourceType/:id

Delete a FHIR resource.

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Resource deleted"
}
```

#### GET /google/fhir/:resourceType

Search FHIR resources.

**Query Parameters:**
- Standard FHIR search parameters
- Example: `?name=Smith&_count=10`

**Response (200 OK):**
```json
{
  "resourceType": "Bundle",
  "type": "searchset",
  "total": 5,
  "entry": [
    {
      "resource": { ... }
    }
  ]
}
```

#### POST /google/fhir

Execute FHIR bundle request (batch operations).

**Request Body:**
```json
{
  "resourceType": "Bundle",
  "type": "transaction",
  "entry": [
    {
      "request": {
        "method": "POST",
        "url": "Patient"
      },
      "resource": { ... }
    }
  ]
}
```

### Composition-Specific Endpoints

#### GET /google/fhir/Composition/:id/binaries

Get all Binary resources referenced in a Composition, converted to text.

**Response (200 OK):**
```json
{
  "success": true,
  "compositionId": "composition-123",
  "dischargeSummaries": [
    {
      "id": "binary-1",
      "contentType": "text/plain",
      "text": "Discharge summary content...",
      "category": "discharge-summary",
      "tags": [...]
    }
  ],
  "dischargeInstructions": [
    {
      "id": "binary-2",
      "contentType": "text/plain",
      "text": "Discharge instructions...",
      "category": "discharge-instructions",
      "tags": [...]
    }
  ],
  "totalBinaries": 2,
  "processedBinaries": 2
}
```

#### GET /google/fhir/Composition/:id/simplified

Get simplified Binary resources (filtered by `discharge-summary-simplified` and `discharge-instructions-simplified` tags).

**Response:** Same structure as `/binaries` but only includes simplified content.

#### GET /google/fhir/Composition/:id/translated

Get translated Binary resources (filtered by `discharge-summary-translated` and `discharge-instructions-translated` tags).

**Response:** Same structure as `/binaries` but only includes translated content.

### Google Auth Utilities

#### GET /google/token

Get Google Cloud access token.

**Response (200 OK):**
```json
{
  "access_token": "ya29.a0AfH6SMC..."
}
```

#### POST /google/impersonate/:email

Impersonate a user (placeholder for domain-wide delegation).

**Request Body:**
```json
{
  "scopes": ["https://www.googleapis.com/auth/cloud-platform"]
}
```

## Business Rules

1. **Tenant Isolation**: Each tenant's data is stored in separate FHIR stores
2. **Resource Type Validation**: Only allowed resource types can be accessed
3. **Binary Content**: Only `text/plain` Binary resources are processed
4. **Tag Filtering**: Binary resources filtered by FHIR tags for categorization
5. **Error Handling**: FHIR OperationOutcome errors are properly handled

## Configuration

Requires:
- Google Cloud project ID
- Location (e.g., `us-central1`)
- Tenant-specific dataset and FHIR store names
- Service account with Healthcare API permissions

## Authentication

- Uses service account credentials from config
- Supports Application Default Credentials (ADC) in Cloud Run
- Service account path resolved from `service_account_path` in config

