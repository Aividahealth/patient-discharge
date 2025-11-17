#!/bin/bash

# Deployment script for discharge-summary-translator Cloud Function (Pub/Sub triggered)
# This script builds and deploys the Translation Cloud Function to Google Cloud

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
FUNCTION_NAME="discharge-summary-translator"
RUNTIME="nodejs20"
REGION="us-central1"
ENTRY_POINT="processSimplificationCompletedEvent"
PUBSUB_TOPIC="discharge-simplification-completed"
MEMORY="512MB"
TIMEOUT="540s"

echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}Discharge Summary Translator${NC}"
echo -e "${GREEN}Cloud Function Deployment (Pub/Sub)${NC}"
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

# Check if BACKEND_API_URL is set (optional)
if [ -z "$BACKEND_API_URL" ]; then
    BACKEND_API_URL=""
    echo -e "${YELLOW}BACKEND_API_URL not set, will use default tenant config${NC}"
else
    echo -e "${GREEN}Using Backend API URL: ${BACKEND_API_URL}${NC}"
fi

# Check if FHIR_API_BASE_URL is set (optional)
if [ -z "$FHIR_API_BASE_URL" ]; then
    FHIR_API_BASE_URL=""
    echo -e "${YELLOW}FHIR_API_BASE_URL not set${NC}"
else
    echo -e "${GREEN}Using FHIR API URL: ${FHIR_API_BASE_URL}${NC}"
fi

echo -e "${GREEN}Configuration:${NC}"
echo "  Project ID: $PROJECT_ID"
echo "  Function Name: $FUNCTION_NAME"
echo "  Region: $REGION"
echo "  Runtime: $RUNTIME"
echo "  Trigger Topic: $PUBSUB_TOPIC"
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

# Build common components first
cd ../common && npm install && npm run build

# Copy common into translation for Cloud Build
cd ../translation
echo "Copying common modules for deployment..."
cp -r ../common ./common

# Backup original files
echo "Backing up source files..."
for file in *.ts; do
  if [ -f "$file" ]; then
    cp "$file" "$file.backup"
  fi
done

# Update imports to use ./common instead of ../common
echo "Updating import statements..."
for file in *.ts; do
  if [ -f "$file" ]; then
    sed -i.tmp "s|from '../common/|from './common/|g" "$file"
    rm -f "$file.tmp"
  fi
done

# Also backup and update tsconfig
cp tsconfig.json tsconfig.json.backup
cat > tsconfig.json <<'TSCONFIG_EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./lib",
    "rootDir": "./",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "moduleResolution": "node",
    "baseUrl": "./",
    "paths": {
      "@common/*": ["./common/*"]
    }
  },
  "include": [
    "./**/*.ts",
    "./common/**/*.ts"
  ],
  "exclude": [
    "node_modules",
    "lib",
    "**/*.test.ts"
  ]
}
TSCONFIG_EOF

# Install dependencies and build
npm install && npm run build

if [ $? -ne 0 ]; then
    echo -e "${RED}Error: TypeScript build failed${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Build successful${NC}"
echo ""

# Check/create Pub/Sub topic
echo -e "${GREEN}Step 2: Verifying Pub/Sub topic...${NC}"

FULL_TOPIC_NAME="projects/${PROJECT_ID}/topics/${PUBSUB_TOPIC}"
if ! gcloud pubsub topics describe "$PUBSUB_TOPIC" --project="$PROJECT_ID" &> /dev/null; then
    echo -e "${YELLOW}Warning: Pub/Sub topic ${PUBSUB_TOPIC} does not exist${NC}"
    echo "Creating topic..."
    gcloud pubsub topics create "$PUBSUB_TOPIC" --project="$PROJECT_ID"
fi

echo -e "${GREEN}✓ Pub/Sub topic verified${NC}"
echo ""

# Verify buckets for default tenant
echo -e "${GREEN}Step 3: Verifying GCS buckets for default tenant...${NC}"

# Tenant-specific bucket names
SIMPLIFIED_BUCKET="discharge-summaries-simplified-default"
TRANSLATED_BUCKET="discharge-summaries-translated-default"

if ! gsutil ls -b "gs://${SIMPLIFIED_BUCKET}" &> /dev/null; then
    echo -e "${YELLOW}Warning: Simplified bucket gs://${SIMPLIFIED_BUCKET} does not exist${NC}"
    echo "Creating bucket..."
    gsutil mb -p "$PROJECT_ID" -l "$REGION" "gs://${SIMPLIFIED_BUCKET}"
fi

if ! gsutil ls -b "gs://${TRANSLATED_BUCKET}" &> /dev/null; then
    echo -e "${YELLOW}Warning: Translated bucket gs://${TRANSLATED_BUCKET} does not exist${NC}"
    echo "Creating bucket..."
    gsutil mb -p "$PROJECT_ID" -l "$REGION" "gs://${TRANSLATED_BUCKET}"
fi

echo -e "${GREEN}✓ Buckets verified${NC}"
echo ""

# Enable required APIs
echo -e "${GREEN}Step 4: Enabling required Google Cloud APIs...${NC}"
gcloud services enable cloudfunctions.googleapis.com --project="$PROJECT_ID" 2>/dev/null || true
gcloud services enable cloudbuild.googleapis.com --project="$PROJECT_ID" 2>/dev/null || true
gcloud services enable artifactregistry.googleapis.com --project="$PROJECT_ID" 2>/dev/null || true
gcloud services enable translate.googleapis.com --project="$PROJECT_ID" 2>/dev/null || true
gcloud services enable storage.googleapis.com --project="$PROJECT_ID" 2>/dev/null || true
gcloud services enable pubsub.googleapis.com --project="$PROJECT_ID" 2>/dev/null || true
gcloud services enable run.googleapis.com --project="$PROJECT_ID" 2>/dev/null || true

echo -e "${GREEN}✓ APIs enabled${NC}"
echo ""

# Deploy Cloud Function
echo -e "${GREEN}Step 5: Deploying Translation Cloud Function...${NC}"
echo "This may take a few minutes..."
echo ""

# Create .gcloudignore
cat > .gcloudignore <<EOF
# Node.js dependencies
node_modules/

# Environment files
.env
.env.*

# Git
.git/
.gitignore

# IDE
.vscode/
.idea/

# Tests
tests/
*.test.ts
*.spec.ts
jest.config.js
coverage/

# Documentation
*.md
docs/

# Development files
.prettierrc
.eslintrc.js
.editorconfig

# Backup
.backup/

# Old files
translation-function.ts
gcs.service.ts
firestore.service.ts

# Other services
../simplification/
../examples/
EOF

gcloud functions deploy "$FUNCTION_NAME" \
    --gen2 \
    --runtime="$RUNTIME" \
    --region="$REGION" \
    --source=. \
    --entry-point="$ENTRY_POINT" \
    --trigger-topic="$PUBSUB_TOPIC" \
    --memory="$MEMORY" \
    --timeout="$TIMEOUT" \
    --set-env-vars="PROJECT_ID=${PROJECT_ID},LOCATION=${LOCATION},MODEL_NAME=${MODEL_NAME},BACKEND_API_URL=${BACKEND_API_URL},FHIR_API_BASE_URL=${FHIR_API_BASE_URL}" \
    --project="$PROJECT_ID"

DEPLOY_STATUS=$?

# Clean up and restore original files
echo "Cleaning up deployment files..."
rm -rf ./common
mv tsconfig.json.backup tsconfig.json
for file in *.ts.backup; do
  if [ -f "$file" ]; then
    mv "$file" "${file%.backup}"
  fi
done

if [ $DEPLOY_STATUS -ne 0 ]; then
    echo -e "${RED}Error: Deployment failed${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}Translation Function Deployment Successful! 🎉${NC}"
echo -e "${GREEN}================================${NC}"
echo ""
echo -e "${GREEN}Function Details:${NC}"
echo "  Name: $FUNCTION_NAME"
echo "  Region: $REGION"
echo "  Trigger Topic: projects/${PROJECT_ID}/topics/${PUBSUB_TOPIC}"
echo "  Simplified Bucket: gs://${SIMPLIFIED_BUCKET}"
echo "  Translated Bucket: gs://${TRANSLATED_BUCKET}"
echo ""
echo -e "${GREEN}To test:${NC}"
echo "  # Trigger by publishing a message to the topic (normally triggered by simplification service)"
echo "  gcloud pubsub topics publish $PUBSUB_TOPIC --message='{\"tenantId\":\"default\",\"compositionId\":\"test-123\",\"simplifiedFiles\":[],\"processingTimeMs\":1000,\"tokensUsed\":100,\"timestamp\":\"2025-11-09T00:00:00.000Z\"}' --project=$PROJECT_ID"
echo ""
echo -e "${GREEN}To view logs:${NC}"
echo "  gcloud functions logs read $FUNCTION_NAME --region=$REGION --project=$PROJECT_ID"
echo ""
