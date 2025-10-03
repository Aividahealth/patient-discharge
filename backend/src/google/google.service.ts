import { Injectable, BadRequestException } from '@nestjs/common';
import { getGoogleAccessToken } from './auth';
import { AxiosInstance } from 'axios';
import { createFhirAxiosClient } from './fhirClient.js';
import { DevConfigService } from '../config/dev-config.service';

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

  private async getFhirClient(): Promise<AxiosInstance> {
    if (!this.clientPromise) {
      const cfg = this.configService.get();
      const baseUrl = cfg.fhir_base_url;
      if (!baseUrl) {
        throw new Error('fhir_base_url missing in config.yaml');
      }
      this.clientPromise = createFhirAxiosClient(baseUrl);
    }
    return this.clientPromise;
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

  async fhirCreate(resourceType: string, body: unknown) {
    this.assertAllowed(resourceType);
    const client = await this.getFhirClient();
    const { data } = await client.post(`/${resourceType}`, body);
    return data;
  }

  async fhirRead(resourceType: string, id: string) {
    this.assertAllowed(resourceType);
    const client = await this.getFhirClient();
    const { data } = await client.get(`/${resourceType}/${id}`);
    return data;
  }

  async fhirUpdate(resourceType: string, id: string, body: unknown) {
    this.assertAllowed(resourceType);
    const client = await this.getFhirClient();
    const { data } = await client.put(`/${resourceType}/${id}`, body);
    return data;
  }

  async fhirDelete(resourceType: string, id: string) {
    this.assertAllowed(resourceType);
    const client = await this.getFhirClient();
    const { data } = await client.delete(`/${resourceType}/${id}`);
    return data;
  }

  async fhirSearch(resourceType: string, query: Record<string, any>) {
    this.assertAllowed(resourceType);
    const client = await this.getFhirClient();
    const { data } = await client.get(`/${resourceType}`, { params: query });
    return data;
  }
}


