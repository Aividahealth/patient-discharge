# Portal Integration Testing - Quick Reference

Complete test suite for testing all portals (Clinician, Expert, Patient, Admin) with discharge summaries.

## Quick Start

```bash
# From test directory (recommended)
cd test
npm install  # First time only
npm test

# Or from backend directory
cd backend
npm run test:portals

# Clean up test data
cd test && npm run cleanup
```

## What Gets Tested

✅ **Clinician Portal** - Upload and manage discharge summaries
✅ **Expert Portal** - Review and approve summaries
✅ **Patient Portal** - View simplified discharge instructions
✅ **Admin Portal** - User and tenant management

## Key Features

- 🏥 Tests all four portals comprehensively
- 👥 Automatically creates tagged test users
- 📄 Uploads sample discharge summaries (.md and .pdf)
- 🏷️ Tags all data with `portal-integration-test`
- 🧹 Automatic cleanup after tests
- 🔄 Safe to run repeatedly
- ☁️ Works with demo tenant

## Test Commands

```bash
# From test directory (recommended)
cd test
npm test                    # Basic test run
npm run test:verbose        # With verbose output
npm run test:coverage       # With code coverage
npm run test:watch          # Watch mode (for development)
npm run test:no-cleanup     # Skip cleanup (for debugging)
npm run cleanup             # Manual cleanup

# Or from backend directory
cd backend
npm run test:portals
npm run test:portals:verbose
npm run test:portals:coverage
npm run test:portals:watch
npm run test:portals -- --no-cleanup
npm run cleanup-test-data
```

## Test Data

### Sample Discharge Summaries

Located in: `test/test-data/discharge-summaries/`

- **patient-001-discharge.md** - Cardiac (MI, stent)
- **patient-002-discharge.md** - OB/GYN (delivery)
- **patient-003-discharge.md** - Orthopedic (hip replacement)
- **patient-004-discharge.md** - Pediatric (pneumonia)

All patient data is fictional.

### Test Users

Automatically created for each test run:

| Role | Access |
|------|--------|
| Patient | View own discharge summaries |
| Clinician | Upload and manage summaries |
| Expert | Review and approve summaries |
| Admin | Manage users and view metrics |

## Configuration

### Required Setup

1. **Service Account**:
   ```bash
   export SERVICE_ACCOUNT_PATH=/path/to/service-account.json
   # OR create .settings.dev/config.yaml
   ```

2. **GCS Bucket**:
   ```bash
   export GCS_BUCKET_NAME=your-bucket-name
   # OR add to .settings.dev/config.yaml
   ```

3. **Environment**:
   ```bash
   NODE_ENV=dev npm run test:portals
   ```

## Test Architecture

```
test/                                  # Top-level test directory
├── portals-integration.spec.ts        # Main test suite
├── utils/
│   ├── test-user-manager.ts           # User management
│   └── test-discharge-manager.ts      # Discharge summary management
├── scripts/
│   ├── run-portal-tests.ts            # Test runner
│   └── cleanup-test-data.ts           # Cleanup script
├── test-data/
│   └── discharge-summaries/           # Sample documents
├── package.json                       # Test dependencies
├── tsconfig.json                      # TypeScript config
├── jest.config.js                     # Jest config
├── TESTING_GUIDE.md                   # Detailed guide
├── PORTAL_TESTING.md                  # This file
└── README.md                          # Full documentation
```

## How It Works

1. **Setup Phase** (~30 seconds)
   - Creates test users (patient, clinician, expert, admin)
   - Uploads discharge summaries from test-data directory
   - Tags all data with `portal-integration-test`

2. **Test Phase** (~2-3 minutes)
   - Tests authentication for all user types
   - Tests clinician portal functionality
   - Tests expert review workflow
   - Tests patient portal access
   - Tests admin portal operations
   - Tests cross-portal workflows

3. **Cleanup Phase** (~15 seconds)
   - Deletes all test users from Firestore
   - Removes discharge summaries from Firestore
   - Cleans up uploaded files from GCS

## Safety Features

🔒 **Data Isolation**
- All test data tagged with `portal-integration-test`
- Only deletes tagged data
- No impact on production data

🔒 **Tenant Isolation**
- Uses demo tenant only
- Tests tenant boundaries
- Verifies data separation

🔒 **User Tagging**
- Unique usernames with timestamps
- Tagged for easy identification
- Automatic cleanup

## Common Use Cases

### During Development

```bash
# Watch mode - tests run on file changes
cd test && npm run test:watch
```

### Before Committing

```bash
# Full test run with coverage
cd test && npm run test:coverage
```

### After Errors

```bash
# Clean up and retry
cd test
npm run cleanup
npm test
```

### CI/CD Pipeline

```bash
# Non-interactive mode
cd test && CI=true npm test
```

## Troubleshooting

### Tests Won't Start

```bash
# Check prerequisites
ls test/test-data/discharge-summaries/
echo $SERVICE_ACCOUNT_PATH

# Install dependencies
cd test && npm install

# Verify Firestore access
cd backend && npm run list-users
```

### Test Data Pollution

```bash
# Clean up first
cd test && npm run cleanup

# Then run tests
npm test
```

### Upload Failures

```bash
# Verify bucket access
gsutil ls gs://your-bucket-name

# Check permissions
gcloud projects get-iam-policy YOUR_PROJECT_ID
```

### Cleanup Not Working

```bash
# Manual cleanup with verbose output
cd test && npm run cleanup

# Verify in Firestore Console
# Filter: testTag == "portal-integration-test"
```

## Performance

**Expected Duration:** ~3-4 minutes total

- Setup: 30 seconds
- Tests: 2-3 minutes
- Cleanup: 15 seconds

**Optimization Tips:**
- Use `--no-cleanup` during development
- Run specific tests with `--testNamePattern`
- Use watch mode for active development

## Documentation

- **Quick Reference**: This file
- **Full Guide**: [TESTING_GUIDE.md](TESTING_GUIDE.md)
- **Test README**: [README.md](README.md)
- **Architecture**: [../ARCHITECTURE_DEEP_DIVE.md](../ARCHITECTURE_DEEP_DIVE.md)

## CI/CD Integration

### GitHub Actions

```yaml
- name: Portal Tests
  run: |
    cd test
    npm install
    npm test
  env:
    NODE_ENV: dev
    CI: true
```

### Pre-commit Hook

```bash
#!/bin/sh
cd test && npm test
```

## Support

**For issues:**
1. Check test output for specific errors
2. Review [TESTING_GUIDE.md](TESTING_GUIDE.md)
3. Run cleanup: `cd test && npm run cleanup`
4. Check Firestore Console for test data

**Test Coverage:**
- ✅ Authentication (all roles)
- ✅ Clinician workflow
- ✅ Expert review process
- ✅ Patient access control
- ✅ Admin operations
- ✅ Cross-portal workflows
- ✅ Data isolation
- ✅ Tenant boundaries

## Next Steps

1. **Install dependencies** (first time only):
   ```bash
   cd test && npm install
   ```

2. **Run the tests**:
   ```bash
   npm test
   ```

3. **Review the output** for any failures

4. **Check code coverage**:
   ```bash
   npm run test:coverage
   open coverage/lcov-report/index.html
   ```

5. **Read the full guide**: [TESTING_GUIDE.md](TESTING_GUIDE.md)

---

**Note**: All test data is fictional and created specifically for testing purposes.
