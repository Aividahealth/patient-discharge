#!/bin/bash

# Deployment script for discharge-summary-simplifier Cloud Functions
# This script builds and deploys the Cloud Functions to Google Cloud
# Usage: ./deploy.sh [gcs|pubsub|all]
#   gcs    - Deploy only GCS-triggered function
#   pubsub - Deploy only Pub/Sub-triggered function
#   all    - Deploy both functions (default)

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Deployment mode (default: all)
DEPLOY_MODE="${1:-all}"

# Configuration for GCS-triggered function
GCS_FUNCTION_NAME="discharge-summary-simplifier"
GCS_ENTRY_POINT="processDischargeSummary"
GCS_TRIGGER_BUCKET="discharge-summaries-raw"

# Configuration for Pub/Sub-triggered function
PUBSUB_FUNCTION_NAME="discharge-export-processor"
PUBSUB_ENTRY_POINT="processDischargeExportEvent"

# Common configuration
RUNTIME="nodejs20"
REGION="us-central1"
MEMORY="512MB"
TIMEOUT="540s"
GEN2_FLAG="--gen2"

echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}Discharge Summary Simplifier${NC}"
echo -e "${GREEN}Cloud Functions Deployment${NC}"
echo -e "${GREEN}================================${NC}"
echo ""
echo -e "${GREEN}Deployment Mode: ${DEPLOY_MODE}${NC}"
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

# Check if MODEL_NAME is set (optional, default to gemini-1.5-pro)
if [ -z "$MODEL_NAME" ]; then
    MODEL_NAME="gemini-1.5-pro"
    echo -e "${YELLOW}MODEL_NAME not set, using default: ${MODEL_NAME}${NC}"
fi

# Check if PUBSUB_TOPIC is set (optional, default to discharge-export-events)
if [ -z "$PUBSUB_TOPIC" ]; then
    PUBSUB_TOPIC="discharge-export-events"
    echo -e "${YELLOW}PUBSUB_TOPIC not set, using default: ${PUBSUB_TOPIC}${NC}"
else
    echo -e "${GREEN}Using Pub/Sub topic: ${PUBSUB_TOPIC}${NC}"
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
echo "  Region: $REGION"
echo "  Runtime: $RUNTIME"
echo "  Memory: $MEMORY"
echo "  Timeout: $TIMEOUT"
echo "  Model: $MODEL_NAME"
if [ "$DEPLOY_MODE" == "gcs" ] || [ "$DEPLOY_MODE" == "all" ]; then
    echo ""
    echo "  GCS Function:"
    echo "    Name: $GCS_FUNCTION_NAME"
    echo "    Trigger Bucket: $GCS_TRIGGER_BUCKET"
fi
if [ "$DEPLOY_MODE" == "pubsub" ] || [ "$DEPLOY_MODE" == "all" ]; then
    echo ""
    echo "  Pub/Sub Function:"
    echo "    Name: $PUBSUB_FUNCTION_NAME"
    echo "    Trigger Topic: $PUBSUB_TOPIC"
fi
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
# Copy common into simplification for Cloud Build
cd ../simplification
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

npm install && npm run build

if [ $? -ne 0 ]; then
    echo -e "${RED}Error: TypeScript build failed${NC}"
    # Restore backups
    for file in *.ts.backup; do
      if [ -f "$file" ]; then
        mv "$file" "${file%.backup}"
      fi
    done
    rm -rf ./common
    mv tsconfig.json.backup tsconfig.json
    exit 1
fi

echo -e "${GREEN}✓ Build successful${NC}"
echo ""

# Check if buckets exist (for default tenant)
echo -e "${GREEN}Step 2: Verifying GCS buckets for default tenant...${NC}"

# Tenant-specific bucket names
RAW_BUCKET="discharge-summaries-raw-default"
SIMPLIFIED_BUCKET="discharge-summaries-simplified-default"
TRANSLATED_BUCKET="discharge-summaries-translated-default"

if ! gsutil ls -b "gs://${RAW_BUCKET}" &> /dev/null; then
    echo -e "${YELLOW}Warning: Raw bucket gs://${RAW_BUCKET} does not exist${NC}"
    echo "Creating bucket..."
    gsutil mb -p "$PROJECT_ID" -l "$REGION" "gs://${RAW_BUCKET}"
fi

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

# Check/create Pub/Sub topics if needed
if [ "$DEPLOY_MODE" == "pubsub" ] || [ "$DEPLOY_MODE" == "all" ]; then
    echo -e "${GREEN}Step 2b: Verifying Pub/Sub topics...${NC}"

    # Verify input topic (discharge-export-events)
    FULL_TOPIC_NAME="projects/${PROJECT_ID}/topics/${PUBSUB_TOPIC}"
    if ! gcloud pubsub topics describe "$PUBSUB_TOPIC" --project="$PROJECT_ID" &> /dev/null; then
        echo -e "${YELLOW}Warning: Pub/Sub topic ${PUBSUB_TOPIC} does not exist${NC}"
        echo "Creating topic..."
        gcloud pubsub topics create "$PUBSUB_TOPIC" --project="$PROJECT_ID"
    fi
    echo "✓ Input topic verified: ${PUBSUB_TOPIC}"

    # Verify output topic (discharge-simplification-completed)
    OUTPUT_TOPIC="discharge-simplification-completed"
    if ! gcloud pubsub topics describe "$OUTPUT_TOPIC" --project="$PROJECT_ID" &> /dev/null; then
        echo -e "${YELLOW}Warning: Pub/Sub topic ${OUTPUT_TOPIC} does not exist${NC}"
        echo "Creating topic..."
        gcloud pubsub topics create "$OUTPUT_TOPIC" --project="$PROJECT_ID"
    fi
    echo "✓ Output topic verified: ${OUTPUT_TOPIC}"

    echo -e "${GREEN}✓ Pub/Sub topics verified${NC}"
    echo ""
fi

# Enable required APIs
echo -e "${GREEN}Step 3: Enabling required Google Cloud APIs...${NC}"
gcloud services enable cloudfunctions.googleapis.com --project="$PROJECT_ID"
gcloud services enable cloudbuild.googleapis.com --project="$PROJECT_ID"
gcloud services enable artifactregistry.googleapis.com --project="$PROJECT_ID"
gcloud services enable aiplatform.googleapis.com --project="$PROJECT_ID"
gcloud services enable storage.googleapis.com --project="$PROJECT_ID"

if [ "$DEPLOY_MODE" == "pubsub" ] || [ "$DEPLOY_MODE" == "all" ]; then
    gcloud services enable pubsub.googleapis.com --project="$PROJECT_ID"
fi

echo -e "${GREEN}✓ APIs enabled${NC}"
echo ""

# Deploy Cloud Functions
echo -e "${GREEN}Step 4: Deploying Cloud Functions...${NC}"
echo "This may take a few minutes..."
echo ""

# Create .gcloudignore in parent directory that includes common folder
cat > ../.gcloudignore <<EOF
# Node.js dependencies
**/node_modules/

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
README.md
*.md
docs/

# Development files
.prettierrc
.eslintrc.js
.editorconfig

# Compiled output (Cloud Build will create this)
lib/

# Examples
examples/

# Translation function
translation/
EOF

DEPLOY_STATUS=0

# Deploy GCS-triggered function
if [ "$DEPLOY_MODE" == "gcs" ] || [ "$DEPLOY_MODE" == "all" ]; then
    echo -e "${GREEN}Deploying GCS-triggered function: $GCS_FUNCTION_NAME${NC}"
    gcloud functions deploy "$GCS_FUNCTION_NAME" \
        $GEN2_FLAG \
        --runtime="$RUNTIME" \
        --region="$REGION" \
        --source=. \
        --entry-point="$GCS_ENTRY_POINT" \
        --trigger-bucket="$GCS_TRIGGER_BUCKET" \
        --memory="$MEMORY" \
        --timeout="$TIMEOUT" \
        --set-env-vars="PROJECT_ID=${PROJECT_ID},LOCATION=${LOCATION},MODEL_NAME=${MODEL_NAME},FHIR_API_BASE_URL=${FHIR_API_BASE_URL},BACKEND_API_URL=${BACKEND_API_URL}" \
        --project="$PROJECT_ID"

    GCS_DEPLOY_STATUS=$?
    if [ $GCS_DEPLOY_STATUS -ne 0 ]; then
        DEPLOY_STATUS=$GCS_DEPLOY_STATUS
    fi
    echo ""
fi

# Deploy Pub/Sub-triggered function
if [ "$DEPLOY_MODE" == "pubsub" ] || [ "$DEPLOY_MODE" == "all" ]; then
    echo -e "${GREEN}Deploying Pub/Sub-triggered function: $PUBSUB_FUNCTION_NAME${NC}"
    gcloud functions deploy "$PUBSUB_FUNCTION_NAME" \
        $GEN2_FLAG \
        --runtime="$RUNTIME" \
        --region="$REGION" \
        --source=. \
        --entry-point="$PUBSUB_ENTRY_POINT" \
        --trigger-topic="$PUBSUB_TOPIC" \
        --memory="$MEMORY" \
        --timeout="$TIMEOUT" \
        --set-env-vars="PROJECT_ID=${PROJECT_ID},LOCATION=${LOCATION},MODEL_NAME=${MODEL_NAME},FHIR_API_BASE_URL=${FHIR_API_BASE_URL},BACKEND_API_URL=${BACKEND_API_URL}" \
        --project="$PROJECT_ID"

    PUBSUB_DEPLOY_STATUS=$?
    if [ $PUBSUB_DEPLOY_STATUS -ne 0 ]; then
        DEPLOY_STATUS=$PUBSUB_DEPLOY_STATUS
    fi
    echo ""
fi

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
echo -e "${GREEN}Deployment Successful! 🎉${NC}"
echo -e "${GREEN}================================${NC}"
echo ""

# Display deployed function details
if [ "$DEPLOY_MODE" == "gcs" ] || [ "$DEPLOY_MODE" == "all" ]; then
    echo -e "${GREEN}GCS-Triggered Function:${NC}"
    echo "  Name: $GCS_FUNCTION_NAME"
    echo "  Region: $REGION"
    echo "  Trigger: gs://${GCS_TRIGGER_BUCKET}"
    echo "  Output: gs://${OUTPUT_BUCKET}"
    echo ""
    echo -e "${GREEN}To test:${NC}"
    echo "  gsutil cp your-discharge-summary.md gs://${GCS_TRIGGER_BUCKET}/"
    echo ""
    echo -e "${GREEN}To view logs:${NC}"
    echo "  gcloud functions logs read $GCS_FUNCTION_NAME --region=$REGION --project=$PROJECT_ID"
    echo ""
fi

if [ "$DEPLOY_MODE" == "pubsub" ] || [ "$DEPLOY_MODE" == "all" ]; then
    echo -e "${GREEN}Pub/Sub-Triggered Function:${NC}"
    echo "  Name: $PUBSUB_FUNCTION_NAME"
    echo "  Region: $REGION"
    echo "  Trigger Topic: projects/${PROJECT_ID}/topics/${PUBSUB_TOPIC}"
    echo "  Output Topic: projects/${PROJECT_ID}/topics/discharge-simplification-completed"
    echo "  Raw Bucket: gs://${RAW_BUCKET}"
    echo "  Simplified Bucket: gs://${SIMPLIFIED_BUCKET}"
    echo "  Translated Bucket: gs://${TRANSLATED_BUCKET}"
    echo ""
    echo -e "${GREEN}To test:${NC}"
    echo '  gcloud pubsub topics publish '"$PUBSUB_TOPIC"' --message='"'"'{"tenantId":"default","patientId":"","exportTimestamp":"2025-10-27T15:15:45.925Z","status":"success","cernerEncounterId":"97996600","googleEncounterId":"94562854-4223-43a2-af83-747c3794ce12","googleCompositionId":"22036570-3dc8-4f2f-bf03-43b561af09b9"}'"'"' --project='"$PROJECT_ID"
    echo ""
    echo -e "${GREEN}To view logs:${NC}"
    echo "  gcloud functions logs read $PUBSUB_FUNCTION_NAME --region=$REGION --project=$PROJECT_ID"
    echo ""
fi
