# Firestore Index Configuration

This document explains the Firestore indexes needed for optimal query performance in the patient discharge application.

## Collections and Query Patterns

### 1. **audit_logs** Collection

**Purpose:** Stores audit trail of user actions and system events

**Query Patterns:**
- Filter by `tenantId` + order by `timestamp DESC` (basic audit log listing)
- Filter by `tenantId` + `type` + order by `timestamp DESC` (filter by audit type)
- Filter by `tenantId` + `userId` + order by `timestamp DESC` (user-specific audits)
- Filter by `tenantId` + `patientId` + order by `timestamp DESC` (patient-specific audits)
- Optionally filter by `timestamp` range (startDate/endDate)

**Required Indexes:**
```json
{
  "fields": ["tenantId ASC", "timestamp DESC"]
}
{
  "fields": ["tenantId ASC", "type ASC", "timestamp DESC"]
}
{
  "fields": ["tenantId ASC", "userId ASC", "timestamp DESC"]
}
{
  "fields": ["tenantId ASC", "patientId ASC", "timestamp DESC"]
}
```

**Performance Impact:** Critical for tenant admin portal audit log viewing and filtering

---

### 2. **discharge_summaries** Collection

**Purpose:** Stores discharge summary documents and metadata

**Query Patterns:**
- Filter by `tenantId` + order by `updatedAt DESC` (recent summaries)
- Filter by `tenantId` + order by `createdAt DESC` (chronological listing)
- Filter by `tenantId` + order by `admissionDate DESC` (by admission date)
- Filter by `tenantId` + `status` + order by `updatedAt DESC` (filter by review status)
- Filter by `tenantId` + `patientId` + order by `updatedAt DESC` (patient-specific)
- Filter by `tenantId` + `admissionDate` range + order by `updatedAt DESC` (date range queries)

**Required Indexes:**
```json
{
  "fields": ["tenantId ASC", "updatedAt DESC"]
}
{
  "fields": ["tenantId ASC", "createdAt DESC"]
}
{
  "fields": ["tenantId ASC", "admissionDate DESC"]
}
{
  "fields": ["tenantId ASC", "status ASC", "updatedAt DESC"]
}
{
  "fields": ["tenantId ASC", "patientId ASC", "updatedAt DESC"]
}
{
  "fields": ["tenantId ASC", "admissionDate ASC", "updatedAt DESC"]
}
```

**Performance Impact:** Critical for clinician portal discharge summary listing and filtering

---

### 3. **expert_feedback** Collection

**Purpose:** Stores expert review feedback and ratings

**Query Patterns:**
- Filter by `tenantId` + `dischargeSummaryId` (get all reviews for a summary)
- Filter by `tenantId` + `dischargeSummaryId` + `reviewType` (filter by review type)

**Required Indexes:**
```json
{
  "fields": ["tenantId ASC", "dischargeSummaryId ASC"]
}
{
  "fields": ["tenantId ASC", "dischargeSummaryId ASC", "reviewType ASC"]
}
```

**Performance Impact:** Important for expert review portal showing review history

---

### 4. **quality_metrics** Collection

**Purpose:** Stores readability and quality metrics for discharge summaries

**Query Patterns:**
- Query by `compositionId IN [...]` (batch queries for multiple summaries)
- Filter by `tenantId` (aggregate metrics for admin portal)

**Required Indexes:**
```json
{
  "fields": ["compositionId ASC"]
}
{
  "fields": ["tenantId ASC"]
}
```

**Performance Impact:**
- Single-field indexes (automatically created by Firestore)
- Critical for aggregate quality metrics on admin portal
- Important for quality metrics tiles on clinician and expert portals

---

### 5. **users** Collection

**Purpose:** Stores user accounts and permissions

**Query Patterns:**
- Single document lookups by user ID
- Simple `tenantId` equality queries (no composite indexes needed)

**Required Indexes:** None (single-field queries only)

---

### 6. **config** Collection

**Purpose:** Stores application configuration

**Query Patterns:**
- Single document reads only

**Required Indexes:** None

---

## Deployment Instructions

### Option 1: Deploy via Firebase CLI

1. Install Firebase CLI if not already installed:
   ```bash
   npm install -g firebase-tools
   ```

2. Login to Firebase:
   ```bash
   firebase login
   ```

3. Initialize Firebase in the backend directory (if not already done):
   ```bash
   cd /Users/sekharcidambi/patient-discharge/backend
   firebase init firestore
   # Select your project: simtran-474018
   # Use firestore.indexes.json when prompted for indexes file
   ```

4. Deploy the indexes:
   ```bash
   firebase deploy --only firestore:indexes
   ```

### Option 2: Deploy via gcloud CLI

```bash
gcloud firestore indexes create firestore.indexes.json --project=simtran-474018
```

### Option 3: Manual Creation via Console

Go to [Firebase Console → Firestore → Indexes](https://console.firebase.google.com/project/simtran-474018/firestore/indexes) and create each composite index manually.

---

## Index Build Status

After deploying indexes, monitor their build status:

```bash
firebase firestore:indexes --project=simtran-474018
```

Or visit: https://console.firebase.google.com/project/simtran-474018/firestore/indexes

**Note:** Large indexes can take several hours to build. The application will continue to work during index creation, but affected queries may be slower.

---

## Performance Considerations

### Slow Query Indicators

1. **Audit Logs Pagination**: Without indexes, querying audit logs with filters can scan entire collection
2. **Discharge Summary Listing**: Sorting by date fields requires composite indexes
3. **Expert Review Stats**: Multiple WHERE clauses need composite indexes
4. **Aggregate Quality Metrics**: Tenant-wide queries need tenantId index

### Expected Performance Improvements

| Query Type | Before Indexes | After Indexes | Improvement |
|------------|----------------|---------------|-------------|
| Audit logs (filtered + sorted) | ~2-5s | ~50-200ms | 10-100x |
| Discharge summaries (sorted) | ~1-3s | ~50-150ms | 20-60x |
| Expert feedback lookup | ~500ms-1s | ~20-50ms | 10-50x |
| Quality metrics (tenant-wide) | ~1-3s | ~100-300ms | 10-30x |

### Index Maintenance

- **Single-field indexes**: Automatically created by Firestore (no action needed)
- **Composite indexes**: Must be explicitly created (via firestore.indexes.json)
- **Index exemptions**: Not used in this application
- **TTL policies**: Consider adding for audit_logs if retention policy is needed

---

## Monitoring Slow Queries

### Check Firestore Logs

```bash
gcloud logging read "resource.type=firestore.googleapis.com/Database" \
  --project=simtran-474018 \
  --limit=50 \
  --format=json | jq '.[] | select(.severity=="WARNING")'
```

### Common Warning Messages

1. **"The query requires an index"** → Add the composite index from firestore.indexes.json
2. **"Query exceeded timeout"** → Check for missing indexes or optimize query
3. **"Too many reads"** → Consider pagination or caching

---

## Future Optimizations

1. **Add `createdAt` timestamp index** to quality_metrics for time-based queries
2. **Consider array-contains indexes** if filtering by tags/categories is added
3. **Add geolocation indexes** if hospital/facility location filtering is needed
4. **Implement caching layer** (Redis) for frequently accessed data like aggregate metrics

---

## Related Files

- `backend/src/audit/audit.service.ts` - Audit log queries
- `backend/src/discharge-summaries/firestore.service.ts` - Discharge summary queries
- `backend/src/expert/expert.service.ts` - Expert feedback queries
- `backend/src/quality-metrics/quality-metrics.service.ts` - Quality metrics queries
