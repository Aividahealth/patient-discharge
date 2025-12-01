# Step-by-Step Guide: Manually Update Google FHIR Config in Firestore

This guide walks you through manually updating the Google FHIR dataset and store configuration for the `ctest` tenant in Firestore.

## Prerequisites

1. Access to Google Cloud Console
2. Firestore service account credentials (or use the script)
3. Permission to write to Firestore `config` collection

## Option A: Using the Script (Recommended)

### Step 1: Run the Update Script

```bash
cd test
npx ts-node scripts/update-ctest-google-fhir-config.ts
```

This will:
- Read the current `ctest` tenant config
- Update `infrastructure.google.dataset` and `infrastructure.google.fhir_store`
- Show you what was updated

### Step 2: Verify the Update

Check that the update worked:

```bash
cd test
npx ts-node scripts/check-ctest-google-fhir-config.ts
```

You should see:
```
✅ Google FHIR configuration found:
   Dataset: ctest-dataset
   FHIR Store: ctest-fhir-store
```

### Step 3: Create the Dataset and Store in Google Cloud

The script only updates Firestore. You still need to create the actual resources in Google Cloud:

```bash
# Set your GCP project
gcloud config set project YOUR_PROJECT_ID

# Create the dataset
gcloud healthcare datasets create ctest-dataset --location=us-central1

# Create the FHIR store
gcloud healthcare fhir-stores create ctest-fhir-store \
  --dataset=ctest-dataset \
  --location=us-central1
```

## Option B: Manual Firestore Update via Google Cloud Console

### Step 1: Open Firestore in Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select your project
3. Navigate to **Firestore** → **Data**
4. Find the `config` collection
5. Click on the `ctest` document

### Step 2: Update the Document

1. In the document editor, you'll see the current structure
2. Look for the `infrastructure` field (or create it if it doesn't exist)
3. Add or update the following structure:

```json
{
  "infrastructure": {
    "google": {
      "dataset": "ctest-dataset",
      "fhir_store": "ctest-fhir-store"
    }
  }
}
```

4. Also update the `updatedAt` field to the current timestamp
5. Click **Save**

### Step 3: Verify the Structure

Your document should look something like this:

```json
{
  "name": "Cerner Test Tenant",
  "ehrIntegration": {
    "type": "Cerner",
    "cerner": {
      "base_url": "...",
      "system_app": { ... },
      "patients": ["1"]
    }
  },
  "infrastructure": {
    "google": {
      "dataset": "ctest-dataset",
      "fhir_store": "ctest-fhir-store"
    }
  },
  "updatedAt": "2025-11-24T22:00:00Z"
}
```

### Step 4: Create the Dataset and Store in Google Cloud

You still need to create the actual resources:

#### Using gcloud CLI:

```bash
# Set your project
gcloud config set project YOUR_PROJECT_ID

# Create dataset
gcloud healthcare datasets create ctest-dataset \
  --location=us-central1

# Create FHIR store
gcloud healthcare fhir-stores create ctest-fhir-store \
  --dataset=ctest-dataset \
  --location=us-central1
```

#### Using Google Cloud Console:

1. Go to **Healthcare** → **Datasets**
2. Click **Create Dataset**
3. Name: `ctest-dataset`
4. Location: `us-central1` (or your preferred location)
5. Click **Create**
6. Once created, click on the dataset
7. Click **Create FHIR Store**
8. Name: `ctest-fhir-store`
9. Click **Create**

## Option C: Using the Backend API (If Available)

If your backend has an infrastructure provisioning endpoint:

```bash
# Example (adjust URL and auth as needed)
curl -X POST https://your-backend-url/api/system-admin/tenants/ctest/provision-infrastructure \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

## Verification

After completing the steps:

1. **Check Firestore config:**
   ```bash
   cd test
   npx ts-node scripts/check-ctest-google-fhir-config.ts
   ```

2. **Verify Google Cloud resources exist:**
   ```bash
   gcloud healthcare datasets describe ctest-dataset --location=us-central1
   gcloud healthcare fhir-stores describe ctest-fhir-store \
     --dataset=ctest-dataset \
     --location=us-central1
   ```

3. **Test the discharge queue endpoint:**
   - Log into the clinician portal
   - The 404 error should be gone
   - You should see an empty queue (or patients if data exists)

## Troubleshooting

### Error: "Tenant not found"
- The `ctest` document doesn't exist in Firestore
- Create it first via System Admin UI or manually

### Error: "Permission denied"
- Check your Firestore service account credentials
- Ensure the service account has `Cloud Datastore User` role

### Error: "Dataset not found" (after update)
- The dataset doesn't exist in Google Cloud
- Create it using the gcloud commands above

### Error: "FHIR store not found"
- The FHIR store doesn't exist in Google Cloud
- Create it using the gcloud commands above

### Still getting 404 after all steps
- Verify the dataset/store names match exactly (case-sensitive)
- Check the GCP project ID and location match your backend config
- Restart the backend service to pick up config changes

## Next Steps

Once the configuration is complete:
1. The discharge queue endpoint should work
2. Discharge summaries exported from Cerner will be stored in this FHIR store
3. The clinician portal will be able to display them

