# Service Account Setup Guide

This guide walks you through setting up the service account credentials for the discharge summaries backend.

## Current Configuration

The backend uses `DevConfigService` which reads from `.settings.dev/config.yaml`. Looking at the package.json, the start:dev script references:
```
SERVICE_ACCOUNT_PATH=/root/patient-discharge/backend/.settings.dev/fhir_store_sa.json
```

However, the `DevConfigService` expects a `config.yaml` file at `.settings.dev/config.yaml` with the following structure:

```yaml
service_account_path: /path/to/service-account-key.json
fhir_base_url: https://healthcare.googleapis.com/v1/projects/PROJECT_ID/locations/LOCATION/datasets/DATASET/fhirStores/FHIR_STORE/fhir
gcp:
  project_id: simtran-474018
  location: us-central1
  dataset: your-dataset
  fhir_store: your-fhir-store
```

## Step-by-Step Setup

### Option 1: Use Existing Service Account (Recommended)

If you already have a service account for FHIR operations, you can reuse it by adding additional permissions.

#### 1. Check if .settings.dev directory exists

```bash
cd /Users/sekharcidambi/patient-discharge/backend
ls -la .settings.dev/
```

If it exists, you should see:
- `config.yaml` - Configuration file
- `fhir_store_sa.json` - Service account key (or similar)

#### 2. Verify config.yaml has the service_account_path

```bash
cat .settings.dev/config.yaml
```

You should see something like:
```yaml
service_account_path: /Users/sekharcidambi/patient-discharge/backend/.settings.dev/fhir_store_sa.json
```

#### 3. Add permissions to the existing service account

First, find the service account email:
```bash
# Look in your service account JSON file
cat .settings.dev/fhir_store_sa.json | grep client_email
```

This will show something like: `"client_email": "fhir-store-sa@simtran-474018.iam.gserviceaccount.com"`

#### 4. Add Firestore and Storage permissions

```bash
# Set variables
export PROJECT_ID=simtran-474018
export SA_EMAIL=fhir-store-sa@simtran-474018.iam.gserviceaccount.com  # Replace with your actual email

# Add Firestore User role (read/write to Firestore)
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/datastore.user"

# Add Storage Object Viewer role (read from GCS buckets)
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/storage.objectViewer"
```

### Option 2: Create New Service Account

If you don't have an existing service account or want a dedicated one for discharge summaries:

#### 1. Create the .settings.dev directory

```bash
cd /Users/sekharcidambi/patient-discharge/backend
mkdir -p .settings.dev
```

#### 2. Create a new service account

```bash
export PROJECT_ID=simtran-474018
export SA_NAME=discharge-summaries-sa
export SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

# Create service account
gcloud iam service-accounts create $SA_NAME \
  --display-name="Discharge Summaries Service Account" \
  --project=$PROJECT_ID

# Grant Firestore permissions
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/datastore.user"

# Grant Storage permissions
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/storage.objectViewer"
```

#### 3. Create and download the key

```bash
# Create key and save to .settings.dev
gcloud iam service-accounts keys create \
  .settings.dev/discharge-summaries-sa.json \
  --iam-account=$SA_EMAIL \
  --project=$PROJECT_ID
```

#### 4. Create the config.yaml file

```bash
cat > .settings.dev/config.yaml << 'EOF'
service_account_path: /Users/sekharcidambi/patient-discharge/backend/.settings.dev/discharge-summaries-sa.json
fhir_base_url: https://healthcare.googleapis.com/v1/projects/simtran-474018/locations/us-central1/datasets/YOUR_DATASET/fhirStores/YOUR_FHIR_STORE/fhir
gcp:
  project_id: simtran-474018
  location: us-central1
  dataset: your-dataset
  fhir_store: your-fhir-store
EOF
```

**Important:** Update the placeholders in config.yaml:
- Replace `YOUR_DATASET` with your actual FHIR dataset name
- Replace `YOUR_FHIR_STORE` with your actual FHIR store name

#### 5. Secure the credentials

```bash
# Make sure credentials are not committed to git
chmod 600 .settings.dev/*.json
echo ".settings.dev/" >> .gitignore
```

## Verify the Setup

### 1. Check that the service account file exists

```bash
ls -la /Users/sekharcidambi/patient-discharge/backend/.settings.dev/
```

You should see:
```
-rw-------  1 user  staff  2365 Jan 15 10:00 discharge-summaries-sa.json
-rw-r--r--  1 user  staff   423 Jan 15 10:01 config.yaml
```

### 2. Verify the service account has the right permissions

```bash
export PROJECT_ID=simtran-474018
export SA_EMAIL=discharge-summaries-sa@simtran-474018.iam.gserviceaccount.com

# Check IAM policy
gcloud projects get-iam-policy $PROJECT_ID \
  --flatten="bindings[].members" \
  --filter="bindings.members:serviceAccount:$SA_EMAIL"
```

You should see roles like:
- `roles/datastore.user`
- `roles/storage.objectViewer`

### 3. Test Firestore access

```bash
# Authenticate with the service account
gcloud auth activate-service-account --key-file=.settings.dev/discharge-summaries-sa.json

# Try listing Firestore collections
gcloud firestore databases list --project=$PROJECT_ID

# Switch back to your user account
gcloud config set account YOUR_USER_EMAIL@gmail.com
```

### 4. Test Storage access

```bash
# Authenticate with the service account
gcloud auth activate-service-account --key-file=.settings.dev/discharge-summaries-sa.json

# Try listing files in the bucket
gsutil ls gs://discharge-summaries-raw/

# Switch back to your user account
gcloud config set account YOUR_USER_EMAIL@gmail.com
```

## Required IAM Roles Summary

| Role | Permission | Purpose |
|------|------------|---------|
| `roles/datastore.user` | Firestore read/write | Query and store discharge summary metadata |
| `roles/storage.objectViewer` | GCS read access | Read discharge summary files from buckets |

### Minimum Custom Role (Optional - More Secure)

Instead of using the broad roles above, you can create a custom role with minimum permissions:

```bash
# Create custom role
gcloud iam roles create dischargeSummariesRole \
  --project=$PROJECT_ID \
  --title="Discharge Summaries Role" \
  --description="Minimum permissions for discharge summaries backend" \
  --permissions="\
datastore.databases.get,\
datastore.entities.create,\
datastore.entities.get,\
datastore.entities.list,\
datastore.entities.update,\
storage.objects.get,\
storage.objects.list" \
  --stage=GA

# Assign custom role
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SA_EMAIL" \
  --role="projects/$PROJECT_ID/roles/dischargeSummariesRole"
```

## Troubleshooting

### Error: "DevConfigService not initialized"

**Cause:** The config.yaml file is not being loaded or doesn't exist.

**Solution:**
1. Verify `.settings.dev/config.yaml` exists
2. Check the path in config.yaml is absolute, not relative
3. Ensure `DevConfigService.load()` is called in `main.ts`

### Error: "Permission denied" when accessing Firestore

**Cause:** Service account doesn't have Firestore permissions.

**Solution:**
```bash
gcloud projects add-iam-policy-binding simtran-474018 \
  --member="serviceAccount:YOUR_SA_EMAIL" \
  --role="roles/datastore.user"
```

### Error: "Permission denied" when accessing GCS buckets

**Cause:** Service account doesn't have Storage permissions.

**Solution:**
```bash
gcloud projects add-iam-policy-binding simtran-474018 \
  --member="serviceAccount:YOUR_SA_EMAIL" \
  --role="roles/storage.objectViewer"
```

### Error: "GOOGLE_APPLICATION_CREDENTIALS not set"

**Cause:** The Firestore/Storage SDK can't find credentials.

**Solution:** The code explicitly sets `keyFilename` in the constructors, so this shouldn't happen. If it does:
```bash
export GOOGLE_APPLICATION_CREDENTIALS=/Users/sekharcidambi/patient-discharge/backend/.settings.dev/discharge-summaries-sa.json
```

## Next Steps

After completing this setup:

1. ✅ Service account created with proper permissions
2. ✅ config.yaml file created with correct paths
3. ✅ Service account key saved to .settings.dev/
4. ✅ Credentials secured (not in git)

Now you can:
- Run `npm run start:dev` to start the backend
- Test the API endpoints
- Run the sync script to populate Firestore

## Security Best Practices

1. **Never commit service account keys to git**
   ```bash
   echo ".settings.dev/" >> .gitignore
   ```

2. **Use minimum necessary permissions**
   - Only grant `datastore.user` and `storage.objectViewer`
   - Don't use `roles/owner` or `roles/editor`

3. **Rotate keys regularly**
   ```bash
   # Delete old key
   gcloud iam service-accounts keys delete KEY_ID --iam-account=$SA_EMAIL

   # Create new key
   gcloud iam service-accounts keys create .settings.dev/discharge-summaries-sa.json \
     --iam-account=$SA_EMAIL
   ```

4. **Use different service accounts for different environments**
   - Development: `discharge-summaries-dev-sa`
   - Production: `discharge-summaries-prod-sa`
