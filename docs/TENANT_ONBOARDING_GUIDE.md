# Tenant Onboarding Guide

## Overview

This guide provides step-by-step instructions for onboarding a new tenant to the Aivida Patient Discharge Platform. The platform is a multi-tenant healthcare application that manages patient discharge summaries with AI-powered simplification and translation capabilities.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Integration Methods](#integration-methods)
3. [Tenant Configuration](#tenant-configuration)
4. [Onboarding Steps](#onboarding-steps)
5. [Post-Onboarding Verification](#post-onboarding-verification)
6. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before onboarding a new tenant, ensure you have:

### Information Required

- [ ] Tenant name and identifier (e.g., "Memorial Hospital", `memorial-hospital`)
- [ ] Tenant type: `demo`, `production`, or `custom`
- [ ] Integration method choice (see [Integration Methods](#integration-methods))
- [ ] Branding assets (logo, favicon, color scheme)
- [ ] Feature requirements
- [ ] Initial admin user details
- [ ] Google Cloud project access
- [ ] Firestore database access

### Technical Requirements

- [ ] Access to Google Cloud Console
- [ ] Firestore database permissions
- [ ] Cloud Storage bucket access (`aivida-discharge-summaries`)
- [ ] Cloud Healthcare API access (if using FHIR)
- [ ] Node.js environment for running scripts

---

## Integration Methods

The tenant can choose one of the following integration methods for discharge summaries:

### Option 1: Manual Upload

**Description**: Tenants manually upload discharge summary documents through the web interface.

**Best for**:
- Small hospitals or clinics
- Testing/demo environments
- Organizations without EHR integration capabilities
- Quick onboarding without technical integration

**Requirements**:
- None (web interface only)

**Configuration**:
```yaml
config:
  features:
    fileUpload: true
  integration:
    method: "manual"
```

---

### Option 2: Cerner FHIR Integration

**Description**: Automated integration with Cerner EHR system using FHIR R4 API.

**Best for**:
- Organizations using Cerner Millennium/PowerChart
- High-volume discharge processing
- Automated workflows

**Requirements**:
1. **Cerner FHIR Base URL**: Tenant-specific FHIR endpoint
2. **System App Credentials** (Backend service authentication):
   - Client ID
   - Client Secret
   - Token URL
   - Scopes (typically `system/*.read system/*.write`)
3. **Provider App Credentials** (User SSO - optional):
   - Client ID
   - Client Secret
   - Authorization URL
   - Token URL
   - Redirect URI
   - Scopes (typically `user/*.read launch/patient`)
4. **Patient List**: Initial list of patient IDs to process
5. **Google FHIR Store Configuration**:
   - Dataset name
   - FHIR store name

**Configuration**:
```yaml
config:
  integration:
    method: "cerner"
  tenantConfig:
    cerner:
      base_url: "https://fhir-ehr.cerner.com/r4/[tenant-id]"
      patients:
        - "12345678"
        - "87654321"
      system_app:
        client_id: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
        client_secret: "secret-key-here"
        token_url: "https://authorization.cerner.com/tenants/[tenant-id]/protocols/oauth2/profiles/smart-v1/token"
        scopes: "system/*.read system/*.write"
      provider_app:
        client_id: "yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy"
        client_secret: "provider-secret"
        authorization_url: "https://authorization.cerner.com/tenants/[tenant-id]/protocols/oauth2/profiles/smart-v1/authorize"
        token_url: "https://authorization.cerner.com/tenants/[tenant-id]/protocols/oauth2/profiles/smart-v1/token"
        redirect_uri: "https://aividia.com/[tenant-id]/auth/callback"
        scopes: "user/*.read launch/patient openid fhirUser"
    google:
      dataset: "aivida-production"
      fhir_store: "[tenant-id]-fhir"
```

---

### Option 3: Epic Integration (Coming Soon)

**Description**: Integration with Epic EHR system using FHIR R4 API.

**Status**: Planned for future release

**Requirements** (when available):
- Epic FHIR endpoint
- Epic client credentials
- Epic patient context
- Similar configuration structure to Cerner

---

## Tenant Configuration

### Configuration Structure

Each tenant has the following configuration sections:

#### 1. Basic Information

```typescript
{
  id: "tenant-unique-id",           // Auto-generated or custom
  name: "Hospital Name",             // Display name
  status: "active",                  // active | inactive | suspended
  type: "production",                // demo | production | custom
}
```

#### 2. Branding

```typescript
{
  branding: {
    logo: "https://storage.googleapis.com/aivida-branding/[tenant-id]/logo.png",
    favicon: "https://storage.googleapis.com/aivida-branding/[tenant-id]/favicon.ico",
    primaryColor: "#3b82f6",       // Primary brand color
    secondaryColor: "#60a5fa",     // Secondary brand color
    accentColor: "#1e40af"         // Accent color
  }
}
```

#### 3. Features

```typescript
{
  features: {
    aiGeneration: true,            // Enable AI simplification/translation
    multiLanguage: true,           // Enable multi-language support
    supportedLanguages: [          // Languages to support
      "en",                        // English (required)
      "es",                        // Spanish
      "hi",                        // Hindi
      "vi",                        // Vietnamese
      "fr"                         // French
    ],
    fileUpload: true,              // Enable manual file upload
    expertPortal: true,            // Enable expert review portal
    clinicianPortal: true,         // Enable clinician portal
    adminPortal: true              // Enable admin portal
  }
}
```

#### 4. Integration Configuration

```typescript
{
  config: {
    simplificationEnabled: true,
    translationEnabled: true,
    defaultLanguage: "en",

    integration: {
      method: "cerner" | "manual" | "epic"  // Integration method
    },

    tenantConfig: {
      google: {
        dataset: "aivida-production",
        fhir_store: "tenant-fhir"
      },
      cerner: {
        // Cerner configuration (if applicable)
      },
      pubsub: {
        topic_name: "discharge-processing-tenant-id",
        service_account_path: "/path/to/service-account.json"
      }
    }
  }
}
```

---

## Onboarding Steps

### Step 1: Gather Tenant Information

Use the **Tenant Onboarding Checklist**:

```markdown
## Tenant Information Checklist

### Basic Details
- [ ] Tenant ID: ________________
- [ ] Tenant Name: ________________
- [ ] Tenant Type: [ ] Demo  [ ] Production  [ ] Custom
- [ ] Status: [ ] Active  [ ] Inactive

### Integration Method
- [ ] Manual Upload
- [ ] Cerner Integration
- [ ] Epic Integration (future)

### Branding
- [ ] Logo file (PNG, min 200x200px): ________________
- [ ] Favicon file (ICO, 32x32px): ________________
- [ ] Primary Color (hex): ________________
- [ ] Secondary Color (hex): ________________
- [ ] Accent Color (hex): ________________

### Features Required
- [ ] AI Simplification
- [ ] Multi-language Translation
- [ ] Languages needed: ________________
- [ ] Manual File Upload
- [ ] Expert Review Portal
- [ ] Clinician Portal
- [ ] Admin Portal

### Initial Admin User
- [ ] Username: ________________
- [ ] Full Name: ________________
- [ ] Email: ________________
- [ ] Password (temporary): ________________

### Cerner Integration (if applicable)
- [ ] Cerner FHIR Base URL: ________________
- [ ] System App Client ID: ________________
- [ ] System App Client Secret: ________________
- [ ] System App Token URL: ________________
- [ ] System App Scopes: ________________
- [ ] Provider App Client ID: ________________
- [ ] Provider App Client Secret: ________________
- [ ] Provider App Authorization URL: ________________
- [ ] Provider App Token URL: ________________
- [ ] Provider App Redirect URI: ________________
- [ ] Provider App Scopes: ________________
- [ ] Initial Patient IDs: ________________

### Google Cloud Configuration
- [ ] FHIR Dataset Name: ________________
- [ ] FHIR Store Name: ________________
- [ ] Pub/Sub Topic Name: ________________
- [ ] Service Account Email: ________________
```

---

### Step 2: Upload Branding Assets

1. **Upload to Google Cloud Storage**:
   ```bash
   # Create tenant branding folder
   gsutil mb gs://aivida-branding/[tenant-id]/

   # Upload logo
   gsutil cp logo.png gs://aivida-branding/[tenant-id]/logo.png
   gsutil acl ch -u AllUsers:R gs://aivida-branding/[tenant-id]/logo.png

   # Upload favicon
   gsutil cp favicon.ico gs://aivida-branding/[tenant-id]/favicon.ico
   gsutil acl ch -u AllUsers:R gs://aivida-branding/[tenant-id]/favicon.ico
   ```

2. **Get public URLs**:
   - Logo: `https://storage.googleapis.com/aivida-branding/[tenant-id]/logo.png`
   - Favicon: `https://storage.googleapis.com/aivida-branding/[tenant-id]/favicon.ico`

---

### Step 3: Create Google Cloud Resources (Cerner Integration Only)

If the tenant is using Cerner integration:

1. **Create FHIR Store**:
   ```bash
   gcloud healthcare fhir-stores create [tenant-id]-fhir \
     --dataset=aivida-production \
     --location=us-central1 \
     --version=R4 \
     --enable-update-create
   ```

2. **Create Pub/Sub Topic**:
   ```bash
   gcloud pubsub topics create discharge-processing-[tenant-id]
   ```

3. **Create Service Account**:
   ```bash
   gcloud iam service-accounts create [tenant-id]-service \
     --display-name="[Tenant Name] Service Account"

   # Grant necessary permissions
   gcloud projects add-iam-policy-binding [project-id] \
     --member="serviceAccount:[tenant-id]-service@[project-id].iam.gserviceaccount.com" \
     --role="roles/healthcare.fhirStoreAdmin"

   gcloud projects add-iam-policy-binding [project-id] \
     --member="serviceAccount:[tenant-id]-service@[project-id].iam.gserviceaccount.com" \
     --role="roles/pubsub.publisher"

   # Download service account key
   gcloud iam service-accounts keys create [tenant-id]-sa-key.json \
     --iam-account=[tenant-id]-service@[project-id].iam.gserviceaccount.com
   ```

---

### Step 4: Run Tenant Onboarding Script

Use the automated onboarding script:

```bash
cd /home/user/patient-discharge/scripts

# For manual upload tenant
npm run onboard-tenant -- \
  --id="memorial-hospital" \
  --name="Memorial Hospital" \
  --type="production" \
  --method="manual" \
  --admin-username="admin@memorial" \
  --admin-name="John Doe" \
  --admin-password="TempPass123!"

# For Cerner integration tenant
npm run onboard-tenant -- \
  --id="memorial-hospital" \
  --name="Memorial Hospital" \
  --type="production" \
  --method="cerner" \
  --config-file="./memorial-cerner-config.json" \
  --admin-username="admin@memorial" \
  --admin-name="John Doe" \
  --admin-password="TempPass123!"
```

The script will:
- ✅ Create tenant configuration in Firestore
- ✅ Create initial admin user
- ✅ Validate Cerner credentials (if applicable)
- ✅ Test FHIR store connectivity (if applicable)
- ✅ Generate access URLs
- ✅ Output onboarding summary

---

### Step 5: Verify Tenant Configuration

1. **Check Firestore**:
   - Navigate to Firestore Console
   - Open `config` collection
   - Verify tenant document exists with correct data

2. **Check Users**:
   - Open `users` collection
   - Verify admin user exists with correct `tenantId`

3. **Test Login**:
   ```bash
   curl -X POST https://api.aividia.com/api/auth/login \
     -H "Content-Type: application/json" \
     -H "X-Tenant-ID: memorial-hospital" \
     -d '{
       "username": "admin@memorial",
       "password": "TempPass123!"
     }'
   ```

4. **Access Portals**:
   - Admin Portal: `https://aividia.com/memorial-hospital/admin`
   - Clinician Portal: `https://aividia.com/memorial-hospital/clinician`
   - Patient Portal: `https://aividia.com/memorial-hospital/patient`
   - Expert Portal: `https://aividia.com/memorial-hospital/expert`

---

### Step 6: Create Additional Users

Create users for different roles:

```bash
# Clinician
npm run create-user -- \
  --tenant="memorial-hospital" \
  --username="dr.smith" \
  --name="Dr. Sarah Smith" \
  --role="clinician" \
  --password="TempPass123!"

# Expert Reviewer
npm run create-user -- \
  --tenant="memorial-hospital" \
  --username="expert.jones" \
  --name="Dr. Michael Jones" \
  --role="expert" \
  --password="TempPass123!"

# Patient (linked to patient ID)
npm run create-user -- \
  --tenant="memorial-hospital" \
  --username="patient12345" \
  --name="Jane Patient" \
  --role="patient" \
  --linked-patient-id="12345678" \
  --password="TempPass123!"
```

---

### Step 7: Test Integration (Cerner Only)

For Cerner-integrated tenants:

```bash
# Test Cerner connectivity
npm run test-cerner-integration -- --tenant="memorial-hospital"

# Import initial discharge summaries
npm run import-cerner-discharges -- \
  --tenant="memorial-hospital" \
  --patient-ids="12345678,87654321"
```

---

## Post-Onboarding Verification

### Verification Checklist

- [ ] Tenant configuration exists in Firestore
- [ ] Admin user can log in successfully
- [ ] Branding appears correctly on login page
- [ ] All enabled portals are accessible
- [ ] Cerner integration is working (if applicable)
  - [ ] Can authenticate with Cerner
  - [ ] Can fetch patient data
  - [ ] Can import discharge summaries
- [ ] File upload works (if enabled)
- [ ] AI simplification works (if enabled)
- [ ] Translation works (if enabled)
- [ ] Expert review portal works (if enabled)

---

## Troubleshooting

### Issue: Cannot log in

**Symptoms**: Login fails with "Invalid credentials"

**Solutions**:
1. Verify tenant ID matches exactly (case-sensitive)
2. Check that user exists in Firestore with correct `tenantId`
3. Verify password hash was created correctly
4. Check `X-Tenant-ID` header is being sent

### Issue: Branding not appearing

**Symptoms**: Default logo/colors appear instead of tenant branding

**Solutions**:
1. Verify branding URLs are publicly accessible
2. Check CORS settings on Cloud Storage bucket
3. Clear browser cache
4. Verify branding URLs in tenant config

### Issue: Cerner integration failing

**Symptoms**: Cannot fetch data from Cerner, authentication errors

**Solutions**:
1. Verify Cerner credentials are correct
2. Check Cerner base URL is correct for tenant
3. Verify system app scopes include necessary permissions
4. Check token expiration (tokens expire after 570 seconds)
5. Review Cerner logs for specific error messages
6. Test credentials using Cerner's API explorer

### Issue: FHIR store errors

**Symptoms**: Cannot store/retrieve FHIR resources

**Solutions**:
1. Verify FHIR store exists in Google Cloud
2. Check service account has `healthcare.fhirStoreAdmin` role
3. Verify dataset and FHIR store names match configuration
4. Check FHIR store is version R4

### Issue: File upload not working

**Symptoms**: Cannot upload discharge summary files

**Solutions**:
1. Verify Cloud Storage bucket exists
2. Check service account has write permissions to bucket
3. Verify `fileUpload` feature is enabled in tenant config
4. Check file size limits (max 10MB)

---

## Integration Method Decision Matrix

| Factor | Manual Upload | Cerner Integration | Epic Integration (Future) |
|--------|---------------|-------------------|---------------------------|
| **Setup Time** | < 1 hour | 1-2 weeks | TBD |
| **Technical Complexity** | Low | Medium-High | Medium-High |
| **Ongoing Maintenance** | None | Medium | Medium |
| **Volume Capacity** | Low (< 50/day) | High (1000s/day) | High (1000s/day) |
| **Automation Level** | Manual | Fully automated | Fully automated |
| **Initial Cost** | None | Integration fees | TBD |
| **Prerequisites** | None | Cerner access + credentials | Epic access + credentials |
| **Best For** | Pilots, demos, small clinics | Large hospitals, high volume | Large hospitals using Epic |

---

## Security Considerations

### Production Deployment

Before launching a production tenant:

- [ ] Replace all default/demo credentials
- [ ] Enable HTTPS only (disable HTTP)
- [ ] Implement rate limiting
- [ ] Enable audit logging
- [ ] Set up monitoring and alerts
- [ ] Configure backup strategy
- [ ] Review and test disaster recovery plan
- [ ] Conduct security audit
- [ ] Enable CSRF protection
- [ ] Implement refresh token rotation
- [ ] Set up intrusion detection
- [ ] Configure firewall rules
- [ ] Enable data encryption at rest
- [ ] Set up VPN for admin access (if applicable)

### HIPAA Compliance

For HIPAA-compliant deployments:

- [ ] Sign Business Associate Agreement (BAA) with Google Cloud
- [ ] Enable Cloud Audit Logs
- [ ] Implement access controls and role-based permissions
- [ ] Enable encryption for data in transit and at rest
- [ ] Set up automated backup with retention policies
- [ ] Implement session timeout (15 minutes recommended)
- [ ] Enable automatic logout
- [ ] Set up breach notification procedures
- [ ] Conduct risk assessment
- [ ] Document security policies and procedures
- [ ] Train staff on HIPAA requirements
- [ ] Implement PHI access logging and monitoring

---

## Support and Contacts

For assistance with tenant onboarding:

- **Technical Support**: support@aividia.com
- **Documentation**: https://docs.aividia.com
- **Integration Help**: integrations@aividia.com
- **Security Issues**: security@aividia.com

---

## Appendix: Configuration Templates

### Minimal Manual Upload Tenant

```json
{
  "id": "simple-clinic",
  "name": "Simple Clinic",
  "status": "active",
  "type": "production",
  "branding": {
    "logo": "https://storage.googleapis.com/aivida-branding/simple-clinic/logo.png",
    "favicon": "https://storage.googleapis.com/aivida-branding/simple-clinic/favicon.ico",
    "primaryColor": "#3b82f6",
    "secondaryColor": "#60a5fa",
    "accentColor": "#1e40af"
  },
  "features": {
    "aiGeneration": true,
    "multiLanguage": true,
    "supportedLanguages": ["en", "es"],
    "fileUpload": true,
    "expertPortal": false,
    "clinicianPortal": true,
    "adminPortal": true
  },
  "config": {
    "simplificationEnabled": true,
    "translationEnabled": true,
    "defaultLanguage": "en",
    "integration": {
      "method": "manual"
    }
  }
}
```

### Full Cerner Integration Tenant

```json
{
  "id": "memorial-hospital",
  "name": "Memorial Hospital",
  "status": "active",
  "type": "production",
  "branding": {
    "logo": "https://storage.googleapis.com/aivida-branding/memorial-hospital/logo.png",
    "favicon": "https://storage.googleapis.com/aivida-branding/memorial-hospital/favicon.ico",
    "primaryColor": "#1e3a8a",
    "secondaryColor": "#3b82f6",
    "accentColor": "#60a5fa"
  },
  "features": {
    "aiGeneration": true,
    "multiLanguage": true,
    "supportedLanguages": ["en", "es", "hi", "vi", "fr"],
    "fileUpload": true,
    "expertPortal": true,
    "clinicianPortal": true,
    "adminPortal": true
  },
  "config": {
    "simplificationEnabled": true,
    "translationEnabled": true,
    "defaultLanguage": "en",
    "integration": {
      "method": "cerner"
    },
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
          "client_secret": "xxxxxxxxxxxxxxxxxxxxxxxxxxxx",
          "token_url": "https://authorization.cerner.com/tenants/ec2458f2-1e24-41c8-b71b-0e701af7583d/protocols/oauth2/profiles/smart-v1/token",
          "scopes": "system/*.read system/*.write"
        },
        "provider_app": {
          "client_id": "yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy",
          "client_secret": "yyyyyyyyyyyyyyyyyyyyyyyyyyyy",
          "authorization_url": "https://authorization.cerner.com/tenants/ec2458f2-1e24-41c8-b71b-0e701af7583d/protocols/oauth2/profiles/smart-v1/authorize",
          "token_url": "https://authorization.cerner.com/tenants/ec2458f2-1e24-41c8-b71b-0e701af7583d/protocols/oauth2/profiles/smart-v1/token",
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
}
```

---

**Document Version**: 1.0
**Last Updated**: 2025-11-17
**Maintained By**: Aivida Engineering Team
