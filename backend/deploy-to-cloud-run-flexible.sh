#!/bin/bash

# Exit on error
set -e

# Configuration
PROJECT_ID="simtran-474018"
REGION="us-central1"
REPOSITORY="cloud-run-source-deploy"

# Get environment from command line argument or default to dev
ENVIRONMENT=${1:-dev}
SERVICE_NAME="patient-discharge-backend-${ENVIRONMENT}"
IMAGE_NAME="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPOSITORY}/${SERVICE_NAME}"

echo "🚀 Deploying NestJS Backend to Cloud Run"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Project ID: ${PROJECT_ID}"
echo "Region: ${REGION}"
echo "Service: ${SERVICE_NAME}"
echo "Environment: ${ENVIRONMENT}"
echo ""

# Check if settings folder exists
if [ ! -d ".settings.${ENVIRONMENT}" ]; then
    echo "❌ Error: .settings.${ENVIRONMENT} folder not found!"
    echo "Available environments:"
    ls -la .settings.* 2>/dev/null | grep "^d" | awk '{print $9}' | sed 's/.settings.//' || echo "No .settings folders found"
    exit 1
fi

echo "✅ Found .settings.${ENVIRONMENT} configuration folder"

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
gcloud builds submit --tag ${IMAGE_NAME}

# Deploy to Cloud Run
echo "🚀 Deploying to Cloud Run..."
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
  --set-env-vars "NODE_ENV=${ENVIRONMENT}"

# Get the service URL
echo ""
echo "✅ Deployment complete!"
echo ""
SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} --platform managed --region ${REGION} --format 'value(status.url)')
echo "🌐 Service URL: ${SERVICE_URL}"
echo ""
echo "📝 Next steps:"
echo "1. Update your frontend .env with: NEXT_PUBLIC_API_URL=${SERVICE_URL}"
echo "2. Test the API: curl ${SERVICE_URL}/discharge-summaries/stats/overview"
echo "3. Check logs: gcloud logs tail --service=${SERVICE_NAME} --region=${REGION}"
echo ""
echo "🔧 Environment: ${ENVIRONMENT}"
echo "📁 Config loaded from: .settings.${ENVIRONMENT}/config.yaml"
echo ""
