# Portal Integration Test Suite

Comprehensive end-to-end testing for all portals in the patient discharge system.

## Quick Start

```bash
# From the test directory
cd test
npm install  # First time only
npm test

# Or from the backend directory
cd backend
npm run test:portals

# Clean up test data
npm run cleanup
```

## What This Tests

This test suite provides comprehensive testing for:

### ✅ Clinician Portal
- Upload discharge summaries (.md and .pdf)
- View discharge summary list
- Request simplification
- Manage patient discharge documents

### ✅ Expert Portal
- Review discharge summaries
- Add quality metrics
- Approve/reject summaries
- Expert workflow validation

### ✅ Patient Portal
- View discharge summaries
- Access simplified versions
- Data isolation and security
- Patient-specific content filtering

### ✅ Admin Portal
- User management
- Tenant metrics and analytics
- Configuration management
- Administrative operations

### ✅ Cross-Portal Workflows
- Complete discharge summary lifecycle
- Multi-role collaboration
- Status transitions
- Data consistency

## Test Data

### Sample Discharge Summaries

Located in: `test/test-data/discharge-summaries/`

- **patient-001-discharge.md** - Cardiac patient (acute MI, stent placement)
- **patient-002-discharge.md** - OB/GYN patient (normal vaginal delivery)
- **patient-003-discharge.md** - Orthopedic patient (hip fracture, joint replacement)
- **patient-004-discharge.md** - Pediatric patient (pneumonia)

All patient information is **fictional** and created for testing purposes.

### Test Users

The test suite automatically creates users for all roles:

| Role | Username Pattern | Purpose |
|------|-----------------|---------|
| Patient | `test-patient-{timestamp}` | Test patient portal access |
| Clinician | `test-clinician-{timestamp}` | Test discharge summary management |
| Expert | `test-expert-{timestamp}` | Test review and approval workflow |
| Admin | `test-admin-{timestamp}` | Test administrative functions |

All test users are automatically:
- Created with secure random passwords
- Tagged for easy identification
- Cleaned up after tests complete

## Architecture

### Test Utilities

#### `utils/test-user-manager.ts`
- Create and manage test users
- Support for all user roles
- Automatic tagging and cleanup
- Password generation

#### `utils/test-discharge-manager.ts`
- Upload discharge summaries to GCS
- Create Firestore metadata
- Support for .md and .pdf files
- Automatic tagging and cleanup

### Test Organization

```
test/                              # Top-level test directory
├── portals-integration.spec.ts    # Main test suite
├── utils/
│   ├── test-user-manager.ts       # User creation/cleanup
│   └── test-discharge-manager.ts  # Discharge summary management
├── scripts/
│   ├── run-portal-tests.ts        # Test runner
│   └── cleanup-test-data.ts       # Cleanup script
├── test-data/
│   └── discharge-summaries/       # Sample discharge documents
│       ├── patient-001-discharge.md
│       ├── patient-002-discharge.md
│       ├── patient-003-discharge.md
│       ├── patient-004-discharge.md
│       └── README.md
├── package.json                   # Test dependencies
├── tsconfig.json                  # TypeScript config
├── jest.config.js                 # Jest config
├── TESTING_GUIDE.md               # Comprehensive guide
├── PORTAL_TESTING.md              # Quick reference
└── README.md                      # This file
```

## Usage

### Basic Commands

```bash
# From test directory (recommended)
cd test
npm test                    # Run tests
npm run test:verbose        # Verbose output
npm run test:coverage       # With coverage
npm run test:watch          # Watch mode
npm run cleanup             # Clean up test data

# Or from backend directory
cd backend
npm run test:portals
npm run test:portals:verbose
npm run test:portals:coverage
npm run cleanup-test-data
```

### Advanced Options

```bash
# From test directory
npm run test:no-cleanup     # Skip cleanup (for debugging)

# Or from backend directory
npm run test:portals -- --no-cleanup

# Run specific test suites with Jest
jest --testNamePattern="Clinician Portal"

# Combine options
npm test -- --verbose --no-cleanup
```

## Test Tagging System

All test data is tagged with `portal-integration-test`:

```typescript
{
  // User or discharge summary data
  testTag: 'portal-integration-test',
  testCreatedAt: '2025-01-20T10:30:00Z',
  createdBy: 'test-automation'
}
```

**Benefits:**
- ✅ Easy identification of test data
- ✅ Safe cleanup without affecting production
- ✅ Query test data across runs
- ✅ Prevent accidental data pollution

## Cleanup

### Automatic Cleanup

By default, tests automatically clean up after completion:

```bash
cd test && npm test  # Includes cleanup
```

### Manual Cleanup

Clean up test data at any time:

```bash
# From test directory
cd test && npm run cleanup

# From backend directory
cd backend && npm run cleanup-test-data
```

This script:
- Finds all data tagged with `portal-integration-test`
- Deletes users from Firestore
- Deletes discharge summaries from Firestore
- Removes uploaded files from GCS
- Provides detailed cleanup summary

### Skip Cleanup (Debugging)

Keep test data for inspection:

```bash
# From test directory
cd test && npm run test:no-cleanup

# From backend directory
cd backend && npm run test:portals -- --no-cleanup
```

## Configuration

### Service Account

Set up service account credentials:

```bash
# Option 1: Environment variable
export SERVICE_ACCOUNT_PATH=/path/to/service-account.json

# Option 2: Config file
# Create .settings.dev/config.yaml with:
# firestore_service_account_path: /path/to/service-account.json
```

### GCS Bucket

Configure GCS bucket for file storage:

```bash
# Option 1: Environment variable
export GCS_BUCKET_NAME=your-bucket-name

# Option 2: Config file
# Add to .settings.dev/config.yaml:
# gcs_bucket_name: your-bucket-name
```

### Environment

Specify environment:

```bash
# Dev (default)
NODE_ENV=dev npm run test:portals

# Staging
NODE_ENV=staging npm run test:portals
```

## CI/CD Integration

### GitHub Actions

```yaml
- name: Run Portal Tests
  env:
    SERVICE_ACCOUNT_PATH: ./service-account.json
    GCS_BUCKET_NAME: ${{ secrets.GCS_BUCKET_NAME }}
    NODE_ENV: dev
    CI: true
  run: |
    cd backend
    npm run test:portals
```

### GitLab CI

```yaml
portal-tests:
  script:
    - cd backend
    - npm install
    - npm run test:portals
  variables:
    NODE_ENV: dev
    CI: "true"
```

## Troubleshooting

### Connection Issues

**Problem**: Tests fail to connect to Firestore

**Solution**:
```bash
# Verify credentials
ls -la .settings.dev/

# Check environment variables
echo $SERVICE_ACCOUNT_PATH

# Test connection
npm run list-users
```

### Test Data Pollution

**Problem**: Test data from previous runs interferes

**Solution**:
```bash
# Clean up before running tests
npm run cleanup-test-data
npm run test:portals
```

### Upload Failures

**Problem**: Failed to upload discharge summaries to GCS

**Solution**:
```bash
# Verify bucket exists and permissions
gsutil ls gs://your-bucket-name

# Check service account has storage.objects.create permission
```

### Cleanup Failures

**Problem**: Cleanup script doesn't remove all test data

**Solution**:
```bash
# Run cleanup with verbose output
npm run cleanup-test-data

# Manually verify in Firestore Console
# Query: testTag == "portal-integration-test"
```

## Best Practices

### 1. Run Tests Before Commits

```bash
# Pre-commit hook
npm run test:portals
```

### 2. Keep Test Data Realistic

Update sample discharge summaries to match real-world scenarios.

### 3. Monitor Test Performance

```bash
# Check test duration
npm run test:portals -- --verbose
```

### 4. Clean Up Regularly

```bash
# Weekly cleanup recommended
npm run cleanup-test-data
```

### 5. Review Test Coverage

```bash
# Generate coverage report
npm run test:portals:coverage

# View coverage
open coverage/lcov-report/index.html
```

## Contributing

### Adding New Test Cases

1. Open `test/portals-integration.spec.ts`
2. Add test case to appropriate describe block
3. Use existing test utilities
4. Ensure proper cleanup

Example:

```typescript
describe('New Feature Tests', () => {
  it('should test new feature', async () => {
    // Use existing managers
    const user = await userManager.createUser({...});

    // Test feature
    expect(feature).toBeDefined();

    // Cleanup is automatic
  });
});
```

### Adding New Test Data

1. Create new discharge summary in `test-data/discharge-summaries/`
2. Use standard format with patient metadata
3. Test will automatically pick it up
4. Update README if needed

### Updating Test Utilities

When modifying test utilities:
1. Update `test/utils/test-user-manager.ts` or `test-discharge-manager.ts`
2. Ensure backward compatibility
3. Update this documentation
4. Test cleanup functionality

## Performance

### Test Duration

Expected test duration:
- Setup: ~30 seconds
- Tests: ~2-3 minutes
- Cleanup: ~15 seconds
- **Total: ~3-4 minutes**

### Optimization Tips

1. Use `--no-cleanup` during development
2. Run specific test suites with `--testNamePattern`
3. Use watch mode for active development
4. Run full suite before commits

## Support

For issues or questions:

1. Check [TESTING_GUIDE.md](./TESTING_GUIDE.md) for detailed information
2. Review test output for error messages
3. Run cleanup: `npm run cleanup-test-data`
4. Check Firestore Console for test data
5. Verify GCS bucket permissions

## Related Documentation

- [Detailed Testing Guide](./TESTING_GUIDE.md) - Comprehensive guide
- [Architecture Documentation](../ARCHITECTURE_DEEP_DIVE.md)
- [Authentication System](../AUTH_SYSTEM_DESIGN.md)
- [Tenant Configuration](../TENANT_CONFIG_USAGE.md)

## License

This test suite is part of the patient discharge system and follows the same license.
