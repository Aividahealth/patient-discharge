import { Injectable, Logger } from '@nestjs/common';
import { Firestore } from '@google-cloud/firestore';
import { DevConfigService } from './dev-config.service';
import { resolveServiceAccountPath } from '../utils/path.helper';

export interface TenantConfigResponse {
  id: string;
  name: string;
  status: 'active' | 'inactive' | 'suspended';
  type: string;
  branding: {
    logo: string;
    favicon: string;
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
  };
  features: {
    aiGeneration: boolean;
    multiLanguage: boolean;
    supportedLanguages: string[];
    fileUpload: boolean;
    expertPortal: boolean;
    clinicianPortal: boolean;
    adminPortal: boolean;
  };
  config: {
    simplificationEnabled: boolean;
    translationEnabled: boolean;
    defaultLanguage: string;
  };
}

@Injectable()
export class ConfigService {
  private readonly logger = new Logger(ConfigService.name);
  private firestore: Firestore | null = null;
  private readonly collectionName = 'config';

  constructor(private readonly devConfigService: DevConfigService) {}

  /**
   * Initialize Firestore client lazily
   */
  private getFirestore(): Firestore {
    if (!this.firestore) {
      let serviceAccountPath: string | undefined;

      try {
        const config = this.devConfigService.get();
        const configPath = config.firestore_service_account_path || config.service_account_path;
        if (configPath) {
          // Resolve the path - handles both full paths and filenames
          const resolvedPath = resolveServiceAccountPath(configPath);
          // Check if file exists before using it
          const fs = require('fs');
          if (fs.existsSync(resolvedPath)) {
            serviceAccountPath = resolvedPath;
            this.logger.log(`Using Firestore service account from: ${resolvedPath}`);
          } else {
            this.logger.log(`Service account file not found at ${resolvedPath}, using Application Default Credentials`);
          }
        }
      } catch (error) {
        this.logger.log('Config not available, using Application Default Credentials');
      }

      this.firestore = new Firestore(
        serviceAccountPath ? { keyFilename: serviceAccountPath } : {},
      );

      this.logger.log('Firestore Config Service initialized');
    }
    return this.firestore;
  }

  /**
   * Get tenant configuration from Firestore
   */
  async getTenantConfig(tenantId: string): Promise<TenantConfigResponse | null> {
    try {
      const doc = await this.getFirestore()
        .collection(this.collectionName)
        .doc(tenantId)
        .get();

      if (!doc.exists) {
        this.logger.warn(`Tenant config not found in Firestore: ${tenantId}`);
        return null;
      }

      const data = doc.data();
      if (!data) {
        return null;
      }

      // Return only the public-facing config (exclude sensitive fields from config object)
      const response: TenantConfigResponse = {
        id: data.id || tenantId,
        name: data.name || `${tenantId} Hospital`,
        status: data.status || 'active',
        type: data.type || 'custom',
        branding: data.branding || {
          logo: `https://storage.googleapis.com/aivida-assets/logos/${tenantId}.png`,
          favicon: `https://storage.googleapis.com/aivida-assets/favicons/${tenantId}.ico`,
          primaryColor: '#3b82f6',
          secondaryColor: '#60a5fa',
          accentColor: '#1e40af',
        },
        features: data.features || {
          aiGeneration: true,
          multiLanguage: true,
          supportedLanguages: ['en'],
          fileUpload: true,
          expertPortal: true,
          clinicianPortal: true,
          adminPortal: true,
        },
        config: {
          simplificationEnabled: data.config?.simplificationEnabled ?? true,
          translationEnabled: data.config?.translationEnabled ?? true,
          defaultLanguage: data.config?.defaultLanguage || 'en',
        },
      };

      return response;
    } catch (error) {
      this.logger.error(`Error getting tenant config from Firestore: ${error.message}`);
      return null;
    }
  }

  /**
   * Get tenant configuration with fallback to YAML config
   */
  async getTenantConfigWithFallback(tenantId: string): Promise<TenantConfigResponse | null> {
    // Try Firestore first
    const firestoreConfig = await this.getTenantConfig(tenantId);
    this.logger.debug(`🔍 Firestore config: ${JSON.stringify(firestoreConfig)}`);
    if (firestoreConfig) {
      return firestoreConfig;
    }

    // Fallback to YAML config
    const yamlConfig = await this.devConfigService.getTenantConfig(tenantId);
    if (!yamlConfig) {
      return null;
    }

    // Build response from YAML config
    return {
      id: tenantId,
      name: tenantId === 'default' ? 'Default Hospital' : `${tenantId} Hospital`,
      status: 'active',
      type: tenantId === 'default' ? 'default' : 'custom',
      branding: {
        logo: `https://storage.googleapis.com/aivida-assets/logos/${tenantId}.png`,
        favicon: `https://storage.googleapis.com/aivida-assets/favicons/${tenantId}.ico`,
        primaryColor: '#3b82f6',
        secondaryColor: '#60a5fa',
        accentColor: '#1e40af',
      },
      features: {
        aiGeneration: true,
        multiLanguage: true,
        supportedLanguages: ['en', 'es', 'hi', 'vi', 'fr'],
        fileUpload: true,
        expertPortal: true,
        clinicianPortal: true,
        adminPortal: true,
      },
      config: {
        simplificationEnabled: true,
        translationEnabled: true,
        defaultLanguage: 'en',
      },
    };
  }
}

