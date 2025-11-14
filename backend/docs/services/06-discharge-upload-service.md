# Discharge Upload Service

## Overview

The Discharge Upload Service handles uploading discharge summaries and managing the discharge queue. It creates FHIR Composition resources and manages patient discharge workflow.

## Business Logic

### Upload Workflow

1. Clinician uploads discharge summary data
2. Service creates FHIR Composition resource
3. Discharge summary and instructions stored as Binary resources
4. Composition linked to Patient and Encounter
5. Patient added to discharge queue

### Discharge Queue Management

- Queue contains patients ready for discharge review
- Patients can be marked as completed (discharged)
- Queue filtered by tenant

### FHIR Resource Creation

Creates:
- **Composition**: Main discharge document
- **Binary**: Discharge summary text content
- **Binary**: Discharge instructions text content
- Links to existing Patient and Encounter resources

## API Endpoints

### POST /api/discharge-summary/upload

Upload a new discharge summary for processing.

**Request Body:**
```json
{
  "id": "patient-123",
  "mrn": "MRN123",
  "name": "John Smith",
  "room": "301",
  "unit": "ICU",
  "dischargeDate": "2024-01-15",
  "rawDischargeSummary": "Patient admitted with chest pain...",
  "rawDischargeInstructions": "Take medications as prescribed...",
  "status": "pending",
  "attendingPhysician": {
    "name": "Dr. Jane Doe",
    "id": "physician-456"
  },
  "avatar": "https://example.com/avatar.jpg"
}
```

**Required Fields:**
- `id`: Patient/Composition ID
- `mrn`: Medical Record Number
- `name`: Patient name
- `rawDischargeSummary`: Discharge summary text
- `rawDischargeInstructions`: Discharge instructions text

**Response (200 OK):**
```json
{
  "success": true,
  "compositionId": "composition-uuid-123",
  "message": "Discharge summary uploaded successfully",
  "patientId": "patient-123",
  "encounterId": "encounter-456",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

**Error Responses:**
- **400 Bad Request**: Missing required fields
- **500 Internal Server Error**: Upload processing failed

### POST /api/discharge-summary/:compositionId/completed

Mark a discharge as completed (move from queue to discharged).

**Response (200 OK):**
```json
{
  "success": true,
  "compositionId": "composition-uuid-123",
  "message": "Discharge marked as completed",
  "status": "completed",
  "timestamp": "2024-01-15T11:00:00Z"
}
```

**Error Responses:**
- **404 Not Found**: Composition not found
- **500 Internal Server Error**: Failed to update status

## Business Rules

1. **Required Fields**: id, mrn, name, rawDischargeSummary, rawDischargeInstructions must be provided
2. **FHIR Compliance**: Resources created follow FHIR R4 specification
3. **Binary Storage**: Discharge content stored as Binary resources with appropriate tags
4. **Composition Structure**: Composition includes sections for summary and instructions
5. **Tenant Isolation**: All operations are tenant-specific

## Data Model

### Upload Request
```typescript
{
  id: string;                    // Patient/Composition ID
  mrn: string;                   // Medical Record Number
  name: string;                  // Patient name
  room?: string;                 // Room number
  unit?: string;                 // Unit/ward
  dischargeDate: string;         // ISO date string
  rawDischargeSummary: string;   // Discharge summary text
  rawDischargeInstructions: string; // Discharge instructions text
  status: string;                // Status (pending, completed, etc.)
  attendingPhysician: {
    name: string;
    id: string;
  };
  avatar?: string;               // Patient avatar URL
}
```

### FHIR Resources Created

**Composition:**
- Type: Discharge summary (LOINC 18842-5)
- Status: final
- Sections: discharge summary, discharge instructions
- References: Patient, Encounter, Binary resources

**Binary Resources:**
- Content type: text/plain
- Tagged with: discharge-summary, discharge-instructions
- Base64 encoded content

