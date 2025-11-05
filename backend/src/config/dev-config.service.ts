import { Injectable, Logger } from '@nestjs/common';
import { Firestore } from '@google-cloud/firestore';
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
  firestore_service_account_path?: string;
  jwt_secret?: string;
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
  private firestore: Firestore | null = null;
  private readonly collectionName = 'config';
  private tenantConfigCache: Map<string, TenantConfig | null> = new Map();

  constructor() {
    this.logger.log(`🔧 DevConfigService initializing with NODE_ENV: ${process.env.NODE_ENV || 'undefined'}`);
    // Load config from YAML file synchronously
    this.loadConfigSync();
  }

  /**
   * Initialize Firestore client lazily
   */
  private getFirestore(): Firestore {
    if (!this.firestore) {
      let serviceAccountPath: string | undefined;

      try {
        serviceAccountPath = this.config.firestore_service_account_path || this.config.service_account_path;
      } catch (error) {
        this.logger.log('Config not available, using Application Default Credentials');
      }

      this.firestore = new Firestore(
        serviceAccountPath ? { keyFilename: serviceAccountPath } : {},
      );

      this.logger.log('Firestore DevConfigService initialized');
    }
    return this.firestore;
  }

  /**
   * Get tenant configuration from Firestore
   */
  private async getTenantConfigFromFirestore(tenantId: string): Promise<TenantConfig | null> {
    try {
      // Check cache first
      if (this.tenantConfigCache.has(tenantId)) {
        return this.tenantConfigCache.get(tenantId) || null;
      }

      const doc = await this.getFirestore()
        .collection(this.collectionName)
        .doc(tenantId)
        .get();

      if (!doc.exists) {
        this.logger.debug(`Tenant config not found in Firestore: ${tenantId}`);
        this.tenantConfigCache.set(tenantId, null);
        return null;
      }

      const data = doc.data();
      if (!data || !data.config) {
        this.tenantConfigCache.set(tenantId, null);
        return null;
      }

      // Extract the TenantConfig structure from Firestore data
      // The config.tenantConfig field contains the actual google, cerner, pubsub structure
      const firestoreConfig = data.config as any;
      
      if (!firestoreConfig.tenantConfig) {
        this.logger.warn(`Tenant config structure not found in Firestore for: ${tenantId}`);
        this.tenantConfigCache.set(tenantId, null);
        return null;
      }
      
      // Build TenantConfig from Firestore data
      const tenantConfig: TenantConfig = {
        google: firestoreConfig.tenantConfig.google || {
          dataset: '',
          fhir_store: '',
        },
        cerner: firestoreConfig.tenantConfig.cerner || {
          base_url: '',
        },
        pubsub: firestoreConfig.tenantConfig.pubsub,
      };

      // Cache the result
      this.tenantConfigCache.set(tenantId, tenantConfig);
      this.logger.log(`✅ Loaded tenant config from Firestore: ${tenantId}`);
      
      return tenantConfig;
    } catch (error) {
      this.logger.warn(`Error getting tenant config from Firestore: ${error.message}`);
      this.tenantConfigCache.set(tenantId, null);
      return null;
    }
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
        firestore_service_account_path: process.env.FIRESTORE_SERVICE_ACCOUNT_PATH,
        jwt_secret: process.env.JWT_SECRET,
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

  /**
   * Get tenant configuration - checks Firestore first, then YAML config
   * Note: This method is async now to support Firestore lookups
   */
  async getTenantConfig(tenantId: string): Promise<TenantConfig | null> {
    // Try Firestore first
    const firestoreConfig = await this.getTenantConfigFromFirestore(tenantId);
    if (firestoreConfig) {
      return firestoreConfig;
    }

    // Fallback to YAML config
    if (!this.config.tenants) {
      return null;
    }
    
    const yamlConfig = this.config.tenants[tenantId] || this.config.tenants['default'] || null;
    if (yamlConfig) {
      this.logger.debug(`✅ Loaded tenant config from YAML: ${tenantId}`);
    }
    
    return yamlConfig;
  }

  /**
   * Synchronous version for backward compatibility (YAML only)
   * Use this when you need synchronous access and can't use async
   */
  getTenantConfigSync(tenantId: string): TenantConfig | null {
    if (!this.config.tenants) {
      return null;
    }
    return this.config.tenants[tenantId] || this.config.tenants['default'] || null;
  }

  async getTenantGoogleConfig(tenantId: string): Promise<TenantConfig['google'] | null> {
    const tenantConfig = await this.getTenantConfig(tenantId);
    return tenantConfig?.google || null;
  }

  async getTenantGoogleDataset(tenantId: string): Promise<string | null> {
    const googleConfig = await this.getTenantGoogleConfig(tenantId);
    return googleConfig?.dataset || null;
  }

  async getTenantGoogleFhirStore(tenantId: string): Promise<string | null> {
    const googleConfig = await this.getTenantGoogleConfig(tenantId);
    return googleConfig?.fhir_store || null;
  }

  async getTenantCernerConfig(tenantId: string): Promise<TenantConfig['cerner'] | null> {
    const tenantConfig = await this.getTenantConfig(tenantId);
    return tenantConfig?.cerner || null;
  }

  async getTenantCernerSystemConfig(tenantId: string): Promise<TenantConfig['cerner']['system_app'] | null> {
    const cernerConfig = await this.getTenantCernerConfig(tenantId);
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

  async getTenantCernerProviderConfig(tenantId: string): Promise<TenantConfig['cerner']['provider_app'] | null> {
    const cernerConfig = await this.getTenantCernerConfig(tenantId);
    return cernerConfig?.provider_app || null;
  }

  async getTenantCernerPatients(tenantId: string): Promise<string[]> {
    const cernerConfig = await this.getTenantCernerConfig(tenantId);
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
  async getTenantPubSubTopicName(tenantId: string): Promise<string> {
    const tenantConfig = await this.getTenantConfig(tenantId);
    return tenantConfig?.pubsub?.topic_name || `discharge-export-events-${tenantId}`;
  }

  /**
   * Get Pub/Sub service account path from tenant config
   */
  async getTenantPubSubServiceAccountPath(tenantId: string): Promise<string> {
    const tenantConfig = await this.getTenantConfig(tenantId);
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