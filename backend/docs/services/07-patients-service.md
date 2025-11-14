# Patients Service

## Overview

The Patients Service provides access to patient discharge queue information. It retrieves lists of patients ready for discharge review from the Google FHIR store.

## Business Logic

### Discharge Queue

- Retrieves Composition resources with status indicating ready for discharge
- Filters by tenant
- Returns patient information and discharge status
- Used by clinicians to see which patients need discharge processing

### Data Source

- Reads from Google Cloud Healthcare FHIR Store
- Queries Composition resources
- Includes related Patient and Encounter information

## API Endpoints

### GET /api/patients/discharge-queue

Retrieves list of patients ready for discharge review.

**Headers:**
- `Authorization: Bearer <token>` (required)
- `X-Tenant-ID: <tenant-id>` (required)

**Response (200 OK):**
```json
{
  "success": true,
  "patients": [
    {
      "compositionId": "composition-uuid-123",
      "patientId": "patient-123",
      "patientName": "John Smith",
      "mrn": "MRN123",
      "room": "301",
      "unit": "ICU",
      "dischargeDate": "2024-01-15",
      "status": "pending",
      "attendingPhysician": {
        "name": "Dr. Jane Doe",
        "id": "physician-456"
      },
      "avatar": "https://example.com/avatar.jpg",
      "createdAt": "2024-01-15T10:00:00Z"
    }
  ],
  "total": 5
}
```

**Error Responses:**
- **401 Unauthorized**: Missing or invalid authentication
- **500 Internal Server Error**: Failed to retrieve queue

## Business Rules

1. **Authentication Required**: Endpoint requires valid authentication token
2. **Tenant Isolation**: Only returns patients for the authenticated tenant
3. **Status Filtering**: Only includes patients with pending discharge status
4. **Data Privacy**: Patient data filtered based on user role and permissions

## Data Model

### Discharge Queue Item
```typescript
{
  compositionId: string;         // FHIR Composition ID
  patientId: string;             // FHIR Patient ID
  patientName: string;            // Patient full name
  mrn: string;                   // Medical Record Number
  room?: string;                 // Room number
  unit?: string;                 // Unit/ward
  dischargeDate: string;          // ISO date string
  status: string;                // Discharge status
  attendingPhysician: {
    name: string;
    id: string;
  };
  avatar?: string;               // Patient avatar URL
  createdAt: string;             // ISO timestamp
}
```

