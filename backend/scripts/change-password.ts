import * as bcrypt from 'bcryptjs';
import { Firestore } from '@google-cloud/firestore';
import * as fs from 'fs';
import * as path from 'path';
import * as YAML from 'yaml';
import * as crypto from 'crypto';

interface ChangePasswordOptions {
  tenantId: string;
  username: string;
  password?: string; // Optional - will generate if not provided
  changedBy?: string;
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
 * Generate a secure random password
 */
function generatePassword(): string {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  const length = 16;
  let password = '';

  for (let i = 0; i < length; i++) {
    const randomIndex = crypto.randomInt(0, charset.length);
    password += charset[randomIndex];
  }

  return password;
}

/**
 * Hash password using bcrypt
 */
async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12;
  return bcrypt.hash(password, saltRounds);
}

/**
 * Change user password
 */
async function changePassword(firestore: Firestore, options: ChangePasswordOptions): Promise<string> {
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
  console.log('');

  // Generate password if not provided
  const newPassword = options.password || generatePassword();
  const passwordHash = await hashPassword(newPassword);

  // Update password
  await userDoc.ref.update({
    passwordHash: passwordHash,
    updatedAt: new Date(),
    lastUpdatedBy: options.changedBy || 'admin-script',
  });

  return newPassword;
}

/**
 * Parse command line arguments
 */
function parseArgs(): ChangePasswordOptions | null {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage: npm run script:change-password -- [OPTIONS]

Change a user's password. If no password is provided, a secure random password will be generated.

Options:
  --tenantId=<id>        Tenant ID (required)
  --username=<username>  Username (required)
  --password=<password>  New password (optional, will generate if not provided)
  --changedBy=<admin>    Admin username changing password (optional)

Examples:
  # Change password with auto-generated password
  npm run script:change-password -- \\
    --tenantId=demo \\
    --username=clinician

  # Change password to specific value
  npm run script:change-password -- \\
    --tenantId=acme-hospital \\
    --username=dr.smith \\
    --password="NewSecurePass123!" \\
    --changedBy=admin

Notes:
  - Auto-generated passwords are 16 characters with mixed case, numbers, and symbols
  - The new password will be displayed - save it securely!
  - Changing password does not unlock the account if it's locked
  - User must use the new password on next login
`);
    return null;
  }

  const options: Partial<ChangePasswordOptions> = {};

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
      case 'password':
        options.password = value;
        break;
      case 'changedBy':
        options.changedBy = value;
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

  return options as ChangePasswordOptions;
}

/**
 * Main function
 */
async function main() {
  console.log('🔑 User Password Change Script\n');

  const options = parseArgs();
  if (!options) {
    process.exit(0);
  }

  try {
    const firestore = getFirestore();
    console.log('✅ Firestore client initialized\n');

    const newPassword = await changePassword(firestore, options);

    console.log('✅ Password changed successfully!\n');
    console.log('═══════════════════════════════════════════');
    console.log('NEW PASSWORD - SAVE SECURELY');
    console.log('═══════════════════════════════════════════');
    console.log(`Tenant:    ${options.tenantId}`);
    console.log(`Username:  ${options.username}`);
    console.log(`Password:  ${newPassword}`);
    console.log('═══════════════════════════════════════════');
    console.log('\n⚠️  IMPORTANT: Save this password securely!');
    console.log('   Provide the new password to the user via a secure channel.\n');

  } catch (error) {
    console.error('\n❌ Password change failed:', error.message);
    process.exit(1);
  }
}

// Run the script
main();
