# EHR Integration Architecture Analysis & Recommendations

## Executive Summary

The current EHR integration architecture supports **Cerner only** and uses a tightly-coupled design that makes it difficult to add additional EHR vendors like EPIC. This document provides a comprehensive analysis and actionable recommendations to make the system **vendor-agnostic, scalable, and maintainable**.

---

## Current Architecture Analysis

### 1. **Current Implementation**

```
┌─────────────────────────────────────────┐
│   Controllers (Vendor-Specific)         │
│   - CernerController                    │
│   - CernerAuthController                │
└──────────────┬──────────────────────────┘
               │
               │ Direct Dependency
               ▼
┌─────────────────────────────────────────┐
│   Services (Concrete Implementations)   │
│   - CernerService                       │
│   - CernerAuthService                   │
│   - DischargeExportService              │
└──────────────┬──────────────────────────┘
               │
               │ Direct Dependency
               ▼
┌─────────────────────────────────────────┐
│   External EHR API                      │
│   - Cerner FHIR R4 API                  │
└─────────────────────────────────────────┘
```

**Key Files:**
- `/backend/src/cerner/cerner.service.ts` - Cerner FHIR operations
- `/backend/src/cerner-auth/cerner-auth.service.ts` - Cerner OAuth2
- `/backend/src/discharge-export/services/discharge-export.service.ts` - Export pipeline
- `/backend/src/config/dev-config.service.ts` - Multi-tenant configuration

### 2. **Critical Issues**

#### ❌ **Issue #1: No Abstraction Layer**
- `CernerService` is a concrete implementation with no interface/abstract class
- Business logic directly depends on vendor-specific service
- Adding EPIC would require duplicating controllers, services, and business logic

**Impact:**
```typescript
// Current: Direct dependency on CernerService
@Injectable()
export class DischargeExportService {
  constructor(
    private readonly cernerService: CernerService,  // ❌ Tightly coupled
    private readonly googleService: GoogleService,
  ) {}
}
```

#### ❌ **Issue #2: Vendor-Specific Configuration**
- Configuration structure has hard-coded "cerner" key
- No mechanism to specify which EHR vendor a tenant uses
- Adding new vendors requires modifying the config schema

**Current Config:**
```typescript
type TenantConfig = {
  cerner: {  // ❌ Hard-coded vendor name
    base_url: string;
    system_app: {...};
    provider_app: {...};
  };
  google: {...};
}
```

#### ❌ **Issue #3: Tightly Coupled Export Pipeline**
- `DischargeExportService` has methods like `findCernerDischargeSummary()`
- Assumes all data comes from Cerner
- Cannot route to different EHR vendors based on tenant

**Example:**
```typescript
// Line 36 in discharge-export.service.ts
const cernerDoc = await this.findCernerDischargeSummary(ctx, documentId);
// ❌ Hard-coded to Cerner
```

#### ❌ **Issue #4: No Dynamic Vendor Selection**
- No factory pattern to instantiate correct EHR service
- No vendor registry to track available integrations
- Cannot switch vendors at runtime based on tenant configuration

#### ❌ **Issue #5: Authentication Tightly Coupled**
- Token management is inside `CernerService`
- Each vendor would need to reimplement OAuth2 flows
- No shared authentication abstractions

---

## Proposed Architecture

### **Target Architecture: Adapter + Factory Pattern**

```
┌─────────────────────────────────────────────────────────────┐
│   Controllers (Vendor-Agnostic)                             │
│   - EHRController (generic)                                 │
│   - EHRAuthController (generic)                             │
└──────────────┬──────────────────────────────────────────────┘
               │
               │ Uses Interface
               ▼
┌─────────────────────────────────────────────────────────────┐
│   EHR Abstraction Layer (Interface)                         │
│   - IEHRService (interface)                                 │
│   - IEHRAuthService (interface)                             │
└──────────────┬──────────────────────────────────────────────┘
               │
               │ Factory Pattern
               ▼
┌─────────────────────────────────────────────────────────────┐
│   EHR Factory                                               │
│   - EHRServiceFactory (creates correct adapter)             │
│   - EHRAuthServiceFactory                                   │
└──────────────┬──────────────────────────────────────────────┘
               │
               │ Returns Adapter
               ▼
┌─────────────────────────────────────────────────────────────┐
│   Vendor Adapters (Concrete Implementations)                │
│   - CernerAdapter implements IEHRService                    │
│   - EPICAdapter implements IEHRService                      │
│   - AllscriptsAdapter implements IEHRService                │
└──────────────┬──────────────────────────────────────────────┘
               │
               │ Calls Vendor API
               ▼
┌─────────────────────────────────────────────────────────────┐
│   External EHR APIs                                         │
│   - Cerner FHIR R4 API                                      │
│   - EPIC FHIR R4 API                                        │
│   - Allscripts FHIR R4 API                                  │
└─────────────────────────────────────────────────────────────┘
```

---

## Detailed Recommendations

### **Recommendation #1: Create EHR Service Interface**

**Create:** `/backend/src/ehr/interfaces/ehr-service.interface.ts`

```typescript
import { TenantContext } from '../../tenant/tenant-context';

export enum EHRVendor {
  CERNER = 'cerner',
  EPIC = 'epic',
  ALLSCRIPTS = 'allscripts',
  MEDITECH = 'meditech',
}

export interface IEHRService {
  /**
   * Get vendor name (cerner, epic, etc.)
   */
  getVendor(): EHRVendor;

  /**
   * Authenticate with the EHR system
   */
  authenticate(ctx: TenantContext, authType: AuthType): Promise<boolean>;

  /**
   * Check if authentication token is valid
   */
  isAuthenticated(): boolean;

  /**
   * Create a FHIR resource
   */
  createResource(resourceType: string, resource: any, ctx: TenantContext): Promise<any | null>;

  /**
   * Fetch a FHIR resource by type and ID
   */
  fetchResource(resourceType: string, resourceId: string, ctx: TenantContext): Promise<any | null>;

  /**
   * Update a FHIR resource
   */
  updateResource(resourceType: string, resourceId: string, resource: any, ctx: TenantContext): Promise<any | null>;

  /**
   * Delete a FHIR resource
   */
  deleteResource(resourceType: string, resourceId: string, ctx: TenantContext): Promise<boolean>;

  /**
   * Search FHIR resources with query parameters
   */
  searchResource(resourceType: string, query: Record<string, any>, ctx: TenantContext): Promise<any | null>;

  /**
   * Search discharge summaries for a patient
   */
  searchDischargeSummaries(patientId: string, ctx: TenantContext): Promise<any | null>;

  /**
   * Fetch binary document content (PDF, images, etc.)
   */
  fetchBinaryDocument(binaryId: string, ctx: TenantContext, acceptType?: string): Promise<any | null>;

  /**
   * Get EHR-specific capabilities (optional)
   */
  getCapabilities?(): EHRCapabilities;
}

export interface EHRCapabilities {
  supportsFHIRR4: boolean;
  supportsSMARTonFHIR: boolean;
  supportsPatientAccess: boolean;
  supportsProviderAccess: boolean;
  supportedResourceTypes: string[];
}
```

### **Recommendation #2: Refactor CernerService to Implement Interface**

**Refactor:** `/backend/src/ehr/adapters/cerner.adapter.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { IEHRService, EHRVendor } from '../interfaces/ehr-service.interface';
import { TenantContext } from '../../tenant/tenant-context';
import { AuthType } from '../../cerner-auth/types/auth.types';
import { DevConfigService } from '../../config/dev-config.service';
import { AuditService } from '../../audit/audit.service';
import axios from 'axios';
import * as qs from 'qs';

@Injectable()
export class CernerAdapter implements IEHRService {
  private readonly logger = new Logger(CernerAdapter.name);
  private accessToken: string | null = null;
  private accessTokenExpiryMs: number | null = null;

  constructor(
    private readonly configService: DevConfigService,
    private readonly auditService: AuditService,
  ) {}

  getVendor(): EHRVendor {
    return EHRVendor.CERNER;
  }

  async authenticate(ctx: TenantContext, authType: AuthType = AuthType.SYSTEM): Promise<boolean> {
    // Move existing CernerService.authenticate() logic here
    // ... (same implementation)
  }

  isAuthenticated(): boolean {
    return this.isTokenValid();
  }

  async createResource(resourceType: string, resource: any, ctx: TenantContext): Promise<any | null> {
    // Move existing CernerService.createResource() logic here
    // ... (same implementation)
  }

  async fetchResource(resourceType: string, resourceId: string, ctx: TenantContext): Promise<any | null> {
    // Move existing CernerService.fetchResource() logic here
    // ... (same implementation)
  }

  async updateResource(resourceType: string, resourceId: string, resource: any, ctx: TenantContext): Promise<any | null> {
    // Move existing CernerService.updateResource() logic here
    // ... (same implementation)
  }

  async deleteResource(resourceType: string, resourceId: string, ctx: TenantContext): Promise<boolean> {
    // Move existing CernerService.deleteResource() logic here
    // ... (same implementation)
  }

  async searchResource(resourceType: string, query: Record<string, any>, ctx: TenantContext): Promise<any | null> {
    // Move existing CernerService.searchResource() logic here
    // ... (same implementation)
  }

  async searchDischargeSummaries(patientId: string, ctx: TenantContext): Promise<any | null> {
    // Move existing CernerService.searchDischargeSummaries() logic here
    // ... (same implementation)
  }

  async fetchBinaryDocument(binaryId: string, ctx: TenantContext, acceptType: string = 'application/octet-stream'): Promise<any | null> {
    // Move existing CernerService.fetchBinaryDocument() logic here
    // ... (same implementation)
  }

  // Private helper methods
  private async getBaseUrl(ctx: TenantContext): Promise<string> {
    const ehrConfig = await this.configService.getTenantEHRConfig(ctx.tenantId);
    if (!ehrConfig?.base_url) {
      throw new Error(`Missing EHR base_url for tenant: ${ctx.tenantId}`);
    }
    return ehrConfig.base_url;
  }

  private isTokenValid(): boolean {
    if (!this.accessToken) return false;
    if (!this.accessTokenExpiryMs) return true;
    return Date.now() < this.accessTokenExpiryMs;
  }

  private async ensureAccessToken(ctx: TenantContext, authType: AuthType = AuthType.SYSTEM): Promise<boolean> {
    if (this.isTokenValid()) {
      this.logger.log('Reusing existing access token');
      return true;
    }
    this.logger.log('Access token expired or missing, fetching new token');
    return this.authenticate(ctx, authType);
  }
}
```

### **Recommendation #3: Create EPIC Adapter**

**Create:** `/backend/src/ehr/adapters/epic.adapter.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { IEHRService, EHRVendor } from '../interfaces/ehr-service.interface';
import { TenantContext } from '../../tenant/tenant-context';
import { AuthType } from '../../cerner-auth/types/auth.types';
import { DevConfigService } from '../../config/dev-config.service';
import { AuditService } from '../../audit/audit.service';
import axios from 'axios';

@Injectable()
export class EPICAdapter implements IEHRService {
  private readonly logger = new Logger(EPICAdapter.name);
  private accessToken: string | null = null;
  private accessTokenExpiryMs: number | null = null;

  constructor(
    private readonly configService: DevConfigService,
    private readonly auditService: AuditService,
  ) {}

  getVendor(): EHRVendor {
    return EHRVendor.EPIC;
  }

  async authenticate(ctx: TenantContext, authType: AuthType = AuthType.SYSTEM): Promise<boolean> {
    this.logger.log(`Authenticating with EPIC for tenant: ${ctx.tenantId}`);

    const ehrConfig = await this.configService.getTenantEHRConfig(ctx.tenantId);
    if (!ehrConfig?.system_app) {
      this.logger.error('Missing EPIC system app configuration');
      return false;
    }

    // EPIC uses JWT-based authentication (Backend Client Credentials)
    // https://fhir.epic.com/Documentation?docId=oauth2&section=BackendOAuth2Guide

    try {
      // EPIC requires JWT assertion for backend apps
      const jwt = await this.createJWTAssertion(ehrConfig.system_app);

      const response = await axios.post(
        ehrConfig.system_app.token_url,
        new URLSearchParams({
          grant_type: 'client_credentials',
          client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
          client_assertion: jwt,
          scope: ehrConfig.system_app.scopes,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      );

      this.accessToken = response.data.access_token;
      const expiresInSec: number = response.data.expires_in || 3600;
      const refreshBufferMs = 60 * 1000;
      this.accessTokenExpiryMs = Date.now() + Math.max(0, (expiresInSec * 1000) - refreshBufferMs);

      this.logger.log('EPIC authentication successful');
      return true;
    } catch (error) {
      this.logger.error('EPIC authentication failed', error);
      return false;
    }
  }

  private async createJWTAssertion(config: any): Promise<string> {
    // EPIC requires RS384 JWT signed with private key
    // See: https://fhir.epic.com/Documentation?docId=oauth2&section=BackendOAuth2Guide

    const jwt = require('jsonwebtoken');
    const fs = require('fs');

    // Load private key from config
    const privateKey = fs.readFileSync(config.private_key_path, 'utf8');

    const claims = {
      iss: config.client_id,  // Your app's client ID
      sub: config.client_id,  // Same as iss for backend apps
      aud: config.token_url,  // EPIC's token endpoint
      jti: this.generateJTI(), // Unique JWT ID
      exp: Math.floor(Date.now() / 1000) + 300, // 5 minutes from now
    };

    return jwt.sign(claims, privateKey, {
      algorithm: 'RS384',
      keyid: config.key_id, // Your public key ID registered with EPIC
    });
  }

  private generateJTI(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }

  isAuthenticated(): boolean {
    return this.isTokenValid();
  }

  async createResource(resourceType: string, resource: any, ctx: TenantContext): Promise<any | null> {
    const ok = await this.ensureAccessToken(ctx);
    if (!ok) {
      this.logger.error('Authentication failed. Cannot create resource.');
      return null;
    }

    const baseUrl = await this.getBaseUrl(ctx);
    const url = `${baseUrl}/${resourceType}`;

    try {
      const response = await axios.post(url, resource, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/fhir+json',
          Accept: 'application/fhir+json',
          // EPIC requires Epic-Client-ID header
          'Epic-Client-ID': (await this.configService.getTenantEHRConfig(ctx.tenantId))?.system_app?.client_id,
        },
      });

      this.logger.log(`Created ${resourceType} in EPIC successfully.`);
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to create ${resourceType} in EPIC`, error);
      if (error.response) {
        this.logger.error('Response:', error.response.data);
        return error.response.data;
      }
      throw error;
    }
  }

  async fetchResource(resourceType: string, resourceId: string, ctx: TenantContext): Promise<any | null> {
    const ok = await this.ensureAccessToken(ctx);
    if (!ok) return null;

    const baseUrl = await this.getBaseUrl(ctx);
    const url = `${baseUrl}/${resourceType}/${resourceId}`;

    try {
      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          Accept: 'application/fhir+json',
          'Epic-Client-ID': (await this.configService.getTenantEHRConfig(ctx.tenantId))?.system_app?.client_id,
        },
      });

      this.logger.log(`Fetched ${resourceType}/${resourceId} from EPIC successfully.`);
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to fetch ${resourceType}/${resourceId} from EPIC`, error);
      if (error.response) {
        this.logger.error('Response:', error.response.data);
        return error.response.data;
      }
      return null;
    }
  }

  async updateResource(resourceType: string, resourceId: string, resource: any, ctx: TenantContext): Promise<any | null> {
    const ok = await this.ensureAccessToken(ctx);
    if (!ok) return null;

    const baseUrl = await this.getBaseUrl(ctx);
    const url = `${baseUrl}/${resourceType}/${resourceId}`;

    try {
      const response = await axios.put(url, resource, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/fhir+json',
          Accept: 'application/fhir+json',
          'Epic-Client-ID': (await this.configService.getTenantEHRConfig(ctx.tenantId))?.system_app?.client_id,
        },
      });

      this.logger.log(`Updated ${resourceType}/${resourceId} in EPIC successfully.`);
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to update ${resourceType}/${resourceId} in EPIC`, error);
      if (error.response) {
        this.logger.error('Response:', error.response.data);
        return error.response.data;
      }
      return null;
    }
  }

  async deleteResource(resourceType: string, resourceId: string, ctx: TenantContext): Promise<boolean> {
    // Note: EPIC may not support DELETE for all resource types
    // See EPIC FHIR documentation for supported operations
    this.logger.warn('DELETE operations may not be supported by EPIC for all resource types');
    return false;
  }

  async searchResource(resourceType: string, query: Record<string, any>, ctx: TenantContext): Promise<any | null> {
    const ok = await this.ensureAccessToken(ctx);
    if (!ok) return null;

    const baseUrl = await this.getBaseUrl(ctx);
    const url = `${baseUrl}/${resourceType}`;

    try {
      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          Accept: 'application/fhir+json',
          'Epic-Client-ID': (await this.configService.getTenantEHRConfig(ctx.tenantId))?.system_app?.client_id,
        },
        params: query,
      });

      return response.data;
    } catch (error) {
      this.logger.error(`Failed to search ${resourceType} in EPIC`, error);
      if (error.response) {
        this.logger.error('Response:', error.response.data);
        return error.response.data;
      }
      return null;
    }
  }

  async searchDischargeSummaries(patientId: string, ctx: TenantContext): Promise<any | null> {
    this.logger.log(`Searching discharge summaries for patient ${patientId} in EPIC`);

    // Audit log
    this.auditService.logFhirRequest({
      action: 'search',
      resourceType: 'DocumentReference',
      resourceId: patientId,
      endpoint: '/ehr/discharge-summaries',
      method: 'GET',
      metadata: { vendor: 'epic', loincCode: '18842-5' },
    });

    // EPIC uses DocumentReference for discharge summaries
    const query = {
      patient: patientId,
      type: 'http://loinc.org|18842-5', // Discharge Summary LOINC code
      _count: 100, // EPIC default is 10, max is typically 100
    };

    const result = await this.searchResource('DocumentReference', query, ctx);

    if (result && result.total > 0) {
      this.auditService.logDocumentProcessing(
        result.entry?.[0]?.resource?.id || 'unknown',
        patientId,
        'extracted',
        { totalFound: result.total, vendor: 'epic' },
      );
    }

    return result;
  }

  async fetchBinaryDocument(binaryId: string, ctx: TenantContext, acceptType: string = 'application/pdf'): Promise<any | null> {
    const ok = await this.ensureAccessToken(ctx);
    if (!ok) return null;

    const baseUrl = await this.getBaseUrl(ctx);
    const url = `${baseUrl}/Binary/${binaryId}`;

    try {
      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          Accept: acceptType,
          'Epic-Client-ID': (await this.configService.getTenantEHRConfig(ctx.tenantId))?.system_app?.client_id,
        },
        responseType: 'arraybuffer', // For binary data
      });

      this.logger.log(`Fetched Binary/${binaryId} from EPIC successfully.`);

      const binaryData = response.data;

      return {
        id: binaryId,
        contentType: response.headers['content-type'] || acceptType,
        data: binaryData,
        size: binaryData.length,
      };
    } catch (error) {
      this.logger.error(`Failed to fetch Binary/${binaryId} from EPIC`);
      if (error.response) {
        this.logger.error(`HTTP ${error.response.status}: ${error.response.statusText}`);
        return error.response.data;
      }
      return null;
    }
  }

  // Private helper methods
  private async getBaseUrl(ctx: TenantContext): Promise<string> {
    const ehrConfig = await this.configService.getTenantEHRConfig(ctx.tenantId);
    if (!ehrConfig?.base_url) {
      throw new Error(`Missing EPIC base_url for tenant: ${ctx.tenantId}`);
    }
    return ehrConfig.base_url;
  }

  private isTokenValid(): boolean {
    if (!this.accessToken) return false;
    if (!this.accessTokenExpiryMs) return true;
    return Date.now() < this.accessTokenExpiryMs;
  }

  private async ensureAccessToken(ctx: TenantContext, authType: AuthType = AuthType.SYSTEM): Promise<boolean> {
    if (this.isTokenValid()) {
      this.logger.log('Reusing existing EPIC access token');
      return true;
    }
    this.logger.log('EPIC access token expired or missing, fetching new token');
    return this.authenticate(ctx, authType);
  }
}
```

### **Recommendation #4: Create EHR Service Factory**

**Create:** `/backend/src/ehr/factories/ehr-service.factory.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { IEHRService, EHRVendor } from '../interfaces/ehr-service.interface';
import { CernerAdapter } from '../adapters/cerner.adapter';
import { EPICAdapter } from '../adapters/epic.adapter';
import { DevConfigService } from '../../config/dev-config.service';
import { AuditService } from '../../audit/audit.service';
import { TenantContext } from '../../tenant/tenant-context';

@Injectable()
export class EHRServiceFactory {
  private readonly logger = new Logger(EHRServiceFactory.name);

  // Cache instances per tenant+vendor to reuse tokens
  private serviceCache: Map<string, IEHRService> = new Map();

  constructor(
    private readonly configService: DevConfigService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Get the appropriate EHR service for a tenant
   * Uses factory pattern to instantiate the correct adapter
   */
  async getEHRService(ctx: TenantContext): Promise<IEHRService> {
    // Get tenant's configured EHR vendor
    const tenantConfig = await this.configService.getTenantConfig(ctx.tenantId);
    if (!tenantConfig?.ehr?.vendor) {
      throw new Error(`No EHR vendor configured for tenant: ${ctx.tenantId}`);
    }

    const vendor = tenantConfig.ehr.vendor as EHRVendor;
    const cacheKey = `${ctx.tenantId}:${vendor}`;

    // Return cached instance if available
    if (this.serviceCache.has(cacheKey)) {
      this.logger.log(`Using cached EHR service for ${ctx.tenantId} (${vendor})`);
      return this.serviceCache.get(cacheKey)!;
    }

    // Create new instance based on vendor
    this.logger.log(`Creating new EHR service for ${ctx.tenantId} (${vendor})`);
    const service = this.createEHRService(vendor);

    // Cache the instance
    this.serviceCache.set(cacheKey, service);

    return service;
  }

  /**
   * Create EHR service instance based on vendor
   */
  private createEHRService(vendor: EHRVendor): IEHRService {
    switch (vendor) {
      case EHRVendor.CERNER:
        return new CernerAdapter(this.configService, this.auditService);

      case EHRVendor.EPIC:
        return new EPICAdapter(this.configService, this.auditService);

      // Add more vendors here
      // case EHRVendor.ALLSCRIPTS:
      //   return new AllscriptsAdapter(this.configService, this.auditService);

      default:
        throw new Error(`Unsupported EHR vendor: ${vendor}`);
    }
  }

  /**
   * Clear cache for a specific tenant (useful for config updates)
   */
  clearCache(tenantId: string): void {
    const keysToDelete: string[] = [];
    for (const key of this.serviceCache.keys()) {
      if (key.startsWith(`${tenantId}:`)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => this.serviceCache.delete(key));
    this.logger.log(`Cleared EHR service cache for tenant: ${tenantId}`);
  }

  /**
   * Get all supported vendors
   */
  getSupportedVendors(): EHRVendor[] {
    return Object.values(EHRVendor);
  }
}
```

### **Recommendation #5: Refactor Configuration Structure**

**Update:** `/backend/src/config/dev-config.service.ts`

Add vendor-agnostic configuration structure:

```typescript
export type TenantConfig = {
  google: {
    dataset: string;
    fhir_store: string;
  };

  // NEW: Vendor-agnostic EHR configuration
  ehr: {
    vendor: 'cerner' | 'epic' | 'allscripts' | 'meditech';  // Which EHR vendor to use
    base_url: string;
    patients?: string[];  // Optional patient list for export

    // Vendor-specific configuration (structure varies by vendor)
    system_app?: {
      client_id: string;
      client_secret?: string;      // For Cerner
      private_key_path?: string;   // For EPIC
      key_id?: string;              // For EPIC
      token_url: string;
      scopes: string;
    };

    provider_app?: {
      client_id: string;
      client_secret?: string;
      private_key_path?: string;
      key_id?: string;
      authorization_url: string;
      token_url: string;
      redirect_uri: string;
      scopes: string;
    };
  };

  // DEPRECATED: Keep for backward compatibility
  cerner?: {
    base_url: string;
    patients?: string[];
    client_id?: string;
    client_secret?: string;
    token_url?: string;
    scopes?: string;
    system_app?: {...};
    provider_app?: {...};
  };

  pubsub?: {
    topic_name: string;
    service_account_path: string;
  };
};
```

**Add methods to DevConfigService:**

```typescript
async getTenantEHRVendor(tenantId: string): Promise<string | null> {
  const tenantConfig = await this.getTenantConfig(tenantId);

  // Try new ehr config first
  if (tenantConfig?.ehr?.vendor) {
    return tenantConfig.ehr.vendor;
  }

  // Fall back to legacy cerner config
  if (tenantConfig?.cerner) {
    return 'cerner';
  }

  return null;
}

async getTenantEHRConfig(tenantId: string): Promise<TenantConfig['ehr'] | null> {
  const tenantConfig = await this.getTenantConfig(tenantId);

  // Try new ehr config first
  if (tenantConfig?.ehr) {
    return tenantConfig.ehr;
  }

  // Fall back to legacy cerner config
  if (tenantConfig?.cerner) {
    // Convert legacy cerner config to new ehr config format
    return {
      vendor: 'cerner',
      base_url: tenantConfig.cerner.base_url,
      patients: tenantConfig.cerner.patients,
      system_app: tenantConfig.cerner.system_app || (
        tenantConfig.cerner.client_id ? {
          client_id: tenantConfig.cerner.client_id,
          client_secret: tenantConfig.cerner.client_secret!,
          token_url: tenantConfig.cerner.token_url!,
          scopes: tenantConfig.cerner.scopes!,
        } : undefined
      ),
      provider_app: tenantConfig.cerner.provider_app,
    };
  }

  return null;
}
```

### **Recommendation #6: Refactor DischargeExportService**

**Update:** `/backend/src/discharge-export/services/discharge-export.service.ts`

Make it vendor-agnostic by using the factory:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { GoogleService } from '../../google/google.service';
import { AuditService } from '../../audit/audit.service';
import { DevConfigService } from '../../config/dev-config.service';
import { EHRServiceFactory } from '../../ehr/factories/ehr-service.factory';
import { TenantContext } from '../../tenant/tenant-context';
import { ExportResult } from '../types/discharge-export.types';

@Injectable()
export class DischargeExportService {
  private readonly logger = new Logger(DischargeExportService.name);

  constructor(
    private readonly ehrFactory: EHRServiceFactory,  // ✅ Use factory instead of concrete service
    private readonly googleService: GoogleService,
    private readonly auditService: AuditService,
    private readonly configService: DevConfigService,
  ) {}

  async exportDischargeSummary(
    ctx: TenantContext,
    documentId?: string,
    encounterId?: string,
  ): Promise<ExportResult> {
    const exportTimestamp = new Date().toISOString();
    this.logger.log(`🚀 Starting discharge summary export for ${documentId ? ` (document: ${documentId})` : ''}`);

    // ✅ Get the appropriate EHR service for this tenant
    const ehrService = await this.ehrFactory.getEHRService(ctx);
    const vendor = ehrService.getVendor();
    this.logger.log(`📡 Using EHR vendor: ${vendor}`);

    let ehrPatientId: string | undefined;

    try {
      // Step 1: Find discharge summary metadata in EHR
      this.logger.log(`📋 Step 1: Searching for discharge summary metadata in ${vendor}...`);
      const ehrDoc = await this.findEHRDischargeSummary(ehrService, ctx, documentId);
      if (!ehrDoc) {
        this.logger.warn(`❌ No discharge summary found in ${vendor} for document ${documentId || 'unknown'}`);
        return {
          success: false,
          error: `No discharge summary found in ${vendor}`,
          metadata: { exportTimestamp, vendor },
        };
      }
      this.logger.log(`✅ Found ${vendor} document: ${ehrDoc.id} (encounter: ${ehrDoc.encounterId})`);

      // ... rest of the export logic remains the same but uses ehrService instead of cernerService

      return {
        success: true,
        ehrDocumentId: ehrDoc.id,
        ehrPatientId,
        googlePatientId: patientMapping.googlePatientId,
        encounterId: ehrDoc.encounterId,
        metadata: {
          exportTimestamp,
          vendor,
          duplicateCheck: 'new',
          patientMapping: patientMapping.action,
        },
      };
    } catch (error) {
      this.logger.error(`Export failed for ${vendor}:`, error);
      return {
        success: false,
        error: error.message,
        metadata: { exportTimestamp, vendor },
      };
    }
  }

  // ✅ Renamed from findCernerDischargeSummary to findEHRDischargeSummary
  private async findEHRDischargeSummary(
    ehrService: IEHRService,
    ctx: TenantContext,
    documentId?: string,
  ): Promise<any | null> {
    // Use ehrService (which could be Cerner, EPIC, etc.)
    if (documentId) {
      return await ehrService.fetchResource('DocumentReference', documentId, ctx);
    }

    // Search for discharge summaries
    const result = await ehrService.searchDischargeSummaries(patientId, ctx);
    // ... rest of logic
  }
}
```

### **Recommendation #7: Create Generic EHR Controller**

**Create:** `/backend/src/ehr/ehr.controller.ts`

Replace vendor-specific controllers with a generic one:

```typescript
import { Controller, Get, Post, Put, Delete, Param, Body, Query, Logger } from '@nestjs/common';
import { EHRServiceFactory } from './factories/ehr-service.factory';
import { TenantContext } from '../tenant/tenant-context';
import { TenantContext as TenantContextDecorator } from '../tenant/tenant.decorator';

@Controller('ehr')
export class EHRController {
  private readonly logger = new Logger(EHRController.name);

  constructor(private readonly ehrFactory: EHRServiceFactory) {}

  /**
   * Generic FHIR CRUD: Create resource
   */
  @Post(':resourceType')
  async createResource(
    @Param('resourceType') resourceType: string,
    @Body() resource: any,
    @TenantContextDecorator() ctx: TenantContext,
  ) {
    const ehrService = await this.ehrFactory.getEHRService(ctx);
    const vendor = ehrService.getVendor();
    this.logger.log(`Creating ${resourceType} in ${vendor} for tenant ${ctx.tenantId}`);

    return await ehrService.createResource(resourceType, resource, ctx);
  }

  /**
   * Generic FHIR CRUD: Fetch resource
   */
  @Get(':resourceType/:id')
  async fetchResource(
    @Param('resourceType') resourceType: string,
    @Param('id') id: string,
    @TenantContextDecorator() ctx: TenantContext,
  ) {
    const ehrService = await this.ehrFactory.getEHRService(ctx);
    return await ehrService.fetchResource(resourceType, id, ctx);
  }

  /**
   * Generic FHIR CRUD: Update resource
   */
  @Put(':resourceType/:id')
  async updateResource(
    @Param('resourceType') resourceType: string,
    @Param('id') id: string,
    @Body() resource: any,
    @TenantContextDecorator() ctx: TenantContext,
  ) {
    const ehrService = await this.ehrFactory.getEHRService(ctx);
    return await ehrService.updateResource(resourceType, id, resource, ctx);
  }

  /**
   * Generic FHIR CRUD: Delete resource
   */
  @Delete(':resourceType/:id')
  async deleteResource(
    @Param('resourceType') resourceType: string,
    @Param('id') id: string,
    @TenantContextDecorator() ctx: TenantContext,
  ) {
    const ehrService = await this.ehrFactory.getEHRService(ctx);
    return await ehrService.deleteResource(resourceType, id, ctx);
  }

  /**
   * Generic FHIR search
   */
  @Get(':resourceType')
  async searchResource(
    @Param('resourceType') resourceType: string,
    @Query() query: Record<string, any>,
    @TenantContextDecorator() ctx: TenantContext,
  ) {
    const ehrService = await this.ehrFactory.getEHRService(ctx);
    return await ehrService.searchResource(resourceType, query, ctx);
  }

  /**
   * Search discharge summaries (convenience endpoint)
   */
  @Get('discharge-summaries/:patientId')
  async searchDischargeSummaries(
    @Param('patientId') patientId: string,
    @TenantContextDecorator() ctx: TenantContext,
  ) {
    const ehrService = await this.ehrFactory.getEHRService(ctx);
    return await ehrService.searchDischargeSummaries(patientId, ctx);
  }

  /**
   * Fetch binary document
   */
  @Get('binary/:binaryId')
  async fetchBinaryDocument(
    @Param('binaryId') binaryId: string,
    @Query('contentType') contentType: string,
    @TenantContextDecorator() ctx: TenantContext,
  ) {
    const ehrService = await this.ehrFactory.getEHRService(ctx);
    return await ehrService.fetchBinaryDocument(binaryId, ctx, contentType);
  }
}
```

### **Recommendation #8: Create Vendor Registry**

**Create:** `/backend/src/ehr/vendor-registry.service.ts`

Track available vendors and their capabilities:

```typescript
import { Injectable } from '@nestjs/common';
import { EHRVendor, EHRCapabilities } from './interfaces/ehr-service.interface';

interface VendorMetadata {
  vendor: EHRVendor;
  name: string;
  description: string;
  capabilities: EHRCapabilities;
  documentationUrl: string;
  status: 'production' | 'beta' | 'development';
}

@Injectable()
export class VendorRegistryService {
  private vendors: Map<EHRVendor, VendorMetadata> = new Map();

  constructor() {
    this.registerVendor({
      vendor: EHRVendor.CERNER,
      name: 'Oracle Health (Cerner)',
      description: 'Cerner EHR system with FHIR R4 support',
      capabilities: {
        supportsFHIRR4: true,
        supportsSMARTonFHIR: true,
        supportsPatientAccess: true,
        supportsProviderAccess: true,
        supportedResourceTypes: [
          'Patient', 'Encounter', 'DocumentReference', 'Composition',
          'Binary', 'Observation', 'Condition', 'Medication', 'Procedure',
        ],
      },
      documentationUrl: 'https://fhir.cerner.com/millennium/r4/',
      status: 'production',
    });

    this.registerVendor({
      vendor: EHRVendor.EPIC,
      name: 'Epic Systems',
      description: 'Epic EHR system with FHIR R4 support',
      capabilities: {
        supportsFHIRR4: true,
        supportsSMARTonFHIR: true,
        supportsPatientAccess: true,
        supportsProviderAccess: true,
        supportedResourceTypes: [
          'Patient', 'Encounter', 'DocumentReference', 'Binary',
          'Observation', 'Condition', 'MedicationRequest', 'Procedure',
          'AllergyIntolerance', 'Immunization', 'DiagnosticReport',
        ],
      },
      documentationUrl: 'https://fhir.epic.com/',
      status: 'beta',
    });
  }

  registerVendor(metadata: VendorMetadata): void {
    this.vendors.set(metadata.vendor, metadata);
  }

  getVendor(vendor: EHRVendor): VendorMetadata | undefined {
    return this.vendors.get(vendor);
  }

  getAllVendors(): VendorMetadata[] {
    return Array.from(this.vendors.values());
  }

  getProductionVendors(): VendorMetadata[] {
    return Array.from(this.vendors.values()).filter(v => v.status === 'production');
  }

  isVendorSupported(vendor: EHRVendor): boolean {
    return this.vendors.has(vendor);
  }

  getVendorCapabilities(vendor: EHRVendor): EHRCapabilities | undefined {
    return this.vendors.get(vendor)?.capabilities;
  }
}
```

---

## Migration Plan

### **Phase 1: Foundation (Week 1-2)**
1. ✅ Create EHR interface (`IEHRService`)
2. ✅ Create vendor registry service
3. ✅ Update configuration schema to support vendor selection
4. ✅ Add backward compatibility for existing Cerner configs

### **Phase 2: Refactor Cerner (Week 3)**
1. ✅ Refactor `CernerService` to `CernerAdapter` implementing `IEHRService`
2. ✅ Create `EHRServiceFactory`
3. ✅ Test with existing Cerner integrations
4. ✅ Ensure no breaking changes

### **Phase 3: Add EPIC Support (Week 4-5)**
1. ✅ Implement `EPICAdapter` implementing `IEHRService`
2. ✅ Add EPIC-specific authentication (JWT assertion)
3. ✅ Test with EPIC sandbox environment
4. ✅ Document EPIC configuration requirements

### **Phase 4: Refactor Export Pipeline (Week 6)**
1. ✅ Update `DischargeExportService` to use factory
2. ✅ Make all vendor-specific methods generic
3. ✅ Update tests
4. ✅ Deploy to staging

### **Phase 5: Generic Controller (Week 7)**
1. ✅ Create `EHRController` to replace `CernerController`
2. ✅ Keep `CernerController` for backward compatibility (deprecated)
3. ✅ Update API documentation
4. ✅ Migrate clients to new endpoints

### **Phase 6: Production Rollout (Week 8)**
1. ✅ Deploy to production with feature flag
2. ✅ Monitor performance and errors
3. ✅ Gradual tenant migration
4. ✅ Deprecation notice for old endpoints

---

## Configuration Examples

### **Cerner Configuration (Legacy)**
```yaml
tenants:
  hospital-a:
    cerner:
      base_url: "https://fhir-ehr-code.cerner.com/r4/tenant-123"
      system_app:
        client_id: "cerner-client-id"
        client_secret: "cerner-secret"
        token_url: "https://authorization.cerner.com/tenants/tenant-123/protocols/oauth2/profiles/smart-v1/token"
        scopes: "system/Patient.read system/DocumentReference.read system/Binary.read"
```

### **Cerner Configuration (New Format)**
```yaml
tenants:
  hospital-a:
    ehr:
      vendor: cerner
      base_url: "https://fhir-ehr-code.cerner.com/r4/tenant-123"
      system_app:
        client_id: "cerner-client-id"
        client_secret: "cerner-secret"
        token_url: "https://authorization.cerner.com/tenants/tenant-123/protocols/oauth2/profiles/smart-v1/token"
        scopes: "system/Patient.read system/DocumentReference.read system/Binary.read"
```

### **EPIC Configuration**
```yaml
tenants:
  hospital-b:
    ehr:
      vendor: epic
      base_url: "https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4"
      system_app:
        client_id: "epic-client-id"
        private_key_path: ".settings.prod/epic-private-key.pem"
        key_id: "epic-public-key-id-123"
        token_url: "https://fhir.epic.com/interconnect-fhir-oauth/oauth2/token"
        scopes: "system/Patient.read system/DocumentReference.read"
      provider_app:
        client_id: "epic-provider-client-id"
        private_key_path: ".settings.prod/epic-provider-private-key.pem"
        authorization_url: "https://fhir.epic.com/interconnect-fhir-oauth/oauth2/authorize"
        token_url: "https://fhir.epic.com/interconnect-fhir-oauth/oauth2/token"
        redirect_uri: "https://your-app.com/auth/epic/callback"
        scopes: "launch/patient patient/Patient.read patient/DocumentReference.read"
```

---

## Key Benefits

### **1. Scalability**
- ✅ Add new EHR vendors by implementing `IEHRService`
- ✅ No changes required to business logic or controllers
- ✅ Factory pattern handles instantiation

### **2. Maintainability**
- ✅ Single interface to maintain
- ✅ Vendor-specific logic isolated in adapters
- ✅ Clear separation of concerns

### **3. Testability**
- ✅ Easy to mock `IEHRService` for unit tests
- ✅ Can create test adapters for integration tests
- ✅ Factory can be configured for different test scenarios

### **4. Flexibility**
- ✅ Tenants can use different EHR vendors
- ✅ Can switch vendors without code changes
- ✅ Support hybrid scenarios (some tenants on Cerner, others on EPIC)

### **5. Backward Compatibility**
- ✅ Existing Cerner configurations continue to work
- ✅ Old endpoints remain functional (deprecated)
- ✅ Gradual migration path

---

## EPIC-Specific Implementation Notes

### **Authentication Differences**

| Aspect | Cerner | EPIC |
|--------|--------|------|
| **Backend Auth** | Basic Auth + Client Credentials | JWT Assertion (RS384) |
| **Token Format** | Bearer token | Bearer token |
| **Key Type** | Client secret (shared secret) | Private key (RSA) |
| **Algorithm** | N/A (Basic Auth) | RS384 (JWT signing) |
| **Headers** | `Authorization: Basic` | `Authorization: Bearer` + `Epic-Client-ID` |

### **FHIR API Differences**

| Feature | Cerner | EPIC |
|---------|--------|------|
| **Base URL** | `https://fhir-ehr-code.cerner.com/r4/{tenantId}` | `https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4` |
| **Search Count** | Default: all, Max: unlimited | Default: 10, Max: 100 |
| **DELETE Support** | Yes (most resources) | Limited (read-only for most) |
| **Binary Format** | Base64 or raw | Usually raw (PDF, images) |
| **Patient ID Format** | Numeric string | Alphanumeric |

### **EPIC Setup Requirements**

1. **Register Application** with Epic's App Orchard
2. **Generate RSA Key Pair** (2048-bit or higher)
3. **Upload Public Key** to Epic
4. **Obtain Client ID** and **Key ID**
5. **Configure Redirect URIs** (for provider app)
6. **Request Production Access** (for non-sandbox)

### **EPIC JWT Assertion Example**

```json
{
  "iss": "your-epic-client-id",
  "sub": "your-epic-client-id",
  "aud": "https://fhir.epic.com/interconnect-fhir-oauth/oauth2/token",
  "jti": "unique-jwt-id-12345",
  "exp": 1699999999
}
```

Signed with RS384 using your private key, with `kid` header set to your Key ID.

---

## Testing Strategy

### **Unit Tests**
```typescript
describe('EHRServiceFactory', () => {
  it('should return CernerAdapter for Cerner tenant', async () => {
    const service = await factory.getEHRService(cernerCtx);
    expect(service.getVendor()).toBe(EHRVendor.CERNER);
  });

  it('should return EPICAdapter for EPIC tenant', async () => {
    const service = await factory.getEHRService(epicCtx);
    expect(service.getVendor()).toBe(EHRVendor.EPIC);
  });

  it('should cache service instances', async () => {
    const service1 = await factory.getEHRService(ctx);
    const service2 = await factory.getEHRService(ctx);
    expect(service1).toBe(service2);
  });
});
```

### **Integration Tests**
```typescript
describe('DischargeExportService (Multi-Vendor)', () => {
  it('should export from Cerner to Google FHIR', async () => {
    const result = await exportService.exportDischargeSummary(cernerCtx, 'doc-123');
    expect(result.success).toBe(true);
    expect(result.metadata.vendor).toBe('cerner');
  });

  it('should export from EPIC to Google FHIR', async () => {
    const result = await exportService.exportDischargeSummary(epicCtx, 'doc-456');
    expect(result.success).toBe(true);
    expect(result.metadata.vendor).toBe('epic');
  });
});
```

---

## API Endpoint Changes

### **Old (Vendor-Specific)**
```
GET  /cerner/Patient/12345
POST /cerner/DocumentReference
GET  /cerner/discharge-summaries/12345
```

### **New (Vendor-Agnostic)**
```
GET  /ehr/Patient/12345              # Uses tenant's configured vendor
POST /ehr/DocumentReference          # Uses tenant's configured vendor
GET  /ehr/discharge-summaries/12345  # Uses tenant's configured vendor
```

The system automatically routes to the correct EHR vendor based on tenant configuration.

---

## Next Steps

1. **Review this architecture document** with your team
2. **Prioritize EPIC integration** or other vendors
3. **Begin Phase 1 implementation** (Foundation)
4. **Set up EPIC sandbox account** for testing
5. **Create proof-of-concept** with EPIC adapter
6. **Plan gradual migration** for existing tenants

---

## Questions to Address

1. **Which EHR vendor should we prioritize after Cerner?**
   - EPIC (largest market share in US)
   - Allscripts
   - Meditech
   - Athenahealth

2. **Do we need to support multiple vendors per tenant?**
   - Currently assumes 1 vendor per tenant
   - Could be extended to support multiple sources

3. **How should we handle vendor-specific features?**
   - Use optional methods in interface (`getCapabilities()`)
   - Create vendor-specific extension interfaces

4. **What's the migration timeline?**
   - Immediate? Gradual rollout? Parallel run?

---

## Conclusion

The current architecture is **tightly coupled to Cerner** and requires significant refactoring to support multiple EHR vendors. By implementing the **Adapter + Factory pattern** with a clear **abstraction layer**, we can make the system **vendor-agnostic, scalable, and maintainable**.

The proposed architecture allows you to:
- ✅ Add EPIC (or any other vendor) in days, not months
- ✅ Support multiple tenants with different EHR vendors
- ✅ Maintain backward compatibility with existing Cerner integrations
- ✅ Test and deploy new vendors without affecting existing ones
- ✅ Scale to support dozens of EHR vendors in the future

**Estimated effort:** 6-8 weeks for full implementation (including EPIC adapter)

**ROI:** Every new vendor after EPIC will take 1-2 weeks instead of months
