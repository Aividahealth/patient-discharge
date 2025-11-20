# Portal Integration Testing Guide

This guide explains how to use the comprehensive portal integration test suite.

## Overview

The portal integration test suite provides end-to-end testing for all portals in the patient discharge system:

- **Clinician Portal**: Upload and manage discharge summaries
- **Expert Portal**: Review and approve discharge summaries
- **Patient Portal**: View simplified discharge summaries
- **Admin Portal**: Manage users and view tenant metrics

## Features

- ✅ Tests all four portals comprehensively
- ✅ Uses the demo tenant for testing
- ✅ Automatically creates test users for all roles
- ✅ Uploads sample discharge summaries (.md and .pdf formats)
- ✅ Tags all test data for easy identification and cleanup
- ✅ Provides automated cleanup script
- ✅ Safe to run repeatedly without data pollution

## Quick Start

### 1. Run the Tests

```bash
# From the backend directory
npm run test:portals
```

This will:
1. Create test users (patient, clinician, expert, admin)
2. Upload discharge summaries from `test-data/discharge-summaries/`
3. Run comprehensive tests for all portals
4. Automatically clean up all test data

### 2. Manual Cleanup

If you need to manually clean up test data:

```bash
npm run cleanup-test-data
```

This is safe to run at any time and will only delete data tagged with `portal-integration-test`.

## Test Options

### Verbose Output

```bash
npm run test:portals -- --verbose
```

Shows detailed test output including all console logs.

### Code Coverage

```bash
npm run test:portals -- --coverage
```

Generates a code coverage report.

### Skip Cleanup

```bash
npm run test:portals -- --no-cleanup
```

Keeps test data after tests complete (useful for debugging).

### Watch Mode

```bash
npm run test:portals -- --watch
```

Re-runs tests automatically when files change.

## Test Data

### Sample Discharge Summaries

Test discharge summaries are located in:
```
backend/test-data/discharge-summaries/
```

The directory includes:
- `patient-001-discharge.md` - Cardiac patient (MI with stent)
- `patient-002-discharge.md` - OB/GYN patient (normal delivery)
- `patient-003-discharge.md` - Orthopedic patient (hip fracture)
- `patient-004-discharge.md` - Pediatric patient (pneumonia)

All patient data is **fictional** and created specifically for testing.

### Adding More Test Data

To add more test data:

1. Create a new `.md` or `.pdf` file in `test-data/discharge-summaries/`
2. Include patient information in the standard format
3. The test suite will automatically pick it up

## Test Architecture

### Test Utilities

#### TestUserManager (`test/utils/test-user-manager.ts`)

Manages test user creation and cleanup:

```typescript
const userManager = new TestUserManager(firestore, 'portal-integration-test');

// Create standard set of portal users
const users = await userManager.createPortalTestUsers('demo');

// Or create individual users
const clinician = await userManager.createUser({
  tenantId: 'demo',
  username: 'test-clinician',
  name: 'Dr. Test',
  role: 'clinician',
});

// Cleanup
await userManager.cleanupAllTestUsers();
```

#### TestDischargeManager (`test/utils/test-discharge-manager.ts`)

Manages discharge summary creation and cleanup:

```typescript
const dischargeManager = new TestDischargeManager(
  firestore,
  storage,
  bucketName,
  'portal-integration-test'
);

// Create discharge summaries from directory
const summaries = await dischargeManager.createDischargeSummariesFromDirectory(
  'demo',
  './test-data/discharge-summaries'
);

// Or create individual summary
const summary = await dischargeManager.createDischargeSummary({
  tenantId: 'demo',
  patientId: 'patient-001',
  filePath: './test-data/discharge-summaries/patient-001-discharge.md',
});

// Cleanup
await dischargeManager.cleanupAllTestSummaries();
```

### Test Organization

The test suite is organized into the following sections:

1. **Authentication Tests**: Verify all user types can authenticate
2. **Clinician Portal Tests**: Test discharge summary management
3. **Expert Portal Tests**: Test review and approval workflow
4. **Patient Portal Tests**: Test patient access and data isolation
5. **Admin Portal Tests**: Test user management and metrics
6. **Cross-Portal Workflow Tests**: Test complete workflows
7. **Data Isolation Tests**: Verify tenant isolation and test tagging

## Test Data Tagging

All test data is automatically tagged with `portal-integration-test`:

```typescript
{
  // ... other fields
  testTag: 'portal-integration-test',
  testCreatedAt: '2025-01-20T10:30:00Z',
  createdBy: 'test-automation'
}
```

This allows for:
- Easy identification of test data
- Safe cleanup without affecting production data
- Querying test data across multiple test runs

## Troubleshooting

### Tests Fail to Connect to Firestore

**Solution**: Ensure your service account credentials are configured:

```bash
# Set environment variable
export SERVICE_ACCOUNT_PATH=/path/to/service-account.json

# Or create config file
mkdir -p .settings.dev
# Add firestore_service_account_path to .settings.dev/config.yaml
```

### Tests Fail to Upload to GCS

**Solution**: Verify GCS bucket configuration and permissions:

```bash
# Set bucket name
export GCS_BUCKET_NAME=your-bucket-name

# Or add to .settings.dev/config.yaml
```

### Test Data Not Cleaned Up

**Solution**: Manually run the cleanup script:

```bash
npm run cleanup-test-data
```

### Test Users Already Exist

**Solution**: The test suite automatically cleans up existing test data at the start. If this fails, manually run cleanup:

```bash
npm run cleanup-test-data
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Portal Integration Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2

      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'

      - name: Install dependencies
        run: cd backend && npm install

      - name: Setup service account
        run: echo "${{ secrets.GCP_SERVICE_ACCOUNT }}" > service-account.json

      - name: Run portal tests
        env:
          SERVICE_ACCOUNT_PATH: ./service-account.json
          GCS_BUCKET_NAME: ${{ secrets.GCS_BUCKET_NAME }}
          NODE_ENV: dev
          CI: true
        run: cd backend && npm run test:portals

      - name: Upload coverage
        uses: codecov/codecov-action@v2
        if: always()
```

## Best Practices

### 1. Run Tests Frequently

Run the test suite regularly to catch issues early:

```bash
# Before committing changes
npm run test:portals

# During development with watch mode
npm run test:portals -- --watch
```

### 2. Keep Test Data Fresh

Update test discharge summaries to reflect real-world scenarios and edge cases.

### 3. Review Test Output

Pay attention to test output, especially metrics and workflow tests:

```bash
npm run test:portals -- --verbose
```

### 4. Clean Up Manually When Needed

If you interrupt tests or encounter errors, run cleanup manually:

```bash
npm run cleanup-test-data
```

### 5. Test in Different Environments

Test in different environments to ensure consistency:

```bash
# Dev environment
NODE_ENV=dev npm run test:portals

# Staging environment
NODE_ENV=staging npm run test:portals
```

## Advanced Usage

### Custom Test Tags

You can create custom test managers with different tags:

```typescript
const userManager = new TestUserManager(firestore, 'my-custom-test-tag');
const dischargeManager = new TestDischargeManager(
  firestore,
  storage,
  bucketName,
  'my-custom-test-tag'
);
```

### Selective Testing

Run specific test suites using Jest patterns:

```bash
# Run only authentication tests
npm run test:portals -- --testNamePattern="Authentication Tests"

# Run only clinician portal tests
npm run test:portals -- --testNamePattern="Clinician Portal"
```

### Debug Mode

Debug tests with Node.js inspector:

```bash
node --inspect-brk -r ts-node/register -r tsconfig-paths/register \
  node_modules/.bin/jest test/portals-integration.spec.ts --runInBand
```

Then attach your debugger to the Node.js process.

## Support

For issues or questions:

1. Check this guide and the troubleshooting section
2. Review test output for specific error messages
3. Check Firestore and GCS for test data (tagged with `portal-integration-test`)
4. Run cleanup script to reset: `npm run cleanup-test-data`
5. Consult the codebase documentation in the main README

## Related Documentation

- [Main README](../README.md)
- [Architecture Documentation](../../ARCHITECTURE_DEEP_DIVE.md)
- [Authentication System](../../AUTH_SYSTEM_DESIGN.md)
- [Tenant Configuration](../../TENANT_CONFIG_USAGE.md)
