# Discharge Summaries Backend Setup Guide

## Overview

This guide walks you through setting up and testing the discharge summaries backend implementation.

## Prerequisites

- Node.js >= 20.0.0
- Google Cloud Project with Firestore and Cloud Storage enabled
- Service account credentials with permissions for Firestore and GCS

## Step 1: Install Dependencies

```bash
cd /Users/sekharcidambi/patient-discharge/backend
npm install
```

This will install the newly added dependencies:
- `@google-cloud/firestore` - Firestore SDK
- `@google-cloud/storage` - Cloud Storage SDK

## Step 2: Configure Environment Variables

Make sure your service account credentials are properly configured. The backend currently uses:
- `SERVICE_ACCOUNT_PATH` environment variable (see package.json start:dev script)

You may need to update the service account to have permissions for:
- Firestore (read/write access to `discharge_summaries` collection)
- Cloud Storage (read access to buckets: `discharge-summaries-raw`, `discharge-summaries-simplified`, `discharge-summaries-translated`)

## Step 3: Start the Backend

```bash
cd /Users/sekharcidambi/patient-discharge/backend
npm run start:dev
```

The backend should start on `http://localhost:3000`

## Step 4: Run Initial Sync

In a new terminal, run the sync script to populate Firestore from existing GCS files:

```bash
cd /Users/sekharcidambi/patient-discharge/backend
npm run sync-discharge-summaries
```

This will:
1. Call the `POST /discharge-summaries/sync/all` endpoint
2. Scan all files in the `discharge-summaries-raw` bucket
3. Create Firestore documents with metadata
4. Link related simplified and translated files
5. Display statistics

Expected output:
```
Starting discharge summaries sync...
Backend URL: http://localhost:3000

Sync completed:
  Success: true
  Synced: 14
  Failed: 0

Statistics:
  Firestore:
    Total: 14
    By Status:
      translated: 14
      simplified: 0
      raw_only: 0
  GCS:
    Raw: 35
    Simplified: 15
    Translated: 17
```

## Step 5: Test the API Endpoints

### List all discharge summaries
```bash
curl http://localhost:3000/discharge-summaries
```

### List with filtering
```bash
# Filter by status
curl "http://localhost:3000/discharge-summaries?status=translated&limit=5"

# Filter by patient name
curl "http://localhost:3000/discharge-summaries?patientName=Adult"
```

### Get metadata for a specific summary
```bash
# Replace {id} with an actual ID from the list endpoint
curl http://localhost:3000/discharge-summaries/{id}
```

### Get content (simplified version)
```bash
curl "http://localhost:3000/discharge-summaries/{id}/content?version=simplified"
```

### Get translated content (Spanish)
```bash
curl "http://localhost:3000/discharge-summaries/{id}/content?version=translated&language=es"
```

### Get statistics
```bash
curl http://localhost:3000/discharge-summaries/stats/overview
```

### Manually sync a single file
```bash
curl -X POST "http://localhost:3000/discharge-summaries/sync/file?bucket=discharge-summaries-raw&file=Adult%20-%20DKA%20discharge.md"
```

## Step 6: Deploy Cloud Functions (Optional - for Auto-Sync)

The Cloud Functions automatically sync new GCS uploads to Firestore. Deploy them with:

```bash
cd /Users/sekharcidambi/patient-discharge/backend/cloud-functions/firestore-sync
export PROJECT_ID=simtran-474018
chmod +x deploy.sh
./deploy.sh
```

This will deploy three Cloud Functions:
- `discharge-summary-firestore-sync-raw` - Triggers on uploads to `discharge-summaries-raw`
- `discharge-summary-firestore-sync-simplified` - Triggers on uploads to `discharge-summaries-simplified`
- `discharge-summary-firestore-sync-translated` - Triggers on uploads to `discharge-summaries-translated`

### Test Cloud Functions

Upload a test file to trigger the Cloud Function:

```bash
# Create a test file
echo "# Test Discharge Summary" > test-summary.md

# Upload to raw bucket
gsutil cp test-summary.md gs://discharge-summaries-raw/

# Check Cloud Function logs
gcloud functions logs read discharge-summary-firestore-sync-raw \
  --region=us-central1 \
  --project=simtran-474018 \
  --limit=50
```

## Troubleshooting

### Issue: "Permission denied" errors

**Solution**: Ensure your service account has the following IAM roles:
- `roles/datastore.user` - For Firestore access
- `roles/storage.objectViewer` - For GCS read access

### Issue: "Collection not found" in Firestore

**Solution**: Firestore collections are created automatically when the first document is added. Run the sync script to create the collection.

### Issue: TypeScript compilation errors

**Solution**: Run the build command to check for errors:
```bash
npm run build
```

### Issue: "Cannot find module @google-cloud/firestore"

**Solution**: Make sure you ran `npm install` after updating package.json

## Next Steps

1. **Frontend Integration**: Update the React clinician portal to consume these APIs
2. **Authentication**: Add authentication middleware to protect endpoints
3. **Audit Logging**: Add audit trail for HIPAA compliance
4. **Deploy Backend**: Deploy the NestJS backend to Cloud Run
5. **Rate Limiting**: Add rate limiting to protect the API

## Architecture Summary

```
┌─────────────────┐
│  React Frontend │
│    (Vercel)     │
└────────┬────────┘
         │ HTTPS
         ▼
┌─────────────────────┐
│  NestJS Backend     │
│  (localhost:3000)   │
└──────┬──────┬───────┘
       │      │
       │      └──────────────┐
       ▼                     ▼
┌──────────────┐     ┌──────────────┐
│  Firestore   │     │  GCS Buckets │
│  (Metadata)  │     │  (Content)   │
└──────────────┘     └──────┬───────┘
                             │
                             ▼
                     ┌──────────────┐
                     │ Cloud Function│
                     │  (Auto-sync) │
                     └──────────────┘
```

## API Endpoints Reference

See [DISCHARGE_SUMMARIES_API.md](./DISCHARGE_SUMMARIES_API.md) for complete API documentation.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/discharge-summaries` | GET | List summaries with filtering |
| `/discharge-summaries/:id` | GET | Get metadata |
| `/discharge-summaries/:id/content` | GET | Get content |
| `/discharge-summaries/stats/overview` | GET | Get statistics |
| `/discharge-summaries/sync/all` | POST | Sync all files |
| `/discharge-summaries/sync/file` | POST | Sync single file |
