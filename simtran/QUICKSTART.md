# Quick Start Guide

Get the discharge summary simplifier running in under 10 minutes.

## Prerequisites

- Google Cloud account with billing enabled
- Node.js v20+ installed
- gcloud CLI installed and configured

## 5-Step Deployment

### 1. Set Project ID

```bash
export PROJECT_ID=your-project-id
gcloud config set project $PROJECT_ID
```

### 2. Install Dependencies

```bash
cd backend
npm install
```

### 3. Configure Environment

```bash
cp .env.example .env
# Edit .env and set PROJECT_ID
```

### 4. Build

```bash
npm run build
```

### 5. Deploy

```bash
export LOCATION=us-central1
export MODEL_NAME=gemini-3-flash
./deploy.sh
```

## Test It

```bash
# Upload a test file
cat > test.md << 'EOF'
# Discharge Summary

Patient was admitted to hospital for treatment of acute condition.

**Diagnosis:** Hypertension

**Medications:** Lisinopril 10mg daily

**Follow-up:** See your doctor in 2 weeks
EOF

gsutil cp test.md gs://discharge-summaries-raw/

# Wait 10 seconds
sleep 10

# Check output
gsutil cat gs://discharge-summaries-simplified/test-simplified.md
```

## View Logs

```bash
gcloud functions logs read discharge-summary-simplifier \
  --region=us-central1 \
  --limit=20
```

## What's Next?

- Read [README.md](README.md) for full documentation
- See [SETUP.md](SETUP.md) for detailed setup guide
- Check [examples/](examples/) for sample files

## Common Issues

**Deployment fails?**
```bash
# Enable required APIs
gcloud services enable cloudfunctions.googleapis.com
gcloud services enable aiplatform.googleapis.com
gcloud services enable storage.googleapis.com
```

**Permission denied?**
```bash
# Grant yourself admin role
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="user:YOUR_EMAIL" \
  --role="roles/cloudfunctions.admin"
```

**Need help?** Check the full [SETUP.md](SETUP.md) guide.
