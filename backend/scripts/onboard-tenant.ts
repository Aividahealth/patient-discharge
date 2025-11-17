#!/usr/bin/env ts-node

/**
 * Tenant Onboarding Script
 *
 * This script automates the process of onboarding a new tenant to the
 * Aivida Patient Discharge Platform.
 *
 * Usage:
 *   npm run onboard-tenant -- --id="tenant-id" --name="Tenant Name" --method="manual|cerner"
 *
 * Options:
 *   --id                  Tenant unique identifier (required)
 *   --name                Tenant display name (required)
 *   --type                Tenant type: demo|production|custom (default: production)
 *   --method              Integration method: manual|cerner|epic (required)
 *   --config-file         Path to JSON config file for advanced settings (optional)
 *   --admin-username      Admin username (required)
 *   --admin-name          Admin full name (required)
 *   --admin-password      Admin password (required, min 8 chars)
 *   --logo-url            Logo URL (optional)
 *   --favicon-url         Favicon URL (optional)
 *   --primary-color       Primary brand color hex (default: #3b82f6)
 *   --secondary-color     Secondary brand color hex (default: #60a5fa)
 *   --accent-color        Accent brand color hex (default: #1e40af)
 *   --languages           Comma-separated language codes (default: en,es)
 *   --dry-run             Preview changes without applying them
 *   --skip-validation     Skip Cerner/FHIR validation (not recommended)
 */

import * as admin from 'firebase-admin';
import * as bcrypt from 'bcryptjs';
import * as fs from 'fs';
import * as path from 'path';

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

// Helper functions for colored output
const log = {
  info: (msg: string) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg: string) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  warning: (msg: string) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  error: (msg: string) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  section: (msg: string) => console.log(`\n${colors.bright}${colors.cyan}${msg}${colors.reset}\n`),
};

// Interfaces
interface TenantConfig {
  id: string;
  name: string;
  status: 'active' | 'inactive' | 'suspended';
  type: 'demo' | 'production' | 'custom';
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
    integration: {
      method: 'manual' | 'cerner' | 'epic';
    };
    tenantConfig?: {
      google?: {
        dataset: string;
        fhir_store: string;
      };
      cerner?: {
        base_url: string;
        patients: string[];
        system_app: {
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
  };
  createdAt: Date;
  updatedAt: Date;
}

interface AdminUser {
  tenantId: string;
  username: string;
  passwordHash: string;
  name: string;
  role: 'admin';
  createdAt: Date;
  updatedAt: Date;
}

interface OnboardingOptions {
  id: string;
  name: string;
  type: 'demo' | 'production' | 'custom';
  method: 'manual' | 'cerner' | 'epic';
  configFile?: string;
  adminUsername: string;
  adminName: string;
  adminPassword: string;
  logoUrl?: string;
  faviconUrl?: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  languages: string[];
  dryRun: boolean;
  skipValidation: boolean;
}

// Parse command-line arguments
function parseArgs(): OnboardingOptions | null {
  const args = process.argv.slice(2);
  const options: any = {
    type: 'production',
    primaryColor: '#3b82f6',
    secondaryColor: '#60a5fa',
    accentColor: '#1e40af',
    languages: ['en', 'es'],
    dryRun: false,
    skipValidation: false,
  };

  for (const arg of args) {
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');

      if (key === 'languages' && value) {
        options[key] = value.split(',').map(l => l.trim());
      } else if (key === 'dry-run') {
        options.dryRun = true;
      } else if (key === 'skip-validation') {
        options.skipValidation = true;
      } else if (value) {
        options[key.replace(/-/g, '_')] = value;
      }
    }
  }

  // Convert snake_case to camelCase
  const camelCaseOptions: any = {};
  for (const [key, value] of Object.entries(options)) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    camelCaseOptions[camelKey] = value;
  }

  // Validate required fields
  const required = ['id', 'name', 'method', 'adminUsername', 'adminName', 'adminPassword'];
  const missing = required.filter(field => !camelCaseOptions[field]);

  if (missing.length > 0) {
    log.error(`Missing required arguments: ${missing.join(', ')}`);
    log.info('Usage: npm run onboard-tenant -- --id="tenant-id" --name="Tenant Name" --method="manual|cerner" --admin-username="admin" --admin-name="Admin User" --admin-password="password"');
    return null;
  }

  // Validate method
  if (!['manual', 'cerner', 'epic'].includes(camelCaseOptions.method)) {
    log.error('Invalid integration method. Must be: manual, cerner, or epic');
    return null;
  }

  // Validate password strength
  if (camelCaseOptions.adminPassword.length < 8) {
    log.error('Admin password must be at least 8 characters');
    return null;
  }

  // Warn about Epic
  if (camelCaseOptions.method === 'epic') {
    log.warning('Epic integration is not yet implemented. Use manual or cerner for now.');
    return null;
  }

  return camelCaseOptions as OnboardingOptions;
}

// Initialize Firebase Admin
async function initializeFirebase() {
  try {
    // Check if already initialized
    if (admin.apps.length > 0) {
      return admin.firestore();
    }

    // Try to load service account from environment or default paths
    let serviceAccount: any;
    const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
      || path.join(__dirname, '../.settings.dev/service-account.json')
      || path.join(__dirname, './service-account.json');

    if (fs.existsSync(serviceAccountPath)) {
      serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    } else {
      // Use default credentials (works in Cloud environments)
      admin.initializeApp();
    }

    return admin.firestore();
  } catch (error) {
    log.error(`Failed to initialize Firebase: ${error}`);
    throw error;
  }
}

// Validate Cerner configuration
async function validateCernerConfig(config: any): Promise<boolean> {
  log.info('Validating Cerner configuration...');

  const required = [
    'base_url',
    'system_app.client_id',
    'system_app.client_secret',
    'system_app.token_url',
    'system_app.scopes',
  ];

  for (const field of required) {
    const keys = field.split('.');
    let value = config.cerner;

    for (const key of keys) {
      value = value?.[key];
    }

    if (!value) {
      log.error(`Missing Cerner configuration field: ${field}`);
      return false;
    }
  }

  // Validate URL formats
  try {
    new URL(config.cerner.base_url);
    new URL(config.cerner.system_app.token_url);

    if (config.cerner.provider_app) {
      new URL(config.cerner.provider_app.authorization_url);
      new URL(config.cerner.provider_app.token_url);
    }
  } catch (error) {
    log.error(`Invalid URL in Cerner configuration: ${error}`);
    return false;
  }

  log.success('Cerner configuration is valid');
  return true;
}

// Test Cerner connectivity
async function testCernerConnection(config: any): Promise<boolean> {
  log.info('Testing Cerner connectivity...');

  try {
    const tokenUrl = config.cerner.system_app.token_url;
    const clientId = config.cerner.system_app.client_id;
    const clientSecret = config.cerner.system_app.client_secret;

    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        scope: config.cerner.system_app.scopes,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      log.error(`Cerner authentication failed: ${response.status} ${errorText}`);
      return false;
    }

    const data = await response.json();

    if (data.access_token) {
      log.success('Successfully authenticated with Cerner');
      return true;
    } else {
      log.error('No access token received from Cerner');
      return false;
    }
  } catch (error) {
    log.error(`Cerner connection test failed: ${error}`);
    return false;
  }
}

// Build tenant configuration
function buildTenantConfig(options: OnboardingOptions, advancedConfig?: any): TenantConfig {
  const baseConfig: TenantConfig = {
    id: options.id,
    name: options.name,
    status: 'active',
    type: options.type,
    branding: {
      logo: options.logoUrl || `https://storage.googleapis.com/aivida-branding/${options.id}/logo.png`,
      favicon: options.faviconUrl || `https://storage.googleapis.com/aivida-branding/${options.id}/favicon.ico`,
      primaryColor: options.primaryColor,
      secondaryColor: options.secondaryColor,
      accentColor: options.accentColor,
    },
    features: {
      aiGeneration: true,
      multiLanguage: options.languages.length > 1,
      supportedLanguages: options.languages,
      fileUpload: options.method === 'manual',
      expertPortal: options.type === 'production',
      clinicianPortal: true,
      adminPortal: true,
    },
    config: {
      simplificationEnabled: true,
      translationEnabled: options.languages.length > 1,
      defaultLanguage: options.languages[0] || 'en',
      integration: {
        method: options.method,
      },
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Merge advanced config if provided
  if (advancedConfig) {
    baseConfig.config.tenantConfig = advancedConfig.tenantConfig || {};
  } else if (options.method === 'cerner') {
    // Add placeholder for Cerner config
    baseConfig.config.tenantConfig = {
      google: {
        dataset: 'aivida-production',
        fhir_store: `${options.id}-fhir`,
      },
      cerner: {
        base_url: 'https://fhir-ehr.cerner.com/r4/TENANT-ID-HERE',
        patients: [],
        system_app: {
          client_id: 'REPLACE-WITH-ACTUAL-CLIENT-ID',
          client_secret: 'REPLACE-WITH-ACTUAL-CLIENT-SECRET',
          token_url: 'https://authorization.cerner.com/tenants/TENANT-ID/protocols/oauth2/profiles/smart-v1/token',
          scopes: 'system/*.read system/*.write',
        },
      },
      pubsub: {
        topic_name: `discharge-processing-${options.id}`,
        service_account_path: `/secrets/${options.id}-sa-key.json`,
      },
    };
  }

  return baseConfig;
}

// Build admin user
async function buildAdminUser(options: OnboardingOptions): Promise<AdminUser> {
  const passwordHash = await bcrypt.hash(options.adminPassword, 10);

  return {
    tenantId: options.id,
    username: options.adminUsername,
    passwordHash,
    name: options.adminName,
    role: 'admin',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

// Create tenant in Firestore
async function createTenant(db: admin.firestore.Firestore, config: TenantConfig, dryRun: boolean): Promise<boolean> {
  try {
    // Check if tenant already exists
    const existingTenant = await db.collection('config').doc(config.id).get();

    if (existingTenant.exists) {
      log.error(`Tenant with ID '${config.id}' already exists`);
      return false;
    }

    if (dryRun) {
      log.warning('[DRY RUN] Would create tenant configuration');
      console.log(JSON.stringify(config, null, 2));
      return true;
    }

    await db.collection('config').doc(config.id).set(config);
    log.success(`Created tenant configuration: ${config.id}`);
    return true;
  } catch (error) {
    log.error(`Failed to create tenant: ${error}`);
    return false;
  }
}

// Create admin user in Firestore
async function createAdminUser(db: admin.firestore.Firestore, user: AdminUser, dryRun: boolean): Promise<boolean> {
  try {
    // Check if username already exists for this tenant
    const existingUsers = await db.collection('users')
      .where('tenantId', '==', user.tenantId)
      .where('username', '==', user.username)
      .get();

    if (!existingUsers.empty) {
      log.error(`User '${user.username}' already exists for tenant '${user.tenantId}'`);
      return false;
    }

    if (dryRun) {
      log.warning('[DRY RUN] Would create admin user');
      console.log(JSON.stringify({ ...user, passwordHash: '[REDACTED]' }, null, 2));
      return true;
    }

    await db.collection('users').add(user);
    log.success(`Created admin user: ${user.username}`);
    return true;
  } catch (error) {
    log.error(`Failed to create admin user: ${error}`);
    return false;
  }
}

// Print onboarding summary
function printSummary(options: OnboardingOptions, config: TenantConfig) {
  log.section('='.repeat(60));
  log.section('TENANT ONBOARDING SUMMARY');
  log.section('='.repeat(60));

  console.log(`${colors.bright}Tenant Information:${colors.reset}`);
  console.log(`  ID:           ${config.id}`);
  console.log(`  Name:         ${config.name}`);
  console.log(`  Type:         ${config.type}`);
  console.log(`  Status:       ${config.status}`);
  console.log(`  Method:       ${config.config.integration.method}`);

  console.log(`\n${colors.bright}Features:${colors.reset}`);
  console.log(`  AI Generation:      ${config.features.aiGeneration ? '✓' : '✗'}`);
  console.log(`  Multi-language:     ${config.features.multiLanguage ? '✓' : '✗'}`);
  console.log(`  Languages:          ${config.features.supportedLanguages.join(', ')}`);
  console.log(`  File Upload:        ${config.features.fileUpload ? '✓' : '✗'}`);
  console.log(`  Expert Portal:      ${config.features.expertPortal ? '✓' : '✗'}`);
  console.log(`  Clinician Portal:   ${config.features.clinicianPortal ? '✓' : '✗'}`);
  console.log(`  Admin Portal:       ${config.features.adminPortal ? '✓' : '✗'}`);

  console.log(`\n${colors.bright}Admin User:${colors.reset}`);
  console.log(`  Username:     ${options.adminUsername}`);
  console.log(`  Name:         ${options.adminName}`);

  console.log(`\n${colors.bright}Access URLs:${colors.reset}`);
  console.log(`  Admin Portal:       https://aividia.com/${config.id}/admin`);
  console.log(`  Clinician Portal:   https://aividia.com/${config.id}/clinician`);
  console.log(`  Patient Portal:     https://aividia.com/${config.id}/patient`);
  if (config.features.expertPortal) {
    console.log(`  Expert Portal:      https://aividia.com/${config.id}/expert`);
  }

  console.log(`\n${colors.bright}API Endpoint:${colors.reset}`);
  console.log(`  Base URL:     https://api.aividia.com`);
  console.log(`  Headers:      X-Tenant-ID: ${config.id}`);

  if (config.config.integration.method === 'cerner' && config.config.tenantConfig?.cerner) {
    console.log(`\n${colors.bright}Cerner Integration:${colors.reset}`);
    const cerner = config.config.tenantConfig.cerner;

    // Check if using placeholder values
    if (cerner.system_app.client_id.includes('REPLACE')) {
      log.warning('Cerner credentials are PLACEHOLDERS - update them in Firestore!');
      console.log(`  Status:       ${colors.yellow}⚠ REQUIRES CONFIGURATION${colors.reset}`);
      console.log(`\n${colors.yellow}Next Steps:${colors.reset}`);
      console.log(`  1. Obtain Cerner credentials from your Cerner representative`);
      console.log(`  2. Update tenant config in Firestore (config/${config.id})`);
      console.log(`  3. Run: npm run test-cerner-integration -- --tenant="${config.id}"`);
    } else {
      console.log(`  Status:       ${colors.green}✓ CONFIGURED${colors.reset}`);
      console.log(`  Base URL:     ${cerner.base_url}`);
      console.log(`  FHIR Store:   ${config.config.tenantConfig.google?.dataset}/${config.config.tenantConfig.google?.fhir_store}`);
    }
  }

  console.log(`\n${colors.bright}Next Steps:${colors.reset}`);
  console.log(`  1. ${config.features.fileUpload ? 'Upload branding assets to GCS' : 'Configure Cerner integration'}`);
  console.log(`  2. Test login with admin credentials`);
  console.log(`  3. Create additional users (clinicians, experts, patients)`);
  console.log(`  4. ${config.config.integration.method === 'cerner' ? 'Test Cerner integration' : 'Upload test discharge summary'}`);
  console.log(`  5. Verify AI simplification and translation`);

  log.section('='.repeat(60));
}

// Main function
async function main() {
  log.section('AIVIDA TENANT ONBOARDING SCRIPT');

  // Parse arguments
  const options = parseArgs();
  if (!options) {
    process.exit(1);
  }

  // Load advanced config if provided
  let advancedConfig: any;
  if (options.configFile) {
    try {
      const configPath = path.resolve(options.configFile);
      advancedConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      log.success(`Loaded advanced configuration from: ${configPath}`);
    } catch (error) {
      log.error(`Failed to load config file: ${error}`);
      process.exit(1);
    }
  }

  // Build tenant configuration
  const tenantConfig = buildTenantConfig(options, advancedConfig);

  // Validate Cerner config if applicable
  if (options.method === 'cerner' && !options.skipValidation) {
    if (advancedConfig?.tenantConfig?.cerner) {
      const isValid = await validateCernerConfig(advancedConfig);
      if (!isValid) {
        log.error('Cerner configuration validation failed');
        process.exit(1);
      }

      // Test Cerner connection
      const isConnected = await testCernerConnection(advancedConfig);
      if (!isConnected) {
        log.warning('Cerner connection test failed - continuing anyway');
        log.warning('You will need to fix Cerner credentials before integration works');
      }
    } else {
      log.warning('No Cerner configuration provided - using placeholders');
      log.warning('Update config in Firestore before using Cerner integration');
    }
  }

  // Initialize Firebase
  log.info('Initializing Firebase connection...');
  const db = await initializeFirebase();
  log.success('Connected to Firestore');

  // Build admin user
  const adminUser = await buildAdminUser(options);

  // Create tenant
  log.info(`Creating tenant: ${options.id}...`);
  const tenantCreated = await createTenant(db, tenantConfig, options.dryRun);
  if (!tenantCreated) {
    process.exit(1);
  }

  // Create admin user
  log.info(`Creating admin user: ${options.adminUsername}...`);
  const userCreated = await createAdminUser(db, adminUser, options.dryRun);
  if (!userCreated) {
    process.exit(1);
  }

  // Print summary
  if (!options.dryRun) {
    printSummary(options, tenantConfig);
    log.success('Tenant onboarding completed successfully!');
  } else {
    log.warning('DRY RUN COMPLETED - No changes were made');
  }
}

// Run the script
main().catch((error) => {
  log.error(`Onboarding failed: ${error}`);
  process.exit(1);
});
