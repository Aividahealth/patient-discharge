import { Injectable } from '@nestjs/common';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';

export type DevConfig = {
  service_account_path: string;
  fhir_base_url?: string;
  fhirstore_url?: string;
  gcp?: { project_id?: string; location?: string; dataset?: string; fhir_store?: string };
  resource_types?: string[];
  cerner?: {
    base_url?: string;
    client_id?: string;
    client_secret?: string;
    token_url?: string;
    scopes?: string;
  };
};

@Injectable()
export class DevConfigService {
  private config: DevConfig | null = null;

  async load(): Promise<void> {
    const p = path.resolve(process.cwd(), '.settings.dev/config.yaml');

    try {
      // Try to load from file first (for local development)
      const raw = await fs.readFile(p, 'utf8');
      this.config = YAML.parse(raw) as DevConfig;
    } catch (error) {
      // Fall back to environment variables (for production/Cloud Run)
      this.config = {
        service_account_path: process.env.SERVICE_ACCOUNT_PATH || '',
        fhir_base_url: process.env.FHIR_BASE_URL,
        fhirstore_url: process.env.FHIRSTORE_URL,
        gcp: {
          project_id: process.env.GCP_PROJECT_ID,
          location: process.env.GCP_LOCATION,
          dataset: process.env.GCP_DATASET,
          fhir_store: process.env.GCP_FHIR_STORE,
        },
        resource_types: process.env.RESOURCE_TYPES?.split(','),
        cerner: {
          base_url: process.env.CERNER_BASE_URL,
          client_id: process.env.CERNER_CLIENT_ID,
          client_secret: process.env.CERNER_CLIENT_SECRET,
          token_url: process.env.CERNER_TOKEN_URL,
          scopes: process.env.CERNER_SCOPES,
        },
      };
    }
  }

  get(): DevConfig {
    if (!this.config) throw new Error('DevConfigService not initialized. Call load() during bootstrap.');
    return this.config;
  }
}