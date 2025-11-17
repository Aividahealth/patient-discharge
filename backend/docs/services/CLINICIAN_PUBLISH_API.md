# POST Clinician Publish Discharge Summary API Specification

## Endpoint

```
POST /api/discharge-summary/:compositionId/publish
```

## Description

Publishes a discharge summary to the patient after clinician review. This endpoint:
- Stores additional clarifications in FHIR as a Binary resource
- Stores publish metadata (publish flag, clinician info, timestamp, approval status) in Firestore
- Links the clarification Binary to the Composition resource
- Updates the Composition to include the clarification reference

## Authentication

- **Required**: `Authorization: Bearer <token>` header
- **Required**: `x-tenant-id: <tenantId>` header

## Request

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `compositionId` | string | Yes | The Composition ID (discharge summary ID) to publish |

### Request Body

**With Additional Clarifications:**
```json
{
  "additionalClarifications": "Patient should follow up with cardiology within 2 weeks. Avoid strenuous activity for 4 weeks.",
  "publish": true,
  "sectionApprovals": {
    "medications": {
      "approved": true,
      "approvedAt": "2025-11-17T10:25:00Z",
      "approvedBy": {
        "id": "clinician-123",
        "name": "Dr. Sam Johnson"
      }
    },
    "appointments": {
      "approved": true,
      "approvedAt": "2025-11-17T10:26:00Z",
      "approvedBy": {
        "id": "clinician-123",
        "name": "Dr. Sam Johnson"
      }
    },
    "dietActivity": {
      "approved": true,
      "approvedAt": "2025-11-17T10:27:00Z",
      "approvedBy": {
        "id": "clinician-123",
        "name": "Dr. Sam Johnson"
      }
    }
  },
  "redactionPreferences": {
    "redactRoomNumber": false,
    "redactMRN": false,
    "redactInsuranceInfo": false
  },
  "clinician": {
    "id": "clinician-123",
    "name": "Dr. Sam Johnson",
    "email": "sam.johnson@hospital.com"
  }
}
```

**Without Additional Clarifications (must send "None"):**
```json
{
  "additionalClarifications": "None",
  "publish": true,
  "sectionApprovals": {
    "medications": {
      "approved": true,
      "approvedAt": "2025-11-17T10:25:00Z",
      "approvedBy": {
        "id": "clinician-123",
        "name": "Dr. Sam Johnson"
      }
    },
    "appointments": {
      "approved": true,
      "approvedAt": "2025-11-17T10:26:00Z",
      "approvedBy": {
        "id": "clinician-123",
        "name": "Dr. Sam Johnson"
      }
    },
    "dietActivity": {
      "approved": true,
      "approvedAt": "2025-11-17T10:27:00Z",
      "approvedBy": {
        "id": "clinician-123",
        "name": "Dr. Sam Johnson"
      }
    }
  },
  "redactionPreferences": {
    "redactRoomNumber": false,
    "redactMRN": false,
    "redactInsuranceInfo": false
  },
  "clinician": {
    "id": "clinician-123",
    "name": "Dr. Sam Johnson",
    "email": "sam.johnson@hospital.com"
  }
}
```

### Request Body Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `additionalClarifications` | string | Yes | Additional notes or clarifications for the patient. **Must be "None" (exact string) if no clarifications are provided.** Cannot be empty string or omitted. |
| `publish` | boolean | Yes | Whether to publish the discharge summary to the patient. Must be `true` to publish. |
| `sectionApprovals` | object | Yes | Approval status for each required section with audit trail information |
| `sectionApprovals.medications` | object | Yes | Medications section approval details |
| `sectionApprovals.medications.approved` | boolean | Yes | Whether medications section is approved |
| `sectionApprovals.medications.approvedAt` | string (ISO 8601) | Yes | Timestamp when medications section was approved |
| `sectionApprovals.medications.approvedBy` | object | Yes | Clinician who approved the medications section |
| `sectionApprovals.medications.approvedBy.id` | string | Yes | Clinician ID who approved medications |
| `sectionApprovals.medications.approvedBy.name` | string | Yes | Clinician name who approved medications |
| `sectionApprovals.appointments` | object | Yes | Appointments section approval details |
| `sectionApprovals.appointments.approved` | boolean | Yes | Whether appointments section is approved |
| `sectionApprovals.appointments.approvedAt` | string (ISO 8601) | Yes | Timestamp when appointments section was approved |
| `sectionApprovals.appointments.approvedBy` | object | Yes | Clinician who approved the appointments section |
| `sectionApprovals.appointments.approvedBy.id` | string | Yes | Clinician ID who approved appointments |
| `sectionApprovals.appointments.approvedBy.name` | string | Yes | Clinician name who approved appointments |
| `sectionApprovals.dietActivity` | object | Yes | Diet & Activity section approval details |
| `sectionApprovals.dietActivity.approved` | boolean | Yes | Whether diet & activity section is approved |
| `sectionApprovals.dietActivity.approvedAt` | string (ISO 8601) | Yes | Timestamp when diet & activity section was approved |
| `sectionApprovals.dietActivity.approvedBy` | object | Yes | Clinician who approved the diet & activity section |
| `sectionApprovals.dietActivity.approvedBy.id` | string | Yes | Clinician ID who approved diet & activity |
| `sectionApprovals.dietActivity.approvedBy.name` | string | Yes | Clinician name who approved diet & activity |
| `redactionPreferences` | object | No | Preferences for redacting sensitive information |
| `redactionPreferences.redactRoomNumber` | boolean | No | Whether to redact room number (default: false) |
| `redactionPreferences.redactMRN` | boolean | No | Whether to redact medical record number (default: false) |
| `redactionPreferences.redactInsuranceInfo` | boolean | No | Whether to redact insurance information (default: false) |
| `clinician` | object | Yes | Information about the clinician publishing the summary |
| `clinician.id` | string | Yes | Unique identifier for the clinician |
| `clinician.name` | string | Yes | Full name of the clinician |
| `clinician.email` | string | No | Email address of the clinician |

### Request Headers

```http
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
x-tenant-id: demo
```

## Response

### Success Response (200 OK)

```json
{
  "success": true,
  "message": "Discharge summary published successfully",
  "compositionId": "composition-uuid-123",
  "patientId": "patient-uuid-456",
  "clarificationBinaryId": "binary-uuid-789",
  "hasClarifications": true,
  "publishedAt": "2025-11-17T10:30:00Z",
  "publishedBy": {
    "id": "clinician-123",
    "name": "Dr. Sam Johnson",
    "email": "sam.johnson@hospital.com"
  },
  "sectionApprovals": {
    "medications": {
      "approved": true,
      "approvedAt": "2025-11-17T10:25:00Z",
      "approvedBy": {
        "id": "clinician-123",
        "name": "Dr. Sam Johnson"
      }
    },
    "appointments": {
      "approved": true,
      "approvedAt": "2025-11-17T10:26:00Z",
      "approvedBy": {
        "id": "clinician-123",
        "name": "Dr. Sam Johnson"
      }
    },
    "dietActivity": {
      "approved": true,
      "approvedAt": "2025-11-17T10:27:00Z",
      "approvedBy": {
        "id": "clinician-123",
        "name": "Dr. Sam Johnson"
      }
    }
  },
  "redactionPreferences": {
    "redactRoomNumber": false,
    "redactMRN": false,
    "redactInsuranceInfo": false
  }
}
```

**Note**: If `additionalClarifications` was "None", then `clarificationBinaryId` will be `null` and `hasClarifications` will be `false`.

### Error Responses

#### 400 Bad Request

**Missing required fields:**
```json
{
  "error": "Bad Request",
  "message": "Missing required field: publish",
  "statusCode": 400
}
```

**Invalid approval status:**
```json
{
  "error": "Bad Request",
  "message": "All required sections must be approved before publishing",
  "statusCode": 400,
  "details": {
    "unapprovedSections": ["medications", "appointments"]
  }
}
```

**Invalid additionalClarifications:**
```json
{
  "error": "Bad Request",
  "message": "additionalClarifications must be provided. Use 'None' if no clarifications are needed.",
  "statusCode": 400
}
```

**Missing section approval details:**
```json
{
  "error": "Bad Request",
  "message": "Missing required approval details for section: medications",
  "statusCode": 400,
  "details": {
    "missingFields": ["approved", "approvedAt", "approvedBy"]
  }
}
```

#### 404 Not Found

**Composition not found:**
```json
{
  "error": "Not Found",
  "message": "Composition not found: composition-uuid-123",
  "statusCode": 404
}
```

#### 401 Unauthorized

**Missing or invalid token:**
```json
{
  "error": "Unauthorized",
  "message": "Invalid or missing authentication token",
  "statusCode": 401
}
```

#### 500 Internal Server Error

**FHIR store error:**
```json
{
  "error": "Internal Server Error",
  "message": "Failed to store clarification in FHIR store",
  "statusCode": 500,
  "details": {
    "fhirError": "Resource validation failed"
  }
}
```

**Firestore error:**
```json
{
  "error": "Internal Server Error",
  "message": "Failed to store publish metadata in Firestore",
  "statusCode": 500
}
```

## Business Logic

### Validation Rules

1. **Additional Clarifications Validation**:
   - `additionalClarifications` field is **required** and cannot be omitted
   - If no clarifications are provided, frontend **must** send the exact string `"None"`
   - Empty string `""` is not allowed - must be `"None"` or actual clarification text
   - This ensures explicit audit trail of whether clarifications were provided

2. **Section Approval Validation**:
   - `sectionApprovals` object is required with all three sections: `medications`, `appointments`, `dietActivity`
   - Each section must have:
     - `approved` (boolean): Required
     - `approvedAt` (ISO 8601 timestamp): Required
     - `approvedBy` (object): Required with `id` and `name`
   - If `publish` is `true`, all sections must have `approved: true`
   - If any section is not approved when `publish` is `true`, return 400 Bad Request with list of unapproved sections
   - All approval timestamps and clinician information are stored for audit purposes

3. **Composition Validation**:
   - Composition must exist in FHIR store
   - Composition must belong to the tenant
   - If Composition not found, return 404 Not Found

4. **Clinician Validation**:
   - Clinician information must be provided
   - Clinician ID and name are required
   - Clinician information in `sectionApprovals` must match the publishing clinician (or can be different if sections were approved by different clinicians)

### FHIR Storage (Additional Clarifications)

1. **Create Binary Resource (only if clarifications provided)**:
   - **Condition**: Only create Binary resource if `additionalClarifications` is NOT `"None"`
   - Resource Type: `Binary`
   - Content Type: `text/plain`
   - Content: Base64-encoded `additionalClarifications` text
   - Tags:
     - System: `http://aivida.com/fhir/tags`
     - Code: `clinician-clarifications`
     - Display: `Clinician Additional Clarifications`

2. **Update Composition (only if clarifications provided)**:
   - If Binary was created, add a new section titled "Clinician Clarifications" or "Additional Notes"
   - Add entry referencing the Binary resource: `Binary/{clarificationBinaryId}`
   - Maintain existing sections and entries
   - If `additionalClarifications` is `"None"`, do not update Composition

3. **Create DocumentReference (Optional)**:
   - If needed for better traceability, create a DocumentReference linking to the clarification Binary
   - Type: Custom type for clinician notes
   - Subject: Reference to Patient
   - Context: Reference to Encounter
   - Only create if Binary resource was created (i.e., clarifications were not "None")

### Firestore Storage (Publish Metadata - Audit Trail)

**Collection**: `discharge_summaries`

**Document ID**: `{compositionId}`

**Document Structure**:
```json
{
  "compositionId": "composition-uuid-123",
  "patientId": "patient-uuid-456",
  "tenantId": "demo",
  "published": true,
  "publishedAt": "2025-11-17T10:30:00Z",
  "publishedBy": {
    "id": "clinician-123",
    "name": "Dr. Sam Johnson",
    "email": "sam.johnson@hospital.com"
  },
  "sectionApprovals": {
    "medications": {
      "approved": true,
      "approvedAt": "2025-11-17T10:25:00Z",
      "approvedBy": {
        "id": "clinician-123",
        "name": "Dr. Sam Johnson"
      }
    },
    "appointments": {
      "approved": true,
      "approvedAt": "2025-11-17T10:26:00Z",
      "approvedBy": {
        "id": "clinician-123",
        "name": "Dr. Sam Johnson"
      }
    },
    "dietActivity": {
      "approved": true,
      "approvedAt": "2025-11-17T10:27:00Z",
      "approvedBy": {
        "id": "clinician-123",
        "name": "Dr. Sam Johnson"
      }
    }
  },
  "redactionPreferences": {
    "redactRoomNumber": false,
    "redactMRN": false,
    "redactInsuranceInfo": false
  },
  "additionalClarifications": {
    "text": "Patient should follow up with cardiology within 2 weeks. Avoid strenuous activity for 4 weeks.",
    "hasClarifications": true,
    "clarificationBinaryId": "binary-uuid-789",
    "storedAt": "2025-11-17T10:30:00Z"
  },
  "auditTrail": {
    "createdAt": "2025-11-17T08:00:00Z",
    "updatedAt": "2025-11-17T10:30:00Z",
    "lastModifiedBy": {
      "id": "clinician-123",
      "name": "Dr. Sam Johnson"
    }
  }
}
```

**Fields** (All fields stored for audit purposes):

- **Core Identifiers**:
  - `compositionId` (string): The Composition ID
  - `patientId` (string): The Patient ID (extracted from Composition)
  - `tenantId` (string): The tenant ID

- **Publish Information**:
  - `published` (boolean): Whether the summary has been published
  - `publishedAt` (timestamp): ISO 8601 timestamp of when it was published
  - `publishedBy` (object): Clinician who published it
    - `id` (string): Clinician ID
    - `name` (string): Clinician name
    - `email` (string, optional): Clinician email

- **Section Approvals** (Complete audit trail for each section):
  - `sectionApprovals` (object): Approval status for each section with full audit trail
  - `sectionApprovals.medications` (object): Medications section approval details
    - `approved` (boolean): Whether section is approved
    - `approvedAt` (timestamp): When section was approved
    - `approvedBy` (object): Clinician who approved this section
      - `id` (string): Clinician ID
      - `name` (string): Clinician name
  - `sectionApprovals.appointments` (object): Same structure as medications
  - `sectionApprovals.dietActivity` (object): Same structure as medications

- **Redaction Preferences**:
  - `redactionPreferences` (object): Preferences for redacting sensitive information
    - `redactRoomNumber` (boolean): Whether to redact room number
    - `redactMRN` (boolean): Whether to redact medical record number
    - `redactInsuranceInfo` (boolean): Whether to redact insurance information

- **Additional Clarifications** (Always stored, even if "None"):
  - `additionalClarifications` (object): Clarification information
    - `text` (string): The clarification text (or "None" if no clarifications)
    - `hasClarifications` (boolean): Whether actual clarifications were provided (false if text is "None")
    - `clarificationBinaryId` (string | null): ID of the Binary resource containing clarifications (null if "None")
    - `storedAt` (timestamp): When clarifications were stored

- **Audit Trail**:
  - `auditTrail` (object): General audit information
    - `createdAt` (timestamp): When the document was first created
    - `updatedAt` (timestamp): Last update timestamp
    - `lastModifiedBy` (object): Last clinician who modified the document
      - `id` (string): Clinician ID
      - `name` (string): Clinician name

**Important Notes**:
- **All fields are stored in Firestore for complete audit trail**, even if values are null or "None"
- The `additionalClarifications.text` field will contain the exact string `"None"` if no clarifications were provided
- This ensures complete traceability of all actions and decisions made during the review process
- The audit trail allows reconstruction of who approved what, when, and what clarifications (if any) were provided

## Example Requests

### Publish with Additional Clarifications

```bash
curl -X POST "https://api.example.com/api/discharge-summary/composition-uuid-123/publish" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "x-tenant-id: demo" \
  -d '{
    "additionalClarifications": "Patient should follow up with cardiology within 2 weeks. Avoid strenuous activity for 4 weeks.",
    "publish": true,
    "sectionApprovals": {
      "medications": {
        "approved": true,
        "approvedAt": "2025-11-17T10:25:00Z",
        "approvedBy": {
          "id": "clinician-123",
          "name": "Dr. Sam Johnson"
        }
      },
      "appointments": {
        "approved": true,
        "approvedAt": "2025-11-17T10:26:00Z",
        "approvedBy": {
          "id": "clinician-123",
          "name": "Dr. Sam Johnson"
        }
      },
      "dietActivity": {
        "approved": true,
        "approvedAt": "2025-11-17T10:27:00Z",
        "approvedBy": {
          "id": "clinician-123",
          "name": "Dr. Sam Johnson"
        }
      }
    },
    "redactionPreferences": {
      "redactRoomNumber": false,
      "redactMRN": false,
      "redactInsuranceInfo": false
    },
    "clinician": {
      "id": "clinician-123",
      "name": "Dr. Sam Johnson",
      "email": "sam.johnson@hospital.com"
    }
  }'
```

### Publish without Additional Clarifications (must send "None")

```bash
curl -X POST "https://api.example.com/api/discharge-summary/composition-uuid-123/publish" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "x-tenant-id: demo" \
  -d '{
    "additionalClarifications": "None",
    "publish": true,
    "sectionApprovals": {
      "medications": {
        "approved": true,
        "approvedAt": "2025-11-17T10:25:00Z",
        "approvedBy": {
          "id": "clinician-123",
          "name": "Dr. Sam Johnson"
        }
      },
      "appointments": {
        "approved": true,
        "approvedAt": "2025-11-17T10:26:00Z",
        "approvedBy": {
          "id": "clinician-123",
          "name": "Dr. Sam Johnson"
        }
      },
      "dietActivity": {
        "approved": true,
        "approvedAt": "2025-11-17T10:27:00Z",
        "approvedBy": {
          "id": "clinician-123",
          "name": "Dr. Sam Johnson"
        }
      }
    },
    "redactionPreferences": {
      "redactRoomNumber": false,
      "redactMRN": false,
      "redactInsuranceInfo": false
    },
    "clinician": {
      "id": "clinician-123",
      "name": "Dr. Sam Johnson",
      "email": "sam.johnson@hospital.com"
    }
  }'
```

### Save Draft (Not Publishing)

```bash
curl -X POST "https://api.example.com/api/discharge-summary/composition-uuid-123/publish" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "x-tenant-id: demo" \
  -d '{
    "additionalClarifications": "Draft notes for review...",
    "publish": false,
    "sectionApprovals": {
      "medications": {
        "approved": false,
        "approvedAt": "2025-11-17T10:25:00Z",
        "approvedBy": {
          "id": "clinician-123",
          "name": "Dr. Sam Johnson"
        }
      },
      "appointments": {
        "approved": true,
        "approvedAt": "2025-11-17T10:26:00Z",
        "approvedBy": {
          "id": "clinician-123",
          "name": "Dr. Sam Johnson"
        }
      },
      "dietActivity": {
        "approved": false,
        "approvedAt": "2025-11-17T10:27:00Z",
        "approvedBy": {
          "id": "clinician-123",
          "name": "Dr. Sam Johnson"
        }
      }
    },
    "clinician": {
      "id": "clinician-123",
      "name": "Dr. Sam Johnson"
    }
  }'
```

## Implementation Notes

### Backend Implementation Steps

1. **Validate Request**:
   - Check authentication and tenant context
   - Validate all required fields
   - If `publish` is `true`, ensure all sections are approved

2. **Fetch Composition**:
   - Read Composition from FHIR store
   - Extract Patient ID and Encounter ID from Composition
   - Verify Composition belongs to tenant

3. **Store Additional Clarifications (if provided)**:
   - Check if `additionalClarifications` is NOT `"None"`
   - If not "None", create Binary resource with clarification text
   - Tag with `clinician-clarifications`
   - Update Composition to include reference to Binary in a new section
   - If "None", skip Binary creation and Composition update

4. **Store Complete Audit Trail in Firestore**:
   - Create or update document in `discharge_summaries` collection
   - **Store all data for audit purposes**:
     - Set `published` flag
     - Store clinician information (`publishedBy`)
     - Store complete `sectionApprovals` with timestamps and approver info for each section
     - Store `redactionPreferences`
     - Store `additionalClarifications` object with:
       - `text`: The exact text received (including "None" if no clarifications)
       - `hasClarifications`: Boolean indicating if actual clarifications were provided
       - `clarificationBinaryId`: Binary ID if created, null if "None"
       - `storedAt`: Timestamp
     - Store `auditTrail` with creation/update timestamps and last modifier
   - **Important**: All fields must be stored, even if values are null or "None", to maintain complete audit trail

5. **Return Response**:
   - Return success response with all relevant IDs and metadata

### Error Handling

- **FHIR Errors**: Catch and wrap FHIR API errors with appropriate HTTP status codes
- **Firestore Errors**: Handle Firestore write errors gracefully
- **Partial Failures**: If Binary creation succeeds but Firestore write fails, consider transaction rollback or retry logic

### Performance Considerations

- **Firestore Indexes**: Ensure indexes on:
  - `compositionId`
  - `tenantId`
  - `published`
  - `publishedAt`
  - `(tenantId, published)`

### Security Considerations

- **Authentication**: Verify clinician has permission to publish discharge summaries
- **Tenant Isolation**: Ensure Composition belongs to the tenant making the request
- **Data Validation**: Sanitize `additionalClarifications` text to prevent injection attacks
- **Audit Logging**: Log all publish actions for audit trail

## Related Endpoints

- `GET /api/discharge-summary/queue` - Get discharge queue
- `POST /api/discharge-summary/:compositionId/completed` - Mark discharge as completed
- `GET /api/discharge-summary/:compositionId` - Get discharge summary details

## Frontend Integration

The frontend should:
1. **Collect section approval details**:
   - For each section (medications, appointments, diet & activity), track:
     - Whether the section is approved (boolean)
     - Timestamp when approved (ISO 8601 format)
     - Clinician who approved it (id and name from authenticated user context)
   - Send complete approval details in `sectionApprovals` object

2. **Collect additional clarifications**:
   - If user enters clarifications, send the text as-is
   - **If user does NOT enter any clarifications, frontend MUST send the exact string `"None"`**
   - Cannot send empty string `""` or omit the field
   - This ensures explicit audit trail

3. **Collect redaction preferences**:
   - Collect user selections for redacting room number, MRN, and insurance info

4. **Collect clinician information**:
   - Get from authenticated user context (id, name, email)

5. **Call endpoint when "Publish to Patient" button is clicked**:
   - Validate that all sections are approved if `publish: true`
   - Ensure `additionalClarifications` is set (either actual text or `"None"`)
   - Send complete request with all audit trail information

6. **Handle responses**:
   - Show loading state during API call
   - Display success message on successful publish
   - Display error message with details if validation fails
   - Handle network errors gracefully

7. **UI Considerations**:
   - When user toggles section approval, capture timestamp and clinician info immediately
   - Store approval state locally until publish is clicked
   - Show visual indicators for which sections are approved
   - If clarifications textarea is empty, automatically set to `"None"` before sending request

