# Cerner Integration End-to-End Testing Guide

This guide provides step-by-step instructions for testing the complete Cerner sandbox integration with the patient discharge system.

## Overview

The Cerner integration enables automatic polling of discharge summaries from Cerner's sandbox EHR system, processing them through simplification and translation pipelines, and making them available in the patient portal.

## Architecture

```
Cerner Sandbox (FHIR API)
    ↓
Backend Scheduler (every 10 min)
    ↓
Google FHIR Store (ctest-dataset/ctest-fhir-store)
    ↓
Pub/Sub Event (discharge-export-events)
    ↓
discharge-export-processor (Cloud Function)
    ↓
GCS Buckets (raw/simplified/translated)
    ↓
Patient Portal (https://www.aividahealth.ai/ctest/clinician)
```

## Prerequisites

1. **Service Account Credentials**: Set environment variable for Firestore access
   ```bash
   export FIRESTORE_SERVICE_ACCOUNT_PATH=/path/to/service-account.json
   ```

2. **Cerner Sandbox Access**: The `ctest` tenant must have valid Cerner system app credentials configured in Firestore

3. **GCP Authentication**:
   ```bash
   gcloud auth login
   gcloud config set project simtran-474018
   ```

## Test Data Setup

### Step 1: Create Test Discharge Summaries in Cerner Sandbox

This script creates 8 discharge summaries with realistic medical content in the Cerner sandbox FHIR server.

```bash
cd test
npx ts-node scripts/add-patient-to-ctest-config.ts
```

**What it does:**
- Authenticates with Cerner using system app credentials
- Creates/finds Practitioner resources
- Creates discharge summaries as DocumentReferences for 8 different medical scenarios
- Uses existing patient IDs from tenant config (Patients 1 and 12822233)
- Updates Firestore `tenant_patients` collection for automated discovery

**Expected output:**
```
✅ Successfully processed: 8/8 patients
Total patient IDs: 2
Created Resources: [lists all DocumentReferences with IDs]
```

### Step 2: Verify Tenant Configuration

Check that the ctest tenant has correct configuration:

```bash
npx ts-node scripts/check-ctest-pubsub-config.ts
```

**Verifies:**
- ✅ Pub/Sub topic: `discharge-export-events` (default topic)
- ✅ Google FHIR: `ctest-dataset/ctest-fhir-store`
- ✅ EHR Integration: Cerner with patient IDs

## Automated Polling

The backend scheduler automatically runs every 10 minutes and:

1. Queries Firestore `tenant_patients` collection for ctest
2. Polls Cerner FHIR API for encounters for each patient
3. Exports encounters and DocumentReferences to Google FHIR
4. Creates/updates Composition resources
5. Publishes Pub/Sub events for processing

**Monitor scheduler logs:**
```bash
gcloud logging read 'resource.type=cloud_run_revision AND resource.labels.service_name=patient-discharge-backend-dev AND textPayload:"ctest"' --limit=50 --format="value(timestamp, textPayload)"
```

## Manual Testing

### Publish Test Event

To manually trigger the pipeline without waiting for the scheduler:

```bash
npx ts-node scripts/publish-correct-event.ts
```

**What it does:**
- Publishes an encounter export event to `discharge-export-events` topic
- Uses a real composition ID from ctest FHIR store
- Triggers the full pipeline: export → simplify → translate

### Verify Pipeline Processing

1. **Check discharge-export-processor logs:**
   ```bash
   gcloud functions logs read discharge-export-processor --limit=30
   ```

2. **Check GCS buckets:**
   ```bash
   gsutil ls -l gs://discharge-summaries-raw-ctest/
   gsutil ls -l gs://discharge-summaries-simplified-ctest/
   gsutil ls -l gs://discharge-summaries-translated-ctest/
   ```

## Verification Scripts

### Check FHIR Store Contents

```bash
bash scripts/check-ctest-fhir-patients.sh
```

**Verifies:**
- Number of Patients in ctest FHIR store
- Number of Encounters
- Number of Compositions with correct type (18842-5)

### Check Composition Structure

```bash
bash scripts/check-composition-structure.sh
```

**Verifies:**
- Composition has correct type: `18842-5` (Discharge Summary)
- Composition has encounter reference
- Composition has patient reference

### Search for Discharge Summaries

```bash
bash scripts/search-discharge-compositions.sh
```

**Lists all compositions with type 18842-5 (Discharge Summary)**

## Troubleshooting

### Issue: No patients showing in clinician portal

**Diagnosis:**
```bash
# Check discharge queue API
curl -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-Tenant-ID: ctest" \
  https://patient-discharge-backend-dev-qnzythtpnq-uc.a.run.app/api/patients/discharge-queue
```

**Common causes:**

1. **Compositions have wrong type**
   - Solution: Run `npx ts-node scripts/fix-composition-types.ts`
   - Converts type from "11488-4" to "18842-5"

2. **Encounters have "finished" status (maps to "approved", filtered out)**
   - Solution: Run `npx ts-node scripts/fix-encounter-statuses.ts`
   - Changes status from "finished" to "in-progress" (maps to "review")

3. **Compositions missing encounter references**
   - These won't show in discharge queue
   - Wait for scheduler to create new compositions with proper references

### Issue: Pub/Sub events not triggering processors

**Check topic configuration:**
```bash
npx ts-node scripts/check-ctest-pubsub-config.ts
```

**Verify:**
- Topic should be `discharge-export-events` (not `discharge-export-events-ctest`)
- Backend publishes to this topic
- discharge-export-processor subscribes to this topic

**Fix if needed:**
```bash
npx ts-node scripts/update-ctest-pubsub-topic.ts
```

### Issue: Data going to wrong FHIR store

**Symptoms:**
- Compositions created in `aivida-dev/aivida` instead of `ctest-dataset/ctest-fhir-store`

**Diagnosis:**
```bash
bash scripts/check-composition-location.sh
```

**Fix:**
```bash
npx ts-node scripts/fix-ctest-google-config.ts
```

This moves `infrastructure.google` to top-level `google` field in Firestore config.

## Expected Results

After successful end-to-end test:

### 1. Firestore
- ✅ `config/ctest` document has correct configuration
- ✅ `tenant_patients/ctest` document lists patient IDs

### 2. Cerner Sandbox
- ✅ 8 DocumentReferences created with discharge summary content
- ✅ DocumentReferences linked to Encounters and Patients

### 3. Google FHIR Store (ctest-dataset/ctest-fhir-store)
- ✅ 2 Patient resources
- ✅ 5 Encounter resources (status: in-progress)
- ✅ 31+ Composition resources (type: 18842-5)
- ✅ Multiple DocumentReference and Binary resources

### 4. GCS Buckets
- ✅ `discharge-summaries-raw-ctest/` - Raw discharge summaries
- ✅ `discharge-summaries-simplified-ctest/` - Simplified content
- ✅ `discharge-summaries-translated-ctest/` - Spanish translations

### 5. Clinician Portal
- ✅ Visit: https://www.aividahealth.ai/ctest/clinician
- ✅ See patient "Potter Harry" in discharge queue
- ✅ Status: "review"
- ✅ View discharge summaries (raw, simplified, translated)

## Scheduler Configuration

The encounter export scheduler runs every 10 minutes via cron:

- **Cron expression**: `*/10 * * * *`
- **Endpoint**: `POST /scheduler/encounter-export/trigger?tenantId=ctest`
- **Service**: `patient-discharge-backend-dev`

**Monitor cron jobs:**
```bash
gcloud logging read 'resource.type=cloud_run_revision AND resource.labels.service_name=patient-discharge-backend-dev AND textPayload:"Encounter export cron"' --limit=10
```

## Clean Up (Optional)

To remove test data from Cerner sandbox and Google FHIR:

### Delete Compositions
```bash
# List all compositions for ctest
TOKEN=$(gcloud auth print-access-token)
curl -H "Authorization: Bearer $TOKEN" \
  "https://healthcare.googleapis.com/v1/projects/simtran-474018/locations/us-central1/datasets/ctest-dataset/fhirStores/ctest-fhir-store/fhir/Composition?_count=100"

# Delete individual composition (repeat for each)
curl -X DELETE -H "Authorization: Bearer $TOKEN" \
  "https://healthcare.googleapis.com/v1/projects/simtran-474018/locations/us-central1/datasets/ctest-dataset/fhirStores/ctest-fhir-store/fhir/Composition/{id}"
```

### Delete GCS Files
```bash
gsutil rm -r gs://discharge-summaries-raw-ctest/*
gsutil rm -r gs://discharge-summaries-simplified-ctest/*
gsutil rm -r gs://discharge-summaries-translated-ctest/*
```

## Key Configuration Reference

### Firestore: config/ctest
```json
{
  "google": {
    "dataset": "ctest-dataset",
    "fhir_store": "ctest-fhir-store"
  },
  "pubsub": {
    "topic_name": "discharge-export-events"
  },
  "ehrIntegration": {
    "type": "Cerner",
    "cerner": {
      "base_url": "https://fhir-ehr-code.cerner.com/r4/ec2458f2-1e24-41c8-b71b-0e701af7583d",
      "patients": ["1", "12822233"],
      "system_app": {
        "client_id": "...",
        "client_secret": "...",
        "token_url": "...",
        "scopes": "..."
      }
    }
  }
}
```

### Firestore: tenant_patients/ctest
```json
{
  "patientIds": ["1", "12822233"],
  "updatedAt": "timestamp"
}
```

## Support

For issues or questions:
1. Check logs in Google Cloud Console
2. Verify Firestore configuration
3. Review this documentation
4. Contact: development team

## Changelog

### 2025-11-25
- Initial end-to-end testing documentation
- Fixed composition types (11488-4 → 18842-5)
- Fixed encounter statuses (finished → in-progress)
- Fixed FHIR store routing (infrastructure.google → google)
- Fixed Pub/Sub topic configuration
- Verified complete pipeline: Cerner → FHIR → Pub/Sub → Simplify → Translate → Portal
