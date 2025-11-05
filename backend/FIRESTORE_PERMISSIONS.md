# Firestore Permissions Required

## Required Permissions for User Seeding Script

The `seed-users.ts` script requires the following Firestore permissions:

### 1. **Read Operations** (to check if users exist)
- `firestore.databases.get`
- `firestore.databases.list`
- `firestore.documents.get`
- `firestore.documents.list`

### 2. **Write Operations** (to create users)
- `firestore.documents.create`
- `firestore.documents.update`

## Required IAM Roles

To grant these permissions, assign one of the following IAM roles to your service account:

### Option 1: Cloud Datastore User (Recommended for read/write)
```bash
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:SERVICE_ACCOUNT_EMAIL" \
  --role="roles/datastore.user"
```

### Option 2: Firestore Database User (For Firestore in Native mode)
```bash
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:SERVICE_ACCOUNT_EMAIL" \
  --role="roles/firebase.admin"
```

Or more specifically:
```bash
# For Firestore read/write access
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:SERVICE_ACCOUNT_EMAIL" \
  --role="roles/datastore.user"
```

### Option 3: Owner/Editor (Not recommended for production)
```bash
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:SERVICE_ACCOUNT_EMAIL" \
  --role="roles/owner"
```

## Steps to Grant Permissions

1. **Get your service account email:**
   ```bash
   cat .settings.dev/fhir_store_sa.json | grep client_email
   ```

2. **Get your project ID:**
   ```bash
   cat .settings.dev/fhir_store_sa.json | grep project_id
   ```

3. **Grant Firestore User role:**
   ```bash
   gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
     --member="serviceAccount:YOUR_SERVICE_ACCOUNT_EMAIL" \
     --role="roles/datastore.user"
   ```

   Or if you're using Firestore in Native mode:
   ```bash
   gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
     --member="serviceAccount:YOUR_SERVICE_ACCOUNT_EMAIL" \
     --role="roles/firebase.admin"
   ```

## Minimum Required Permissions (Custom Role)

If you want to create a custom role with only the minimum permissions needed:

```bash
# Create custom role
gcloud iam roles create firestoreUserCustom \
  --project=YOUR_PROJECT_ID \
  --title="Firestore User Custom" \
  --description="Custom role for Firestore read/write operations" \
  --permissions=datastore.entities.create,datastore.entities.get,datastore.entities.list,datastore.entities.update,datastore.entities.delete

# Assign the role
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:YOUR_SERVICE_ACCOUNT_EMAIL" \
  --role="projects/YOUR_PROJECT_ID/roles/firestoreUserCustom"
```

## Verify Permissions

After granting permissions, verify they're working:

```bash
# Test Firestore access
npm run seed-users
```

## Current Service Account

Your service account is located at:
- Path: `.settings.dev/fhir_store_sa.json`
- Used for: Firestore operations, Google Cloud Healthcare API

Make sure this service account has the Firestore permissions listed above.

