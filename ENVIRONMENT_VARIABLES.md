# Environment Variables Configuration

## Frontend (Next.js)

### Required Environment Variables

All frontend environment variables must be prefixed with `NEXT_PUBLIC_` to be accessible in the browser.

#### 1. Main Backend API URL

**Variable:** `NEXT_PUBLIC_API_URL`

**Purpose:** Points to the main backend service for patient data, FHIR resources, etc.

**Values:**
- **Local Development:** `http://localhost:3000`
- **Production:** `https://patient-discharge-backend-qnzythtpnq-uc.a.run.app`

**Default Fallback:** Automatically detects localhost or uses production URL

---

#### 2. Chatbot Service URL

**Variable:** `NEXT_PUBLIC_CHATBOT_SERVICE_URL`

**Purpose:** Points to the separate chatbot service running Gemini AI

**Values:**
- **Local Development:** `http://localhost:3000/api/patient-chatbot/chat`
- **Production:** `https://patient-discharge-chatbot-647433528821.us-central1.run.app/api/patient-chatbot/chat`

**Default Fallback:** Uses production chatbot URL if not set

**Why Separate Service?**
- The chatbot runs on a dedicated Cloud Run service with higher memory/CPU
- Isolated from main backend for better performance
- Can be scaled independently

---

## Backend (NestJS)

### Required Environment Variables

Set these in Cloud Run service configuration or `.env` file:

#### Core Settings

```bash
NODE_ENV=dev                              # Environment: dev, staging, production
PORT=8080                                 # Port (Cloud Run injects this automatically)
```

#### FHIR/Google Healthcare API

```bash
GCP_PROJECT_ID=simtran-474018            # Google Cloud project ID
GCP_LOCATION=us-central1                 # Google Cloud region
DEFAULT_GOOGLE_DATASET=aivida-dev        # FHIR dataset name
DEFAULT_GOOGLE_FHIR_STORE=aivida         # FHIR store name
```

#### Authentication

```bash
JWT_SECRET=your-jwt-secret-change-in-production  # JWT signing secret (CHANGE IN PROD!)
```

#### Vertex AI (for Chatbot)

```bash
GCP_PROJECT=simtran-474018               # Google Cloud project for Vertex AI
LOCATION=us-central1                     # Region for Vertex AI API
```

**Note:** Vertex AI API (`aiplatform.googleapis.com`) must be enabled in your GCP project.

---

## Setting Environment Variables

### Option 1: Vercel (Frontend)

1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add the variables:
   ```
   NEXT_PUBLIC_CHATBOT_SERVICE_URL=https://patient-discharge-chatbot-647433528821.us-central1.run.app/api/patient-chatbot/chat
   ```
3. Redeploy to apply changes

### Option 2: Local Development (Frontend)

Create `.env.local` file in `/frontend` directory:

```bash
# .env.local
NEXT_PUBLIC_CHATBOT_SERVICE_URL=http://localhost:3000/api/patient-chatbot/chat
```

**Important:** Never commit `.env.local` to git (already in `.gitignore`)

### Option 3: Cloud Run (Backend)

**Via gcloud CLI:**

```bash
gcloud run services update patient-discharge-backend \
  --region us-central1 \
  --set-env-vars "NODE_ENV=dev,GCP_PROJECT_ID=simtran-474018,GCP_LOCATION=us-central1,JWT_SECRET=your-secret"
```

**Via Cloud Console:**

1. Go to Cloud Run → Select Service → Edit & Deploy New Revision
2. Variables & Secrets tab
3. Add environment variables
4. Deploy

---

## Architecture: Two Separate Services

### Service 1: Main Backend

**Service Name:** `patient-discharge-backend`

**URL:** `https://patient-discharge-backend-qnzythtpnq-uc.a.run.app`

**Purpose:**
- Patient data API
- FHIR resource management
- Authentication
- Discharge summaries

**Configuration:**
- Memory: 512Mi
- CPU: 1
- Timeout: 60s

---

### Service 2: Chatbot Service

**Service Name:** `patient-discharge-chatbot`

**URL:** `https://patient-discharge-chatbot-647433528821.us-central1.run.app`

**Purpose:**
- Gemini AI chatbot
- Patient Q&A
- Discharge instructions interpretation

**Configuration:**
- Memory: 2Gi (higher for AI processing)
- CPU: 2
- CPU Boost: Enabled
- Timeout: 300s

**Why Separate?**
- AI processing requires more resources
- Independent scaling
- Isolated failures
- Different timeout requirements

---

## Frontend Configuration Priority

The frontend uses this priority order for determining URLs:

### 1. Environment Variable (Highest Priority)
```typescript
process.env.NEXT_PUBLIC_CHATBOT_SERVICE_URL
```

### 2. Localhost Detection
```typescript
window.location.hostname === 'localhost' 
  ? 'http://localhost:3000/api/patient-chatbot/chat'
  : ...
```

### 3. Hardcoded Fallback (Lowest Priority)
```typescript
'https://patient-discharge-chatbot-647433528821.us-central1.run.app/api/patient-chatbot/chat'
```

This ensures the app works even if environment variables aren't set, while allowing easy configuration.

---

## Testing Configuration

### Test Backend Connection

```bash
curl https://patient-discharge-backend-qnzythtpnq-uc.a.run.app/health
```

**Expected:**
```json
{"status":"ok","timestamp":"2025-11-18...","uptime":123}
```

### Test Chatbot Service

```bash
curl https://patient-discharge-chatbot-647433528821.us-central1.run.app/health
```

**Expected:**
```json
{"status":"ok","timestamp":"2025-11-18...","uptime":456}
```

### Test Chatbot Endpoint (No Auth)

```bash
curl -X POST https://patient-discharge-chatbot-647433528821.us-central1.run.app/api/patient-chatbot/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"test"}'
```

**Expected:**
```json
{"message":"Missing Authorization header...","error":"Unauthorized","statusCode":401}
```

✅ `401` means the endpoint exists and auth is working  
❌ `404` means wrong URL or endpoint doesn't exist  
❌ `500` means server error (check logs)

---

## Troubleshooting

### Chatbot Returns 404

**Cause:** Frontend calling wrong URL

**Solution:**
1. Check console: `[Chatbot] Sending message to backend: ...`
2. Verify URL matches chatbot service URL
3. Set `NEXT_PUBLIC_CHATBOT_SERVICE_URL` in Vercel
4. Redeploy frontend

### Chatbot Returns 500

**Cause:** Backend error (likely Vertex AI issue)

**Solution:**
1. Check Cloud Run logs:
   ```bash
   gcloud run services logs read patient-discharge-chatbot --project simtran-474018 --region us-central1 --limit 50
   ```
2. Verify Vertex AI API is enabled
3. Check service account permissions
4. Verify `GCP_PROJECT` and `LOCATION` env vars are set

### Frontend Shows Wrong Data

**Cause:** Calling wrong backend service

**Solution:**
1. Verify `NEXT_PUBLIC_API_URL` points to correct backend
2. Check browser console for API URLs being called
3. Clear browser cache

---

## Security Notes

### Never Expose These

❌ Backend JWT_SECRET  
❌ Service account keys  
❌ Database credentials  
❌ API keys (unless prefixed with NEXT_PUBLIC_)

### Safe to Expose (Frontend)

✅ NEXT_PUBLIC_API_URL (public anyway)  
✅ NEXT_PUBLIC_CHATBOT_SERVICE_URL (public anyway)  
✅ Any variable prefixed with NEXT_PUBLIC_

---

**Last Updated:** November 18, 2025  
**Status:** Two separate Cloud Run services in production

