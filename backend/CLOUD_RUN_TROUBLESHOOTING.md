# Cloud Run Deployment Troubleshooting Guide

## Overview
This guide helps troubleshoot common issues when deploying the Patient Discharge backend to Google Cloud Run.

## Common Issues and Solutions

### 1. Container Failed to Start (Port Binding Issue)

**Error:**
```
The user-provided container failed to start and listen on the port defined provided by the PORT=8080 environment variable
```

**Causes:**
- Application not listening on `0.0.0.0` (required for containers)
- Application crashes during startup before binding to port
- Wrong port configuration

**Solutions:**
✅ **Fixed:** Application now listens on `0.0.0.0` (see `src/main.ts`)
```typescript
await app.listen(port, '0.0.0.0');
```

### 2. Configuration File Missing

**Error:**
```
Failed to load config from YAML file: ENOENT: no such file or directory
```

**Causes:**
- `.settings.dev/config.yaml` not copied to container
- Wrong `NODE_ENV` value

**Solutions:**
✅ **Fixed:** Dockerfile explicitly copies `.settings.dev` directory
✅ **Fallback:** Application falls back to environment variables if YAML fails

**Verify in Dockerfile:**
```dockerfile
COPY .settings.dev ./.settings.dev
```

### 3. Firestore Authentication Failed

**Error:**
```
Error getting tenant config from Firestore: Could not load the default credentials
```

**Causes:**
- Service account not configured
- Missing IAM permissions

**Solutions:**

1. **Verify Cloud Run service account has permissions:**
```bash
# Get the service account
gcloud run services describe patient-discharge-chatbot \
  --region us-central1 \
  --format 'value(spec.template.spec.serviceAccountName)'

# Grant Firestore permissions
gcloud projects add-iam-policy-binding simtran-474018 \
  --member="serviceAccount:SERVICE_ACCOUNT_EMAIL" \
  --role="roles/datastore.user"

# Grant Vertex AI permissions (for chatbot)
gcloud projects add-iam-policy-binding simtran-474018 \
  --member="serviceAccount:SERVICE_ACCOUNT_EMAIL" \
  --role="roles/aiplatform.user"
```

2. **Application uses Application Default Credentials (ADC) automatically in Cloud Run**

### 4. Startup Timeout

**Error:**
```
Revision 'xxx' is not ready and cannot serve traffic. ... timeout
```

**Causes:**
- Application takes too long to initialize
- Heavy dependencies loading slowly

**Solutions:**
✅ **Fixed:** Deployment script uses `--startup-cpu-boost` for faster startup
✅ **Fixed:** Increased memory to 2Gi and CPU to 2 cores

### 5. Missing Environment Variables

**Symptoms:**
- Application starts but crashes when handling requests
- Errors about missing configuration

**Solutions:**
✅ **Fixed:** Deployment script sets all required environment variables:
- `NODE_ENV=dev`
- `PORT=8080`
- `DEFAULT_GOOGLE_DATASET`
- `DEFAULT_GOOGLE_FHIR_STORE`
- `JWT_SECRET`
- `GCP_PROJECT_ID`
- `GCP_LOCATION`

## Deployment Scripts

### For Chatbot Service
```bash
cd backend
./deploy-chatbot-to-cloud-run.sh
```

### For Main Backend
```bash
cd backend
./deploy-to-cloud-run.sh
```

## Checking Logs

### Real-time logs
```bash
gcloud logs tail --service=patient-discharge-chatbot --region=us-central1
```

### Filter by severity
```bash
gcloud logs read --service=patient-discharge-chatbot \
  --region=us-central1 \
  --severity=ERROR \
  --limit=50
```

### View startup logs
```bash
gcloud logs read --service=patient-discharge-chatbot \
  --region=us-central1 \
  --filter="textPayload:Bootstrap" \
  --limit=50
```

## Testing the Deployment

### 1. Health Check
```bash
SERVICE_URL=$(gcloud run services describe patient-discharge-chatbot \
  --region us-central1 \
  --format 'value(status.url)')

curl $SERVICE_URL/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 123.456,
  "environment": "dev"
}
```

### 2. Root Endpoint
```bash
curl $SERVICE_URL/
```

Expected response:
```
Hello World!
```

### 3. Chatbot Endpoint (requires authentication)
```bash
curl -X POST $SERVICE_URL/api/patient-chatbot/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "X-Tenant-ID: default" \
  -d '{
    "message": "What is my discharge summary about?",
    "patientId": "123",
    "compositionId": "456",
    "dischargeSummary": "Patient was admitted...",
    "dischargeInstructions": "Take medications..."
  }'
```

## Key Configuration Changes Made

1. ✅ **Port Binding**: Changed `app.listen(port)` to `app.listen(port, '0.0.0.0')`
2. ✅ **Error Handling**: Added try-catch in bootstrap with proper error logging
3. ✅ **Health Check**: Added `/health` endpoint
4. ✅ **Startup Performance**: Increased CPU/memory and enabled startup boost
5. ✅ **Environment Variables**: Set all required variables in deployment script
6. ✅ **Dependencies**: Fixed missing `class-validator` and `class-transformer` packages
7. ✅ **Guards**: Fixed incorrect guard imports (use `AuthGuard` instead of `JwtAuthGuard`)

## Rollback Procedure

If deployment fails, rollback to previous version:

```bash
# List revisions
gcloud run revisions list --service=patient-discharge-chatbot --region=us-central1

# Rollback to previous revision
gcloud run services update-traffic patient-discharge-chatbot \
  --region=us-central1 \
  --to-revisions=PREVIOUS_REVISION=100
```

## Monitoring

### View service details
```bash
gcloud run services describe patient-discharge-chatbot --region=us-central1
```

### Check resource usage
```bash
gcloud run services describe patient-discharge-chatbot \
  --region=us-central1 \
  --format="value(status.traffic[0].percent)"
```

## Next Steps After Successful Deployment

1. ✅ Test all endpoints
2. ✅ Monitor logs for errors
3. ✅ Set up alerts for failures
4. ✅ Configure custom domain (optional)
5. ✅ Update frontend to use new service URL
6. ✅ Set up Cloud Monitoring dashboards

## Support

For more help:
- [Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Cloud Run Troubleshooting](https://cloud.google.com/run/docs/troubleshooting)
- Check application logs in Cloud Console

