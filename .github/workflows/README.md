# GitHub Actions Workflows

This directory contains the CI/CD workflows for the Patient Discharge System.

## Workflows Overview

### `ci.yml` - Pull Request CI
**Purpose**: Validates all pull requests before merging

**Triggers**:
- Pull requests to `main` or `develop`

**Features**:
- Smart path filtering (only tests changed components)
- Parallel execution for faster CI
- Security scanning with Trivy
- Dependency vulnerability checks
- Code coverage reporting

**Components Tested**:
- Backend: Lint, test, build
- Frontend: Lint, type check, build
- Cloud Functions: Lint, build, test

---

### `backend-ci-cd.yml` - Backend Pipeline
**Purpose**: Build, test, and deploy NestJS backend API

**Triggers**:
- Push to `main` or `develop` (when `backend/**` changes)
- Pull requests affecting `backend/**`

**Deployment Targets**:
- Development: `patient-discharge-backend-dev` (Cloud Run)
- Production: `patient-discharge-backend` (Cloud Run)

**Pipeline Stages**:
1. **Lint** → ESLint validation
2. **Test** → Jest unit tests + coverage
3. **Build** → Docker image build + push to GCR
4. **Deploy** → Cloud Run deployment

---

### `frontend-ci-cd.yml` - Frontend Pipeline
**Purpose**: Build and deploy Next.js frontend application

**Triggers**:
- Push to `main` or `develop` (when `frontend/**` changes)
- Pull requests affecting `frontend/**`

**Deployment Options**:
1. **Vercel** (Recommended)
   - Automatic previews for PRs
   - Production deploys to main
   - Custom domains supported

2. **Cloud Run** (Alternative)
   - Containerized Next.js with standalone output
   - SSR support
   - Similar config to backend

**Pipeline Stages**:
1. **Lint** → ESLint validation
2. **Build** → Next.js build + artifacts
3. **Deploy** → Vercel or Cloud Run

**Configuration**:
Set `USE_CLOUD_RUN` variable to `'true'` to use Cloud Run instead of Vercel.

---

### `cloud-functions-ci-cd.yml` - Cloud Functions Pipeline
**Purpose**: Deploy simplification and translation services

**Triggers**:
- Push to `main` or `develop` (when `simtran/**` changes)
- Pull requests affecting `simtran/**`

**Functions Deployed**:
1. **Simplification Function**
   - Uses Google Vertex AI
   - Simplifies medical discharge summaries
   - Timeout: 540s (9 minutes)

2. **Translation Function**
   - Uses Google Translate API
   - Translates discharge summaries
   - Timeout: 300s (5 minutes)

**Pipeline Stages**:
1. **Lint & Test** → All functions validated
2. **Deploy** → Separate deployments for each function

---

## Required Secrets

Add these in **Settings → Secrets and variables → Actions**:

### Google Cloud Platform
```
GCP_PROJECT_ID          Your GCP project ID
GCP_SA_KEY              Service account JSON key (full JSON object)
```

### Vercel (if using for frontend)
```
VERCEL_TOKEN            Vercel authentication token
VERCEL_ORG_ID           Your Vercel organization ID
VERCEL_PROJECT_ID       Frontend project ID
NEXT_PUBLIC_API_URL     Backend API URL
DEV_API_URL             Development API URL
PROD_API_URL            Production API URL
```

### Optional
```
CODECOV_TOKEN           Codecov upload token
```

---

## Required Variables

Add these in **Settings → Secrets and variables → Actions → Variables**:

```
USE_CLOUD_RUN           Set to 'true' to deploy frontend to Cloud Run
```

---

## Workflow Execution

### On Pull Request
```
1. Developer creates PR
2. `ci.yml` runs automatically
3. Path filtering determines which jobs to run
4. Parallel execution of:
   - Backend CI (if backend changed)
   - Frontend CI (if frontend changed)
   - Functions CI (if simtran changed)
   - Security scan (always runs)
5. All checks must pass before merge
```

### On Merge to `develop`
```
1. PR merged to develop
2. Component-specific workflows trigger:
   - backend-ci-cd.yml → Deploy to Cloud Run (dev)
   - frontend-ci-cd.yml → Deploy to Vercel (preview) or Cloud Run (dev)
   - cloud-functions-ci-cd.yml → Deploy functions (*-dev)
3. Development environment updated
```

### On Merge to `main`
```
1. PR merged to main
2. Component-specific workflows trigger:
   - backend-ci-cd.yml → Deploy to Cloud Run (production)
   - frontend-ci-cd.yml → Deploy to Vercel (production) or Cloud Run (production)
   - cloud-functions-ci-cd.yml → Deploy functions (production)
3. Production environment updated
```

---

## Path Filtering

The CI workflow uses path filtering to optimize execution:

| Component | Path Pattern | Workflow |
|-----------|-------------|----------|
| Backend | `backend/**` | `backend-ci-cd.yml` |
| Frontend | `frontend/**` | `frontend-ci-cd.yml` |
| Functions | `simtran/**` | `cloud-functions-ci-cd.yml` |

**Benefits**:
- Faster CI (only tests what changed)
- Lower costs (fewer workflow minutes)
- Clearer feedback (relevant checks only)

---

## Environments

### Development
- Branch: `develop`
- Auto-deploy: Yes
- Scaling: Auto-scale to zero
- Purpose: Feature testing

### Production
- Branch: `main`
- Auto-deploy: Yes
- Scaling: Always warm (min 1 instance)
- Purpose: Live traffic

---

## Monitoring

### View Workflow Status
1. Go to repository **Actions** tab
2. Select workflow
3. View recent runs

### Check Deployment Status
- **Cloud Run**: [GCP Console](https://console.cloud.google.com/run)
- **Cloud Functions**: [GCP Console](https://console.cloud.google.com/functions)
- **Vercel**: [Vercel Dashboard](https://vercel.com/dashboard)

### View Logs
```bash
# Backend logs
gcloud run services logs read patient-discharge-backend

# Function logs
gcloud functions logs read simplify-discharge

# Frontend logs (Cloud Run)
gcloud run services logs read patient-discharge-frontend
```

---

## Troubleshooting

### Workflow Not Triggering
- Check path patterns match your changes
- Verify branch protection rules
- Check workflow permissions

### Build Failing
- Review workflow logs in Actions tab
- Check if secrets are configured
- Verify service account permissions

### Deployment Failing
- Ensure GCP APIs are enabled
- Check service account has required roles
- Verify project ID is correct

---

## Customization

### Modify Resource Limits
Edit the workflow files:

**Backend** (`backend-ci-cd.yml`):
```yaml
--memory 1Gi          # Change memory allocation
--cpu 2               # Change CPU allocation
--max-instances 100   # Change max scaling
```

**Frontend** (`frontend-ci-cd.yml`):
```yaml
--memory 512Mi        # For Cloud Run deployment
```

**Functions** (`cloud-functions-ci-cd.yml`):
```yaml
--memory 1GB          # Function memory
--timeout 540s        # Function timeout
```

### Add Environment Variables
```yaml
--set-env-vars "KEY1=value1,KEY2=value2"
```

### Change Regions
```yaml
env:
  REGION: us-central1  # Change to your preferred region
```

---

## Best Practices

1. **Branch Protection**
   - Require status checks before merge
   - Require PR reviews
   - No direct pushes to main/develop

2. **Secrets Management**
   - Never commit secrets
   - Rotate keys regularly
   - Use GitHub Secrets for all sensitive data

3. **Testing**
   - Write tests for new features
   - Maintain code coverage
   - Fix broken tests immediately

4. **Deployment**
   - Deploy to dev first
   - Test thoroughly before production
   - Monitor after deployment

5. **Workflow Maintenance**
   - Update action versions regularly
   - Review and optimize workflows
   - Document any customizations

---

## Related Documentation

- [Full CI/CD Setup Guide](../../docs/CI-CD-SETUP.md)
- [Quick Start Guide](../../docs/CI-CD-QUICK-START.md)
- [Backend Documentation](../../backend/README.md)
- [Frontend Documentation](../../frontend/README.md)

---

For questions or issues, consult the [CI/CD Setup Documentation](../../docs/CI-CD-SETUP.md) or contact the DevOps team.
