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
    const raw = await fs.readFile(p, 'utf8');
    this.config = YAML.parse(raw) as DevConfig;
  }

  get(): DevConfig {
    if (!this.config) throw new Error('DevConfigService not initialized. Call load() during bootstrap.');
    return this.config;
  }
}