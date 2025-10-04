#!/bin/bash

# Deployment script for Firestore Sync Cloud Function

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configuration
FUNCTION_NAME="discharge-summary-firestore-sync"
RUNTIME="nodejs20"
REGION="us-central1"
ENTRY_POINT="syncToFirestore"
MEMORY="512MB"
TIMEOUT="540s"

echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}Firestore Sync Function${NC}"
echo -e "${GREEN}Cloud Function Deployment${NC}"
echo -e "${GREEN}================================${NC}"
echo ""

# Check if PROJECT_ID is set
if [ -z "$PROJECT_ID" ]; then
    echo -e "${RED}Error: PROJECT_ID environment variable is not set${NC}"
    echo "Please set it with: export PROJECT_ID=your-project-id"
    exit 1
fi

echo -e "${GREEN}Configuration:${NC}"
echo "  Project ID: $PROJECT_ID"
echo "  Function Name: $FUNCTION_NAME"
echo "  Region: $REGION"
echo "  Runtime: $RUNTIME"
echo ""

# Build TypeScript
echo -e "${GREEN}Step 1: Building TypeScript...${NC}"
npm install && npm run build

if [ $? -ne 0 ]; then
    echo -e "${RED}Error: TypeScript build failed${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Build successful${NC}"
echo ""

# Enable required APIs
echo -e "${GREEN}Step 2: Enabling required Google Cloud APIs...${NC}"
gcloud services enable cloudfunctions.googleapis.com --project="$PROJECT_ID"
gcloud services enable cloudbuild.googleapis.com --project="$PROJECT_ID"
gcloud services enable artifactregistry.googleapis.com --project="$PROJECT_ID"
gcloud services enable firestore.googleapis.com --project="$PROJECT_ID"

echo -e "${GREEN}✓ APIs enabled${NC}"
echo ""

# Deploy Cloud Function for each bucket
echo -e "${GREEN}Step 3: Deploying Cloud Functions...${NC}"
echo "This may take a few minutes..."
echo ""

# Deploy for raw bucket
echo "Deploying trigger for discharge-summaries-raw..."
gcloud functions deploy "${FUNCTION_NAME}-raw" \
    --gen2 \
    --runtime="$RUNTIME" \
    --region="$REGION" \
    --source=. \
    --entry-point="$ENTRY_POINT" \
    --trigger-bucket="discharge-summaries-raw" \
    --memory="$MEMORY" \
    --timeout="$TIMEOUT" \
    --set-env-vars="PROJECT_ID=${PROJECT_ID}" \
    --project="$PROJECT_ID"

# Deploy for simplified bucket
echo "Deploying trigger for discharge-summaries-simplified..."
gcloud functions deploy "${FUNCTION_NAME}-simplified" \
    --gen2 \
    --runtime="$RUNTIME" \
    --region="$REGION" \
    --source=. \
    --entry-point="$ENTRY_POINT" \
    --trigger-bucket="discharge-summaries-simplified" \
    --memory="$MEMORY" \
    --timeout="$TIMEOUT" \
    --set-env-vars="PROJECT_ID=${PROJECT_ID}" \
    --project="$PROJECT_ID"

# Deploy for translated bucket
echo "Deploying trigger for discharge-summaries-translated..."
gcloud functions deploy "${FUNCTION_NAME}-translated" \
    --gen2 \
    --runtime="$RUNTIME" \
    --region="$REGION" \
    --source=. \
    --entry-point="$ENTRY_POINT" \
    --trigger-bucket="discharge-summaries-translated" \
    --memory="$MEMORY" \
    --timeout="$TIMEOUT" \
    --set-env-vars="PROJECT_ID=${PROJECT_ID}" \
    --project="$PROJECT_ID"

echo ""
echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}Deployment Successful! 🎉${NC}"
echo -e "${GREEN}================================${NC}"
echo ""
echo -e "${GREEN}Deployed Functions:${NC}"
echo "  - ${FUNCTION_NAME}-raw"
echo "  - ${FUNCTION_NAME}-simplified"
echo "  - ${FUNCTION_NAME}-translated"
echo ""
echo -e "${GREEN}To view logs:${NC}"
echo "  gcloud functions logs read ${FUNCTION_NAME}-raw --region=$REGION --project=$PROJECT_ID"
echo ""
