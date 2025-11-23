# EHR Module - Vendor-Agnostic EHR Integration

## Overview

The EHR Module provides a **vendor-agnostic abstraction layer** for integrating with multiple Electronic Health Record (EHR) systems including Cerner, EPIC, Allscripts, and more. It uses the **Adapter + Factory Pattern** to dynamically route requests to the appropriate vendor based on tenant configuration.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│   Controllers (Vendor-Agnostic)                             │
│   - EHRController                                           │
└──────────────┬──────────────────────────────────────────────┘
               │
               │ Uses Interface
               ▼
┌─────────────────────────────────────────────────────────────┐
│   EHR Abstraction Layer (Interface)                         │
│   - IEHRService (interface)                                 │
└──────────────┬──────────────────────────────────────────────┘
               │
               │ Factory Pattern
               ▼
┌─────────────────────────────────────────────────────────────┐
│   EHR Factory                                               │
│   - EHRServiceFactory (creates correct adapter)             │
└──────────────┬──────────────────────────────────────────────┘
               │
               │ Returns Adapter
               ▼
┌─────────────────────────────────────────────────────────────┐
│   Vendor Adapters (Concrete Implementations)                │
│   - CernerAdapter implements IEHRService                    │
│   - EPICAdapter implements IEHRService                      │
│   - AllscriptsAdapter implements IEHRService (future)       │
└──────────────┬──────────────────────────────────────────────┘
               │
               │ Calls Vendor API
               ▼
┌─────────────────────────────────────────────────────────────┐
│   External EHR APIs                                         │
│   - Cerner FHIR R4 API                                      │
│   - EPIC FHIR R4 API                                        │
└─────────────────────────────────────────────────────────────┘
```

## Key Components

### 1. **IEHRService Interface** (`interfaces/ehr-service.interface.ts`)

Defines the common contract all EHR adapters must implement:

```typescript
interface IEHRService {
  getVendor(): EHRVendor;
  authenticate(ctx: TenantContext, authType?: AuthType): Promise<boolean>;
  isAuthenticated(): boolean;
  createResource(resourceType: string, resource: any, ctx: TenantContext): Promise<any | null>;
  fetchResource(resourceType: string, resourceId: string, ctx: TenantContext): Promise<any | null>;
  updateResource(resourceType: string, resourceId: string, resource: any, ctx: TenantContext): Promise<any | null>;
  deleteResource(resourceType: string, resourceId: string, ctx: TenantContext): Promise<boolean>;
  searchResource(resourceType: string, query: Record<string, any>, ctx: TenantContext): Promise<any | null>;
  searchDischargeSummaries(patientId: string, ctx: TenantContext): Promise<any | null>;
  fetchBinaryDocument(binaryId: string, ctx: TenantContext, acceptType?: string): Promise<BinaryDocument | null>;
  parseDocumentReference(docRef: any): any;
  getCapabilities?(): EHRCapabilities;
}
```

### 2. **EHRServiceFactory** (`factories/ehr-service.factory.ts`)

Factory service that creates the appropriate EHR adapter based on tenant configuration:

```typescript
// Get EHR service for tenant (automatic vendor selection)
const ehrService = await ehrFactory.getEHRService(ctx);

// The factory:
// 1. Reads tenant configuration to determine vendor
// 2. Creates/retrieves cached adapter instance
// 3. Returns the appropriate adapter (Cerner, EPIC, etc.)
```

### 3. **Vendor Adapters**

#### **CernerAdapter** (`adapters/cerner.adapter.ts`)
- Implements Cerner-specific FHIR R4 operations
- Uses Basic Auth + Client Credentials flow
- Supports SMART on FHIR

#### **EPICAdapter** (`adapters/epic.adapter.ts`)
- Implements EPIC-specific FHIR R4 operations
- Uses JWT assertion (RS384) for authentication
- Requires RSA private key
- Includes Epic-Client-ID header in all requests

### 4. **VendorRegistryService** (`services/vendor-registry.service.ts`)

Tracks available EHR vendors and their capabilities:

```typescript
const metadata = vendorRegistry.getVendor(EHRVendor.EPIC);
// Returns: { name, description, capabilities, documentationUrl, status }
```

### 5. **EHRController** (`controllers/ehr.controller.ts`)

Generic REST API endpoints that work with any vendor:

```
GET    /ehr/vendors                     - List supported vendors
GET    /ehr/vendor                      - Get tenant's configured vendor
POST   /ehr/:resourceType               - Create FHIR resource
GET    /ehr/:resourceType/:id           - Fetch FHIR resource
PUT    /ehr/:resourceType/:id           - Update FHIR resource
DELETE /ehr/:resourceType/:id           - Delete FHIR resource
GET    /ehr/:resourceType               - Search FHIR resources
GET    /ehr/discharge-summaries/:pid   - Search discharge summaries
GET    /ehr/binary/:id                  - Fetch binary document
POST   /ehr/cache/clear                 - Clear cache for tenant
GET    /ehr/cache/stats                 - Get cache statistics
```

## Configuration

### Cerner Configuration (Legacy Format - Still Supported)

```yaml
tenants:
  hospital-a:
    cerner:
      base_url: "https://fhir-ehr-code.cerner.com/r4/tenant-123"
      system_app:
        client_id: "cerner-client-id"
        client_secret: "cerner-secret"
        token_url: "https://authorization.cerner.com/.../token"
        scopes: "system/Patient.read system/DocumentReference.read"
```

### New Vendor-Agnostic Format (Recommended)

```yaml
tenants:
  hospital-a:
    ehr:
      vendor: cerner  # or 'epic', 'allscripts', etc.
      base_url: "https://fhir-ehr-code.cerner.com/r4/tenant-123"
      system_app:
        client_id: "cerner-client-id"
        client_secret: "cerner-secret"  # For Cerner
        token_url: "https://authorization.cerner.com/.../token"
        scopes: "system/Patient.read system/DocumentReference.read"
```

### EPIC Configuration

```yaml
tenants:
  hospital-b:
    ehr:
      vendor: epic
      base_url: "https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4"
      system_app:
        client_id: "epic-client-id"
        private_key_path: ".settings.prod/epic-private-key.pem"  # For EPIC
        key_id: "epic-public-key-id-123"
        token_url: "https://fhir.epic.com/interconnect-fhir-oauth/oauth2/token"
        scopes: "system/Patient.read system/DocumentReference.read"
```

## Usage

### In Controllers/Services

```typescript
import { EHRServiceFactory } from '../ehr/factories/ehr-service.factory';

@Injectable()
export class MyService {
  constructor(private readonly ehrFactory: EHRServiceFactory) {}

  async getPatient(patientId: string, ctx: TenantContext) {
    // Get EHR service for this tenant (automatic vendor selection)
    const ehrService = await this.ehrFactory.getEHRService(ctx);

    // Use the service (works with Cerner, EPIC, or any other vendor)
    const patient = await ehrService.fetchResource('Patient', patientId, ctx);

    return patient;
  }
}
```

### Vendor-Specific Logic (if needed)

```typescript
const ehrService = await this.ehrFactory.getEHRService(ctx);
const vendor = ehrService.getVendor();

if (vendor === EHRVendor.EPIC) {
  // EPIC-specific logic
} else if (vendor === EHRVendor.CERNER) {
  // Cerner-specific logic
}
```

## Adding a New EHR Vendor

### Step 1: Create Adapter

Create `adapters/allscripts.adapter.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { IEHRService, EHRVendor } from '../interfaces/ehr-service.interface';

@Injectable()
export class AllscriptsAdapter implements IEHRService {
  private readonly logger = new Logger(AllscriptsAdapter.name);

  getVendor(): EHRVendor {
    return EHRVendor.ALLSCRIPTS;
  }

  async authenticate(ctx: TenantContext): Promise<boolean> {
    // Implement Allscripts-specific authentication
  }

  async fetchResource(resourceType: string, resourceId: string, ctx: TenantContext): Promise<any | null> {
    // Implement Allscripts-specific FHIR operations
  }

  // ... implement all other IEHRService methods
}
```

### Step 2: Register in Factory

Update `factories/ehr-service.factory.ts`:

```typescript
case EHRVendor.ALLSCRIPTS:
  return new AllscriptsAdapter(this.configService, this.auditService);
```

### Step 3: Register in Module

Update `ehr.module.ts`:

```typescript
providers: [
  EHRServiceFactory,
  VendorRegistryService,
  CernerAdapter,
  EPICAdapter,
  AllscriptsAdapter,  // Add new adapter
],
```

### Step 4: Register Metadata

Update `services/vendor-registry.service.ts`:

```typescript
this.registerVendor({
  vendor: EHRVendor.ALLSCRIPTS,
  name: 'Allscripts',
  description: 'Allscripts EHR system with FHIR R4 support',
  capabilities: { ... },
  documentationUrl: 'https://...',
  status: 'beta',
});
```

## Benefits

### ✅ Scalability
- Add new vendors in days, not months
- No changes to business logic when adding vendors

### ✅ Maintainability
- Single interface to maintain
- Vendor logic isolated in adapters
- Clear separation of concerns

### ✅ Testability
- Easy to mock `IEHRService` for unit tests
- Can create test adapters for integration tests

### ✅ Flexibility
- Each tenant can use different EHR vendors
- Switch vendors without code changes
- Support hybrid scenarios

### ✅ Backward Compatibility
- Existing Cerner configurations continue to work
- Old `CernerService` still available (deprecated)
- Gradual migration path

## Differences Between Vendors

### Authentication

| Vendor | Method | Credentials |
|--------|--------|-------------|
| Cerner | Basic Auth + Client Credentials | `client_id`, `client_secret` |
| EPIC | JWT Assertion (RS384) | `client_id`, `private_key_path`, `key_id` |

### FHIR API Differences

| Feature | Cerner | EPIC |
|---------|--------|------|
| Base URL | `https://fhir-ehr-code.cerner.com/r4/{tid}` | `https://fhir.epic.com/.../FHIR/R4` |
| Search Count | Unlimited | Max: 100 |
| DELETE Support | Yes | No (read-only) |
| UPDATE Support | Yes | Limited |
| Extra Headers | `Authorization: Bearer` | `Authorization: Bearer` + `Epic-Client-ID` |

## Migration Guide

### From CernerService to EHRFactory

**Before:**
```typescript
@Injectable()
export class MyService {
  constructor(private readonly cernerService: CernerService) {}

  async getPatient(patientId: string, ctx: TenantContext) {
    return await this.cernerService.fetchResource('Patient', patientId, ctx);
  }
}
```

**After:**
```typescript
@Injectable()
export class MyService {
  constructor(private readonly ehrFactory: EHRServiceFactory) {}

  async getPatient(patientId: string, ctx: TenantContext) {
    const ehrService = await this.ehrFactory.getEHRService(ctx);
    return await ehrService.fetchResource('Patient', patientId, ctx);
  }
}
```

## Testing

### Unit Tests

```typescript
import { Test } from '@nestjs/testing';
import { EHRServiceFactory } from './ehr-service.factory';

describe('EHRServiceFactory', () => {
  let factory: EHRServiceFactory;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [EHRServiceFactory, ...],
    }).compile();

    factory = module.get<EHRServiceFactory>(EHRServiceFactory);
  });

  it('should return CernerAdapter for Cerner tenant', async () => {
    const service = await factory.getEHRService(cernerCtx);
    expect(service.getVendor()).toBe(EHRVendor.CERNER);
  });

  it('should return EPICAdapter for EPIC tenant', async () => {
    const service = await factory.getEHRService(epicCtx);
    expect(service.getVendor()).toBe(EHRVendor.EPIC);
  });
});
```

## Troubleshooting

### "Unsupported EHR vendor" Error

- Check tenant configuration has `ehr.vendor` set correctly
- Verify vendor is in `EHRVendor` enum
- Ensure adapter is registered in factory

### Authentication Failures

**Cerner:**
- Verify `client_id` and `client_secret` are correct
- Check `scopes` include required permissions
- Ensure `token_url` is correct for tenant

**EPIC:**
- Verify RSA private key file exists at `private_key_path`
- Ensure public key is registered with EPIC
- Check `key_id` matches registered key
- Verify JWT signature algorithm is RS384

### Cache Issues

Clear cache for a tenant:
```bash
POST /ehr/cache/clear
```

View cache statistics:
```bash
GET /ehr/cache/stats
```

## Future Enhancements

- [ ] Add Allscripts adapter
- [ ] Add Meditech adapter
- [ ] Add Athenahealth adapter
- [ ] Support multiple EHR vendors per tenant
- [ ] Add retry logic with exponential backoff
- [ ] Add circuit breaker pattern
- [ ] Add metrics and monitoring
- [ ] Add rate limiting per vendor
- [ ] Add webhook support for real-time updates

## Related Documentation

- [EHR Integration Analysis](../../docs/architecture/EHR_INTEGRATION_ANALYSIS.md)
- [Cerner Documentation](https://fhir.cerner.com/millennium/r4/)
- [EPIC Documentation](https://fhir.epic.com/)
- [FHIR R4 Specification](https://hl7.org/fhir/R4/)

## Support

For questions or issues:
1. Check this README
2. Review `/docs/architecture/EHR_INTEGRATION_ANALYSIS.md`
3. Check vendor-specific documentation
4. Create an issue in the repository
