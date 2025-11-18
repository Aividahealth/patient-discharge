import { Firestore } from '@google-cloud/firestore';
import * as fs from 'fs';
import * as path from 'path';
import * as YAML from 'yaml';

interface ListUsersOptions {
  tenantId?: string; // Optional - if not provided, lists all users
  role?: string; // Optional - filter by role
  showLocked?: boolean; // Optional - show only locked accounts
  showInactive?: boolean; // Optional - show only inactive accounts
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
      return config.firestore_service_account_path;
    }
  } catch (error) {
    console.log('Could not load config, using environment variable or default');
  }

  return process.env.SERVICE_ACCOUNT_PATH;
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
 * Format date for display
 */
function formatDate(date: any): string {
  if (!date) return 'Never';
  const d = date.toDate ? date.toDate() : new Date(date);
  return d.toISOString().split('T')[0] + ' ' + d.toTimeString().split(' ')[0];
}

/**
 * List users with filters
 */
async function listUsers(firestore: Firestore, options: ListUsersOptions): Promise<void> {
  let query: FirebaseFirestore.Query = firestore.collection('users');

  // Apply filters
  if (options.tenantId) {
    query = query.where('tenantId', '==', options.tenantId);
  }

  if (options.role) {
    query = query.where('role', '==', options.role);
  }

  const snapshot = await query.get();

  if (snapshot.empty) {
    console.log('No users found matching the criteria.');
    return;
  }

  let users = snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
    };
  });

  // Apply additional filters (not supported in Firestore query)
  if (options.showLocked) {
    users = users.filter(u => u.isLocked === true);
  }

  if (options.showInactive) {
    users = users.filter(u => u.isActive === false);
  }

  // Sort by tenantId, then role, then username
  users.sort((a, b) => {
    if (a.tenantId !== b.tenantId) {
      return (a.tenantId || '').localeCompare(b.tenantId || '');
    }
    if (a.role !== b.role) {
      return a.role.localeCompare(b.role);
    }
    return a.username.localeCompare(b.username);
  });

  console.log(`\n📋 Found ${users.length} user(s)\n`);

  // Display summary table
  console.log('┌────────────────────────────────────────────────────────────────────────────────┐');
  console.log('│                                    USER LIST                                   │');
  console.log('├──────────┬─────────────┬───────────────────┬─────────────┬────────┬──────────┤');
  console.log('│ Tenant   │ Username    │ Name              │ Role        │ Status │ Locked   │');
  console.log('├──────────┬─────────────┬───────────────────┬─────────────┬────────┬──────────┤');

  for (const user of users) {
    const tenant = (user.tenantId || 'system').padEnd(8).slice(0, 8);
    const username = user.username.padEnd(11).slice(0, 11);
    const name = user.name.padEnd(17).slice(0, 17);
    const role = user.role.padEnd(11).slice(0, 11);
    const status = (user.isActive === false ? '🔴 Inactive' : '🟢 Active  ').slice(0, 10);
    const locked = (user.isLocked ? '🔒 Yes' : '   No ').slice(0, 8);

    console.log(`│ ${tenant} │ ${username} │ ${name} │ ${role} │ ${status} │ ${locked} │`);
  }

  console.log('└──────────┴─────────────┴───────────────────┴─────────────┴────────┴──────────┘');

  // Display detailed information
  console.log('\n📖 Detailed Information:\n');

  for (const user of users) {
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`User ID: ${user.id}`);
    console.log(`Tenant: ${user.tenantId || 'system (cross-tenant)'}`);
    console.log(`Username: ${user.username}`);
    console.log(`Name: ${user.name}`);
    console.log(`Role: ${user.role}`);

    if (user.linkedPatientId) {
      console.log(`Linked Patient ID: ${user.linkedPatientId}`);
    }

    if (user.email) {
      console.log(`Email: ${user.email}`);
    }

    console.log(`\nAccount Status:`);
    console.log(`  Active: ${user.isActive === false ? '❌ No' : '✅ Yes'}`);
    console.log(`  Locked: ${user.isLocked ? '🔒 Yes' : '✅ No'}`);

    if (user.isLocked) {
      console.log(`  Locked At: ${formatDate(user.lockedAt)}`);
      console.log(`  Locked Reason: ${user.lockedReason || 'Not specified'}`);
    }

    console.log(`  Failed Login Attempts: ${user.failedLoginAttempts || 0}/3`);

    if (user.lastFailedLoginAt) {
      console.log(`  Last Failed Login: ${formatDate(user.lastFailedLoginAt)}`);
    }

    if (user.lastSuccessfulLoginAt) {
      console.log(`  Last Successful Login: ${formatDate(user.lastSuccessfulLoginAt)}`);
    }

    console.log(`\nAudit Trail:`);
    console.log(`  Created: ${formatDate(user.createdAt)}`);
    if (user.createdBy) {
      console.log(`  Created By: ${user.createdBy}`);
    }
    console.log(`  Updated: ${formatDate(user.updatedAt)}`);
    if (user.lastUpdatedBy) {
      console.log(`  Last Updated By: ${user.lastUpdatedBy}`);
    }

    console.log('');
  }

  // Display statistics
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 Statistics:');
  console.log(`  Total Users: ${users.length}`);
  console.log(`  Active: ${users.filter(u => u.isActive !== false).length}`);
  console.log(`  Inactive: ${users.filter(u => u.isActive === false).length}`);
  console.log(`  Locked: ${users.filter(u => u.isLocked).length}`);
  console.log('\nBy Role:');

  const roleStats = users.reduce((acc, user) => {
    acc[user.role] = (acc[user.role] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  for (const [role, count] of Object.entries(roleStats)) {
    console.log(`  ${role}: ${count}`);
  }

  if (options.tenantId) {
    console.log(`\nFiltered by Tenant: ${options.tenantId}`);
  }
}

/**
 * Parse command line arguments
 */
function parseArgs(): ListUsersOptions {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage: npm run script:list-users -- [OPTIONS]

List users in the system with optional filters.

Options:
  --tenantId=<id>    Filter by tenant ID (optional, shows all tenants if not specified)
  --role=<role>      Filter by role (optional)
                     Options: patient, clinician, expert, tenant_admin, system_admin
  --locked           Show only locked accounts (optional)
  --inactive         Show only inactive accounts (optional)

Examples:
  # List all users
  npm run script:list-users

  # List users in a specific tenant
  npm run script:list-users -- --tenantId=demo

  # List all clinicians
  npm run script:list-users -- --role=clinician

  # List locked accounts in a tenant
  npm run script:list-users -- --tenantId=acme-hospital --locked

  # List all system admins
  npm run script:list-users -- --role=system_admin

  # List inactive users
  npm run script:list-users -- --inactive
`);
    process.exit(0);
  }

  const options: ListUsersOptions = {};

  for (const arg of args) {
    if (arg === '--locked') {
      options.showLocked = true;
      continue;
    }

    if (arg === '--inactive') {
      options.showInactive = true;
      continue;
    }

    const [key, value] = arg.split('=');
    const cleanKey = key.replace(/^--/, '');

    switch (cleanKey) {
      case 'tenantId':
        options.tenantId = value;
        break;
      case 'role':
        options.role = value;
        break;
      default:
        if (!arg.startsWith('--')) {
          console.error(`Unknown option: ${key}`);
        }
        break;
    }
  }

  return options;
}

/**
 * Main function
 */
async function main() {
  console.log('👥 User List Script\n');

  const options = parseArgs();

  try {
    const firestore = getFirestore();
    console.log('✅ Firestore client initialized\n');

    await listUsers(firestore, options);

  } catch (error) {
    console.error('\n❌ Failed to list users:', error.message);
    process.exit(1);
  }
}

// Run the script
main();
