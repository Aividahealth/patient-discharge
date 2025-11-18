import { Firestore } from '@google-cloud/firestore';
import * as fs from 'fs';
import * as path from 'path';
import * as YAML from 'yaml';

interface UnlockUserOptions {
  tenantId: string;
  username: string;
  unlockedBy?: string;
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
 * Unlock a user account
 */
async function unlockUser(firestore: Firestore, options: UnlockUserOptions): Promise<void> {
  // Find user by tenantId and username
  const querySnapshot = await firestore
    .collection('users')
    .where('tenantId', '==', options.tenantId)
    .where('username', '==', options.username)
    .limit(1)
    .get();

  if (querySnapshot.empty) {
    throw new Error(`User ${options.username} not found in tenant ${options.tenantId}`);
  }

  const userDoc = querySnapshot.docs[0];
  const userData = userDoc.data();

  console.log('\n📋 User Details:');
  console.log(`  User ID: ${userDoc.id}`);
  console.log(`  Username: ${userData.username}`);
  console.log(`  Name: ${userData.name}`);
  console.log(`  Role: ${userData.role}`);
  console.log(`  Tenant: ${userData.tenantId}`);
  console.log(`  Is Locked: ${userData.isLocked || false}`);
  console.log(`  Failed Attempts: ${userData.failedLoginAttempts || 0}`);

  if (userData.isLocked) {
    console.log(`  Locked At: ${userData.lockedAt?.toDate?.() || 'Unknown'}`);
    console.log(`  Locked Reason: ${userData.lockedReason || 'Not specified'}`);
  }
  console.log('');

  if (!userData.isLocked) {
    console.log('⚠️  Account is not locked. No action needed.');
    return;
  }

  // Unlock the account
  await userDoc.ref.update({
    isLocked: false,
    failedLoginAttempts: 0,
    lockedAt: null,
    lockedReason: null,
    lastFailedLoginAt: null,
    updatedAt: new Date(),
    lastUpdatedBy: options.unlockedBy || 'admin-script',
  });

  console.log('✅ Account unlocked successfully!');
  console.log('   - Failed login attempts reset to 0');
  console.log('   - Account lock status cleared');
  console.log('   - User can now log in');
}

/**
 * Parse command line arguments
 */
function parseArgs(): UnlockUserOptions | null {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage: npm run script:unlock-user -- [OPTIONS]

Unlock a user account that has been locked due to failed login attempts.

Options:
  --tenantId=<id>        Tenant ID (required)
  --username=<username>  Username to unlock (required)
  --unlockedBy=<admin>   Admin username performing unlock (optional)

Examples:
  # Unlock a user account
  npm run script:unlock-user -- \\
    --tenantId=demo \\
    --username=clinician

  # Unlock with admin tracking
  npm run script:unlock-user -- \\
    --tenantId=acme-hospital \\
    --username=dr.smith \\
    --unlockedBy=admin

Notes:
  - This script resets the failed login attempt counter to 0
  - Removes the account lock status
  - Clears lockout timestamp and reason
  - User will be able to log in immediately after unlock
`);
    return null;
  }

  const options: Partial<UnlockUserOptions> = {};

  for (const arg of args) {
    const [key, value] = arg.split('=');
    const cleanKey = key.replace(/^--/, '');

    switch (cleanKey) {
      case 'tenantId':
        options.tenantId = value;
        break;
      case 'username':
        options.username = value;
        break;
      case 'unlockedBy':
        options.unlockedBy = value;
        break;
      default:
        console.error(`Unknown option: ${key}`);
        return null;
    }
  }

  if (!options.tenantId || !options.username) {
    console.error('Error: --tenantId and --username are required');
    return null;
  }

  return options as UnlockUserOptions;
}

/**
 * Main function
 */
async function main() {
  console.log('🔓 User Account Unlock Script\n');

  const options = parseArgs();
  if (!options) {
    process.exit(0);
  }

  try {
    const firestore = getFirestore();
    console.log('✅ Firestore client initialized\n');

    await unlockUser(firestore, options);

  } catch (error) {
    console.error('\n❌ Account unlock failed:', error.message);
    process.exit(1);
  }
}

// Run the script
main();
