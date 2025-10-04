# Quick Start Guide - Environment Setup

## TL;DR - What You Need

Your backend expects a file at `.settings.dev/config.yaml` with your service account credentials. You likely already have this set up for FHIR operations, you just need to add permissions for Firestore and GCS.

## Quick Check - Do You Already Have This Set Up?

Run this from the backend directory:

```bash
cd /Users/sekharcidambi/patient-discharge/backend
ls -la .settings.dev/
```

**If you see `config.yaml` and a `.json` file** → You're already set up! Skip to **Step 3: Add Permissions**

**If the directory doesn't exist** → Start with **Step 1: First Time Setup**

---

## Step 1: First Time Setup (Only if .settings.dev doesn't exist)

```bash
cd /Users/sekharcidambi/patient-discharge/backend

# Create directory
mkdir -p .settings.dev

# Create service account
export PROJECT_ID=simtran-474018
export SA_NAME=discharge-summaries-sa

gcloud iam service-accounts create $SA_NAME \
  --display-name="Discharge Summaries Backend SA" \
  --project=$PROJECT_ID

# Download key
gcloud iam service-accounts keys create \
  .settings.dev/${SA_NAME}.json \
  --iam-account="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --project=$PROJECT_ID

# Create config.yaml (update the FHIR URLs if you have them)
cat > .settings.dev/config.yaml << EOF
service_account_path: /Users/sekharcidambi/patient-discharge/backend/.settings.dev/${SA_NAME}.json
gcp:
  project_id: simtran-474018
  location: us-central1
EOF

# Secure the files
chmod 600 .settings.dev/*.json
```

---

## Step 2: OR Use Your Existing Service Account

If you already have `.settings.dev/config.yaml`, just verify it looks correct:

```bash
cat .settings.dev/config.yaml
```

Should show something like:
```yaml
service_account_path: /Users/sekharcidambi/patient-discharge/backend/.settings.dev/fhir_store_sa.json
# ... other config
```

---

## Step 3: Add Permissions to Your Service Account

**Find your service account email:**

```bash
# Look in your service account JSON file
cat .settings.dev/*.json | grep client_email
```

You'll see something like: `"client_email": "fhir-store-sa@simtran-474018.iam.gserviceaccount.com"`

**Add the required permissions:**

```bash
export PROJECT_ID=simtran-474018
export SA_EMAIL="fhir-store-sa@simtran-474018.iam.gserviceaccount.com"  # ← Use YOUR email from above

# Permission 1: Firestore (for metadata storage and queries)
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/datastore.user"

# Permission 2: Cloud Storage (for reading discharge summaries)
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/storage.objectViewer"
```

---

## Step 4: Verify Permissions

```bash
# Check what permissions your service account has
gcloud projects get-iam-policy $PROJECT_ID \
  --flatten="bindings[].members" \
  --filter="bindings.members:serviceAccount:$SA_EMAIL" \
  --format="table(bindings.role)"
```

You should see at least:
- `roles/datastore.user`
- `roles/storage.objectViewer`

---

## Step 5: Test the Setup

```bash
# Try starting the backend
npm run start:dev
```

**Success looks like:**
```
[Nest] INFO [Bootstrap] Loaded .settings.dev/config.yaml
[Nest] INFO [GcsService] GCS Service initialized
[Nest] INFO [FirestoreService] Firestore Service initialized
[Nest] INFO [NestApplication] Nest application successfully started
```

**Failure looks like:**
```
[Nest] ERROR [Bootstrap] Failed to load .settings.dev/config.yaml
Error: ENOENT: no such file or directory
```
→ Go back to Step 1 or Step 2

---

## What These Permissions Do

| Permission | What It Allows | Why We Need It |
|------------|----------------|----------------|
| `datastore.user` | Read/write to Firestore | Store and query discharge summary metadata (patient names, dates, status, etc.) |
| `storage.objectViewer` | Read from GCS buckets | Retrieve the actual discharge summary content (markdown files) |

---

## Security Notes

✅ **Do this:**
- Keep `.settings.dev/` in your `.gitignore`
- Use `chmod 600` on service account JSON files
- Only grant minimum necessary permissions

❌ **Don't do this:**
- Commit service account keys to git
- Use `roles/owner` or `roles/editor` (too broad)
- Share service account keys via email/Slack

---

## Troubleshooting

### "Failed to load .settings.dev/config.yaml"

**Problem:** File doesn't exist

**Fix:**
```bash
cd /Users/sekharcidambi/patient-discharge/backend
ls .settings.dev/config.yaml  # Does this file exist?
```

If not, go to **Step 1** above.

### "Permission denied" accessing Firestore

**Problem:** Service account doesn't have `datastore.user` role

**Fix:**
```bash
gcloud projects add-iam-policy-binding simtran-474018 \
  --member="serviceAccount:YOUR_SA_EMAIL" \
  --role="roles/datastore.user"
```

### "Permission denied" accessing gs://discharge-summaries-raw

**Problem:** Service account doesn't have `storage.objectViewer` role

**Fix:**
```bash
gcloud projects add-iam-policy-binding simtran-474018 \
  --member="serviceAccount:YOUR_SA_EMAIL" \
  --role="roles/storage.objectViewer"
```

---

## Next Steps

Once the backend starts successfully:

1. ✅ Run the initial sync: `npm run sync-discharge-summaries`
2. ✅ Test the API: `curl http://localhost:3000/discharge-summaries`
3. ✅ Deploy Cloud Functions for auto-sync (see SETUP_DISCHARGE_SUMMARIES.md)
4. ✅ Integrate with React frontend

---

For more detailed information, see:
- **SERVICE_ACCOUNT_SETUP.md** - Detailed service account setup
- **SETUP_DISCHARGE_SUMMARIES.md** - Full deployment guide
- **DISCHARGE_SUMMARIES_API.md** - API documentation
