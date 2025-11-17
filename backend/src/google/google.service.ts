import { Injectable, BadRequestException } from '@nestjs/common';
import { getGoogleAccessToken } from './auth';
import { AxiosInstance } from 'axios';
import { createFhirAxiosClient } from './fhirClient.js';
import { DevConfigService } from '../config/dev-config.service';
import { TenantContext } from '../tenant/tenant-context';

@Injectable()
export class GoogleService {
  private clientPromise: Promise<AxiosInstance> | null = null;
  private allowedTypes: Set<string> | null = null;

  constructor(private readonly configService: DevConfigService) {}

  async getAccessToken() {
    const token = await getGoogleAccessToken(['https://www.googleapis.com/auth/cloud-platform']);
    return { access_token: token };
  }

  async impersonate(email: string, scopes?: string[]) {
    // Placeholder for future domain-wide delegation logic
    const token = await getGoogleAccessToken(scopes && scopes.length ? scopes : ['https://www.googleapis.com/auth/cloud-platform']);
    return { subject: email, access_token: token };
  }

  private async getFhirClient(ctx: TenantContext): Promise<AxiosInstance> {
    const cfg = this.configService.get();
    let baseUrl = cfg.fhir_base_url; // Default fallback
    
    // Construct tenant-specific URL
    const tenantDataset = await this.configService.getTenantGoogleDataset(ctx.tenantId);
    const tenantFhirStore = await this.configService.getTenantGoogleFhirStore(ctx.tenantId);
    
    if (cfg.gcp) {
      baseUrl = `https://healthcare.googleapis.com/v1/projects/${cfg.gcp.project_id}/locations/${cfg.gcp.location}/datasets/${tenantDataset}/fhirStores/${tenantFhirStore}/fhir`;
    }
    
    if (!baseUrl) {
      throw new Error('fhir_base_url missing in config.yaml');
    }
    
    // Create new client for each tenant to avoid caching issues
    return createFhirAxiosClient(baseUrl);
  }

  private isAllowedType(resourceType: string): boolean {
    if (!this.allowedTypes) {
      const types = this.configService.get().resource_types;
      if (!types || types.length === 0 || types.includes('*')) {
        this.allowedTypes = new Set(['*']);
      } else {
        this.allowedTypes = new Set(types.map((t) => t.toLowerCase()));
      }
    }
    if (this.allowedTypes.has('*')) return true;
    return this.allowedTypes.has(resourceType.toLowerCase());
  }

  private assertAllowed(resourceType: string) {
    if (!this.isAllowedType(resourceType)) {
      throw new BadRequestException(`Resource type not allowed: ${resourceType}`);
    }
  }

  async fhirCreate(resourceType: string, body: unknown, ctx: TenantContext) {
    this.assertAllowed(resourceType);
    const client = await this.getFhirClient(ctx);
    try {
      const { data } = await client.post(`/${resourceType}`, body);
      return data;
    } catch (error) {
      console.error(`Google FHIR Create Error for ${resourceType} (tenant: ${ctx.tenantId}):`, {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        requestData: JSON.stringify(body)
      });
      throw error;
    }
  }

  async fhirRead(resourceType: string, id: string, ctx: TenantContext) {
    this.assertAllowed(resourceType);
    const client = await this.getFhirClient(ctx);
    const { data } = await client.get(`/${resourceType}/${id}`);
    return data;
  }

  async fhirUpdate(resourceType: string, id: string, body: unknown, ctx: TenantContext) {
    this.assertAllowed(resourceType);
    const client = await this.getFhirClient(ctx);
    try {
      const { data } = await client.put(`/${resourceType}/${id}`, body);
      return data;
    } catch (error) {
      console.error(`Google FHIR Update Error for ${resourceType}/${id} (tenant: ${ctx.tenantId}):`, {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        requestData: JSON.stringify(body)
      });
      throw error;
    }
  }

  async fhirDelete(resourceType: string, id: string, ctx: TenantContext) {
    this.assertAllowed(resourceType);
    const client = await this.getFhirClient(ctx);
    try {
      const { data } = await client.delete(`/${resourceType}/${id}`);
      return data;
    } catch (error: any) {
      const errorDetails = {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message,
      };
      console.error(`Google FHIR Delete Error for ${resourceType}/${id} (tenant: ${ctx.tenantId}):`, errorDetails);
      
      // Re-throw the error with response preserved for controller to handle
      throw error;
    }
  }

  async fhirSearch(resourceType: string, query: Record<string, any>, ctx: TenantContext) {
    this.assertAllowed(resourceType);
    const client = await this.getFhirClient(ctx);
    const { data } = await client.get(`/${resourceType}`, { params: query });
    return data;
  }

  async fhirBundle(bundle: any, ctx: TenantContext) {
    // For bundles, we need to check if all resource types in the bundle are allowed
    if (bundle.entry && Array.isArray(bundle.entry)) {
      for (const entry of bundle.entry) {
        if (entry.resource && entry.resource.resourceType) {
          this.assertAllowed(entry.resource.resourceType);
        }
      }
    }
    
    const client = await this.getFhirClient(ctx);
    try {
      const { data } = await client.post('/', bundle);
      return data;
    } catch (error) {
      console.error(`Google FHIR Bundle Error (tenant: ${ctx.tenantId}):`, {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        bundleType: bundle.type,
        entryCount: bundle.entry?.length || 0,
        requestData: JSON.stringify(bundle, null, 2)
      });
      throw error;
    }
  }
}


