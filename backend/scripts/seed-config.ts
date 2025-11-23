import { Firestore } from '@google-cloud/firestore';
import * as fs from 'fs';
import * as path from 'path';
import * as YAML from 'yaml';
import { resolveServiceAccountPath } from '../src/utils/path.helper';

interface TenantConfigSeed {
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
    service_account_path?: string;
    firestore_service_account_path?: string;
    jwt_secret?: string;
    fhir_base_url?: string;
    fhirstore_url?: string;
    gcp?: {
      project_id?: string;
      location?: string;
      dataset?: string;
      fhir_store?: string;
    };
    tenantConfig?: {
      google?: any;
      cerner?: any;
      pubsub?: any;
    };
  };
}

/**
 * Load service account path from config
 */
function getServiceAccountPath(): string | undefined {
  try {
    const env = process.env.NODE_ENV || 'dev';
    const configPath = path.resolve(process.cwd(), `.settings.${env}/config.yaml`);
    
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, 'utf8');
      const config = YAML.parse(raw);
      const pathOrFilename = config.firestore_service_account_path || config.service_account_path;
      if (pathOrFilename) {
        // Use the path helper to resolve the path dynamically (handles Docker vs local)
        return resolveServiceAccountPath(pathOrFilename);
      }
    }
  } catch (error) {
    console.log('Could not load config, using environment variable or default');
  }
  
  // Fallback to environment variable if provided
  const envPath = process.env.FIRESTORE_SERVICE_ACCOUNT_PATH || process.env.SERVICE_ACCOUNT_PATH;
  if (envPath) {
    return resolveServiceAccountPath(envPath);
  }
  
  return undefined;
}

/**
 * Initialize Firestore client
 */
function getFirestore(): Firestore {
  const serviceAccountPath = getServiceAccountPath();
  
  if (serviceAccountPath && fs.existsSync(serviceAccountPath)) {
    console.log(`📁 Using service account: ${serviceAccountPath}`);
    return new Firestore({ keyFilename: serviceAccountPath });
  } else {
    console.log('📁 Using Application Default Credentials');
    return new Firestore();
  }
}

/**
 * Load config from YAML and create tenant configs
 */
function loadTenantConfigsFromYAML(): TenantConfigSeed[] {
  try {
    const env = process.env.NODE_ENV || 'dev';
    const configPath = path.resolve(process.cwd(), `.settings.${env}/config.yaml`);
    
    if (!fs.existsSync(configPath)) {
      console.error(`❌ Config file not found: ${configPath}`);
      return [];
    }

    const raw = fs.readFileSync(configPath, 'utf8');
    const yamlConfig = YAML.parse(raw);
    
    const tenantConfigs: TenantConfigSeed[] = [];
    
    // Process each tenant from config.yaml
    if (yamlConfig.tenants) {
      for (const [tenantId, tenantData] of Object.entries(yamlConfig.tenants)) {
        const tenant = tenantData as any;
        
        const tenantConfig: TenantConfigSeed = {
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
            supportedLanguages: ['en', 'es', 'hi', 'vi', 'fr', 'ps'],
            fileUpload: true,
            expertPortal: true,
            clinicianPortal: true,
            adminPortal: true,
          },
          config: {
            simplificationEnabled: true,
            translationEnabled: true,
            defaultLanguage: 'en',
            service_account_path: yamlConfig.service_account_path,
            firestore_service_account_path: yamlConfig.firestore_service_account_path,
            jwt_secret: yamlConfig.jwt_secret,
            fhir_base_url: yamlConfig.fhir_base_url,
            fhirstore_url: yamlConfig.fhirstore_url,
            gcp: yamlConfig.gcp,
            // Store the actual tenant config structure (google, cerner, pubsub)
            tenantConfig: {
              google: tenant.google,
              cerner: tenant.cerner,
              pubsub: tenant.pubsub,
            },
          },
        };
        
        tenantConfigs.push(tenantConfig);
      }
    }
    
    return tenantConfigs;
  } catch (error) {
    console.error(`❌ Error loading config from YAML: ${error.message}`);
    return [];
  }
}

/**
 * Create or update tenant config in Firestore
 */
async function upsertTenantConfig(firestore: Firestore, tenantConfig: TenantConfigSeed): Promise<void> {
  try {
    const docRef = firestore.collection('config').doc(tenantConfig.id);
    
    const configData = {
      ...tenantConfig,
      updatedAt: new Date(),
    };
    
    // Check if config exists
    const existingDoc = await docRef.get();
    
    if (existingDoc.exists) {
      // Update existing config
      await docRef.update(configData);
      console.log(`♻️  Updated tenant config: ${tenantConfig.id}`);
    } else {
      // Create new config
      await docRef.set({
        ...configData,
        createdAt: new Date(),
      });
      console.log(`✅ Created tenant config: ${tenantConfig.id}`);
    }
  } catch (error) {
    console.error(`❌ Error upserting tenant config ${tenantConfig.id}:`, error.message);
    throw error;
  }
}

/**
 * Main function to seed tenant configs
 */
async function seedConfigs() {
  console.log('🌱 Starting tenant config seeding process...\n');

  try {
    const firestore = getFirestore();
    console.log('✅ Firestore client initialized\n');

    const tenantConfigs = loadTenantConfigsFromYAML();
    
    if (tenantConfigs.length === 0) {
      console.error('❌ No tenant configs found in config.yaml');
      process.exit(1);
    }

    console.log(`📋 Found ${tenantConfigs.length} tenant(s) to seed\n`);

    for (const tenantConfig of tenantConfigs) {
      await upsertTenantConfig(firestore, tenantConfig);
    }

    console.log('\n✅ Tenant config seeding completed successfully!');
    console.log('\n📋 Seeded tenants:');
    tenantConfigs.forEach((config) => {
      console.log(`   - ${config.id}: ${config.name}`);
    });
  } catch (error) {
    console.error('\n❌ Tenant config seeding failed:', error);
    process.exit(1);
  }
}

// Run the seed script
seedConfigs();

