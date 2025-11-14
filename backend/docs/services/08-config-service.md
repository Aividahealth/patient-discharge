# Config Service

## Overview

The Config Service provides tenant configuration and branding information. It loads configuration from Firestore with fallback to YAML files.

## Business Logic

### Configuration Hierarchy

1. **Firestore**: Primary source for tenant configuration
2. **YAML Config**: Fallback for tenants not in Firestore
3. **Default Values**: System defaults if neither source available

### Configuration Structure

Includes:
- Tenant identification and metadata
- Branding (logo, colors)
- Feature flags
- Google Cloud configuration
- Cerner configuration
- Pub/Sub configuration

## API Endpoints

### GET /api/config

Get tenant configuration and branding.

**Headers:**
- `X-Tenant-ID: <tenant-id>` (required, can also come from TenantContext)

**Response (200 OK):**
```json
{
  "success": true,
  "tenant": {
    "id": "demo",
    "name": "Demo Hospital",
    "status": "active",
    "type": "demo",
    "branding": {
      "logo": "https://storage.googleapis.com/aivida-assets/logos/demo.png",
      "favicon": "https://storage.googleapis.com/aivida-assets/favicons/demo.ico",
      "primaryColor": "#3b82f6",
      "secondaryColor": "#60a5fa",
      "accentColor": "#1e40af"
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
      "defaultLanguage": "en"
    },
    "google": {
      "dataset": "aivida-dev",
      "fhir_store": "aivida"
    },
    "cerner": {
      "base_url": "https://fhir-ehr-code.cerner.com/r4/...",
      "patients": ["patient-1", "patient-2"]
    }
  }
}
```

**Error Responses:**
- **400 Bad Request**: Missing X-Tenant-ID header
- **404 Not Found**: Tenant configuration not found
- **500 Internal Server Error**: Failed to retrieve configuration

## Business Rules

1. **Tenant ID Required**: Must be provided via header or context
2. **Fallback Logic**: Firestore checked first, then YAML, then defaults
3. **Caching**: Configuration cached per tenant for performance
4. **Validation**: Configuration validated before returning

## Configuration Structure

### Tenant Config
```typescript
{
  id: string;
  name: string;
  status: 'active' | 'inactive';
  type: string;
  branding: {
    logo: string;
    favicon: string;
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
  };
  features: {
    aiGeneration: boolean;
    multiLanguage: boolean;
    supportedLanguages: string[];
    fileUpload: boolean;
    expertPortal: boolean;
    clinicianPortal: boolean;
    adminPortal: boolean;
  };
  config: {
    simplificationEnabled: boolean;
    translationEnabled: boolean;
    defaultLanguage: string;
  };
  google: {
    dataset: string;
    fhir_store: string;
  };
  cerner: {
    base_url: string;
    patients?: string[];
    system_app?: { ... };
    provider_app?: { ... };
  };
  pubsub?: {
    topic_name: string;
    service_account_path: string;
  };
}
```

