# GET Expert Feedback API Specification

## Endpoint

```
GET /expert/feedback/summary/:summaryId
```

## Description

Retrieves expert feedback for a specific discharge summary (composition) with aggregated statistics. This endpoint is designed to support the Expert Review Portal by providing both individual feedback entries and summary statistics.

## Authentication

- **Generic Portal**: No authentication required
- **Tenant-Specific Portal**: Optional `Authorization` and `x-tenant-id` headers for tenant filtering

## Request

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `summaryId` | string | Yes | The composition ID (discharge summary ID) |

### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `reviewType` | string | No | `null` | Filter by review type: `simplification` or `translation` |
| `includeStats` | boolean | No | `true` | Include aggregated statistics in response |
| `includeFeedback` | boolean | No | `true` | Include individual feedback entries in response |
| `limit` | number | No | `50` | Maximum number of feedback entries to return |
| `offset` | number | No | `0` | Number of feedback entries to skip (for pagination) |
| `sortBy` | string | No | `reviewDate` | Sort field: `reviewDate`, `rating`, `createdAt` |
| `sortOrder` | string | No | `desc` | Sort order: `asc` or `desc` |

### Request Headers

**Generic Portal:**
```http
Content-Type: application/json
```

**Tenant-Specific Portal (Optional):**
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
  "summaryId": "composition-uuid-12345",
  "stats": {
    "totalReviews": 5,
    "simplificationReviews": 3,
    "translationReviews": 2,
    "averageRating": 4.2,
    "simplificationRating": 4.0,
    "translationRating": 4.5,
    "latestReviewDate": "2024-01-16T09:00:00Z",
    "latestSimplificationReview": "2024-01-15T10:30:00Z",
    "latestTranslationReview": "2024-01-16T09:00:00Z",
    "hasHallucination": false,
    "hasMissingInfo": false,
    "ratingDistribution": {
      "1": 0,
      "2": 0,
      "3": 1,
      "4": 2,
      "5": 2
    }
  },
  "feedback": [
    {
      "id": "feedback-uuid-abc123",
      "dischargeSummaryId": "composition-uuid-12345",
      "reviewType": "simplification",
      "language": null,
      "reviewerName": "Dr. Jane Smith",
      "reviewerHospital": "General Hospital",
      "reviewDate": "2024-01-16T09:00:00Z",
      "overallRating": 5,
      "whatWorksWell": "The language is clear and accessible. Medical jargon has been effectively simplified.",
      "whatNeedsImprovement": "Some sections could be broken down further.",
      "specificIssues": "Line 45: 'Anticoagulation therapy' should be simplified to 'blood-thinning medication'.",
      "hasHallucination": false,
      "hasMissingInfo": false,
      "createdAt": "2024-01-16T09:00:00Z",
      "updatedAt": null
    },
    {
      "id": "feedback-uuid-def456",
      "dischargeSummaryId": "composition-uuid-12345",
      "reviewType": "translation",
      "language": "es",
      "reviewerName": "Dr. Carlos Rodriguez",
      "reviewerHospital": "Centro Médico",
      "reviewDate": "2024-01-15T14:30:00Z",
      "overallRating": 4,
      "whatWorksWell": "Excellent translation with cultural appropriateness",
      "whatNeedsImprovement": "Minor grammar improvements needed",
      "specificIssues": "Línea 23: usar medicamento en vez de medicina",
      "hasHallucination": false,
      "hasMissingInfo": false,
      "createdAt": "2024-01-15T14:30:00Z",
      "updatedAt": null
    }
  ],
  "pagination": {
    "total": 5,
    "limit": 50,
    "offset": 0,
    "hasMore": false
  }
}
```

### Response Fields

#### Root Object

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | Always `true` for successful responses |
| `summaryId` | string | The discharge summary ID (composition ID) |
| `stats` | object | Aggregated statistics (if `includeStats=true`) |
| `feedback` | array | Array of feedback entries (if `includeFeedback=true`) |
| `pagination` | object | Pagination metadata |

#### Stats Object

| Field | Type | Description |
|-------|------|-------------|
| `totalReviews` | number | Total number of reviews for this summary |
| `simplificationReviews` | number | Number of simplification reviews |
| `translationReviews` | number | Number of translation reviews |
| `averageRating` | number | Average rating across all reviews (1-5) |
| `simplificationRating` | number | Average rating for simplification reviews |
| `translationRating` | number | Average rating for translation reviews |
| `latestReviewDate` | string (ISO 8601) | Date of the most recent review |
| `latestSimplificationReview` | string (ISO 8601) | Date of most recent simplification review |
| `latestTranslationReview` | string (ISO 8601) | Date of most recent translation review |
| `hasHallucination` | boolean | `true` if any review flagged hallucination |
| `hasMissingInfo` | boolean | `true` if any review flagged missing information |
| `ratingDistribution` | object | Count of reviews by rating (1-5) |

#### Feedback Entry Object

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique feedback ID |
| `dischargeSummaryId` | string | The composition ID |
| `reviewType` | string | `simplification` or `translation` |
| `language` | string \| null | Language code (ISO 639-1) for translation reviews |
| `reviewerName` | string | Name of the reviewer |
| `reviewerHospital` | string \| null | Hospital/institution of reviewer |
| `reviewDate` | string (ISO 8601) | Date when review was submitted |
| `overallRating` | number | Rating from 1-5 |
| `whatWorksWell` | string | Positive feedback |
| `whatNeedsImprovement` | string | Areas for improvement |
| `specificIssues` | string | Specific issues identified |
| `hasHallucination` | boolean | Whether review flagged hallucination |
| `hasMissingInfo` | boolean | Whether review flagged missing information |
| `createdAt` | string (ISO 8601) | When feedback was created |
| `updatedAt` | string (ISO 8601) \| null | When feedback was last updated |

#### Pagination Object

| Field | Type | Description |
|-------|------|-------------|
| `total` | number | Total number of feedback entries |
| `limit` | number | Maximum entries per page |
| `offset` | number | Number of entries skipped |
| `hasMore` | boolean | Whether more entries exist |

### Error Responses

#### 400 Bad Request

Invalid query parameters or summary ID format.

```json
{
  "error": "Bad Request",
  "message": "Invalid reviewType. Must be 'simplification' or 'translation'"
}
```

#### 404 Not Found

Discharge summary not found (only if tenant context is provided).

```json
{
  "error": "Not Found",
  "message": "Discharge summary with ID 'composition-uuid-12345' not found"
}
```

#### 500 Internal Server Error

Server error while retrieving feedback.

```json
{
  "error": "Internal Server Error",
  "message": "Failed to retrieve expert feedback"
}
```

## Example Requests

### Get All Feedback with Stats

```bash
curl -X GET "https://api.example.com/expert/feedback/summary/composition-uuid-12345" \
  -H "Content-Type: application/json"
```

### Get Only Simplification Reviews

```bash
curl -X GET "https://api.example.com/expert/feedback/summary/composition-uuid-12345?reviewType=simplification" \
  -H "Content-Type: application/json"
```

### Get Only Statistics (No Individual Feedback)

```bash
curl -X GET "https://api.example.com/expert/feedback/summary/composition-uuid-12345?includeFeedback=false" \
  -H "Content-Type: application/json"
```

### Get Feedback with Pagination

```bash
curl -X GET "https://api.example.com/expert/feedback/summary/composition-uuid-12345?limit=10&offset=0" \
  -H "Content-Type: application/json"
```

### Tenant-Specific Request

```bash
curl -X GET "https://api.example.com/expert/feedback/summary/composition-uuid-12345" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "x-tenant-id: demo"
```

## Use Cases

### 1. Expert Portal Table Display

The portal needs aggregated stats to display in the table:
- Review count
- Average rating
- Status (derived from review count and rating)
- Last review date

**Request:**
```bash
GET /expert/feedback/summary/{summaryId}?includeFeedback=false
```

**Response:** Returns only `stats` object for efficient table rendering.

### 2. Review Detail Page

When clicking "Review →", show all feedback for that summary:

**Request:**
```bash
GET /expert/feedback/summary/{summaryId}?includeStats=true&includeFeedback=true
```

**Response:** Returns both stats and all feedback entries.

### 3. Filter by Review Type

Show only simplification or translation reviews:

**Request:**
```bash
GET /expert/feedback/summary/{summaryId}?reviewType=simplification
```

## Implementation Notes

### Database Query

1. Query Firestore `expert_feedback` collection:
   - Filter by `dischargeSummaryId == summaryId`
   - Optionally filter by `reviewType == reviewType`
   - Optionally filter by `tenantId` if tenant context provided

2. Calculate statistics:
   - Count total reviews
   - Calculate average ratings (overall, by type)
   - Find latest review dates
   - Check for hallucination/missing info flags
   - Count rating distribution

3. Sort and paginate feedback entries

### Performance Considerations

- **Caching**: Consider caching stats for frequently accessed summaries
- **Indexes**: Ensure Firestore indexes on:
  - `dischargeSummaryId`
  - `(dischargeSummaryId, reviewType)`
  - `(dischargeSummaryId, tenantId)`
  - `reviewDate` (for sorting)

### Tenant Filtering

- If `x-tenant-id` header is provided:
  - Filter feedback by `tenantId == header value`
  - Verify composition exists in tenant's FHIR store
- If no tenant header:
  - Return all feedback (generic portal)
  - Skip composition verification

## Backend Implementation

The endpoint should:
1. Validate `summaryId` format
2. Validate query parameters
3. Query Firestore for feedback entries
4. Calculate aggregated statistics
5. Apply sorting and pagination
6. Return formatted response

## Frontend Integration

The frontend can use this endpoint to:
- Display review statistics in the expert portal table
- Show detailed feedback on the review page
- Filter by review type (simplification/translation)
- Paginate through feedback entries

