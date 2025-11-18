# CI/CD Pipeline Documentation

This document describes the Continuous Integration and Continuous Deployment (CI/CD) pipelines for the Patient Discharge System.

> **Note**: This CI/CD pipeline is configured for a **simplified main-branch workflow**. All deployments go directly to production from the `main` branch. Feature branches should create PRs to `main` for review and testing before merge.

## Overview

The Patient Discharge System uses GitHub Actions for automated testing, building, and deployment of three main components:

1. **Backend** - NestJS REST API
2. **Frontend** - Next.js React Application
3. **Cloud Functions** - Simplification and Translation services

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     GitHub Repository                        │
│  ┌──────────┐  ┌──────────┐  ┌─────────────────────────┐   │
│  │ backend/ │  │frontend/ │  │    simtran/             │   │
│  └──────────┘  └──────────┘  └─────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                    GitHub Actions                            │
│  ┌──────────┐  ┌──────────┐  ┌─────────────────────────┐   │
│  │ Backend  │  │Frontend  │  │   Cloud Functions       │   │
│  │  CI/CD   │  │  CI/CD   │  │      CI/CD              │   │
│  └──────────┘  └──────────┘  └─────────────────────────┘   │
│                    Pull Request CI                           │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                   Deployment Targets                         │
│  ┌──────────┐  ┌──────────┐  ┌─────────────────────────┐   │
│  │ Cloud    │  │  Vercel  │  │   Cloud Functions       │   │
│  │   Run    │  │    or    │  │   (Gen2)                │   │
│  │          │  │Cloud Run │  │                         │   │
│  └──────────┘  └──────────┘  └─────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Workflows

### 1. Pull Request CI (`ci.yml`)

**Triggers:**
- Pull requests to `main` branch

**Jobs:**
- **Detect Changes**: Uses path filtering to determine which components changed
- **Backend CI**: Lint, type check, unit tests, e2e tests
- **Frontend CI**: Lint, type check, build validation
- **Functions CI**: Lint, build, test all cloud functions
- **Security Scan**: Trivy vulnerability scanning + npm audit

**Path Filters:**
- Backend: `backend/**`
- Frontend: `frontend/**`
- Functions: `simtran/**`

**Features:**
- Only runs CI for changed components (optimized for monorepo)
- Security scanning with Trivy
- Dependency vulnerability checking with npm audit
- Code coverage reporting to Codecov

---

### 2. Backend CI/CD (`backend-ci-cd.yml`)

**Triggers:**
- Push to `main` branch (when `backend/**` changes)
- Pull requests affecting `backend/**`

**Jobs:**

#### Lint
- Runs ESLint on backend code
- Ensures code quality and style consistency

#### Test
- Runs Jest unit tests with coverage
- Uploads coverage reports to Codecov
- Environment: Node.js 20.x

#### Build
- Builds multi-stage Docker image
- Pushes to Google Container Registry (GCR)
- Tags: `<commit-sha>` and `latest`
- Base image: `node:20-alpine`
- Image size: ~8MB (optimized)

#### Deploy to Production
- **Trigger**: Push to `main` branch
- **Target**: Cloud Run service `patient-discharge-backend`
- **Configuration**:
  - Memory: 1Gi
  - CPU: 2
  - Max instances: 100
  - Min instances: 1 (always warm)
  - Timeout: 300s
  - Environment: `NODE_ENV=production`

**Required Secrets:**
- `GCP_SA_KEY`: Google Cloud Service Account JSON key
- `GCP_PROJECT_ID`: Google Cloud Project ID

---

### 3. Frontend CI/CD (`frontend-ci-cd.yml`)

**Triggers:**
- Push to `main` or `develop` branches (when `frontend/**` changes)
- Pull requests affecting `frontend/**`

**Jobs:**

#### Lint
- Runs ESLint on frontend code
- Environment: Node.js 22.x

#### Build
- Builds Next.js application
- Uploads build artifacts
- Environment variables from `.env.local`
- Validates SSR and static generation

**Deployment Options:**

The workflow supports two deployment strategies (configured via `USE_CLOUD_RUN` variable):

##### Option 1: Vercel (Recommended)
- **Deploy to Development**:
  - Trigger: Push to `develop`
  - Custom domain: `dev.patient-discharge.example.com`
  - Preview URL generated automatically

- **Deploy to Production**:
  - Trigger: Push to `main`
  - Uses `--prod` flag for production deployment
  - Production domain configured in Vercel

**Required Secrets (Vercel):**
- `VERCEL_TOKEN`: Vercel authentication token
- `VERCEL_ORG_ID`: Vercel organization ID
- `VERCEL_PROJECT_ID`: Vercel project ID
- `NEXT_PUBLIC_API_URL`: Backend API URL (dev/prod)

##### Option 2: Cloud Run
- Builds Docker image with Next.js standalone output
- Deploys to Cloud Run with SSR support
- Similar configuration to backend deployment

**Required Secrets (Cloud Run):**
- `GCP_SA_KEY`: Google Cloud Service Account JSON key
- `GCP_PROJECT_ID`: Google Cloud Project ID
- `DEV_API_URL`: Development backend URL
- `PROD_API_URL`: Production backend URL

**Required Variables:**
- `USE_CLOUD_RUN`: Set to `'true'` to use Cloud Run instead of Vercel

---

### 4. Cloud Functions CI/CD (`cloud-functions-ci-cd.yml`)

**Triggers:**
- Push to `main` or `develop` branches (when `simtran/**` changes)
- Pull requests affecting `simtran/**`

**Jobs:**

#### Lint & Test
- Installs dependencies for all packages (common, simplification, translation)
- Runs lint and build for each function
- Executes test suite
- Environment: Node.js 20.x

#### Deploy Simplification Function

**Development:**
- Function name: `simplify-discharge-dev`
- Runtime: Node.js 20
- Memory: 512MB
- Timeout: 540s (9 minutes)
- Max instances: 10
- Trigger: HTTP
- Entry point: `simplifyDischarge`

**Production:**
- Function name: `simplify-discharge`
- Runtime: Node.js 20
- Memory: 1GB
- Timeout: 540s
- Max instances: 100
- Min instances: 1
- Trigger: HTTP
- Entry point: `simplifyDischarge`

#### Deploy Translation Function

**Development:**
- Function name: `translate-discharge-dev`
- Runtime: Node.js 20
- Memory: 512MB
- Timeout: 300s (5 minutes)
- Max instances: 10
- Trigger: HTTP
- Entry point: `translateDischarge`

**Production:**
- Function name: `translate-discharge`
- Runtime: Node.js 20
- Memory: 1GB
- Timeout: 300s
- Max instances: 100
- Min instances: 1
- Trigger: HTTP
- Entry point: `translateDischarge`

**Required Secrets:**
- `GCP_SA_KEY`: Google Cloud Service Account JSON key
- `GCP_PROJECT_ID`: Google Cloud Project ID

---

## Setup Instructions

### 1. GitHub Secrets Configuration

Navigate to **Settings → Secrets and variables → Actions** in your GitHub repository and add:

#### Required for All Workflows
```
GCP_PROJECT_ID          = your-gcp-project-id
GCP_SA_KEY              = {
                            "type": "service_account",
                            "project_id": "your-project",
                            ...
                          }
```

#### Required for Frontend (Vercel Deployment)
```
VERCEL_TOKEN            = your-vercel-token
VERCEL_ORG_ID           = your-org-id
VERCEL_PROJECT_ID       = your-project-id
NEXT_PUBLIC_API_URL     = https://api.example.com
DEV_API_URL             = https://api-dev.example.com
PROD_API_URL            = https://api.example.com
```

#### Optional (for Codecov)
```
CODECOV_TOKEN           = your-codecov-token
```

### 2. GitHub Variables Configuration

Navigate to **Settings → Secrets and variables → Actions → Variables** tab:

```
USE_CLOUD_RUN           = true  (if using Cloud Run for frontend)
```

### 3. Google Cloud Setup

#### Create Service Account
```bash
# Create service account
gcloud iam service-accounts create github-actions \
    --display-name="GitHub Actions CI/CD"

# Grant necessary permissions
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
    --member="serviceAccount:github-actions@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/run.admin"

gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
    --member="serviceAccount:github-actions@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/cloudfunctions.admin"

gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
    --member="serviceAccount:github-actions@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/storage.admin"

gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
    --member="serviceAccount:github-actions@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/iam.serviceAccountUser"

# Create and download key
gcloud iam service-accounts keys create key.json \
    --iam-account=github-actions@YOUR_PROJECT_ID.iam.gserviceaccount.com
```

Copy the contents of `key.json` to the `GCP_SA_KEY` secret.

#### Enable Required APIs
```bash
gcloud services enable run.googleapis.com
gcloud services enable cloudfunctions.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable containerregistry.googleapis.com
```

### 4. Vercel Setup (if using Vercel for frontend)

1. Install Vercel CLI: `npm i -g vercel`
2. Link project: `cd frontend && vercel link`
3. Get tokens:
   ```bash
   vercel whoami  # Get ORG_ID
   # Get VERCEL_TOKEN from https://vercel.com/account/tokens
   # Get PROJECT_ID from .vercel/project.json after linking
   ```

---

## Deployment Environment

### Production Environment
- **Branch**: `main`
- **Backend**: `patient-discharge-backend` (Cloud Run)
- **Frontend**: Vercel production or `patient-discharge-frontend` (Cloud Run)
- **Functions**: Production functions
- **Scaling**: Higher limits, min 1 instance (always warm)
- **Purpose**: Live production traffic

> **Note**: This is a simplified single-environment setup. All merges to `main` automatically deploy to production after passing CI checks.

---

## Deployment Flow

### Feature Development Flow
```
1. Create feature branch from main
   git checkout -b feature/my-feature main

2. Make changes and commit
   git commit -m "feat: add new feature"

3. Push and create PR to main
   git push origin feature/my-feature

4. CI runs automatically:
   ✓ Lint
   ✓ Test
   ✓ Build
   ✓ Security scan

5. After PR approval and merge to main:
   ✓ Automatic deployment to production
   ✓ Monitor deployment and application health
```

### Hotfix Flow
```
1. Create hotfix branch from main
   git checkout -b hotfix/critical-fix main

2. Make changes and commit
   git commit -m "fix: critical bug"

3. Create PR to main
   git push origin hotfix/critical-fix

4. After CI passes and approval:
   ✓ Merge to main → deploys to production immediately
   ✓ Monitor deployment closely
```

---

## Monitoring and Rollback

### View Deployment Status
- GitHub Actions tab in repository
- Cloud Run console: https://console.cloud.google.com/run
- Cloud Functions console: https://console.cloud.google.com/functions
- Vercel dashboard: https://vercel.com/dashboard

### Rollback Procedures

#### Backend/Cloud Functions (Cloud Run/Functions)
```bash
# List revisions
gcloud run revisions list --service=patient-discharge-backend

# Rollback to previous revision
gcloud run services update-traffic patient-discharge-backend \
    --to-revisions=PREVIOUS_REVISION=100
```

#### Frontend (Vercel)
```bash
# List deployments
vercel ls

# Promote previous deployment
vercel promote DEPLOYMENT_URL --scope=YOUR_TEAM
```

#### Frontend (Cloud Run)
Same as backend rollback procedure.

---

## Best Practices

### 1. Branch Protection
Enable in **Settings → Branches → Branch protection rules**:
- Require pull request reviews
- Require status checks to pass (CI workflow)
- Require branches to be up to date
- Require conversation resolution

### 2. Semantic Versioning
Use conventional commits:
- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `refactor:` - Code refactoring
- `test:` - Test additions/changes
- `chore:` - Build process/tool changes

### 3. Environment Variables
- Never commit secrets to repository
- Use GitHub Secrets for sensitive data
- Use `.env.example` files as templates
- Document all required environment variables

### 4. Testing
- Write tests for new features
- Maintain >80% code coverage
- Run tests locally before pushing
- Fix failing tests immediately

### 5. Deployment
- Always deploy to development first
- Test thoroughly in development
- Use gradual rollouts for critical changes
- Monitor logs after deployment

---

## Troubleshooting

### Common Issues

#### 1. "Docker push permission denied"
**Cause**: GCP service account lacks permissions
**Solution**: Grant `storage.admin` role to service account

#### 2. "Cloud Run deployment timeout"
**Cause**: Image too large or slow startup
**Solution**:
- Check Docker image size
- Review application startup time
- Increase timeout in workflow

#### 3. "npm ci failed"
**Cause**: Lock file out of sync
**Solution**:
```bash
npm install
git add package-lock.json
git commit -m "chore: update lock file"
```

#### 4. "Vercel deployment failed"
**Cause**: Invalid tokens or project not linked
**Solution**:
- Verify `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`
- Re-link project: `vercel link`

#### 5. "Tests failing in CI but passing locally"
**Cause**: Environment differences
**Solution**:
- Check Node.js version matches
- Review environment variables
- Check for timezone/locale differences

---

## Cost Optimization

### Cloud Run
- Use min-instances=0 for development (scale to zero)
- Use min-instances=1 for production (avoid cold starts)
- Set appropriate memory limits (512Mi for dev, 1Gi for prod)
- Enable CPU throttling when idle

### Cloud Functions
- Use appropriate timeout values
- Set max-instances to prevent runaway costs
- Use Gen2 for better performance and pricing
- Monitor invocation counts

### CI/CD
- Use path filtering to run only necessary workflows
- Cache dependencies (npm cache in workflows)
- Use matrix builds only when necessary
- Archive old workflow runs

---

## Security Considerations

1. **Service Account Permissions**: Use least privilege principle
2. **Secret Rotation**: Rotate GCP keys and tokens regularly
3. **Dependency Scanning**: Enabled via Trivy and npm audit
4. **HTTPS Only**: All deployments use HTTPS
5. **Authentication**: Cloud Run services can require auth if needed
6. **Audit Logs**: Enable GCP audit logging
7. **Network Policies**: Configure VPC and firewall rules in GCP

---

## Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Google Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Google Cloud Functions Documentation](https://cloud.google.com/functions/docs)
- [Vercel Documentation](https://vercel.com/docs)
- [NestJS Documentation](https://docs.nestjs.com)
- [Next.js Deployment](https://nextjs.org/docs/deployment)

---

## Support

For issues with CI/CD pipelines:
1. Check GitHub Actions logs
2. Review GCP logs (Cloud Logging)
3. Verify secrets and variables configuration
4. Check service account permissions
5. Consult team documentation

---

**Last Updated**: 2025-11-16
**Maintained By**: DevOps Team
