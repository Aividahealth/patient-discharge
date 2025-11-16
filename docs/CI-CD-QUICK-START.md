# CI/CD Quick Start Guide

Quick reference for developers working with the Patient Discharge System CI/CD pipelines.

## Table of Contents
- [Prerequisites](#prerequisites)
- [Local Development](#local-development)
- [Creating a Pull Request](#creating-a-pull-request)
- [Deployment](#deployment)
- [Quick Commands](#quick-commands)

---

## Prerequisites

### Required Tools
```bash
# Node.js versions
node --version    # Should be 20.x for backend/functions, 22.x for frontend
npm --version

# Git
git --version

# Docker (optional, for local testing)
docker --version
```

### Repository Setup
```bash
# Clone repository
git clone https://github.com/your-org/patient-discharge.git
cd patient-discharge

# Install dependencies for all components
cd backend && npm install && cd ..
cd frontend && npm install && cd ..
cd simtran && npm install && cd ..
```

---

## Local Development

### Backend (NestJS)
```bash
cd backend

# Install dependencies
npm install

# Run linter
npm run lint

# Run tests
npm run test

# Run tests with coverage
npm run test:cov

# Run e2e tests
npm run test:e2e

# Build
npm run build

# Start development server
npm run start:dev
```

### Frontend (Next.js)
```bash
cd frontend

# Install dependencies
npm install

# Run linter
npm run lint

# Type check
npx tsc --noEmit

# Build
npm run build

# Start development server
npm run dev
```

### Cloud Functions
```bash
cd simtran

# Install all dependencies
npm install

# Build common library
cd common && npm run build && cd ..

# Build simplification function
cd simplification && npm run build && cd ..

# Build translation function
cd translation && npm run build && cd ..

# Run tests
npm test
```

---

## Creating a Pull Request

### Step 1: Create Feature Branch
```bash
# Always branch from develop
git checkout develop
git pull origin develop
git checkout -b feature/your-feature-name
```

### Step 2: Make Changes and Commit
```bash
# Make your changes...

# Run local checks before committing
cd backend && npm run lint && npm run test && cd ..
cd frontend && npm run lint && npm run build && cd ..

# Commit with conventional commit message
git add .
git commit -m "feat: add new feature"
# or
git commit -m "fix: resolve bug"
```

### Step 3: Push and Create PR
```bash
# Push to remote
git push origin feature/your-feature-name

# Create PR on GitHub
# Target: develop branch
# CI will run automatically
```

### Step 4: Monitor CI Status
1. Go to your PR on GitHub
2. Check "Checks" tab
3. Wait for all checks to pass:
   - ✅ Lint
   - ✅ Tests
   - ✅ Build
   - ✅ Security scan

### Step 5: Address CI Failures
If CI fails, check logs:
```bash
# Fix issues locally
npm run lint -- --fix  # Auto-fix linting issues
npm run test           # Verify tests pass

# Commit fixes
git add .
git commit -m "fix: address CI feedback"
git push origin feature/your-feature-name
```

---

## Deployment

### Automatic Deployments

#### To Development
```bash
# Merge PR to develop branch
# Deployment happens automatically:
# - Backend → Cloud Run (dev)
# - Frontend → Vercel (preview) or Cloud Run (dev)
# - Functions → Cloud Functions (*-dev)
```

#### To Production
```bash
# Create PR from develop to main
# After approval and merge:
# - Backend → Cloud Run (production)
# - Frontend → Vercel (production) or Cloud Run (production)
# - Functions → Cloud Functions (production)
```

### Manual Deployment (if needed)

#### Backend
```bash
cd backend
./deploy-to-cloud-run-dev.sh     # Deploy to dev
./deploy-to-cloud-run.sh         # Deploy to prod (requires approval)
```

#### Cloud Functions
```bash
cd simtran/simplification
./deploy.sh                      # Deploy simplification

cd ../translation
./deploy-translation.sh          # Deploy translation
```

---

## Quick Commands

### Check What Will Be Deployed
```bash
# See which files changed
git diff develop...HEAD

# See which components are affected
git diff develop...HEAD --name-only | grep -E '^(backend|frontend|simtran)/'
```

### Local Pre-Commit Checks
```bash
# Run all checks for backend
cd backend
npm run lint && npm run test && npm run build

# Run all checks for frontend
cd frontend
npm run lint && npx tsc --noEmit && npm run build

# Run all checks for functions
cd simtran
npm run build && npm test
```

### View Deployment Logs

#### Cloud Run (Backend/Frontend)
```bash
# Backend logs
gcloud run services logs read patient-discharge-backend --limit 50

# Frontend logs (if using Cloud Run)
gcloud run services logs read patient-discharge-frontend --limit 50
```

#### Cloud Functions
```bash
# Simplification function logs
gcloud functions logs read simplify-discharge --limit 50

# Translation function logs
gcloud functions logs read translate-discharge --limit 50
```

### Common Git Workflows

#### Update Your Branch
```bash
# Get latest from develop
git checkout develop
git pull origin develop

# Update your feature branch
git checkout feature/your-feature-name
git merge develop
# or
git rebase develop
```

#### Hotfix for Production
```bash
# Create hotfix from main
git checkout main
git pull origin main
git checkout -b hotfix/critical-fix

# Make fix and commit
git commit -m "fix: critical production issue"

# Push and create PR to main
git push origin hotfix/critical-fix

# After merge, also merge to develop
git checkout develop
git merge main
git push origin develop
```

---

## CI/CD Workflow Status

### Check Workflow Status
1. Go to repository on GitHub
2. Click "Actions" tab
3. View workflow runs

### Re-run Failed Workflow
1. Go to failed workflow run
2. Click "Re-run all jobs"
3. Or "Re-run failed jobs"

### Cancel Running Workflow
1. Go to running workflow
2. Click "Cancel workflow"

---

## Environment URLs

### Development
- **Backend**: `https://patient-discharge-backend-dev-PROJECT_ID.run.app`
- **Frontend**: `https://dev.patient-discharge.example.com` (Vercel)
- **Functions**:
  - Simplification: `https://us-central1-PROJECT_ID.cloudfunctions.net/simplify-discharge-dev`
  - Translation: `https://us-central1-PROJECT_ID.cloudfunctions.net/translate-discharge-dev`

### Production
- **Backend**: `https://patient-discharge-backend-PROJECT_ID.run.app`
- **Frontend**: `https://patient-discharge.example.com` (Vercel)
- **Functions**:
  - Simplification: `https://us-central1-PROJECT_ID.cloudfunctions.net/simplify-discharge`
  - Translation: `https://us-central1-PROJECT_ID.cloudfunctions.net/translate-discharge`

---

## Troubleshooting Quick Fixes

### "Lint errors"
```bash
npm run lint -- --fix
git add .
git commit -m "style: fix linting issues"
```

### "Tests failing"
```bash
# Run specific test
npm test -- path/to/test.spec.ts

# Update snapshots if needed
npm test -- -u

# Debug test
npm test -- --detectOpenHandles
```

### "Build failing"
```bash
# Clean install
rm -rf node_modules package-lock.json
npm install

# Clear cache
npm cache clean --force
```

### "Merge conflicts"
```bash
# Update your branch
git fetch origin
git merge origin/develop

# Resolve conflicts in your editor
# Then:
git add .
git commit -m "chore: resolve merge conflicts"
```

---

## Best Practices Checklist

Before creating a PR:
- [ ] Code follows project style guidelines
- [ ] All tests pass locally
- [ ] No linting errors
- [ ] Commit messages follow conventional commits
- [ ] PR description is clear and detailed
- [ ] Related issue is linked (if applicable)
- [ ] Documentation updated (if needed)

Before merging to develop:
- [ ] All CI checks pass
- [ ] Code review approved
- [ ] No merge conflicts
- [ ] Feature tested locally

Before merging to main:
- [ ] Tested thoroughly in development environment
- [ ] Performance impact assessed
- [ ] Breaking changes documented
- [ ] Database migrations prepared (if needed)
- [ ] Rollback plan in place

---

## Getting Help

1. **CI/CD Issues**: Check [CI-CD-SETUP.md](./CI-CD-SETUP.md)
2. **GitHub Actions**: View workflow logs in Actions tab
3. **GCP Issues**: Check Cloud Console logs
4. **Team Slack**: #devops-help channel
5. **Documentation**: See `docs/` directory

---

## Useful Links

- [Full CI/CD Documentation](./CI-CD-SETUP.md)
- [GitHub Actions Dashboard](https://github.com/YOUR_ORG/patient-discharge/actions)
- [Google Cloud Console](https://console.cloud.google.com)
- [Vercel Dashboard](https://vercel.com/dashboard)
- [Codecov Dashboard](https://codecov.io/gh/YOUR_ORG/patient-discharge)

---

**Last Updated**: 2025-11-16
