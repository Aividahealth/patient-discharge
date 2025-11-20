import { Injectable, Logger } from '@nestjs/common';
import { Firestore } from '@google-cloud/firestore';
import * as fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { resolveServiceAccountPath } from '../utils/path.helper';

export type TenantConfig = {
  google: {
    dataset: string;
    fhir_store: string;
  };

  // NEW: Vendor-agnostic EHR configuration
  ehr?: {
    vendor: 'cerner' | 'epic' | 'allscripts' | 'meditech';  // Which EHR vendor to use
    base_url: string;
    patients?: string[];  // Optional patient list for export

    // Vendor-specific configuration (structure varies by vendor)
    system_app?: {
      client_id: string;
      client_secret?: string;      // For Cerner (Basic Auth)
      private_key_path?: string;   // For EPIC (JWT assertion)
      key_id?: string;              // For EPIC (public key ID)
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

  // DEPRECATED: Keep for backward compatibility with existing Cerner configs
  cerner?: {
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
  service_authn_path?: string;
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
        const configPath = this.config.firestore_service_account_path || this.config.service_account_path;
        if (configPath) {
          // Resolve the path - handles both full paths and filenames
          const resolved = resolveServiceAccountPath(configPath);
          // Only use the path if the file actually exists; otherwise fall back to ADC
          if (fs.existsSync(resolved)) {
            serviceAccountPath = resolved;
            this.logger.log(`Using Firestore service account from: ${resolved}`);
          } else {
            this.logger.log(`Firestore service account not found at ${resolved}, using Application Default Credentials`);
          }
        }
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
      const ehrIntegration = data?.ehrIntegration;
      
      // Get Google config from infrastructure or legacy config
      const googleConfigFromInfrastructure = data?.infrastructure?.google;
      const googleConfigFromLegacy = data?.config?.tenantConfig?.google;
      
      // Build base TenantConfig
      const tenantConfig: TenantConfig = {
        google: googleConfigFromInfrastructure || googleConfigFromLegacy || {
          dataset: '',
          fhir_store: '',
        },
        pubsub: data?.config?.tenantConfig?.pubsub,
      };
      
      // Handle EHR Integration
      if (ehrIntegration) {
        const ehrType = ehrIntegration.type;
        
        if (ehrType === 'Manual') {
          // Manual tenant - explicitly set no Cerner config to prevent YAML fallback
          this.logger.debug(`Tenant ${tenantId} is configured as Manual - no EHR integration`);
          tenantConfig.cerner = undefined;
          tenantConfig.ehr = undefined;
        } else if (ehrType === 'Cerner' && ehrIntegration.cerner) {
          // Cerner tenant - include Cerner config
          tenantConfig.cerner = {
            base_url: ehrIntegration.cerner.base_url || '',
            system_app: ehrIntegration.cerner.system_app,
            provider_app: ehrIntegration.cerner.provider_app,
            patients: ehrIntegration.cerner.patients,
          };
          
          // Also populate new 'ehr' structure for vendor-agnostic access
          tenantConfig.ehr = {
            vendor: 'cerner',
            base_url: ehrIntegration.cerner.base_url || '',
            patients: ehrIntegration.cerner.patients,
            system_app: ehrIntegration.cerner.system_app,
            provider_app: ehrIntegration.cerner.provider_app,
          };
          
          this.logger.debug(`Loaded Cerner config from ehrIntegration for tenant: ${tenantId}`);
        } else if (ehrType === 'EPIC' && ehrIntegration.epic) {
          // EPIC tenant - populate new 'ehr' structure
          tenantConfig.ehr = {
            vendor: 'epic',
            base_url: ehrIntegration.epic.base_url || '',
            // EPIC config can be extended here
          };
          this.logger.debug(`Loaded EPIC config from ehrIntegration for tenant: ${tenantId}`);
        } else {
          // Unknown or incomplete EHR integration type
          this.logger.warn(`EHR integration type '${ehrType}' found but config incomplete for tenant: ${tenantId}`);
          tenantConfig.cerner = undefined;
          tenantConfig.ehr = undefined;
        }
      } else {
        // No ehrIntegration found - check legacy config
        const legacyCernerConfig = data?.config?.tenantConfig?.cerner;
        if (legacyCernerConfig) {
          this.logger.debug(`Using legacy Cerner config for tenant: ${tenantId}`);
          tenantConfig.cerner = legacyCernerConfig;
        } else {
          // No EHR config at all - treat as Manual
          this.logger.debug(`No EHR integration found for tenant: ${tenantId} - treating as Manual`);
          tenantConfig.cerner = undefined;
          tenantConfig.ehr = undefined;
        }
      }
      
      this.logger.debug(`Loaded tenant config from Firestore for: ${tenantId} (EHR type: ${ehrIntegration?.type || 'none'})`);

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

    this.logger.debug(`🔍 No Firestore config found for tenant: ${tenantId}, falling back to YAML config ${this.config.tenants ? 'with tenants' : 'without tenants'}`);
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

  async getTenantCernerSystemConfig(tenantId: string): Promise<TenantConfig['cerner'] extends { system_app?: infer T } ? T : any | null> {
    const cernerConfig = await this.getTenantCernerConfig(tenantId);
    if (!cernerConfig) return null;
    
    // Return system_app config if available, otherwise fall back to legacy config
    if (cernerConfig.system_app) {
      return cernerConfig.system_app as any;
    }
    
    // Legacy fallback
    if (cernerConfig.client_id && cernerConfig.client_secret && cernerConfig.token_url && cernerConfig.scopes) {
      return {
        client_id: cernerConfig.client_id,
        client_secret: cernerConfig.client_secret,
        token_url: cernerConfig.token_url,
        scopes: cernerConfig.scopes,
      } as any;
    }
    
    return null;
  }

  async getTenantCernerProviderConfig(tenantId: string): Promise<TenantConfig['cerner'] extends { provider_app?: infer T } ? T : any | null> {
    const cernerConfig = await this.getTenantCernerConfig(tenantId);
    return (cernerConfig?.provider_app as any) || null;
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
    const pathOrFilename = tenantConfig?.pubsub?.service_account_path || this.config.service_account_path;
    if (pathOrFilename) {
      return resolveServiceAccountPath(pathOrFilename);
    }
    // Default fallback
    const env = process.env.NODE_ENV || 'dev';
    return resolveServiceAccountPath('fhir_store_sa.json', env);
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

  /**
   * Get EHR vendor for a tenant
   * Returns vendor from new 'ehr' config, or 'cerner' if using legacy config
   */
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

  /**
   * Get EHR configuration for a tenant
   * Supports both new 'ehr' config and legacy 'cerner' config
   */
  async getTenantEHRConfig(tenantId: string): Promise<TenantConfig['ehr'] | null> {
    const tenantConfig = await this.getTenantConfig(tenantId);

    // Try new ehr config first
    if (tenantConfig?.ehr) {
      return tenantConfig.ehr;
    }

    // Fall back to legacy cerner config and convert to new format
    if (tenantConfig?.cerner) {
      this.logger.debug(`Converting legacy Cerner config to EHR config for tenant: ${tenantId}`);
      return {
        vendor: 'cerner',
        base_url: tenantConfig.cerner.base_url,
        patients: tenantConfig.cerner.patients,
        system_app: tenantConfig.cerner.system_app || (
          tenantConfig.cerner.client_id ? {
            client_id: tenantConfig.cerner.client_id,
            client_secret: tenantConfig.cerner.client_secret,
            token_url: tenantConfig.cerner.token_url!,
            scopes: tenantConfig.cerner.scopes!,
          } : undefined
        ),
        provider_app: tenantConfig.cerner.provider_app,
      };
    }

    return null;
  }

  /**
   * Get EHR system app configuration (for backend/server authentication)
   */
  async getTenantEHRSystemConfig(tenantId: string): Promise<TenantConfig['ehr'] extends { system_app?: infer T } ? T : any | null> {
    const ehrConfig = await this.getTenantEHRConfig(tenantId);
    return (ehrConfig?.system_app as any) || null;
  }

  /**
   * Get EHR provider app configuration (for user authentication)
   */
  async getTenantEHRProviderConfig(tenantId: string): Promise<TenantConfig['ehr'] extends { provider_app?: infer T } ? T : any | null> {
    const ehrConfig = await this.getTenantEHRConfig(tenantId);
    return (ehrConfig?.provider_app as any) || null;
  }

  /**
   * Get list of patients configured for a tenant's EHR
   */
  async getTenantEHRPatients(tenantId: string): Promise<string[]> {
    const ehrConfig = await this.getTenantEHRConfig(tenantId);
    return ehrConfig?.patients || [];
  }
}