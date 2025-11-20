# Cerner Sandbox Integration Status for ctest Tenant

## Current Status

✅ **Migration Complete**: Legacy configs migrated to `ehrIntegration.cerner` structure  
✅ **Code Updated**: Backend now only uses `ehrIntegration.cerner` structure  
✅ **Deployment Complete**: Changes deployed to dev environment  
⚠️ **Configuration Missing**: ctest tenant needs Cerner sandbox credentials configured

## Test Results

```
Tenant: ctest
Status: Tenant exists in Firestore
EHR Integration Type: Cerner
Cerner Config: ❌ Missing
```

## What Needs to Be Configured

The `ctest` tenant needs to have Cerner sandbox credentials added via the System Admin UI. The following fields need to be configured in `ehrIntegration.cerner`:

### Required Configuration

1. **Base URL**: Cerner FHIR sandbox base URL
   - Example: `https://fhir-ehr-code.cerner.com/r4/{tenant-id}`

2. **System App** (for backend authentication):
   - `client_id`: Cerner system app client ID
   - `client_secret`: Cerner system app client secret
   - `token_url`: OAuth2 token endpoint URL
   - `scopes`: Required OAuth2 scopes (e.g., `system/Patient.read system/DocumentReference.read`)

3. **Provider App** (optional, for user SSO):
   - `client_id`: Cerner provider app client ID
   - `client_secret`: Cerner provider app client secret
   - `authorization_url`: OAuth2 authorization endpoint
   - `token_url`: OAuth2 token endpoint URL
   - `redirect_uri`: OAuth2 redirect URI
   - `scopes`: Required OAuth2 scopes

4. **Patients** (optional): List of test patient IDs for export

## Configuration Steps

1. Log into System Admin Portal
2. Navigate to Tenant Management
3. Select `ctest` tenant
4. Go to EHR Integration section
5. Select "Cerner" as EHR Integration Type
6. Enter Cerner sandbox credentials:
   - Base URL
   - System App credentials
   - Provider App credentials (if needed)
7. Save configuration

## Verification

After configuration, run the test script to verify:

```bash
cd backend
npx ts-node scripts/test-cerner-integration.ts
```

Or test via API:

```bash
# Get tenant config
curl -H "X-Tenant-ID: ctest" \
     https://patient-discharge-backend-dev-qnzythtpnq-uc.a.run.app/api/config

# Test Cerner authentication (requires auth token)
curl -H "X-Tenant-ID: ctest" \
     -H "Authorization: Bearer <token>" \
     https://patient-discharge-backend-dev-qnzythtpnq-uc.a.run.app/cerner/test/token-reuse
```

## Next Steps

1. ✅ Code migration complete
2. ✅ Deployment complete
3. ⏳ **Configure ctest tenant with Cerner sandbox credentials** (via System Admin UI)
4. ⏳ Run end-to-end integration tests
5. ⏳ Verify discharge summary export pipeline

## Notes

- The migration script successfully migrated 3 other tenants (default, demo, ec2458f2-1e24-41c8-b71b-0e701af7583d)
- The ctest tenant was skipped because it had no legacy config to migrate
- All configuration must now be done via System Admin UI using the `ehrIntegration.cerner` structure

