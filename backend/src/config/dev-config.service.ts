import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';

export type TenantConfig = {
  google: {
    dataset: string;
    fhir_store: string;
  };
  cerner: {
    base_url: string;
    // List of patients to process for document export
    patients?: string[];
    // Legacy single app config (for backward compatibility)
    client_id?: string;
    client_secret?: string;
    token_url?: string;
    scopes?: string;
    // New dual app config
    system_app?: {
      client_id: string;
      client_secret: string;
      token_url: string;
      scopes: string;
    };
    provider_app?: {
      client_id: string;
      client_secret: string;
      authorization_url: string;
      token_url: string;
      redirect_uri: string;
      scopes: string;
    };
  };
  pubsub?: {
    topic_name: string;
    service_account_path: string;
  };
};

export type DevConfig = {
  service_account_path: string;
  fhir_base_url?: string;
  fhirstore_url?: string;
  gcp?: { project_id?: string; location?: string; dataset?: string; fhir_store?: string };
  pubsub?: { topic_name?: string; service_account_path?: string };
  resource_types?: string[];
  tenants?: Record<string, TenantConfig>;
};

@Injectable()
export class DevConfigService {
  private config: DevConfig;
  private readonly logger = new Logger(DevConfigService.name);

  constructor() {
    this.logger.log(`🔧 DevConfigService initializing with NODE_ENV: ${process.env.NODE_ENV || 'undefined'}`);
    // Load config from YAML file synchronously
    this.loadConfigSync();
  }

  private loadConfigSync() {
    try {
      const env = process.env.NODE_ENV || 'dev';
      const p = path.resolve(process.cwd(), `.settings.${env}/config.yaml`);
      this.logger.log(`📁 Loading config from path: ${p}`);
      this.logger.log(`🌍 Environment: ${env}`);
      const raw = fs.readFileSync(p, 'utf8');
      this.config = YAML.parse(raw) as DevConfig;
      this.logger.log('✅ DevConfigService initialized with YAML config');
      this.logger.log(`📋 Tenants config present: ${!!this.config.tenants}`);
      this.logger.log(`🏢 Available tenants: ${Object.keys(this.config.tenants || {}).join(', ')}`);
    } catch (error) {
      this.logger.error('Failed to load config from YAML file:', error.message);
      // Fall back to environment variables if YAML fails
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
        tenants: {
          default: {
            google: {
              dataset: process.env.DEFAULT_GOOGLE_DATASET || 'aivida-dev',
              fhir_store: process.env.DEFAULT_GOOGLE_FHIR_STORE || 'aivida',
            },
            cerner: {
              base_url: process.env.CERNER_BASE_URL || '',
              client_id: process.env.CERNER_CLIENT_ID || '',
              client_secret: process.env.CERNER_CLIENT_SECRET || '',
              token_url: process.env.CERNER_TOKEN_URL || '',
              scopes: process.env.CERNER_SCOPES || '',
            },
          },
        },
      };
      console.log('DevConfigService initialized with environment variables fallback');
      console.log('Tenants config present:', !!this.config.tenants);
    }
  }

  get(): DevConfig {
    return this.config;
  }

  getTenantConfig(tenantId: string): TenantConfig | null {
    if (!this.config.tenants) {
      return null;
    }
    return this.config.tenants[tenantId] || this.config.tenants['default'] || null;
  }

  getTenantGoogleConfig(tenantId: string): TenantConfig['google'] | null {
    const tenantConfig = this.getTenantConfig(tenantId);
    return tenantConfig?.google || null;
  }

  getTenantGoogleDataset(tenantId: string): string | null {
    const googleConfig = this.getTenantGoogleConfig(tenantId);
    return googleConfig?.dataset || null;
  }

  getTenantGoogleFhirStore(tenantId: string): string | null {
    const googleConfig = this.getTenantGoogleConfig(tenantId);
    return googleConfig?.fhir_store || null;
  }

  getTenantCernerConfig(tenantId: string): TenantConfig['cerner'] | null {
    const tenantConfig = this.getTenantConfig(tenantId);
    return tenantConfig?.cerner || null;
  }

  getTenantCernerSystemConfig(tenantId: string): TenantConfig['cerner']['system_app'] | null {
    const cernerConfig = this.getTenantCernerConfig(tenantId);
    if (!cernerConfig) return null;
    
    // Return system_app config if available, otherwise fall back to legacy config
    if (cernerConfig.system_app) {
      return cernerConfig.system_app;
    }
    
    // Legacy fallback
    if (cernerConfig.client_id && cernerConfig.client_secret && cernerConfig.token_url && cernerConfig.scopes) {
      return {
        client_id: cernerConfig.client_id,
        client_secret: cernerConfig.client_secret,
        token_url: cernerConfig.token_url,
        scopes: cernerConfig.scopes,
      };
    }
    
    return null;
  }

  getTenantCernerProviderConfig(tenantId: string): TenantConfig['cerner']['provider_app'] | null {
    const cernerConfig = this.getTenantCernerConfig(tenantId);
    return cernerConfig?.provider_app || null;
  }

  getTenantCernerPatients(tenantId: string): string[] {
    const cernerConfig = this.getTenantCernerConfig(tenantId);
    return cernerConfig?.patients || [];
  }

  getAllTenantIds(): string[] {
    if (!this.config.tenants) {
      return ['default']; // Fallback to default tenant
    }
    return Object.keys(this.config.tenants);
  }

  /**
   * Get Pub/Sub topic name from tenant config
   */
  getTenantPubSubTopicName(tenantId: string): string {
    const tenantConfig = this.getTenantConfig(tenantId);
    return tenantConfig?.pubsub?.topic_name || `discharge-export-events-${tenantId}`;
  }

  /**
   * Get Pub/Sub service account path from tenant config
   */
  getTenantPubSubServiceAccountPath(tenantId: string): string {
    const tenantConfig = this.getTenantConfig(tenantId);
    const env = process.env.NODE_ENV || 'dev';
    const defaultPath = path.resolve(process.cwd(), `.settings.${env}/fhir_store_sa.json`);
    return tenantConfig?.pubsub?.service_account_path || this.config.service_account_path || defaultPath;
  }

  /**
   * Get GCP project ID from config
   */
  getGcpProjectId(): string {
    return this.config.gcp?.project_id || 'simtran-474018';
  }

  isLoaded(): boolean {
    return true; // Always loaded since it's loaded in constructor
  }
}