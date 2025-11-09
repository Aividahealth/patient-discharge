# Expert Portal Backend API Specification

This document specifies the backend API changes needed for the Expert Portal frontend to function properly using the existing `/api/patients/discharge-queue` endpoint.

## Overview

The Expert Portal has two modes:
1. **Generic Portal** (`/expert`) - Shows ALL discharge summaries, no authentication required
2. **Tenant-Specific Portal** (`/[tenantId]/expert`) - Shows ONLY summaries for a specific tenant, requires authentication

Both portals use the **existing `/api/patients/discharge-queue` endpoint** with additional query parameters for expert review functionality.

## Authentication

### Generic Portal
- **No authentication required**
- Does NOT send `Authorization` or `x-tenant-id` headers
- Backend should return all patients/discharge summaries

### Tenant-Specific Portal
- **Authentication required**
- Sends these headers:
  - `Authorization: Bearer {token}`
  - `x-tenant-id: {tenantId}`
- Backend should filter to only show patients belonging to the tenant

---

## API Endpoint Changes

### Enhanced: Get Discharge Queue for Expert Review

**Endpoint:** `GET /api/patients/discharge-queue`

**Description:** Retrieves list of patients ready for discharge review. **Enhanced to support expert review use cases** with additional query parameters and review statistics.

**Query Parameters:**

**Existing:**
- None (original endpoint returns all patients)

**New (for Expert Portal):**
- `reviewType` (optional): `'simplification'` | `'translation'` - Filter by review type
- `filter` (optional): `'all'` | `'no_reviews'` | `'low_rating'` - Filter by review status
  - `all`: Return all patients
  - `no_reviews`: Return only patients with 0 expert reviews
  - `low_rating`: Return only patients with avg expert review rating < 3.5
- `limit` (optional): Number of results to return (default: 50)
- `offset` (optional): Offset for pagination (default: 0)

**Request Headers (Tenant-Specific Only):**
```
Authorization: Bearer {token}
x-tenant-id: {tenantId}
Content-Type: application/json
```

**Enhanced Response:**

The existing response structure remains the same, but each patient object is **enhanced with expert review statistics**:

```typescript
{
  "patients": [
    {
      // EXISTING FIELDS (keep as-is)
      "id": "patient-uuid-1",
      "mrn": "MRN-12345",
      "name": "John Smith",
      "room": "302",
      "unit": "Cardiology Unit",
      "dischargeDate": "2024-03-15",
      "compositionId": "composition-uuid-12345",
      "status": "review",
      "attendingPhysician": {
        "name": "Dr. Sarah Johnson, MD",
        "id": "physician-uuid-1"
      },
      "avatar": "https://example.com/avatars/patient-1.jpg",

      // NEW FIELDS (add these for expert portal)
      "reviewCount": 3,                    // Total number of expert reviews
      "avgRating": 4.2,                    // Average expert rating (1-5)
      "latestReviewDate": "2024-03-14",    // Date of most recent expert review
      "fileName": "MRN-12345-discharge-summary"  // For display purposes
    },
    // ... more patients
  ],
  "meta": {
    "total": 4,
    "pending": 0,
    "review": 3,
    "approved": 1
  }
}
```

**Backend Implementation Notes:**

1. **Without query parameters** (existing behavior):
   - Return all patients as before
   - Optionally include review stats if available

2. **With expert-specific query parameters**:
   - Filter patients based on `filter` parameter
   - For each patient, query the `expert_feedback` collection/table:
     ```sql
     SELECT
       COUNT(*) as reviewCount,
       AVG(overallRating) as avgRating,
       MAX(reviewDate) as latestReviewDate
     FROM expert_feedback
     WHERE dischargeSummaryId = compositionId
       AND (tenantId = ? OR tenantId IS NULL)  -- Filter by tenant if authenticated
     GROUP BY dischargeSummaryId
     ```

3. **Filtering logic**:
   - `filter=all`: No filtering, return all patients with stats
   - `filter=no_reviews`: Only return patients where `reviewCount = 0`
   - `filter=low_rating`: Only return patients where `avgRating < 3.5 AND reviewCount > 0`

4. **Review type filtering** (optional future enhancement):
   - `reviewType=simplification`: Filter reviews by type in the aggregation
   - `reviewType=translation`: Filter reviews by type in the aggregation

---

## Additional API Endpoints

### 1. Submit Expert Feedback

**Endpoint:** `POST /expert/feedback`

**Description:** Submits expert review feedback for a discharge summary.

**Request Headers (Tenant-Specific Only):**
```
Authorization: Bearer {token}
x-tenant-id: {tenantId}
Content-Type: application/json
```

**Request Body:**
```typescript
{
  dischargeSummaryId: string;          // compositionId from discharge queue
  reviewType: 'simplification' | 'translation';
  language?: string;                   // Required if reviewType='translation'
  reviewerName: string;
  reviewerHospital?: string;
  overallRating: 1 | 2 | 3 | 4 | 5;
  whatWorksWell: string;
  whatNeedsImprovement: string;
  specificIssues: string;
  hasHallucination: boolean;
  hasMissingInfo: boolean;
}
```

**Response:**
```typescript
{
  success: boolean;
  id: string;                          // ID of created feedback record
  message: string;
}
```

**Backend Logic:**

For **Generic Portal** (no auth headers):
- Validate request body
- Create feedback record in `expert_feedback` collection/table:
  ```typescript
  {
    id: generateId(),
    dischargeSummaryId: req.body.dischargeSummaryId,
    tenantId: null,                    // No tenant for generic reviews
    reviewType: req.body.reviewType,
    language: req.body.language,
    reviewerName: req.body.reviewerName,
    reviewerHospital: req.body.reviewerHospital,
    reviewerId: null,
    overallRating: req.body.overallRating,
    whatWorksWell: req.body.whatWorksWell,
    whatNeedsImprovement: req.body.whatNeedsImprovement,
    specificIssues: req.body.specificIssues,
    hasHallucination: req.body.hasHallucination,
    hasMissingInfo: req.body.hasMissingInfo,
    reviewDate: new Date(),
    createdAt: new Date(),
    updatedAt: new Date()
  }
  ```

For **Tenant-Specific Portal** (with auth headers):
- Extract tenantId from `x-tenant-id` header
- Validate token
- Create feedback record with tenantId:
  ```typescript
  {
    ...same as above,
    tenantId: extractedTenantId,
    reviewerId: extractFromToken(token)  // If available
  }
  ```

**Error Responses:**
- `400 Bad Request` - Invalid request body
- `401 Unauthorized` - Invalid token (tenant-specific only)
- `404 Not Found` - Discharge summary not found
- `500 Internal Server Error` - Server error

---

### 2. Get Discharge Summary Content (Using Existing Endpoint)

The frontend already uses the existing endpoint for fetching discharge summary content:

**Endpoint:** `GET /google/fhir/Composition/{compositionId}/binaries`

**Query Parameters:** None

**Request Headers (Tenant-Specific Only):**
```
Authorization: Bearer {token}
X-Tenant-ID: {tenantId}
Content-Type: application/json
```

**No changes needed** - This endpoint already works for both generic and tenant-specific portals.

---

## Database Schema

### New Table/Collection: `expert_feedback`

```typescript
{
  id: string;                          // Auto-generated ID
  dischargeSummaryId: string;          // compositionId from discharge queue
  tenantId: string | null;             // null for generic reviews, tenantId for tenant-specific
  reviewType: 'simplification' | 'translation';
  language: string | null;             // Only for translation reviews
  reviewerName: string;
  reviewerHospital: string | null;
  reviewerId: string | null;           // User ID if authenticated
  overallRating: number;               // 1-5
  whatWorksWell: string;
  whatNeedsImprovement: string;
  specificIssues: string;
  hasHallucination: boolean;
  hasMissingInfo: boolean;
  reviewDate: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

**Indexes:**
- `dischargeSummaryId` - For querying feedback by composition
- `tenantId` - For tenant-specific queries
- `reviewType` - For filtering by type
- `reviewDate` - For sorting by date
- Composite index: `(dischargeSummaryId, tenantId)` - For efficient aggregation

---

## Implementation Summary

### Backend Changes Needed:

1. **Enhance `/api/patients/discharge-queue` endpoint:**
   - Accept new query parameters: `reviewType`, `filter`, `limit`, `offset`
   - For each patient, aggregate expert review statistics from `expert_feedback` table
   - Add `reviewCount`, `avgRating`, `latestReviewDate`, `fileName` to patient objects
   - Support filtering by review status

2. **Create `/expert/feedback` endpoint:**
   - Accept POST requests with expert feedback
   - Store in `expert_feedback` table
   - Handle both generic (no auth) and tenant-specific (with auth) requests

3. **Create `expert_feedback` database table:**
   - Store expert reviews
   - Index for efficient querying

### Frontend Changes Made:

✅ Updated `lib/expert-api.ts` to use `/api/patients/discharge-queue`
✅ Updated both expert portal pages to use new data structure (patient name, MRN, compositionId)
✅ Updated review page navigation to use `compositionId`
✅ Updated table columns to show patient info instead of file names

---

## Example API Calls

### Generic Portal - Get All Patients
```bash
GET /api/patients/discharge-queue
# No auth headers
```

### Generic Portal - Get Patients Needing Reviews (Simplification)
```bash
GET /api/patients/discharge-queue?reviewType=simplification&filter=no_reviews&limit=50
# No auth headers
```

### Tenant-Specific Portal - Get All Patients
```bash
GET /api/patients/discharge-queue
Headers:
  Authorization: Bearer eyJhbGc...
  x-tenant-id: demo
```

### Tenant-Specific Portal - Get Patients with Low Ratings
```bash
GET /api/patients/discharge-queue?filter=low_rating&limit=50
Headers:
  Authorization: Bearer eyJhbGc...
  x-tenant-id: demo
```

### Submit Feedback (Generic)
```bash
POST /expert/feedback
Content-Type: application/json

{
  "dischargeSummaryId": "composition-uuid-12345",
  "reviewType": "simplification",
  "reviewerName": "Dr. Jane Smith",
  "reviewerHospital": "General Hospital",
  "overallRating": 4,
  "whatWorksWell": "Clear language",
  "whatNeedsImprovement": "Some medical terms need simplification",
  "specificIssues": "...",
  "hasHallucination": false,
  "hasMissingInfo": false
}
```

### Submit Feedback (Tenant-Specific)
```bash
POST /expert/feedback
Content-Type: application/json
Authorization: Bearer eyJhbGc...
x-tenant-id: demo

{
  "dischargeSummaryId": "composition-uuid-23456",
  "reviewType": "translation",
  "language": "es",
  "reviewerName": "Dr. Carlos Rodriguez",
  "overallRating": 5,
  ...
}
```

---

## Migration Notes

1. **Minimal Changes**: We're reusing the existing `/api/patients/discharge-queue` endpoint, just enhancing it
2. **Backward Compatible**: Without query parameters, endpoint works as before
3. **New Table**: Only need to create `expert_feedback` table and one new endpoint
4. **Performance**: Consider caching review stats or pre-computing them when feedback is submitted
