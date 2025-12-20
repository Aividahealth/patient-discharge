# Setup Guide: Discharge Summary Simplifier

Complete step-by-step guide to set up and deploy the discharge summary simplifier service.

## Prerequisites Checklist

Before you begin, ensure you have:

- [ ] Google Cloud account with billing enabled
- [ ] Node.js v20 or later installed
- [ ] gcloud CLI installed
- [ ] Git installed
- [ ] Code editor (VS Code recommended)

## Step 1: Google Cloud Project Setup

### 1.1 Create or Select a Project

```bash
# Create a new project
gcloud projects create YOUR_PROJECT_ID --name="Discharge Summary Simplifier"

# Or list existing projects
gcloud projects list

# Set the active project
gcloud config set project YOUR_PROJECT_ID
```

### 1.2 Enable Billing

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Navigate to Billing
3. Link a billing account to your project

### 1.3 Enable Required APIs

```bash
# Enable all required APIs
gcloud services enable cloudfunctions.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable artifactregistry.googleapis.com
gcloud services enable aiplatform.googleapis.com
gcloud services enable storage.googleapis.com
gcloud services enable logging.googleapis.com
```

## Step 2: Create GCS Buckets

```bash
# Set your project ID
export PROJECT_ID=your-project-id
export REGION=us-central1

# Create input bucket
gsutil mb -p $PROJECT_ID -l $REGION gs://discharge-summaries-raw

# Create output bucket
gsutil mb -p $PROJECT_ID -l $REGION gs://discharge-summaries-simplified

# Verify buckets
gsutil ls
```

## Step 3: Set Up IAM Permissions

### 3.1 Service Account Setup (Recommended for Production)

```bash
# Create a service account
gcloud iam service-accounts create discharge-simplifier \
    --display-name="Discharge Summary Simplifier"

# Grant necessary permissions
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:discharge-simplifier@$PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/aiplatform.user"

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:discharge-simplifier@$PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/storage.objectAdmin"
```

### 3.2 Your User Permissions

```bash
# Grant yourself necessary roles for deployment
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="user:YOUR_EMAIL@gmail.com" \
    --role="roles/cloudfunctions.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="user:YOUR_EMAIL@gmail.com" \
    --role="roles/iam.serviceAccountUser"
```

## Step 4: Local Development Setup

### 4.1 Install Dependencies

```bash
cd backend
npm install
```

### 4.2 Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your values
nano .env  # or use your preferred editor
```

Update `.env`:
```env
PROJECT_ID=your-actual-project-id
LOCATION=us-central1
MODEL_NAME=gemini-3-flash
```

### 4.3 Build the Project

```bash
npm run build
```

### 4.4 Run Tests

```bash
npm test
```

## Step 5: Local Testing (Optional)

### 5.1 Set Up Service Account Key for Local Testing

```bash
# Create a key for local development
gcloud iam service-accounts keys create ~/discharge-simplifier-key.json \
    --iam-account=discharge-simplifier@$PROJECT_ID.iam.gserviceaccount.com

# Set the environment variable
export GOOGLE_APPLICATION_CREDENTIALS=~/discharge-simplifier-key.json
```

### 5.2 Start Local Functions Framework

```bash
npm run dev
```

### 5.3 Test Locally

In another terminal:
```bash
# Create a test file
echo "Patient was admitted to hospital for treatment of acute condition. Diagnosis: Hypertension. Medications: Lisinopril 10mg daily. Follow-up with doctor in 2 weeks." > test-discharge.md

# Upload to trigger function
gsutil cp test-discharge.md gs://discharge-summaries-raw/

# Check output
gsutil ls gs://discharge-summaries-simplified/
gsutil cat gs://discharge-summaries-simplified/test-discharge-simplified.md
```

## Step 6: Deploy to Google Cloud

### 6.1 Make Deploy Script Executable

```bash
chmod +x deploy.sh
```

### 6.2 Deploy

```bash
# Export required variables
export PROJECT_ID=your-project-id
export LOCATION=us-central1
export MODEL_NAME=gemini-3-flash

# Run deployment
./deploy.sh
```

The script will:
- Build TypeScript
- Verify/create GCS buckets
- Enable required APIs
- Deploy the Cloud Function
- Display success information

### 6.3 Verify Deployment

```bash
# Check function status
gcloud functions describe discharge-summary-simplifier \
    --region=us-central1 \
    --gen2

# View function URL and trigger
gcloud functions describe discharge-summary-simplifier \
    --region=us-central1 \
    --gen2 \
    --format="value(serviceConfig.uri)"
```

## Step 7: Test Production Deployment

### 7.1 Upload Test File

```bash
# Create a sample discharge summary
cat > sample-discharge.md << 'EOF'
# Discharge Summary

## Patient Information
Date of Discharge: January 15, 2024

## Admitting Diagnosis
Acute exacerbation of COPD

## Discharge Diagnosis
- COPD with acute exacerbation
- Hypertension
- Type 2 Diabetes Mellitus

## Hospital Course
Patient presented to the emergency department with increased dyspnea and productive cough. He was admitted for management of COPD exacerbation. Treatment included nebulizer treatments with albuterol and ipratropium, systemic corticosteroids (prednisone 40mg daily), and antibiotics (azithromycin).

## Discharge Medications
1. Albuterol inhaler 2 puffs q4h PRN
2. Prednisone 40mg PO daily x 5 days
3. Lisinopril 10mg PO daily
4. Metformin 500mg PO BID

## Follow-Up
- Primary care physician in 1 week
- Pulmonology in 2 weeks

## Return Precautions
Return to ED if you experience severe shortness of breath, chest pain, fever, or worsening symptoms.
EOF

# Upload to GCS
gsutil cp sample-discharge.md gs://discharge-summaries-raw/

# Wait a few moments for processing
sleep 10

# Check for output
gsutil ls gs://discharge-summaries-simplified/

# Download and view result
gsutil cp gs://discharge-summaries-simplified/sample-discharge-simplified.md ./
cat sample-discharge-simplified.md
```

### 7.2 Monitor Logs

```bash
# View recent logs
gcloud functions logs read discharge-summary-simplifier \
    --region=us-central1 \
    --limit=50

# Or use Cloud Console
# Go to: Cloud Functions → discharge-summary-simplifier → Logs
```

## Step 8: Production Considerations

### 8.1 Set Up Monitoring

```bash
# Create a log-based metric for errors
gcloud logging metrics create discharge-simplifier-errors \
    --description="Count of errors in discharge simplifier" \
    --log-filter='resource.type="cloud_function"
resource.labels.function_name="discharge-summary-simplifier"
severity>=ERROR'

# Create alert policy (via Cloud Console)
# Monitoring → Alerting → Create Policy
```

### 8.2 Configure Budget Alerts

1. Go to [Billing Console](https://console.cloud.google.com/billing)
2. Select your billing account
3. Go to "Budgets & alerts"
4. Create a new budget for the project
5. Set threshold alerts (e.g., at 50%, 90%, 100%)

### 8.3 Set Up Dead Letter Queue (Optional)

For failed messages that can't be processed:

```bash
# Create a dead letter bucket
gsutil mb -p $PROJECT_ID -l $REGION gs://discharge-summaries-failed

# Update function to write failures here
# (Already implemented in the code)
```

### 8.4 Enable VPC Service Controls (Optional)

For additional security in production:

```bash
# Create a service perimeter
gcloud access-context-manager perimeters create discharge-perimeter \
    --title="Discharge Simplifier Perimeter" \
    --resources=projects/PROJECT_NUMBER \
    --restricted-services=storage.googleapis.com,aiplatform.googleapis.com
```

## Step 9: Optimization & Tuning

### 9.1 Adjust Model for Cost/Performance

For faster, cheaper processing:
```bash
# Redeploy with Gemini Flash
export MODEL_NAME=gemini-3-flash
./deploy.sh
```

### 9.2 Tune Generation Parameters

Edit `.env` for different output characteristics:
```env
# More creative/varied output
TEMPERATURE=0.7

# More conservative output
TEMPERATURE=0.1

# Longer responses
MAX_OUTPUT_TOKENS=16384
```

### 9.3 Scale Resources

For high-volume processing:
```bash
# Increase memory and timeout
gcloud functions deploy discharge-summary-simplifier \
    --memory=1024MB \
    --timeout=540s \
    --region=us-central1 \
    --gen2 \
    --update-env-vars=...
```

## Step 10: Maintenance

### 10.1 Update Dependencies

```bash
# Check for updates
npm outdated

# Update dependencies
npm update

# Rebuild and test
npm run build
npm test

# Redeploy
./deploy.sh
```

### 10.2 Monitor Costs

```bash
# View current month costs
gcloud billing accounts list

# View detailed cost breakdown in Cloud Console
# Billing → Reports → Filter by service
```

### 10.3 Backup Configuration

```bash
# Export current function configuration
gcloud functions describe discharge-summary-simplifier \
    --region=us-central1 \
    --gen2 \
    --format=yaml > function-config-backup.yaml
```

## Troubleshooting

### Issue: Deployment fails with permission errors

**Solution:**
```bash
# Verify you have necessary roles
gcloud projects get-iam-policy $PROJECT_ID \
    --flatten="bindings[].members" \
    --filter="bindings.members:user:YOUR_EMAIL"

# Add missing roles
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="user:YOUR_EMAIL" \
    --role="roles/cloudfunctions.admin"
```

### Issue: Function times out

**Solution:**
```bash
# Increase timeout
gcloud functions deploy discharge-summary-simplifier \
    --timeout=540s \
    --region=us-central1 \
    --gen2 \
    --update-env-vars=...
```

### Issue: Vertex AI quota exceeded

**Solution:**
1. Go to [Quotas page](https://console.cloud.google.com/iam-admin/quotas)
2. Filter for "Vertex AI API"
3. Select "Requests per minute"
4. Click "Edit Quotas" and request increase

### Issue: Out of memory errors

**Solution:**
```bash
# Increase memory allocation
gcloud functions deploy discharge-summary-simplifier \
    --memory=1024MB \
    --region=us-central1 \
    --gen2 \
    --update-env-vars=...
```

## Next Steps

- [ ] Set up monitoring dashboards
- [ ] Configure alerts for errors and costs
- [ ] Create documentation for end users
- [ ] Set up CI/CD pipeline
- [ ] Implement batch processing for large volumes
- [ ] Add integration tests
- [ ] Create backup and disaster recovery plan

## Resources

- [Project README](README.md) - Full documentation
- [Google Cloud Functions](https://cloud.google.com/functions/docs)
- [Vertex AI Gemini](https://cloud.google.com/vertex-ai/docs/generative-ai/model-reference/gemini)
- [Cloud Storage](https://cloud.google.com/storage/docs)

---

**Setup complete! Your discharge summary simplifier is now ready for production use.**
