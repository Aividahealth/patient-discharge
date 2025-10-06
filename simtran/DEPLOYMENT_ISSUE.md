# Cloud Functions Deployment Issue

## Problem
Cloud functions fail to deploy due to monorepo structure where functions depend on `../common` modules that are not included in the deployment package.

## Error
```
error TS2307: Cannot find module '../common/utils/logger' or its corresponding type declarations.
error TS2307: Cannot find module '../common/types' or its corresponding type declarations.
```

## Root Cause
When deploying cloud functions with `gcloud functions deploy`, only the specified source directory is uploaded. The functions in `simtran/simplification/` and `simtran/translation/` depend on `simtran/common/`, but this directory is not included in the deployment package.

## Attempted Solutions
1. ❌ Deploy from subdirectory with `--source=.` - only uploads that directory
2. ❌ Deploy from parent with `--source=./simplification` - only uploads that subdirectory
3. ❌ Modify .gcloudignore - doesn't help with parent directory inclusion

## Recommended Solutions

### Option 1: Copy Common Files (Quick Fix)
Add a pre-deploy script that copies `../common` into each function directory:

```bash
# In deploy.sh
cp -r ../common ./common
npm run build
gcloud functions deploy ...
rm -rf ./common
```

### Option 2: Monorepo Package Manager (Better)
Use npm workspaces or pnpm to properly handle monorepo dependencies:

```json
// Root package.json
{
  "workspaces": [
    "common",
    "simplification",
    "translation"
  ]
}
```

### Option 3: Bundler (Best)
Use esbuild or webpack to bundle functions with dependencies:

```bash
# Bundle with esbuild
esbuild index.ts --bundle --platform=node --outfile=dist/index.js
# Deploy dist directory
```

## Current Workaround
The manual `/discharge-summaries/sync/all` API endpoint works for syncing GCS files to Firestore. This should be called after uploading new files until automatic sync is deployed.

## Next Steps
1. Choose a solution (recommend Option 3 - bundler)
2. Update deploy.sh scripts
3. Test deployment
4. Redeploy both cloud functions with Firestore integration
