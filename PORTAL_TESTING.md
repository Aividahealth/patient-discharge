# Portal Integration Testing - Quick Reference

Complete test suite for testing all portals (Clinician, Expert, Patient, Admin) with discharge summaries.

## Quick Start

```bash
cd backend

# Run all portal tests
npm run test:portals

# Clean up test data
npm run cleanup-test-data
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
# Basic test run
npm run test:portals

# With verbose output
npm run test:portals:verbose

# With code coverage
npm run test:portals:coverage

# Watch mode (for development)
npm run test:portals:watch

# Skip cleanup (for debugging)
npm run test:portals -- --no-cleanup

# Manual cleanup
npm run cleanup-test-data
```

## Test Data

### Sample Discharge Summaries

Located in: `backend/test-data/discharge-summaries/`

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
backend/
├── test/
│   ├── portals-integration.spec.ts    # Main test suite
│   ├── utils/
│   │   ├── test-user-manager.ts       # User management
│   │   └── test-discharge-manager.ts  # Discharge summary management
│   ├── TESTING_GUIDE.md               # Detailed guide
│   └── README.md                      # Full documentation
├── test-data/
│   └── discharge-summaries/           # Sample documents
└── scripts/
    ├── run-portal-tests.ts            # Test runner
    └── cleanup-test-data.ts           # Cleanup script
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
npm run test:portals:watch
```

### Before Committing

```bash
# Full test run with coverage
npm run test:portals:coverage
```

### After Errors

```bash
# Clean up and retry
npm run cleanup-test-data
npm run test:portals
```

### CI/CD Pipeline

```bash
# Non-interactive mode
CI=true npm run test:portals
```

## Troubleshooting

### Tests Won't Start

```bash
# Check prerequisites
ls backend/test-data/discharge-summaries/
echo $SERVICE_ACCOUNT_PATH

# Verify Firestore access
npm run list-users
```

### Test Data Pollution

```bash
# Clean up first
npm run cleanup-test-data

# Then run tests
npm run test:portals
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
npm run cleanup-test-data

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
- **Full Guide**: [backend/test/TESTING_GUIDE.md](backend/test/TESTING_GUIDE.md)
- **Test README**: [backend/test/README.md](backend/test/README.md)
- **Architecture**: [ARCHITECTURE_DEEP_DIVE.md](ARCHITECTURE_DEEP_DIVE.md)

## CI/CD Integration

### GitHub Actions

```yaml
- name: Portal Tests
  run: |
    cd backend
    npm install
    npm run test:portals
  env:
    NODE_ENV: dev
    CI: true
```

### Pre-commit Hook

```bash
#!/bin/sh
cd backend && npm run test:portals
```

## Support

**For issues:**
1. Check test output for specific errors
2. Review [TESTING_GUIDE.md](backend/test/TESTING_GUIDE.md)
3. Run cleanup: `npm run cleanup-test-data`
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

1. **Run the tests**:
   ```bash
   cd backend && npm run test:portals
   ```

2. **Review the output** for any failures

3. **Check code coverage**:
   ```bash
   npm run test:portals:coverage
   open coverage/lcov-report/index.html
   ```

4. **Read the full guide**: [backend/test/TESTING_GUIDE.md](backend/test/TESTING_GUIDE.md)

---

**Note**: All test data is fictional and created specifically for testing purposes.
