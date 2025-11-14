#!/usr/bin/env ts-node
/**
 * Script to generate a Google OIDC ID token for service account authentication
 * 
 * Usage:
 *   npm run generate-service-token
 *   npm run generate-service-token -- --tenant-id demo
 */

import * as fs from 'node:fs';
import * as path from 'path';
import { JWT } from 'google-auth-library';
import { resolveServiceAccountPath } from '../src/utils/path.helper';

interface ServiceAccount {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri?: string;
  token_uri?: string;
  auth_provider_x509_cert_url?: string;
  client_x509_cert_url?: string;
  universe_domain?: string;
}

async function generateServiceToken(tenantId?: string): Promise<void> {
  try {
    // Get service account path from config or environment
    const env = process.env.NODE_ENV || 'dev';
    const configPath = path.resolve(process.cwd(), `.settings.${env}/config.yaml`);
    
    let serviceAuthnPath: string;
    
    if (fs.existsSync(configPath)) {
      const yaml = require('yaml');
      const configContent = fs.readFileSync(configPath, 'utf8');
      const config = yaml.parse(configContent);
      serviceAuthnPath = config.service_authn_path || 'service_authn.json';
    } else {
      serviceAuthnPath = 'service_authn.json';
    }

    // Resolve the full path
    const resolvedPath = resolveServiceAccountPath(serviceAuthnPath, env);
    
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Service account file not found: ${resolvedPath}`);
    }

    console.log(`📄 Reading service account from: ${resolvedPath}`);
    const serviceAccountContent = fs.readFileSync(resolvedPath, 'utf8');
    const serviceAccount: ServiceAccount = JSON.parse(serviceAccountContent);

    if (!serviceAccount.client_id) {
      throw new Error('Service account missing client_id');
    }

    if (!serviceAccount.client_email) {
      throw new Error('Service account missing client_email');
    }

    if (!serviceAccount.private_key) {
      throw new Error('Service account missing private_key');
    }

    // Create JWT client (no scopes needed for ID token)
    const jwtClient = new JWT({
      email: serviceAccount.client_email,
      key: serviceAccount.private_key,
    });

    // Generate ID token with audience set to the service account's client_id
    // This is what the backend will verify against
    const audience = serviceAccount.client_id;
    
    console.log(`🔐 Generating ID token for service account: ${serviceAccount.client_email}`);
    console.log(`   Audience (client_id): ${audience}`);

    const idToken = await jwtClient.fetchIdToken(audience);

    if (!idToken) {
      throw new Error('Failed to generate ID token');
    }

    
    console.log('\n✅ Service Token Generated Successfully!\n');
    console.log('='.repeat(80));
    console.log('ID TOKEN:');
    console.log('='.repeat(80));
    console.log(idToken);
    console.log('='.repeat(80));
    console.log('\n📦 Auth Payload (req.auth):');
    console.log('='.repeat(80));

    console.log('='.repeat(80));
    console.log('\n📋 Usage Example:');
    console.log('='.repeat(80));
    console.log(`curl -X GET http://localhost:3000/api/your-endpoint \\`);
    console.log(`  -H "Authorization: Bearer ${idToken.substring(0, 50)}..." \\`);
    console.log('='.repeat(80));
    console.log('\n💡 Note: This token expires in 1 hour. Regenerate as needed.\n');

  } catch (error) {
    console.error('❌ Error generating service token:', error.message);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const tenantIdIndex = args.indexOf('--tenant-id');
const tenantId = tenantIdIndex !== -1 && args[tenantIdIndex + 1] 
  ? args[tenantIdIndex + 1] 
  : undefined;

generateServiceToken(tenantId);

