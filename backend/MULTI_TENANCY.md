# Multi-Tenancy Support

This application now supports multi-tenancy for both Google FHIR and Cerner integrations.

## Configuration

### Tenant Configuration in `config.yaml`

```yaml
tenants:
  default:
    google:
      dataset: "aivida-dev"
      fhir_store: "aivida"
    cerner:
      base_url: "https://fhir-ehr-code.cerner.com/r4/ec2458f2-1e24-41c8-b71b-0e701af7583d"
      client_id: "70cb05e1-9e4c-4b90-ae8e-4de00c92d9e7"
      client_secret: "bEFd20RyzMktBu_5YTLEzrdzQw2-oSE9"
      token_url: "https://authorization.cerner.com/tenants/ec2458f2-1e24-41c8-b71b-0e701af7583d/hosts/fhir-ehr-code.cerner.com/protocols/oauth2/profiles/smart-v1/token"
      scopes: "system/Patient.read system/Patient.write ..."
  
  tenant2:
    google:
      dataset: "tenant2-dataset"
      fhir_store: "tenant2-fhir-store"
    cerner:
      base_url: "https://fhir-ehr-code.cerner.com/r4/another-tenant-id"
      client_id: "another-client-id"
      client_secret: "another-client-secret"
      token_url: "https://authorization.cerner.com/tenants/another-tenant-id/hosts/fhir-ehr-code.cerner.com/protocols/oauth2/profiles/smart-v1/token"
      scopes: "system/Patient.read system/Patient.write ..."
```

## Usage

### Request Headers

Include the tenant ID in the request header:

```bash
# Using X-Tenant-ID header
curl -H "X-Tenant-ID: tenant2" \
     -H "Content-Type: application/json" \
     http://localhost:3000/google/fhir/Patient

# Using x-tenant-id header (case insensitive)
curl -H "x-tenant-id: tenant2" \
     -H "Content-Type: application/json" \
     http://localhost:3000/google/fhir/Patient

# Using tenant-id header
curl -H "tenant-id: tenant2" \
     -H "Content-Type: application/json" \
     http://localhost:3000/google/fhir/Patient
```

### Default Tenant

If no tenant header is provided, the system will use the `default` tenant configuration.

### Tenant-Specific Configuration

- **Google FHIR**: Each tenant can have its own dataset and FHIR store name, which will be used to construct the tenant-specific Google FHIR API URL
- **Cerner**: Each tenant can have its own Cerner configuration (base URL, client credentials, scopes)

## API Endpoints

All existing endpoints now support multi-tenancy:

### Google FHIR Endpoints
- `POST /google/fhir/:resourceType` - Create resource in tenant-specific FHIR store
- `GET /google/fhir/:resourceType/:id` - Read resource from tenant-specific FHIR store
- `PUT /google/fhir/:resourceType/:id` - Update resource in tenant-specific FHIR store
- `DELETE /google/fhir/:resourceType/:id` - Delete resource from tenant-specific FHIR store
- `GET /google/fhir/:resourceType` - Search resources in tenant-specific FHIR store

### Cerner Endpoints
- `POST /cerner/:resourceType` - Create resource using tenant-specific Cerner config
- `GET /cerner/:resourceType/:id` - Read resource using tenant-specific Cerner config
- `PUT /cerner/:resourceType/:id` - Update resource using tenant-specific Cerner config
- `DELETE /cerner/:resourceType/:id` - Delete resource using tenant-specific Cerner config
- `GET /cerner/:resourceType` - Search resources using tenant-specific Cerner config

## Implementation Details

### Tenant Service
- `TenantService.extractTenantId()` - Extracts tenant ID from request headers
- Supports multiple header formats: `X-Tenant-ID`, `x-tenant-id`, `tenant-id`
- Falls back to `default` if no tenant header is provided

### Configuration Service
- `DevConfigService.getTenantConfig(tenantId)` - Gets tenant-specific configuration
- `DevConfigService.getTenantGoogleConfig(tenantId)` - Gets tenant's Google configuration (dataset + fhir_store)
- `DevConfigService.getTenantGoogleDataset(tenantId)` - Gets tenant's Google dataset name
- `DevConfigService.getTenantGoogleFhirStore(tenantId)` - Gets tenant's Google FHIR store name
- `DevConfigService.getTenantCernerConfig(tenantId)` - Gets tenant's Cerner configuration

### Tenant Decorator
- `@TenantId()` - Parameter decorator for easy access to tenant ID in controllers

## Example Usage

```typescript
// In a controller
@Get('patients')
async getPatients(@TenantId() tenantId: string) {
  // tenantId will be extracted from request headers
  return this.googleService.fhirSearch('Patient', {}, tenantId);
}
```

## Error Handling

- If a tenant ID is provided but not found in configuration, the system will fall back to the `default` tenant
- If no tenant configuration exists at all, appropriate error messages will be returned
- Invalid tenant IDs (containing special characters) will be rejected
