# Expert Review API Endpoints Specification

## Overview

This document provides detailed API specifications for the GET and POST operations for expert review data.

---

## 1. GET Review List (Discharge Queue with Review Stats)

### Endpoint
```
GET /api/patients/discharge-queue
```

### Description
Retrieves list of patients ready for discharge review with aggregated expert review statistics.

### Authentication
- **Generic Portal**: No authentication required
- **Tenant-Specific Portal**: Requires `Authorization` and `x-tenant-id` headers

### Request Headers

**Generic Portal (Optional):**
```http
Content-Type: application/json
```

**Tenant-Specific Portal (Required):**
```http
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
x-tenant-id: demo
```

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `reviewType` | string | No | Filter by review type: `'simplification'` or `'translation'` |
| `filter` | string | No | Filter by review status: `'all'`, `'no_reviews'`, or `'low_rating'` |
| `limit` | number | No | Number of results to return (default: 50, max: 100) |
| `offset` | number | No | Offset for pagination (default: 0) |

**Filter Options:**
- `all`: Return all patients with review stats
- `no_reviews`: Return only patients with 0 expert reviews
- `low_rating`: Return only patients with avgRating < 3.5 (and reviewCount > 0)

### Response

#### Success Response (200 OK)

```json
{
  "patients": [
    {
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
      "reviewCount": 3,
      "avgRating": 4.2,
      "latestReviewDate": "2024-03-14T10:30:00Z",
      "fileName": "MRN-12345-discharge-summary"
    },
    {
      "id": "patient-uuid-2",
      "mrn": "MRN-23456",
      "name": "Priya Sharma",
      "room": "415",
      "unit": "Emergency",
      "dischargeDate": "2024-03-16",
      "compositionId": "composition-uuid-23456",
      "status": "review",
      "attendingPhysician": {
        "name": "Dr. Sarah Johnson, MD",
        "id": "physician-uuid-1"
      },
      "avatar": null,
      "reviewCount": 0,
      "avgRating": null,
      "latestReviewDate": null,
      "fileName": "MRN-23456-discharge-summary"
    }
  ],
  "meta": {
    "total": 2,
    "pending": 0,
    "review": 2,
    "approved": 0
  }
}
```

#### Response Schema

```typescript
{
  patients: Patient[];
  meta: {
    total: number;
    pending: number;
    review: number;
    approved: number;
  };
}

interface Patient {
  // Core patient information
  id: string;                      // Patient ID
  mrn: string;                     // Medical Record Number
  name: string;                    // Patient full name
  room: string;                    // Room number
  unit: string;                    // Hospital unit/department
  dischargeDate: string;           // ISO 8601 date string
  compositionId: string;           // FHIR Composition ID (used for fetching content)
  status: 'review' | 'approved' | 'pending';

  // Attending physician
  attendingPhysician: {
    name: string;
    id: string;
  };

  // Optional fields
  avatar: string | null;           // Patient avatar URL

  // Expert review statistics (NEW - add these fields)
  reviewCount: number;             // Total number of expert reviews (0 if none)
  avgRating: number | null;        // Average rating 1-5 (null if no reviews)
  latestReviewDate: string | null; // ISO 8601 timestamp (null if no reviews)
  fileName: string;                // Display name for the summary
}
```

#### Error Responses

**400 Bad Request**
```json
{
  "error": "Bad Request",
  "message": "Invalid filter parameter. Must be 'all', 'no_reviews', or 'low_rating'"
}
```

**401 Unauthorized** (Tenant-specific only)
```json
{
  "error": "Unauthorized",
  "message": "Invalid or missing authentication token"
}
```

**403 Forbidden** (Tenant-specific only)
```json
{
  "error": "Forbidden",
  "message": "Invalid tenant ID or insufficient permissions"
}
```

**500 Internal Server Error**
```json
{
  "error": "Internal Server Error",
  "message": "Failed to retrieve discharge queue"
}
```

### Example Requests

#### Generic Portal - Get All Patients
```bash
curl -X GET "https://your-api.com/api/patients/discharge-queue" \
  -H "Content-Type: application/json"
```

#### Generic Portal - Get Patients Needing Simplification Reviews
```bash
curl -X GET "https://your-api.com/api/patients/discharge-queue?reviewType=simplification&filter=no_reviews&limit=25" \
  -H "Content-Type: application/json"
```

#### Tenant-Specific Portal - Get Patients with Low Ratings
```bash
curl -X GET "https://your-api.com/api/patients/discharge-queue?filter=low_rating" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "x-tenant-id: demo"
```

#### Tenant-Specific Portal - Get Translation Reviews with Pagination
```bash
curl -X GET "https://your-api.com/api/patients/discharge-queue?reviewType=translation&filter=all&limit=50&offset=50" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "x-tenant-id: demo"
```

### Backend Implementation Notes

1. **Aggregating Review Statistics:**

```sql
-- For each patient/compositionId, compute review stats
SELECT
  p.id,
  p.mrn,
  p.name,
  p.compositionId,
  -- ... other patient fields
  COALESCE(COUNT(ef.id), 0) as reviewCount,
  AVG(ef.overallRating) as avgRating,
  MAX(ef.reviewDate) as latestReviewDate
FROM patients p
LEFT JOIN expert_feedback ef ON ef.dischargeSummaryId = p.compositionId
WHERE
  -- Tenant filtering (if authenticated)
  (p.tenantId IS NULL OR p.tenantId = ?)
  -- Review type filtering (optional)
  AND (? IS NULL OR ef.reviewType = ?)
GROUP BY p.id, p.mrn, p.name, p.compositionId
HAVING
  -- Apply filter
  (? = 'all') OR
  (? = 'no_reviews' AND COALESCE(COUNT(ef.id), 0) = 0) OR
  (? = 'low_rating' AND AVG(ef.overallRating) < 3.5 AND COUNT(ef.id) > 0)
ORDER BY p.dischargeDate DESC
LIMIT ? OFFSET ?
```

2. **Filtering Logic:**
   - If no auth headers: Return all patients
   - If auth headers present: Filter by tenantId
   - Apply review filters based on query parameters

3. **Performance Optimization:**
   - Consider caching review stats
   - Use database indexes on `dischargeSummaryId`, `tenantId`, `reviewType`
   - Pre-compute stats when feedback is submitted

---

## 2. POST Expert Feedback

### Endpoint
```
POST /expert/feedback
```

### Description
Submits expert review feedback for a discharge summary (simplification or translation review).

### Authentication
- **Generic Portal**: No authentication required
- **Tenant-Specific Portal**: Requires `Authorization` and `x-tenant-id` headers

### Request Headers

**Generic Portal:**
```http
Content-Type: application/json
```

**Tenant-Specific Portal:**
```http
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
x-tenant-id: demo
```

### Request Body

#### Simplification Review
```json
{
  "dischargeSummaryId": "composition-uuid-12345",
  "reviewType": "simplification",
  "reviewerName": "Dr. Jane Smith",
  "reviewerHospital": "General Hospital",
  "overallRating": 4,
  "whatWorksWell": "The language is clear and accessible. Medical jargon has been effectively simplified. The structure follows a logical flow that patients can understand.",
  "whatNeedsImprovement": "Some sections could be broken down further. The medication instructions section still contains complex terminology.",
  "specificIssues": "Line 45: 'Anticoagulation therapy' should be simplified to 'blood-thinning medication'. Line 67: The dosage instructions are confusing.",
  "hasHallucination": false,
  "hasMissingInfo": false
}
```

#### Translation Review
```json
{
  "dischargeSummaryId": "composition-uuid-23456",
  "reviewType": "translation",
  "language": "es",
  "reviewerName": "Dr. Carlos Rodriguez",
  "reviewerHospital": "Centro Médico",
  "overallRating": 5,
  "whatWorksWell": "Excellent translation that maintains medical accuracy while being culturally appropriate. Terminology is consistent throughout.",
  "whatNeedsImprovement": "Minor grammar issue in the medication section. Consider using more common regional variations.",
  "specificIssues": "Línea 23: 'tomar la medicina' should be 'tomar el medicamento' for better clarity.",
  "hasHallucination": false,
  "hasMissingInfo": false
}
```

### Request Body Schema

```typescript
{
  dischargeSummaryId: string;          // Required - compositionId from discharge queue
  reviewType: 'simplification' | 'translation';  // Required
  language?: string;                   // Required if reviewType='translation' (ISO 639-1 code: 'es', 'zh', 'hi', etc.)
  reviewerName: string;                // Required - Name of the expert reviewer
  reviewerHospital?: string;           // Optional - Reviewer's hospital/organization
  overallRating: 1 | 2 | 3 | 4 | 5;   // Required - Overall quality rating
  whatWorksWell: string;               // Optional but recommended - Positive feedback
  whatNeedsImprovement: string;        // Optional but recommended - Areas for improvement
  specificIssues: string;              // Optional - Specific text issues with line numbers
  hasHallucination: boolean;           // Required - Flag for AI-generated false information
  hasMissingInfo: boolean;             // Required - Flag for missing critical information
}
```

### Field Validation Rules

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `dischargeSummaryId` | string | Yes | Must be valid compositionId |
| `reviewType` | string | Yes | Must be 'simplification' or 'translation' |
| `language` | string | Conditional | Required if reviewType='translation'. Must be valid ISO 639-1 code |
| `reviewerName` | string | Yes | Min length: 2, Max length: 100 |
| `reviewerHospital` | string | No | Max length: 200 |
| `overallRating` | number | Yes | Must be integer between 1-5 inclusive |
| `whatWorksWell` | string | No | Max length: 2000 |
| `whatNeedsImprovement` | string | No | Max length: 2000 |
| `specificIssues` | string | No | Max length: 5000 |
| `hasHallucination` | boolean | Yes | Must be boolean |
| `hasMissingInfo` | boolean | Yes | Must be boolean |

### Response

#### Success Response (201 Created)

```json
{
  "success": true,
  "id": "feedback-uuid-abc123",
  "message": "Expert feedback submitted successfully"
}
```

#### Response Schema

```typescript
{
  success: boolean;
  id: string;           // UUID of the created feedback record
  message: string;
}
```

#### Error Responses

**400 Bad Request - Missing Required Fields**
```json
{
  "error": "Bad Request",
  "message": "Missing required field: reviewerName"
}
```

**400 Bad Request - Invalid Rating**
```json
{
  "error": "Bad Request",
  "message": "overallRating must be between 1 and 5"
}
```

**400 Bad Request - Missing Language for Translation**
```json
{
  "error": "Bad Request",
  "message": "language is required when reviewType is 'translation'"
}
```

**400 Bad Request - Invalid Review Type**
```json
{
  "error": "Bad Request",
  "message": "reviewType must be 'simplification' or 'translation'"
}
```

**401 Unauthorized** (Tenant-specific only)
```json
{
  "error": "Unauthorized",
  "message": "Invalid or missing authentication token"
}
```

**403 Forbidden** (Tenant-specific only)
```json
{
  "error": "Forbidden",
  "message": "You do not have permission to submit feedback for this tenant"
}
```

**404 Not Found**
```json
{
  "error": "Not Found",
  "message": "Discharge summary with ID 'composition-uuid-12345' not found"
}
```

**500 Internal Server Error**
```json
{
  "error": "Internal Server Error",
  "message": "Failed to save expert feedback"
}
```

### Example Requests

#### Generic Portal - Submit Simplification Review
```bash
curl -X POST "https://your-api.com/expert/feedback" \
  -H "Content-Type: application/json" \
  -d '{
    "dischargeSummaryId": "composition-uuid-12345",
    "reviewType": "simplification",
    "reviewerName": "Dr. Jane Smith",
    "reviewerHospital": "General Hospital",
    "overallRating": 4,
    "whatWorksWell": "Clear language and good structure",
    "whatNeedsImprovement": "Some medical terms need more simplification",
    "specificIssues": "Line 45: anticoagulation therapy needs simplification",
    "hasHallucination": false,
    "hasMissingInfo": false
  }'
```

#### Tenant-Specific Portal - Submit Translation Review
```bash
curl -X POST "https://your-api.com/expert/feedback" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "x-tenant-id: demo" \
  -d '{
    "dischargeSummaryId": "composition-uuid-23456",
    "reviewType": "translation",
    "language": "es",
    "reviewerName": "Dr. Carlos Rodriguez",
    "reviewerHospital": "Centro Médico",
    "overallRating": 5,
    "whatWorksWell": "Excellent translation with cultural appropriateness",
    "whatNeedsImprovement": "Minor grammar improvements needed",
    "specificIssues": "Línea 23: usar medicamento en vez de medicina",
    "hasHallucination": false,
    "hasMissingInfo": false
  }'
```

### Backend Implementation

#### Database Insert

**Generic Portal (No Authentication):**
```sql
INSERT INTO expert_feedback (
  id,
  dischargeSummaryId,
  tenantId,
  reviewType,
  language,
  reviewerName,
  reviewerHospital,
  reviewerId,
  overallRating,
  whatWorksWell,
  whatNeedsImprovement,
  specificIssues,
  hasHallucination,
  hasMissingInfo,
  reviewDate,
  createdAt,
  updatedAt
) VALUES (
  ?, -- generated UUID
  ?, -- dischargeSummaryId from request
  NULL, -- tenantId is NULL for generic reviews
  ?, -- reviewType from request
  ?, -- language from request (if translation)
  ?, -- reviewerName from request
  ?, -- reviewerHospital from request
  NULL, -- reviewerId is NULL (no auth)
  ?, -- overallRating from request
  ?, -- whatWorksWell from request
  ?, -- whatNeedsImprovement from request
  ?, -- specificIssues from request
  ?, -- hasHallucination from request
  ?, -- hasMissingInfo from request
  NOW(), -- reviewDate
  NOW(), -- createdAt
  NOW()  -- updatedAt
);
```

**Tenant-Specific Portal (With Authentication):**
```sql
INSERT INTO expert_feedback (
  id,
  dischargeSummaryId,
  tenantId,
  reviewType,
  language,
  reviewerName,
  reviewerHospital,
  reviewerId,
  overallRating,
  whatWorksWell,
  whatNeedsImprovement,
  specificIssues,
  hasHallucination,
  hasMissingInfo,
  reviewDate,
  createdAt,
  updatedAt
) VALUES (
  ?,
  ?,
  ?, -- tenantId from x-tenant-id header
  ?,
  ?,
  ?,
  ?,
  ?, -- reviewerId extracted from JWT token
  ?,
  ?,
  ?,
  ?,
  ?,
  ?,
  NOW(),
  NOW(),
  NOW()
);
```

#### Validation Pseudocode

```javascript
function validateFeedbackRequest(req) {
  const { body, headers } = req;

  // Required fields
  if (!body.dischargeSummaryId) throw new BadRequestError('dischargeSummaryId is required');
  if (!body.reviewType) throw new BadRequestError('reviewType is required');
  if (!body.reviewerName || body.reviewerName.trim().length < 2) {
    throw new BadRequestError('reviewerName is required and must be at least 2 characters');
  }
  if (body.overallRating === undefined) throw new BadRequestError('overallRating is required');
  if (body.hasHallucination === undefined) throw new BadRequestError('hasHallucination is required');
  if (body.hasMissingInfo === undefined) throw new BadRequestError('hasMissingInfo is required');

  // Review type validation
  if (!['simplification', 'translation'].includes(body.reviewType)) {
    throw new BadRequestError('reviewType must be simplification or translation');
  }

  // Language required for translation
  if (body.reviewType === 'translation' && !body.language) {
    throw new BadRequestError('language is required for translation reviews');
  }

  // Rating validation
  if (!Number.isInteger(body.overallRating) || body.overallRating < 1 || body.overallRating > 5) {
    throw new BadRequestError('overallRating must be an integer between 1 and 5');
  }

  // Length validations
  if (body.reviewerName.length > 100) throw new BadRequestError('reviewerName too long');
  if (body.reviewerHospital && body.reviewerHospital.length > 200) {
    throw new BadRequestError('reviewerHospital too long');
  }
  if (body.whatWorksWell && body.whatWorksWell.length > 2000) {
    throw new BadRequestError('whatWorksWell too long');
  }
  if (body.whatNeedsImprovement && body.whatNeedsImprovement.length > 2000) {
    throw new BadRequestError('whatNeedsImprovement too long');
  }
  if (body.specificIssues && body.specificIssues.length > 5000) {
    throw new BadRequestError('specificIssues too long');
  }

  // Verify discharge summary exists
  const summaryExists = await checkCompositionExists(body.dischargeSummaryId);
  if (!summaryExists) {
    throw new NotFoundError(`Discharge summary ${body.dischargeSummaryId} not found`);
  }

  // Tenant validation (if authenticated)
  if (headers['x-tenant-id']) {
    const tenantId = headers['x-tenant-id'];
    const token = headers.authorization?.replace('Bearer ', '');

    // Validate token
    const user = await validateToken(token);
    if (!user) throw new UnauthorizedError('Invalid token');

    // Verify summary belongs to tenant
    const belongsToTenant = await verifySummaryTenant(body.dischargeSummaryId, tenantId);
    if (!belongsToTenant) {
      throw new ForbiddenError('This discharge summary does not belong to your tenant');
    }
  }

  return true;
}
```

---

## Database Schema

### expert_feedback Table

```sql
CREATE TABLE expert_feedback (
  id VARCHAR(36) PRIMARY KEY,
  dischargeSummaryId VARCHAR(36) NOT NULL,
  tenantId VARCHAR(36),
  reviewType VARCHAR(20) NOT NULL CHECK (reviewType IN ('simplification', 'translation')),
  language VARCHAR(10),
  reviewerName VARCHAR(100) NOT NULL,
  reviewerHospital VARCHAR(200),
  reviewerId VARCHAR(36),
  overallRating INTEGER NOT NULL CHECK (overallRating BETWEEN 1 AND 5),
  whatWorksWell TEXT,
  whatNeedsImprovement TEXT,
  specificIssues TEXT,
  hasHallucination BOOLEAN NOT NULL DEFAULT FALSE,
  hasMissingInfo BOOLEAN NOT NULL DEFAULT FALSE,
  reviewDate TIMESTAMP NOT NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_dischargeSummaryId (dischargeSummaryId),
  INDEX idx_tenantId (tenantId),
  INDEX idx_reviewType (reviewType),
  INDEX idx_reviewDate (reviewDate),
  INDEX idx_composite_summary_tenant (dischargeSummaryId, tenantId)
);
```

### Firestore Schema (Alternative)

```javascript
// Collection: expert_feedback
{
  id: "feedback-uuid-abc123",
  dischargeSummaryId: "composition-uuid-12345",
  tenantId: "demo" | null,
  reviewType: "simplification" | "translation",
  language: "es" | null,
  reviewerName: "Dr. Jane Smith",
  reviewerHospital: "General Hospital" | null,
  reviewerId: "user-uuid" | null,
  overallRating: 4,
  whatWorksWell: "Clear language...",
  whatNeedsImprovement: "Some sections...",
  specificIssues: "Line 45...",
  hasHallucination: false,
  hasMissingInfo: false,
  reviewDate: Timestamp,
  createdAt: Timestamp,
  updatedAt: Timestamp
}

// Indexes
dischargeSummaryId ASC
tenantId ASC
reviewType ASC
reviewDate DESC
dischargeSummaryId ASC, tenantId ASC (composite)
```

---

## Testing Examples

### Test Case 1: Submit Generic Simplification Review

**Request:**
```bash
POST /expert/feedback
Content-Type: application/json

{
  "dischargeSummaryId": "comp-123",
  "reviewType": "simplification",
  "reviewerName": "Dr. Smith",
  "overallRating": 4,
  "whatWorksWell": "Good",
  "whatNeedsImprovement": "Fair",
  "specificIssues": "None",
  "hasHallucination": false,
  "hasMissingInfo": false
}
```

**Expected Response:**
```json
{
  "success": true,
  "id": "feedback-uuid",
  "message": "Expert feedback submitted successfully"
}
```

### Test Case 2: Submit Tenant Translation Review

**Request:**
```bash
POST /expert/feedback
Content-Type: application/json
Authorization: Bearer valid-token
x-tenant-id: demo

{
  "dischargeSummaryId": "comp-456",
  "reviewType": "translation",
  "language": "es",
  "reviewerName": "Dr. Rodriguez",
  "overallRating": 5,
  "whatWorksWell": "Excellent",
  "whatNeedsImprovement": "None",
  "specificIssues": "None",
  "hasHallucination": false,
  "hasMissingInfo": false
}
```

**Expected Response:**
```json
{
  "success": true,
  "id": "feedback-uuid",
  "message": "Expert feedback submitted successfully"
}
```

### Test Case 3: Missing Language for Translation

**Request:**
```bash
POST /expert/feedback
Content-Type: application/json

{
  "dischargeSummaryId": "comp-789",
  "reviewType": "translation",
  "reviewerName": "Dr. Lee",
  "overallRating": 3,
  "hasHallucination": false,
  "hasMissingInfo": false
}
```

**Expected Response:**
```json
{
  "error": "Bad Request",
  "message": "language is required when reviewType is 'translation'"
}
```

### Test Case 4: Invalid Rating

**Request:**
```bash
POST /expert/feedback
Content-Type: application/json

{
  "dischargeSummaryId": "comp-999",
  "reviewType": "simplification",
  "reviewerName": "Dr. Johnson",
  "overallRating": 6,
  "hasHallucination": false,
  "hasMissingInfo": false
}
```

**Expected Response:**
```json
{
  "error": "Bad Request",
  "message": "overallRating must be an integer between 1 and 5"
}
```

---

## Rate Limiting

Recommended rate limits:
- **Generic Portal**: 100 requests per hour per IP
- **Tenant-Specific Portal**: 1000 requests per hour per tenant
- **Feedback Submission**: Max 10 submissions per minute per reviewer

---

## Security Considerations

1. **Input Sanitization**: Sanitize all text inputs to prevent XSS attacks
2. **SQL Injection**: Use parameterized queries for all database operations
3. **Authentication**: Verify JWT tokens for tenant-specific requests
4. **Authorization**: Ensure users can only submit feedback for their tenant's summaries
5. **Rate Limiting**: Implement rate limiting to prevent abuse
6. **Logging**: Log all feedback submissions for audit purposes
7. **Data Privacy**: Ensure patient data is handled according to HIPAA/PHI regulations
