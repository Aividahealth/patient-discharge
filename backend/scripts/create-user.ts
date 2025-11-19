import * as bcrypt from 'bcryptjs';
import { Firestore } from '@google-cloud/firestore';
import * as fs from 'fs';
import * as path from 'path';
import * as YAML from 'yaml';
import * as crypto from 'crypto';

interface CreateUserOptions {
  tenantId: string;
  username: string;
  name: string;
  role: 'patient' | 'clinician' | 'expert' | 'tenant_admin' | 'system_admin';
  linkedPatientId?: string;
  password?: string; // Optional - will generate if not provided
  email?: string;
  createdBy?: string;
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
 * Format: 4 random words separated by dashes, e.g., Correct-Horse-Battery-Staple2
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
  const saltRounds = 12; // Increased from 10 for better security
  return bcrypt.hash(password, saltRounds);
}

/**
 * Validate user input
 */
function validateInput(options: CreateUserOptions): string | null {
  if (!options.tenantId) {
    return 'tenantId is required';
  }

  if (!options.username || options.username.length < 3) {
    return 'username is required and must be at least 3 characters';
  }

  if (!options.name) {
    return 'name is required';
  }

  const validRoles = ['patient', 'clinician', 'expert', 'tenant_admin', 'system_admin'];
  if (!options.role || !validRoles.includes(options.role)) {
    return `role must be one of: ${validRoles.join(', ')}`;
  }

  if (options.role === 'patient' && !options.linkedPatientId) {
    return 'linkedPatientId is required for patient role';
  }

  if (options.role === 'system_admin' && options.tenantId !== 'system') {
    return 'system_admin role must use tenantId "system"';
  }

  return null;
}

/**
 * Create a new user in Firestore
 */
async function createUser(firestore: Firestore, options: CreateUserOptions): Promise<{ password: string; userId: string }> {
  // Validate input
  const validationError = validateInput(options);
  if (validationError) {
    throw new Error(`Validation error: ${validationError}`);
  }

  // Check if user already exists
  const existingUsers = await firestore
    .collection('users')
    .where('tenantId', '==', options.tenantId)
    .where('username', '==', options.username)
    .limit(1)
    .get();

  if (!existingUsers.empty) {
    throw new Error(`User ${options.username} already exists in tenant ${options.tenantId}`);
  }

  // Generate password if not provided
  const password = options.password || generatePassword();
  const passwordHash = await hashPassword(password);

  // Create user document
  const now = new Date();
  const userData = {
    tenantId: options.tenantId === 'system' ? null : options.tenantId, // null for system_admin
    username: options.username,
    passwordHash: passwordHash,
    name: options.name,
    role: options.role,
    linkedPatientId: options.linkedPatientId || null,
    email: options.email || null,

    // Account status
    isActive: true,
    isLocked: false,
    failedLoginAttempts: 0,

    // Audit fields
    createdAt: now,
    updatedAt: now,
    createdBy: options.createdBy || 'system',
  };

  const docRef = firestore.collection('users').doc();
  await docRef.set(userData);

  return { password, userId: docRef.id };
}

/**
 * Parse command line arguments
 */
function parseArgs(): CreateUserOptions | null {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage: npm run script:create-user -- [OPTIONS]

Create a new user account in the patient discharge system.

Options:
  --tenantId=<id>           Tenant ID (required, use "system" for system_admin)
  --username=<username>     Username for login (required, min 3 characters)
  --name=<name>             Full name of user (required)
  --role=<role>             User role (required)
                            Options: patient, clinician, expert, tenant_admin, system_admin
  --linkedPatientId=<id>    Patient ID (required for patient role)
  --password=<password>     Password (optional, will generate if not provided)
  --email=<email>           Email address (optional)
  --createdBy=<admin>       Admin username creating this user (optional)

Examples:
  # Create a clinician
  npm run script:create-user -- \\
    --tenantId=acme-hospital \\
    --username=dr.smith \\
    --name="Dr. John Smith" \\
    --role=clinician \\
    --email=smith@acme.com

  # Create a patient
  npm run script:create-user -- \\
    --tenantId=demo \\
    --username=john.doe \\
    --name="John Doe" \\
    --role=patient \\
    --linkedPatientId=patient-demo-001

  # Create a system admin
  npm run script:create-user -- \\
    --tenantId=system \\
    --username=sysadmin \\
    --name="System Administrator" \\
    --role=system_admin

  # Create user with specific password
  npm run script:create-user -- \\
    --tenantId=demo \\
    --username=expert1 \\
    --name="Dr. Expert" \\
    --role=expert \\
    --password="MySecurePass123!"
`);
    return null;
  }

  const options: Partial<CreateUserOptions> = {};

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
      case 'name':
        options.name = value;
        break;
      case 'role':
        options.role = value as CreateUserOptions['role'];
        break;
      case 'linkedPatientId':
        options.linkedPatientId = value;
        break;
      case 'password':
        options.password = value;
        break;
      case 'email':
        options.email = value;
        break;
      case 'createdBy':
        options.createdBy = value;
        break;
      default:
        console.error(`Unknown option: ${key}`);
        return null;
    }
  }

  return options as CreateUserOptions;
}

/**
 * Main function
 */
async function main() {
  console.log('👤 User Creation Script\n');

  const options = parseArgs();
  if (!options) {
    process.exit(0);
  }

  try {
    const firestore = getFirestore();
    console.log('✅ Firestore client initialized\n');

    console.log('Creating user with the following details:');
    console.log(`  Tenant ID: ${options.tenantId}`);
    console.log(`  Username: ${options.username}`);
    console.log(`  Name: ${options.name}`);
    console.log(`  Role: ${options.role}`);
    if (options.linkedPatientId) {
      console.log(`  Linked Patient ID: ${options.linkedPatientId}`);
    }
    if (options.email) {
      console.log(`  Email: ${options.email}`);
    }
    console.log('');

    const { password, userId } = await createUser(firestore, options);

    console.log('✅ User created successfully!\n');
    console.log('═══════════════════════════════════════════');
    console.log('USER CREDENTIALS - SAVE SECURELY');
    console.log('═══════════════════════════════════════════');
    console.log(`User ID:   ${userId}`);
    console.log(`Tenant:    ${options.tenantId}`);
    console.log(`Username:  ${options.username}`);
    console.log(`Password:  ${password}`);
    console.log(`Name:      ${options.name}`);
    console.log(`Role:      ${options.role}`);
    console.log('═══════════════════════════════════════════');
    console.log('\n⚠️  IMPORTANT: Save this password securely!');
    console.log('   This password cannot be retrieved later.');
    console.log('   Provide these credentials to the user via a secure channel.\n');

  } catch (error) {
    console.error('\n❌ User creation failed:', error.message);
    process.exit(1);
  }
}

// Run the script
main();
