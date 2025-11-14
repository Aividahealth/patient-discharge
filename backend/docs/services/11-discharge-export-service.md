# Discharge Export Service

## Overview

The Discharge Export Service handles exporting discharge summaries from Cerner EHR to Google Cloud Healthcare FHIR Store. It orchestrates the complete export pipeline including patient mapping, document retrieval, and FHIR resource creation.

## Business Logic

### Export Pipeline

1. **Find Discharge Summary**: Search Cerner for DocumentReference with discharge summary type
2. **Check Duplicates**: Verify document hasn't already been exported
3. **Map Patient**: Map Cerner patient to Google FHIR patient (create if needed)
4. **Download Binary**: Fetch PDF/document content from Cerner
5. **Create Composition**: Create Composition resource in Google FHIR
6. **Create Binary**: Create Binary resources for discharge summary and instructions
7. **Link Resources**: Link all resources together
8. **Audit Logging**: Log export operation for tracking

### Patient Mapping

- Searches Google FHIR for existing patient by identifier
- Creates new patient if not found
- Maps Cerner patient identifiers to Google FHIR identifiers
- Handles patient data transformation

### Duplicate Detection

- Checks if DocumentReference ID already exists in Google FHIR
- Prevents duplicate exports
- Returns existing export if duplicate found

## API Endpoints

### POST /discharge-export/export/:documentId

Export discharge summary from Cerner to Google FHIR.

**Path Parameters:**
- `documentId`: Cerner DocumentReference ID

**Response (200 OK):**
```json
{
  "success": true,
  "cernerDocumentId": "doc-ref-123",
  "cernerPatientId": "patient-123",
  "googlePatientId": "google-patient-456",
  "encounterId": "encounter-789",
  "googleCompositionId": "composition-abc",
  "metadata": {
    "exportTimestamp": "2024-01-15T10:30:00Z",
    "patientMapping": "created",
    "duplicateCheck": "new"
  }
}
```

**Error Responses:**
- **500 Internal Server Error**: Export failed with error details

### POST /discharge-export/export-document/:documentId

Export specific document by ID (with patient context).

**Path Parameters:**
- `documentId`: Cerner DocumentReference ID

**Request Body:**
```json
{
  "patientId": "patient-123"
}
```

**Response:** Same as `/export/:documentId`

### GET /discharge-export/binary

Get binary resource from Google FHIR store.

**Query Parameters:**
- `documentReferenceId`: Optional, DocumentReference ID
- `compositionId`: Optional, Composition ID
- At least one ID must be provided

**Response (200 OK):**
```json
{
  "success": true,
  "binary": {
    "resourceType": "Binary",
    "id": "binary-123",
    "contentType": "application/pdf",
    "data": "base64-encoded-content"
  },
  "documentReference": { ... },
  "composition": { ... }
}
```

### GET /discharge-export/test/:patientId

Test the export pipeline for a patient.

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Export pipeline test completed",
  "patientId": "patient-123",
  "cernerDocument": {
    "id": "doc-123",
    "patientId": "patient-123",
    "encounterId": "encounter-456",
    "date": "2024-01-15",
    "hasContent": true
  },
  "steps": {
    "cernerSearch": "SUCCESS",
    "googleConnection": "SUCCESS",
    "exportPipeline": "READY"
  },
  "recommendation": "Pipeline is ready for export"
}
```

## Business Rules

1. **Duplicate Prevention**: Documents are not exported twice
2. **Patient Mapping**: Patients are mapped or created automatically
3. **Resource Linking**: All resources properly linked in FHIR structure
4. **Error Handling**: Comprehensive error logging and recovery
5. **Audit Trail**: All exports logged for compliance

## Export Process Details

### Step 1: Find Cerner Document
- Searches Cerner DocumentReference resources
- Filters by document type (discharge summary)
- Extracts patient and encounter IDs

### Step 2: Duplicate Check
- Searches Google FHIR for existing Composition
- Checks by Cerner document ID
- Returns existing export if found

### Step 3: Patient Mapping
- Searches Google FHIR Patient by identifier
- Creates new Patient if not found
- Maps Cerner identifiers to Google identifiers

### Step 4: Download Binary
- Fetches Binary resource from Cerner
- Extracts PDF or text content
- Converts to appropriate format

### Step 5: Create FHIR Resources
- Creates Composition resource
- Creates Binary resources for content
- Links all resources together

## Data Flow

```
Cerner EHR
    ↓
DocumentReference (discharge summary)
    ↓
Binary Resource (PDF/content)
    ↓
Export Service
    ↓
Google FHIR Store
    ↓
Composition + Binary Resources
```

