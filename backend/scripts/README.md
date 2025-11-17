# Tenant Onboarding Scripts

This directory contains scripts for managing tenant onboarding and administration.

## Prerequisites

1. Install dependencies:
   ```bash
   cd backend
   npm install
   ```

2. Set up Firebase credentials:
   - Ensure `GOOGLE_APPLICATION_CREDENTIALS` environment variable is set, OR
   - Place service account JSON at `backend/.settings.dev/service-account.json`

## Available Scripts

### 1. Onboard Tenant

Creates a new tenant with configuration and admin user.

**Usage:**
```bash
cd backend

# Manual upload tenant (simple)
npm run onboard-tenant -- \
  --id="simple-clinic" \
  --name="Simple Clinic" \
  --method="manual" \
  --admin-username="admin" \
  --admin-name="Admin User" \
  --admin-password="SecurePass123!"

# Cerner integration tenant (with config file)
npm run onboard-tenant -- \
  --id="memorial-hospital" \
  --name="Memorial Hospital" \
  --type="production" \
  --method="cerner" \
  --config-file="./memorial-config.json" \
  --admin-username="admin@memorial" \
  --admin-name="John Doe" \
  --admin-password="SecurePass123!" \
  --primary-color="#1e3a8a" \
  --languages="en,es,hi"

# Dry run (preview without changes)
npm run onboard-tenant -- \
  --id="test-tenant" \
  --name="Test Tenant" \
  --method="manual" \
  --admin-username="admin" \
  --admin-name="Test Admin" \
  --admin-password="password123" \
  --dry-run
```

**Options:**
- `--id` - Tenant unique identifier (required)
- `--name` - Tenant display name (required)
- `--type` - Tenant type: demo | production | custom (default: production)
- `--method` - Integration method: manual | cerner (required)
- `--config-file` - Path to JSON config file for advanced settings
- `--admin-username` - Admin username (required)
- `--admin-name` - Admin full name (required)
- `--admin-password` - Admin password (required, min 8 chars)
- `--logo-url` - Logo URL (optional)
- `--favicon-url` - Favicon URL (optional)
- `--primary-color` - Primary brand color hex (default: #3b82f6)
- `--secondary-color` - Secondary brand color hex (default: #60a5fa)
- `--accent-color` - Accent brand color hex (default: #1e40af)
- `--languages` - Comma-separated language codes (default: en,es)
- `--dry-run` - Preview changes without applying them
- `--skip-validation` - Skip Cerner/FHIR validation

**Config File Example:**
```json
{
  "tenantConfig": {
    "google": {
      "dataset": "aivida-production",
      "fhir_store": "memorial-hospital-fhir"
    },
    "cerner": {
      "base_url": "https://fhir-ehr.cerner.com/r4/ec2458f2-1e24-41c8-b71b-0e701af7583d",
      "patients": ["12345678", "87654321"],
      "system_app": {
        "client_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
        "client_secret": "your-secret-here",
        "token_url": "https://authorization.cerner.com/tenants/xxx/protocols/oauth2/profiles/smart-v1/token",
        "scopes": "system/*.read system/*.write"
      },
      "provider_app": {
        "client_id": "yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy",
        "client_secret": "provider-secret",
        "authorization_url": "https://authorization.cerner.com/tenants/xxx/protocols/oauth2/profiles/smart-v1/authorize",
        "token_url": "https://authorization.cerner.com/tenants/xxx/protocols/oauth2/profiles/smart-v1/token",
        "redirect_uri": "https://aividia.com/memorial-hospital/auth/callback",
        "scopes": "user/*.read launch/patient openid fhirUser"
      }
    },
    "pubsub": {
      "topic_name": "discharge-processing-memorial-hospital",
      "service_account_path": "/secrets/memorial-hospital-sa-key.json"
    }
  }
}
```

---

### 2. Create User

Creates additional users for an existing tenant.

**Usage:**
```bash
cd backend

# Create clinician
npm run create-user -- \
  --tenant="simple-clinic" \
  --username="dr.smith" \
  --name="Dr. Sarah Smith" \
  --role="clinician" \
  --password="SecurePass123!"

# Create expert reviewer
npm run create-user -- \
  --tenant="simple-clinic" \
  --username="expert.jones" \
  --name="Dr. Michael Jones" \
  --role="expert" \
  --password="SecurePass123!"

# Create patient (with linked patient ID)
npm run create-user -- \
  --tenant="simple-clinic" \
  --username="patient12345" \
  --name="Jane Patient" \
  --role="patient" \
  --linked-patient-id="12345678" \
  --password="SecurePass123!"
```

**Options:**
- `--tenant` - Tenant ID (required)
- `--username` - Username for login (required)
- `--name` - Full name (required)
- `--role` - User role: patient | clinician | expert | admin (required)
- `--password` - Password (required, min 8 chars)
- `--linked-patient-id` - FHIR Patient ID (required for patient role)

---

### 3. Test Cerner Integration

Tests Cerner FHIR API connectivity and authentication.

**Usage:**
```bash
cd backend

npm run test-cerner-integration -- --tenant="memorial-hospital"
```

**Tests performed:**
1. ✓ Authentication (OAuth2 client credentials)
2. ✓ FHIR Metadata endpoint
3. ✓ Patient search
4. ✓ Discharge summary (DocumentReference) search

**Options:**
- `--tenant` - Tenant ID to test (required)

---

## Workflow Examples

### Example 1: Simple Manual Upload Tenant

```bash
# 1. Onboard tenant
npm run onboard-tenant -- \
  --id="westside-clinic" \
  --name="Westside Clinic" \
  --method="manual" \
  --admin-username="admin" \
  --admin-name="Admin User" \
  --admin-password="WestsideAdmin2024!"

# 2. Create clinician user
npm run create-user -- \
  --tenant="westside-clinic" \
  --username="dr.williams" \
  --name="Dr. Emily Williams" \
  --role="clinician" \
  --password="Clinician2024!"

# 3. Login at: https://aividia.com/westside-clinic/admin
```

---

### Example 2: Enterprise Cerner Integration

```bash
# 1. Prepare Cerner config file
cat > memorial-config.json <<EOF
{
  "tenantConfig": {
    "google": {
      "dataset": "aivida-production",
      "fhir_store": "memorial-hospital-fhir"
    },
    "cerner": {
      "base_url": "https://fhir-ehr.cerner.com/r4/your-tenant-id",
      "patients": ["12345", "67890"],
      "system_app": {
        "client_id": "your-client-id",
        "client_secret": "your-secret",
        "token_url": "https://authorization.cerner.com/tenants/xxx/protocols/oauth2/profiles/smart-v1/token",
        "scopes": "system/*.read system/*.write"
      }
    }
  }
}
EOF

# 2. Create Google Cloud resources
gcloud healthcare fhir-stores create memorial-hospital-fhir \
  --dataset=aivida-production \
  --location=us-central1 \
  --version=R4

gcloud pubsub topics create discharge-processing-memorial-hospital

# 3. Onboard tenant with Cerner config
npm run onboard-tenant -- \
  --id="memorial-hospital" \
  --name="Memorial Hospital" \
  --type="production" \
  --method="cerner" \
  --config-file="./memorial-config.json" \
  --admin-username="admin@memorial" \
  --admin-name="Hospital Admin" \
  --admin-password="MemorialAdmin2024!" \
  --languages="en,es,hi,vi"

# 4. Test Cerner integration
npm run test-cerner-integration -- --tenant="memorial-hospital"

# 5. Create users
npm run create-user -- \
  --tenant="memorial-hospital" \
  --username="dr.smith" \
  --name="Dr. John Smith" \
  --role="clinician" \
  --password="SmithClinician2024!"

npm run create-user -- \
  --tenant="memorial-hospital" \
  --username="expert.johnson" \
  --name="Dr. Lisa Johnson" \
  --role="expert" \
  --password="ExpertReview2024!"
```

---

## Troubleshooting

### Error: "Failed to initialize Firebase"

**Solution:** Ensure service account credentials are configured:
```bash
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account.json"
```

Or place the file at: `backend/.settings.dev/service-account.json`

---

### Error: "Tenant already exists"

**Solution:** Choose a different tenant ID or delete the existing tenant from Firestore:
```bash
# Delete from Firestore Console or using Firebase CLI
```

---

### Error: "Cerner authentication failed"

**Solutions:**
1. Verify client credentials are correct
2. Check that token URL matches your Cerner tenant
3. Ensure scopes are properly formatted
4. Verify your app is registered with Cerner
5. Check that credentials haven't expired

---

### Error: "User already exists"

**Solution:** Use a different username or delete the existing user from Firestore

---

## Security Notes

1. **Never commit credentials** to version control
2. Use strong passwords for production (min 12 chars, mixed case, numbers, symbols)
3. Change default admin passwords immediately after onboarding
4. Store Cerner credentials in secure secret management (Google Secret Manager, etc.)
5. Use service accounts with minimal required permissions
6. Enable audit logging for production tenants
7. Regularly rotate credentials

---

## Next Steps After Onboarding

1. Upload branding assets to GCS (logo, favicon)
2. Test login with admin credentials
3. Configure additional features in Firestore
4. Import initial discharge summaries (if Cerner integration)
5. Train users on portal usage
6. Monitor logs for errors
7. Set up alerts and monitoring

---

For detailed onboarding guide, see: [docs/TENANT_ONBOARDING_GUIDE.md](../docs/TENANT_ONBOARDING_GUIDE.md)
