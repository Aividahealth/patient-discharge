#!/bin/bash

# Exit on error
set -e

# Configuration
PROJECT_ID="simtran-474018"
REGION="us-central1"
SERVICE_NAME="patient-discharge-chatbot"
REPOSITORY="cloud-run-source-deploy"
IMAGE_NAME="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPOSITORY}/${SERVICE_NAME}"

echo "🚀 Deploying Patient Chatbot to Cloud Run"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Project ID: ${PROJECT_ID}"
echo "Region: ${REGION}"
echo "Service: ${SERVICE_NAME}"
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

# Deploy to Cloud Run
echo "🚀 Deploying to Cloud Run..."
gcloud run deploy ${SERVICE_NAME} \
  --image ${IMAGE_NAME} \
  --platform managed \
  --region ${REGION} \
  --allow-unauthenticated \
  --port 8080 \
  --memory 2Gi \
  --cpu 2 \
  --timeout 300 \
  --cpu-boost \
  --max-instances 10 \
  --min-instances 0 \
  --no-cpu-throttling \
  --set-env-vars "NODE_ENV=dev,DEFAULT_GOOGLE_DATASET=aivida-dev,DEFAULT_GOOGLE_FHIR_STORE=aivida,JWT_SECRET=your-jwt-secret-change-in-production,GCP_PROJECT_ID=simtran-474018,GCP_LOCATION=us-central1"

echo ""
echo "⚠️  IMPORTANT: The service uses Application Default Credentials (ADC)."
echo "    Make sure the Cloud Run service account has the following permissions:"
echo "    - Firestore: roles/datastore.user"
echo "    - Vertex AI: roles/aiplatform.user"
echo ""

# Get the service URL
echo ""
echo "✅ Deployment complete!"
echo ""
SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} --platform managed --region ${REGION} --format 'value(status.url)')
echo "🌐 Service URL: ${SERVICE_URL}"
echo ""
echo "📝 Test the chatbot API:"
echo "curl -X POST ${SERVICE_URL}/api/patient-chatbot/chat \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \\"
echo "  -H 'X-Tenant-ID: default' \\"
echo "  -d '{\"message\":\"test\",\"patientId\":\"123\",\"compositionId\":\"456\",\"dischargeSummary\":\"...\",\"dischargeInstructions\":\"...\"}'"
echo ""
echo "📊 View logs: gcloud logs tail --service=${SERVICE_NAME} --region=${REGION}"
echo ""

