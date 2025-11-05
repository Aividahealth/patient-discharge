import * as bcrypt from 'bcryptjs';
import { Firestore } from '@google-cloud/firestore';
import * as fs from 'fs';
import * as path from 'path';
import * as YAML from 'yaml';

interface UserSeed {
  tenantId: string;
  username: string;
  password: string; // Plain text password - will be hashed
  name: string;
  role: 'patient' | 'clinician' | 'expert' | 'admin';
  linkedPatientId?: string | null;
}

// Sample users to seed
const sampleUsers: UserSeed[] = [
  {
    tenantId: 'demo',
    username: 'patient',
    password: 'Adyar2Austin',
    name: 'John Smith',
    role: 'patient',
    linkedPatientId: 'patient-demo-001',
  },
  {
    tenantId: 'demo',
    username: 'clinician',
    password: 'Demo123!',
    name: 'Dr. Jane Doe',
    role: 'clinician',
    linkedPatientId: null,
  },
  {
    tenantId: 'demo',
    username: 'expert',
    password: 'Demo123!',
    name: 'Dr. Expert Review',
    role: 'expert',
    linkedPatientId: null,
  },
  {
    tenantId: 'demo',
    username: 'admin',
    password: 'Admin123!',
    name: 'System Administrator',
    role: 'admin',
    linkedPatientId: null,
  },
];

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
 * Hash password using bcrypt
 */
async function hashPassword(password: string): Promise<string> {
  const saltRounds = 10;
  return bcrypt.hash(password, saltRounds);
}

/**
 * Create a user in Firestore
 */
async function createUser(firestore: Firestore, user: UserSeed): Promise<void> {
  try {
    // Check if user already exists
    const existingUsers = await firestore
      .collection('users')
      .where('tenantId', '==', user.tenantId)
      .where('username', '==', user.username)
      .limit(1)
      .get();

    if (!existingUsers.empty) {
      console.log(`⏭️  User ${user.username} already exists in tenant ${user.tenantId}, skipping...`);
      return;
    }

    // Hash password
    const passwordHash = await hashPassword(user.password);

    // Create user document
    const userData = {
      tenantId: user.tenantId,
      username: user.username,
      passwordHash: passwordHash,
      name: user.name,
      role: user.role,
      linkedPatientId: user.linkedPatientId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const docRef = firestore.collection('users').doc();
    await docRef.set(userData);

    console.log(`✅ Created user: ${user.username} (${user.role}) in tenant ${user.tenantId} with ID: ${docRef.id}`);
  } catch (error) {
    console.error(`❌ Error creating user ${user.username}:`, error.message);
    throw error;
  }
}

/**
 * Main function to seed users
 */
async function seedUsers() {
  console.log('🌱 Starting user seeding process...\n');

  try {
    const firestore = getFirestore();
    console.log('✅ Firestore client initialized\n');

    for (const user of sampleUsers) {
      await createUser(firestore, user);
    }

    console.log('\n✅ User seeding completed successfully!');
    console.log('\n📋 Created users:');
    sampleUsers.forEach((user) => {
      console.log(`   - ${user.username} (${user.role}) - Password: ${user.password}`);
    });
  } catch (error) {
    console.error('\n❌ User seeding failed:', error);
    process.exit(1);
  }
}

// Run the seed script
seedUsers();

