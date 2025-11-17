#!/usr/bin/env ts-node

/**
 * Cerner Integration Test Script
 *
 * Tests connectivity and authentication with Cerner FHIR API
 *
 * Usage:
 *   npm run test-cerner-integration -- --tenant="tenant-id"
 */

import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

const log = {
  info: (msg: string) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg: string) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  warning: (msg: string) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  error: (msg: string) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  section: (msg: string) => console.log(`\n${colors.bright}${colors.cyan}${msg}${colors.reset}\n`),
};

async function initializeFirebase() {
  if (admin.apps.length > 0) {
    return admin.firestore();
  }

  const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
    || path.join(__dirname, '../.settings.dev/service-account.json');

  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } else {
    admin.initializeApp();
  }

  return admin.firestore();
}

async function testCernerAuth(config: any): Promise<{ success: boolean; token?: string }> {
  log.info('Testing Cerner authentication...');

  try {
    const tokenUrl = config.system_app.token_url;
    const clientId = config.system_app.client_id;
    const clientSecret = config.system_app.client_secret;
    const scopes = config.system_app.scopes;

    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        scope: scopes,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      log.error(`Authentication failed: ${response.status}`);
      console.log(`Error details: ${errorText}`);
      return { success: false };
    }

    const data = await response.json();

    if (data.access_token) {
      log.success('Successfully obtained access token');
      console.log(`Token expires in: ${data.expires_in} seconds`);
      return { success: true, token: data.access_token };
    } else {
      log.error('No access token in response');
      return { success: false };
    }
  } catch (error) {
    log.error(`Authentication error: ${error}`);
    return { success: false };
  }
}

async function testFhirMetadata(baseUrl: string, token: string): Promise<boolean> {
  log.info('Testing FHIR metadata endpoint...');

  try {
    const metadataUrl = `${baseUrl}/metadata`;

    const response = await fetch(metadataUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/fhir+json',
      },
    });

    if (!response.ok) {
      log.error(`Metadata request failed: ${response.status}`);
      return false;
    }

    const metadata = await response.json();

    log.success('Successfully retrieved FHIR metadata');
    console.log(`  FHIR Version: ${metadata.fhirVersion}`);
    console.log(`  Server: ${metadata.software?.name || 'Unknown'} ${metadata.software?.version || ''}`);
    console.log(`  Supported Resources: ${metadata.rest?.[0]?.resource?.length || 0}`);

    return true;
  } catch (error) {
    log.error(`Metadata request error: ${error}`);
    return false;
  }
}

async function testPatientSearch(baseUrl: string, token: string, patientId?: string): Promise<boolean> {
  log.info('Testing patient search...');

  try {
    let searchUrl = `${baseUrl}/Patient`;

    if (patientId) {
      searchUrl += `/${patientId}`;
    } else {
      searchUrl += '?_count=1';
    }

    const response = await fetch(searchUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/fhir+json',
      },
    });

    if (!response.ok) {
      log.error(`Patient search failed: ${response.status}`);
      const errorText = await response.text();
      console.log(`Error: ${errorText}`);
      return false;
    }

    const data = await response.json();

    if (patientId) {
      log.success(`Successfully retrieved patient: ${data.id}`);
      console.log(`  Name: ${data.name?.[0]?.text || 'N/A'}`);
    } else if (data.entry && data.entry.length > 0) {
      log.success(`Successfully searched patients (found ${data.total || data.entry.length})`);
    } else {
      log.warning('Patient search returned no results');
    }

    return true;
  } catch (error) {
    log.error(`Patient search error: ${error}`);
    return false;
  }
}

async function testDocumentSearch(baseUrl: string, token: string): Promise<boolean> {
  log.info('Testing discharge summary search...');

  try {
    const searchUrl = `${baseUrl}/DocumentReference?type=18842-5&_count=5`;

    const response = await fetch(searchUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/fhir+json',
      },
    });

    if (!response.ok) {
      log.error(`Document search failed: ${response.status}`);
      return false;
    }

    const data = await response.json();

    if (data.entry && data.entry.length > 0) {
      log.success(`Found ${data.entry.length} discharge summary documents`);
    } else {
      log.warning('No discharge summaries found');
    }

    return true;
  } catch (error) {
    log.error(`Document search error: ${error}`);
    return false;
  }
}

async function main() {
  log.section('CERNER INTEGRATION TEST');

  const args = process.argv.slice(2);
  let tenantId: string | undefined;

  for (const arg of args) {
    if (arg.startsWith('--tenant=')) {
      tenantId = arg.slice('--tenant='.length);
    }
  }

  if (!tenantId) {
    log.error('Missing required argument: --tenant');
    log.info('Usage: npm run test-cerner-integration -- --tenant="tenant-id"');
    process.exit(1);
  }

  // Initialize Firebase
  log.info('Connecting to Firestore...');
  const db = await initializeFirebase();

  // Load tenant config
  log.info(`Loading tenant configuration: ${tenantId}...`);
  const tenantDoc = await db.collection('config').doc(tenantId).get();

  if (!tenantDoc.exists) {
    log.error(`Tenant '${tenantId}' not found`);
    process.exit(1);
  }

  const tenantData = tenantDoc.data();
  const cernerConfig = tenantData?.config?.tenantConfig?.cerner;

  if (!cernerConfig) {
    log.error(`Tenant '${tenantId}' does not have Cerner integration configured`);
    process.exit(1);
  }

  log.success('Tenant configuration loaded');

  // Display config info
  console.log(`\n${colors.bright}Cerner Configuration:${colors.reset}`);
  console.log(`  Base URL: ${cernerConfig.base_url}`);
  console.log(`  Client ID: ${cernerConfig.system_app.client_id}`);
  console.log(`  Scopes: ${cernerConfig.system_app.scopes}`);

  // Run tests
  log.section('Running Integration Tests');

  const results: any = {};

  // Test 1: Authentication
  const authResult = await testCernerAuth(cernerConfig);
  results.authentication = authResult.success;

  if (!authResult.success) {
    log.error('Authentication failed - cannot proceed with further tests');
    process.exit(1);
  }

  // Test 2: FHIR Metadata
  results.metadata = await testFhirMetadata(cernerConfig.base_url, authResult.token!);

  // Test 3: Patient Search
  const testPatientId = cernerConfig.patients?.[0];
  results.patientSearch = await testPatientSearch(cernerConfig.base_url, authResult.token!, testPatientId);

  // Test 4: Document Search
  results.documentSearch = await testDocumentSearch(cernerConfig.base_url, authResult.token!);

  // Print summary
  log.section('Test Summary');

  const tests = [
    { name: 'Authentication', result: results.authentication },
    { name: 'FHIR Metadata', result: results.metadata },
    { name: 'Patient Search', result: results.patientSearch },
    { name: 'Document Search', result: results.documentSearch },
  ];

  for (const test of tests) {
    const status = test.result ? `${colors.green}✓ PASS${colors.reset}` : `${colors.red}✗ FAIL${colors.reset}`;
    console.log(`  ${test.name.padEnd(20)} ${status}`);
  }

  const allPassed = Object.values(results).every(r => r === true);

  if (allPassed) {
    log.section(`${colors.green}All tests passed! Cerner integration is working correctly.${colors.reset}`);
    process.exit(0);
  } else {
    log.section(`${colors.red}Some tests failed. Review the errors above.${colors.reset}`);
    process.exit(1);
  }
}

main().catch((error) => {
  log.error(`Script failed: ${error}`);
  process.exit(1);
});
