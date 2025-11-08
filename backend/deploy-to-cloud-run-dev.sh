#!/bin/bash

# Exit on error
set -e

# Configuration for DEV environment
PROJECT_ID="simtran-474018"
REGION="us-central1"
SERVICE_NAME="patient-discharge-backend-dev"
REPOSITORY="cloud-run-source-deploy"
IMAGE_NAME="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPOSITORY}/${SERVICE_NAME}"

echo "🚀 Deploying NestJS Backend to Cloud Run (DEV Environment)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Project ID: ${PROJECT_ID}"
echo "Region: ${REGION}"
echo "Service: ${SERVICE_NAME}"
echo "Environment: DEV"
echo ""

# Set the project
echo "📋 Setting GCP project..."
gcloud config set project ${PROJECT_ID}

# Enable required APIs
echo "🔧 Enabling required APIs..."
gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable artifactregistry.googleapis.com

# Create Artifact Registry repository if it doesn't exist
echo "📦 Creating Artifact Registry repository..."
gcloud artifacts repositories create ${REPOSITORY} \
  --repository-format=docker \
  --location=${REGION} \
  --description="Docker repository for Cloud Run" 2>/dev/null || echo "Repository already exists"

# Build the container image
echo "🏗️  Building container image..."
# Change to backend directory (where script is located) to ensure correct build context
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}" || exit 1
gcloud builds submit . --tag ${IMAGE_NAME}

# Deploy to Cloud Run with DEV environment
echo "🚀 Deploying to Cloud Run (DEV)..."
gcloud run deploy ${SERVICE_NAME} \
  --image ${IMAGE_NAME} \
  --platform managed \
  --region ${REGION} \
  --allow-unauthenticated \
  --port 8080 \
  --memory 512Mi \
  --cpu 1 \
  --timeout 300 \
  --max-instances 10 \
  --min-instances 0 \
  --set-env-vars "NODE_ENV=dev"

# Note: If --allow-unauthenticated doesn't work, you may need a project admin to run:
# gcloud run services add-iam-policy-binding ${SERVICE_NAME} \
#   --region ${REGION} \
#   --member "allUsers" \
#   --role "roles/run.invoker"

# Get the service URL
echo ""
echo "✅ DEV Deployment complete!"
echo ""
SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} --platform managed --region ${REGION} --format 'value(status.url)')
echo "🌐 DEV Service URL: ${SERVICE_URL}"
echo ""
echo "📝 Next steps:"
echo "1. Update your frontend .env with: NEXT_PUBLIC_API_URL=${SERVICE_URL}"
echo "2. Test the API: curl ${SERVICE_URL}/discharge-summaries/stats/overview"
echo "3. Check logs: gcloud logs tail --service=${SERVICE_NAME} --region=${REGION}"
echo ""
