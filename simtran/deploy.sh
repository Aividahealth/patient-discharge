#!/bin/bash

# Deployment script for discharge-summary-simplifier Cloud Function
# This script builds and deploys the Cloud Function to Google Cloud

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
FUNCTION_NAME="discharge-summary-simplifier"
RUNTIME="nodejs20"
REGION="us-central1"
ENTRY_POINT="processDischargeSummary"
TRIGGER_BUCKET="discharge-summaries-raw"
MEMORY="512MB"
TIMEOUT="540s"
GEN2_FLAG="--gen2"

echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}Discharge Summary Simplifier${NC}"
echo -e "${GREEN}Cloud Function Deployment${NC}"
echo -e "${GREEN}================================${NC}"
echo ""

# Check if PROJECT_ID is set
if [ -z "$PROJECT_ID" ]; then
    echo -e "${RED}Error: PROJECT_ID environment variable is not set${NC}"
    echo "Please set it with: export PROJECT_ID=your-project-id"
    exit 1
fi

# Check if LOCATION is set (optional, default to us-central1)
if [ -z "$LOCATION" ]; then
    LOCATION="us-central1"
    echo -e "${YELLOW}LOCATION not set, using default: ${LOCATION}${NC}"
fi

# Check if MODEL_NAME is set (optional, default to gemini-2.5-pro)
if [ -z "$MODEL_NAME" ]; then
    MODEL_NAME="gemini-2.5-pro"
    echo -e "${YELLOW}MODEL_NAME not set, using default: ${MODEL_NAME}${NC}"
fi

echo -e "${GREEN}Configuration:${NC}"
echo "  Project ID: $PROJECT_ID"
echo "  Function Name: $FUNCTION_NAME"
echo "  Region: $REGION"
echo "  Runtime: $RUNTIME"
echo "  Trigger Bucket: $TRIGGER_BUCKET"
echo "  Memory: $MEMORY"
echo "  Timeout: $TIMEOUT"
echo "  Model: $MODEL_NAME"
echo ""

# Verify gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}Error: gcloud CLI is not installed${NC}"
    echo "Please install it from: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Verify current project
CURRENT_PROJECT=$(gcloud config get-value project 2>/dev/null)
if [ "$CURRENT_PROJECT" != "$PROJECT_ID" ]; then
    echo -e "${YELLOW}Warning: Current gcloud project ($CURRENT_PROJECT) differs from PROJECT_ID ($PROJECT_ID)${NC}"
    echo "Setting project to: $PROJECT_ID"
    gcloud config set project "$PROJECT_ID"
fi

# Build TypeScript
echo -e "${GREEN}Step 1: Building TypeScript...${NC}"
npm run build

if [ $? -ne 0 ]; then
    echo -e "${RED}Error: TypeScript build failed${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Build successful${NC}"
echo ""

# Check if buckets exist
echo -e "${GREEN}Step 2: Verifying GCS buckets...${NC}"

if ! gsutil ls -b "gs://${TRIGGER_BUCKET}" &> /dev/null; then
    echo -e "${YELLOW}Warning: Input bucket gs://${TRIGGER_BUCKET} does not exist${NC}"
    echo "Creating bucket..."
    gsutil mb -p "$PROJECT_ID" -l "$REGION" "gs://${TRIGGER_BUCKET}"
fi

OUTPUT_BUCKET="discharge-summaries-simplified"
if ! gsutil ls -b "gs://${OUTPUT_BUCKET}" &> /dev/null; then
    echo -e "${YELLOW}Warning: Output bucket gs://${OUTPUT_BUCKET} does not exist${NC}"
    echo "Creating bucket..."
    gsutil mb -p "$PROJECT_ID" -l "$REGION" "gs://${OUTPUT_BUCKET}"
fi

echo -e "${GREEN}✓ Buckets verified${NC}"
echo ""

# Enable required APIs
echo -e "${GREEN}Step 3: Enabling required Google Cloud APIs...${NC}"
gcloud services enable cloudfunctions.googleapis.com --project="$PROJECT_ID"
gcloud services enable cloudbuild.googleapis.com --project="$PROJECT_ID"
gcloud services enable artifactregistry.googleapis.com --project="$PROJECT_ID"
gcloud services enable aiplatform.googleapis.com --project="$PROJECT_ID"
gcloud services enable storage.googleapis.com --project="$PROJECT_ID"

echo -e "${GREEN}✓ APIs enabled${NC}"
echo ""

# Resolve backend/FHIR API URLs (prefer env; else auto-detect Cloud Run service URL)
if [ -z "$BACKEND_API_URL" ]; then
    SERVICE_NAME="${BACKEND_SERVICE_NAME:-patient-discharge-backend-dev}"
    SERVICE_REGION="${BACKEND_SERVICE_REGION:-$REGION}"
    echo -e "${YELLOW}BACKEND_API_URL not set. Attempting to detect Cloud Run service URL for ${SERVICE_NAME}...${NC}"
    BACKEND_API_URL=$(gcloud run services describe "$SERVICE_NAME" --region="$SERVICE_REGION" --format='value(status.url)' --project="$PROJECT_ID" 2>/dev/null || echo "")
    if [ -z "$BACKEND_API_URL" ]; then
        echo -e "${RED}Could not determine BACKEND_API_URL. Please export BACKEND_API_URL with your Cloud Run URL and retry.${NC}"
        exit 1
    fi
fi
echo -e "${GREEN}Using Backend API URL: ${BACKEND_API_URL}${NC}"

if [ -z "$FHIR_API_BASE_URL" ]; then
    FHIR_API_BASE_URL="$BACKEND_API_URL"
    echo -e "${YELLOW}FHIR_API_BASE_URL not set. Using BACKEND_API_URL: ${FHIR_API_BASE_URL}${NC}"
else
    echo -e "${GREEN}Using FHIR API URL: ${FHIR_API_BASE_URL}${NC}"
fi

# Deploy Cloud Function
echo -e "${GREEN}Step 4: Deploying Cloud Function...${NC}"
echo "This may take a few minutes..."
echo ""

gcloud functions deploy "$FUNCTION_NAME" \
    $GEN2_FLAG \
    --runtime="$RUNTIME" \
    --region="$REGION" \
    --source=. \
    --entry-point="$ENTRY_POINT" \
    --trigger-bucket="$TRIGGER_BUCKET" \
    --memory="$MEMORY" \
    --timeout="$TIMEOUT" \
    --set-env-vars="PROJECT_ID=${PROJECT_ID},LOCATION=${LOCATION},MODEL_NAME=${MODEL_NAME},BACKEND_API_URL=${BACKEND_API_URL},FHIR_API_BASE_URL=${FHIR_API_BASE_URL}" \
    --project="$PROJECT_ID"

if [ $? -ne 0 ]; then
    echo -e "${RED}Error: Deployment failed${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}Deployment Successful! 🎉${NC}"
echo -e "${GREEN}================================${NC}"
echo ""
echo -e "${GREEN}Function Details:${NC}"
echo "  Name: $FUNCTION_NAME"
echo "  Region: $REGION"
echo "  Trigger: gs://${TRIGGER_BUCKET}"
echo "  Output: gs://${OUTPUT_BUCKET}"
echo ""
echo -e "${GREEN}To test the function:${NC}"
echo "  gsutil cp your-discharge-summary.md gs://${TRIGGER_BUCKET}/"
echo ""
echo -e "${GREEN}To view logs:${NC}"
echo "  gcloud functions logs read $FUNCTION_NAME --region=$REGION --project=$PROJECT_ID"
echo ""
