import { Firestore } from '@google-cloud/firestore';
import * as fs from 'fs';
import * as path from 'path';
import * as YAML from 'yaml';

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
 * Migrate a single user document
 */
async function migrateUser(firestore: Firestore, userId: string, userData: any): Promise<boolean> {
  try {
    const updates: any = {
      updatedAt: new Date(),
    };

    let needsUpdate = false;

    // Add isActive field if missing (default: true)
    if (userData.isActive === undefined) {
      updates.isActive = true;
      needsUpdate = true;
    }

    // Add isLocked field if missing (default: false)
    if (userData.isLocked === undefined) {
      updates.isLocked = false;
      needsUpdate = true;
    }

    // Add failedLoginAttempts if missing (default: 0)
    if (userData.failedLoginAttempts === undefined) {
      updates.failedLoginAttempts = 0;
      needsUpdate = true;
    }

    // Rename 'admin' role to 'tenant_admin'
    if (userData.role === 'admin') {
      updates.role = 'tenant_admin';
      needsUpdate = true;
      console.log(`  ⚠️  Renaming role from 'admin' to 'tenant_admin'`);
    }

    // If no updates needed, skip
    if (!needsUpdate) {
      return false;
    }

    // Apply updates
    await firestore.collection('users').doc(userId).update(updates);

    return true;
  } catch (error) {
    console.error(`  ❌ Error migrating user ${userId}:`, error.message);
    return false;
  }
}

/**
 * Main migration function
 */
async function migrateUsers() {
  console.log('🔄 Starting user migration...\n');

  try {
    const firestore = getFirestore();
    console.log('✅ Firestore client initialized\n');

    // Fetch all users
    const usersSnapshot = await firestore.collection('users').get();

    if (usersSnapshot.empty) {
      console.log('⚠️  No users found in the database.');
      return;
    }

    console.log(`📊 Found ${usersSnapshot.size} user(s) to check\n`);

    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    // Process each user
    for (const doc of usersSnapshot.docs) {
      const userId = doc.id;
      const userData = doc.data();

      console.log(`\n👤 Processing user: ${userData.username} (${userId})`);
      console.log(`   Role: ${userData.role}`);
      console.log(`   Tenant: ${userData.tenantId}`);

      const wasMigrated = await migrateUser(firestore, userId, userData);

      if (wasMigrated) {
        console.log(`   ✅ Migrated`);
        migratedCount++;
      } else {
        console.log(`   ⏭️  Already up-to-date, skipped`);
        skippedCount++;
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 Migration Summary:');
    console.log('='.repeat(60));
    console.log(`Total users processed: ${usersSnapshot.size}`);
    console.log(`✅ Migrated: ${migratedCount}`);
    console.log(`⏭️  Skipped (already up-to-date): ${skippedCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log('='.repeat(60));

    console.log('\n✅ Migration completed successfully!');
    console.log('\nChanges applied:');
    console.log('  - Added isActive field (default: true)');
    console.log('  - Added isLocked field (default: false)');
    console.log('  - Added failedLoginAttempts field (default: 0)');
    console.log('  - Renamed "admin" role to "tenant_admin"\n');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

/**
 * Dry run function - shows what would be changed without actually changing it
 */
async function dryRun() {
  console.log('🔍 Running migration in DRY RUN mode (no changes will be made)\n');

  try {
    const firestore = getFirestore();
    console.log('✅ Firestore client initialized\n');

    // Fetch all users
    const usersSnapshot = await firestore.collection('users').get();

    if (usersSnapshot.empty) {
      console.log('⚠️  No users found in the database.');
      return;
    }

    console.log(`📊 Found ${usersSnapshot.size} user(s) to check\n`);

    let wouldMigrateCount = 0;
    let upToDateCount = 0;

    // Process each user
    for (const doc of usersSnapshot.docs) {
      const userId = doc.id;
      const userData = doc.data();

      console.log(`\n👤 User: ${userData.username} (${userId})`);
      console.log(`   Role: ${userData.role}`);
      console.log(`   Tenant: ${userData.tenantId}`);

      const changes: string[] = [];

      if (userData.isActive === undefined) {
        changes.push('Add isActive: true');
      }

      if (userData.isLocked === undefined) {
        changes.push('Add isLocked: false');
      }

      if (userData.failedLoginAttempts === undefined) {
        changes.push('Add failedLoginAttempts: 0');
      }

      if (userData.role === 'admin') {
        changes.push('Rename role from "admin" to "tenant_admin"');
      }

      if (changes.length > 0) {
        console.log('   📝 Changes to be applied:');
        changes.forEach(change => console.log(`      - ${change}`));
        wouldMigrateCount++;
      } else {
        console.log('   ✅ Already up-to-date');
        upToDateCount++;
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 Dry Run Summary:');
    console.log('='.repeat(60));
    console.log(`Total users: ${usersSnapshot.size}`);
    console.log(`Would migrate: ${wouldMigrateCount}`);
    console.log(`Already up-to-date: ${upToDateCount}`);
    console.log('='.repeat(60));

    console.log('\n💡 To apply these changes, run:');
    console.log('   npm run migrate-users\n');

  } catch (error) {
    console.error('\n❌ Dry run failed:', error);
    process.exit(1);
  }
}

/**
 * Main entry point
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage: npm run migrate-users [OPTIONS]

Migrate existing users to the new authentication system schema.

Options:
  --dry-run    Run in dry-run mode (show what would change without making changes)
  --help, -h   Show this help message

Examples:
  # Dry run to see what would change
  npm run migrate-users -- --dry-run

  # Apply migrations
  npm run migrate-users

What this migration does:
  - Adds isActive field (default: true) to users missing it
  - Adds isLocked field (default: false) to users missing it
  - Adds failedLoginAttempts field (default: 0) to users missing it
  - Renames 'admin' role to 'tenant_admin'
  - Updates updatedAt timestamp

⚠️  IMPORTANT: Backup your Firestore database before running this migration!
`);
    process.exit(0);
  }

  if (args.includes('--dry-run')) {
    await dryRun();
  } else {
    console.log('⚠️  WARNING: This will modify user documents in Firestore.\n');
    console.log('   Make sure you have a backup before proceeding.\n');
    console.log('   Run with --dry-run flag first to see what would change.\n');
    console.log('   Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');

    await new Promise(resolve => setTimeout(resolve, 5000));

    await migrateUsers();
  }
}

// Run the migration
main();
