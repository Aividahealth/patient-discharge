#!/usr/bin/env ts-node

/**
 * User Creation Script
 *
 * Creates additional users for a tenant (clinicians, experts, patients)
 *
 * Usage:
 *   npm run create-user -- --tenant="tenant-id" --username="user123" --name="User Name" --role="clinician" --password="password"
 */

import * as admin from 'firebase-admin';
import * as bcrypt from 'bcryptjs';
import * as fs from 'fs';
import * as path from 'path';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

const log = {
  info: (msg: string) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg: string) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  warning: (msg: string) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  error: (msg: string) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
};

interface UserOptions {
  tenant: string;
  username: string;
  name: string;
  role: 'patient' | 'clinician' | 'expert' | 'admin';
  password: string;
  linkedPatientId?: string;
}

function parseArgs(): UserOptions | null {
  const args = process.argv.slice(2);
  const options: any = {};

  for (const arg of args) {
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      if (value) {
        options[key.replace(/-/g, '_')] = value;
      }
    }
  }

  // Convert to camelCase
  const camelOptions: any = {};
  for (const [key, value] of Object.entries(options)) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    camelOptions[camelKey] = value;
  }

  const required = ['tenant', 'username', 'name', 'role', 'password'];
  const missing = required.filter(field => !camelOptions[field]);

  if (missing.length > 0) {
    log.error(`Missing required arguments: ${missing.join(', ')}`);
    return null;
  }

  if (!['patient', 'clinician', 'expert', 'admin'].includes(camelOptions.role)) {
    log.error('Invalid role. Must be: patient, clinician, expert, or admin');
    return null;
  }

  if (camelOptions.password.length < 8) {
    log.error('Password must be at least 8 characters');
    return null;
  }

  return camelOptions as UserOptions;
}

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

async function createUser(db: admin.firestore.Firestore, options: UserOptions): Promise<boolean> {
  try {
    // Check if tenant exists
    const tenantDoc = await db.collection('config').doc(options.tenant).get();
    if (!tenantDoc.exists) {
      log.error(`Tenant '${options.tenant}' does not exist`);
      return false;
    }

    // Check if user already exists
    const existingUsers = await db.collection('users')
      .where('tenantId', '==', options.tenant)
      .where('username', '==', options.username)
      .get();

    if (!existingUsers.empty) {
      log.error(`User '${options.username}' already exists for tenant '${options.tenant}'`);
      return false;
    }

    // Hash password
    const passwordHash = await bcrypt.hash(options.password, 10);

    // Create user object
    const user: any = {
      tenantId: options.tenant,
      username: options.username,
      passwordHash,
      name: options.name,
      role: options.role,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (options.linkedPatientId) {
      user.linkedPatientId = options.linkedPatientId;
    }

    // Save to Firestore
    await db.collection('users').add(user);

    log.success(`Created user: ${options.username} (${options.role})`);
    console.log(`\nLogin details:`);
    console.log(`  Tenant:   ${options.tenant}`);
    console.log(`  Username: ${options.username}`);
    console.log(`  Role:     ${options.role}`);
    console.log(`  Portal:   https://aividia.com/${options.tenant}/${options.role === 'admin' ? 'admin' : options.role === 'expert' ? 'expert' : options.role === 'patient' ? 'patient' : 'clinician'}`);

    return true;
  } catch (error) {
    log.error(`Failed to create user: ${error}`);
    return false;
  }
}

async function main() {
  const options = parseArgs();
  if (!options) {
    log.info('Usage: npm run create-user -- --tenant="tenant-id" --username="user123" --name="User Name" --role="clinician" --password="password" [--linked-patient-id="12345"]');
    process.exit(1);
  }

  log.info('Initializing Firebase...');
  const db = await initializeFirebase();

  const success = await createUser(db, options);
  process.exit(success ? 0 : 1);
}

main().catch((error) => {
  log.error(`Script failed: ${error}`);
  process.exit(1);
});
