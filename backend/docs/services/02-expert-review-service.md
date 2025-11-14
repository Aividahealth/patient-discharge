# Expert Review Service

## Overview

The Expert Review Service allows medical experts to review discharge summaries and provide feedback on simplification and translation quality. Feedback is stored in Firestore and can be retrieved for analysis.

## Business Logic

### Review Workflow

1. Expert views list of discharge summaries available for review
2. Expert selects a summary to review
3. Expert submits feedback with ratings and comments
4. Feedback is stored in Firestore with metadata
5. Feedback can be updated or retrieved later

### Feedback Validation

The service validates:
- Required fields (dischargeSummaryId, reviewType, reviewerName, overallRating, hasHallucination, hasMissingInfo)
- Conditional fields (language required if reviewType='translation')
- Field lengths and formats
- Rating range (1-5)
- Review type values ('simplification' or 'translation')

### Data Storage

- Feedback stored in Firestore collection: `expert_feedback`
- Discharge summaries metadata in: `discharge_summaries`
- Feedback linked to discharge summary via `dischargeSummaryId`
- Supports filtering and aggregation queries

## API Endpoints

### GET /expert/list

Get list of discharge summaries available for expert review.

**Query Parameters:**
| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| `type` | string | Filter by review type ('simplification' or 'translation') | - |
| `filter` | string | Filter: 'all', 'no_reviews', 'low_rating' | 'all' |
| `limit` | number | Number of results per page | 20 |
| `offset` | number | Pagination offset | 0 |

**Example Request:**
```bash
GET /expert/list?type=simplification&filter=no_reviews&limit=10
```

**Response (200 OK):**
```json
{
  "summaries": [
    {
      "id": "9f0d413e-8d13-4736-b961-5df1bc71582d",
      "patientName": "John Smith",
      "mrn": "MRN123",
      "simplifiedAt": "2024-01-15T10:30:00Z",
      "translatedAt": "2024-01-15T11:00:00Z",
      "reviewCount": 2,
      "avgRating": 4.5,
      "latestReviewDate": "2024-01-16T09:00:00Z"
    }
  ],
  "total": 45
}
```

### POST /expert/feedback

Submit expert feedback for a discharge summary.

**Request Body:**
```json
{
  "dischargeSummaryId": "9f0d413e-8d13-4736-b961-5df1bc71582d",
  "reviewType": "simplification",
  "language": "es",
  "reviewerName": "Dr. Jane Smith",
  "reviewerHospital": "General Hospital",
  "overallRating": 4,
  "whatWorksWell": "The language is clear and accessible.",
  "whatNeedsImprovement": "Some sections could be broken down further.",
  "specificIssues": "Line 45: Anticoagulation therapy should be simplified.",
  "hasHallucination": false,
  "hasMissingInfo": false
}
```

**Field Validation:**
- `dischargeSummaryId`: Required, must be valid compositionId
- `reviewType`: Required, must be 'simplification' or 'translation'
- `language`: Required if reviewType='translation', ISO 639-1 code (2 chars)
- `reviewerName`: Required, 2-100 characters
- `reviewerHospital`: Optional, max 200 characters
- `overallRating`: Required, integer 1-5
- `whatWorksWell`: Optional, max 2000 characters
- `whatNeedsImprovement`: Optional, max 2000 characters
- `specificIssues`: Optional, max 5000 characters
- `hasHallucination`: Required, boolean
- `hasMissingInfo`: Required, boolean

**Response (201 Created):**
```json
{
  "success": true,
  "id": "feedback-uuid-abc123",
  "message": "Expert feedback submitted successfully"
}
```

**Error Responses:**
- **400 Bad Request**: Validation errors (missing fields, invalid values)
- **404 Not Found**: Discharge summary not found (if tenant context available)
- **500 Internal Server Error**: Failed to save feedback

### GET /expert/feedback/:id

Get feedback by ID.

**Response (200 OK):**
```json
{
  "id": "feedback-uuid-abc123",
  "dischargeSummaryId": "9f0d413e-8d13-4736-b961-5df1bc71582d",
  "reviewType": "simplification",
  "reviewerName": "Dr. Jane Smith",
  "reviewerHospital": "General Hospital",
  "reviewDate": "2024-01-16T09:00:00Z",
  "overallRating": 4,
  "whatWorksWell": "The language is clear and accessible.",
  "whatNeedsImprovement": "Some sections could be broken down further.",
  "specificIssues": "Line 45: Anticoagulation therapy should be simplified.",
  "hasHallucination": false,
  "hasMissingInfo": false,
  "createdAt": "2024-01-16T09:00:00Z"
}
```

### PUT /expert/feedback/:id

Update existing feedback (allows partial updates).

**Request Body:**
```json
{
  "overallRating": 5,
  "whatNeedsImprovement": "Updated feedback text"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "id": "feedback-uuid-abc123",
  "message": "Feedback updated successfully"
}
```

### GET /expert/feedback/summary/:summaryId

Get all feedback for a specific discharge summary.

**Query Parameters:**
- `reviewType`: Optional, filter by review type

**Response (200 OK):**
```json
[
  {
    "id": "feedback-1",
    "reviewType": "simplification",
    "reviewerName": "Dr. Jane Smith",
    "overallRating": 4,
    "reviewDate": "2024-01-16T09:00:00Z"
  },
  {
    "id": "feedback-2",
    "reviewType": "translation",
    "language": "es",
    "reviewerName": "Dr. John Doe",
    "overallRating": 5,
    "reviewDate": "2024-01-16T10:00:00Z"
  }
]
```

## Business Rules

1. **Review Types**: Only 'simplification' and 'translation' are supported
2. **Language Requirement**: Language is required for translation reviews
3. **Rating Scale**: Overall rating must be between 1-5 (inclusive)
4. **Feedback Linking**: Feedback is linked to discharge summary via compositionId
5. **Multiple Reviews**: Multiple experts can review the same summary
6. **Update Support**: Feedback can be updated after submission

## Data Model

### ExpertFeedback (Firestore)
```typescript
{
  id: string;
  dischargeSummaryId: string;
  reviewType: 'simplification' | 'translation';
  language?: string;
  reviewerName: string;
  reviewerHospital?: string;
  reviewDate: Date;
  overallRating: 1 | 2 | 3 | 4 | 5;
  whatWorksWell?: string;
  whatNeedsImprovement?: string;
  specificIssues?: string;
  hasHallucination: boolean;
  hasMissingInfo: boolean;
  createdAt: Date;
  updatedAt?: Date;
}
```

## Statistics and Aggregation

The service calculates:
- Review count per summary
- Average rating per summary
- Latest review date
- Filtering by review type and rating thresholds

