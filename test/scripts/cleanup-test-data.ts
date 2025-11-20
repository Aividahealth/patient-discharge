/**
 * Cleanup Test Data Script
 *
 * Deletes all test users and discharge summaries created by the portal integration tests
 * Safe to run at any time - only deletes data tagged with 'portal-integration-test'
 */

import { Firestore } from '@google-cloud/firestore';
import { Storage } from '@google-cloud/storage';
import * as fs from 'fs';
import * as path from 'path';
import * as YAML from 'yaml';

const TEST_TAG = 'portal-integration-test';

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
 * Get GCS bucket name from config
 */
function getGCSBucketName(): string {
  try {
    const env = process.env.NODE_ENV || 'dev';
    const configPath = path.resolve(process.cwd(), `.settings.${env}/config.yaml`);

    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, 'utf8');
      const config = YAML.parse(raw);
      return config.gcs_bucket_name || 'patient-discharge-dev';
    }
  } catch (error) {
    // Fall back to default
  }
  return process.env.GCS_BUCKET_NAME || 'patient-discharge-dev';
}

/**
 * Initialize Firestore and Storage clients
 */
function initializeClients(): { firestore: Firestore; storage: Storage } {
  const serviceAccountPath = getServiceAccountPath();

  if (serviceAccountPath && fs.existsSync(serviceAccountPath)) {
    console.log(`📁 Using service account: ${serviceAccountPath}`);
    const firestore = new Firestore({ keyFilename: serviceAccountPath });
    const storage = new Storage({ keyFilename: serviceAccountPath });
    return { firestore, storage };
  } else {
    console.log('📁 Using Application Default Credentials');
    const firestore = new Firestore();
    const storage = new Storage();
    return { firestore, storage };
  }
}

/**
 * Delete all test users
 */
async function cleanupTestUsers(firestore: Firestore): Promise<number> {
  console.log('\n👥 Cleaning up test users...');

  const snapshot = await firestore
    .collection('users')
    .where('testTag', '==', TEST_TAG)
    .get();

  if (snapshot.empty) {
    console.log('   No test users found');
    return 0;
  }

  console.log(`   Found ${snapshot.size} test users to delete`);

  let deletedCount = 0;
  const batch = firestore.batch();
  let batchSize = 0;
  const MAX_BATCH_SIZE = 500;

  for (const doc of snapshot.docs) {
    const userData = doc.data();
    console.log(`   Deleting user: ${userData.username} (${userData.role}) - ID: ${doc.id}`);

    batch.delete(doc.ref);
    batchSize++;

    if (batchSize >= MAX_BATCH_SIZE) {
      await batch.commit();
      deletedCount += batchSize;
      batchSize = 0;
    }
  }

  if (batchSize > 0) {
    await batch.commit();
    deletedCount += batchSize;
  }

  console.log(`   ✅ Deleted ${deletedCount} test users`);
  return deletedCount;
}

/**
 * Delete all test discharge summaries
 */
async function cleanupTestDischargeSummaries(
  firestore: Firestore,
  storage: Storage
): Promise<number> {
  console.log('\n📄 Cleaning up test discharge summaries...');

  const snapshot = await firestore
    .collection('discharge_summaries')
    .where('testTag', '==', TEST_TAG)
    .get();

  if (snapshot.empty) {
    console.log('   No test discharge summaries found');
    return 0;
  }

  console.log(`   Found ${snapshot.size} test discharge summaries to delete`);

  const bucketName = getGCSBucketName();
  const bucket = storage.bucket(bucketName);

  let deletedCount = 0;
  const batch = firestore.batch();
  let batchSize = 0;
  const MAX_BATCH_SIZE = 500;

  const summariesToDelete: Array<{ id: string; tenantId: string }> = [];

  for (const doc of snapshot.docs) {
    const summaryData = doc.data();
    console.log(`   Deleting summary: ${summaryData.patientName} (${summaryData.mrn}) - ID: ${doc.id}`);

    batch.delete(doc.ref);
    summariesToDelete.push({
      id: doc.id,
      tenantId: summaryData.tenantId,
    });
    batchSize++;

    if (batchSize >= MAX_BATCH_SIZE) {
      await batch.commit();
      deletedCount += batchSize;
      batchSize = 0;
    }
  }

  if (batchSize > 0) {
    await batch.commit();
    deletedCount += batchSize;
  }

  console.log(`   ✅ Deleted ${deletedCount} discharge summary documents from Firestore`);

  // Clean up GCS files (best effort)
  console.log('\n🗑️  Cleaning up GCS files...');
  let gcsDeletedCount = 0;

  for (const summary of summariesToDelete) {
    try {
      const prefix = `${summary.tenantId}/raw/${summary.id}/`;
      const [files] = await bucket.getFiles({ prefix });

      for (const file of files) {
        await file.delete();
        gcsDeletedCount++;
      }

      if (files.length > 0) {
        console.log(`   Deleted ${files.length} files for summary ${summary.id}`);
      }
    } catch (error) {
      console.warn(`   Warning: Could not delete GCS files for ${summary.id}:`, error.message);
    }
  }

  console.log(`   ✅ Deleted ${gcsDeletedCount} files from GCS`);

  return deletedCount;
}

/**
 * Clean up other test-related collections (if any)
 */
async function cleanupOtherTestData(firestore: Firestore): Promise<void> {
  console.log('\n🔍 Checking for other test data...');

  // Add cleanup for other collections that might have test data
  // For example: review_comments, quality_metrics, etc.

  // Example: Clean up test-tagged quality metrics
  try {
    const metricsSnapshot = await firestore
      .collection('quality_metrics')
      .where('testTag', '==', TEST_TAG)
      .get();

    if (!metricsSnapshot.empty) {
      const batch = firestore.batch();
      metricsSnapshot.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
      console.log(`   ✅ Deleted ${metricsSnapshot.size} test quality metrics`);
    }
  } catch (error) {
    // Collection might not exist, ignore
  }
}

/**
 * Display cleanup summary
 */
function displaySummary(userCount: number, summaryCount: number): void {
  console.log('\n' + '='.repeat(60));
  console.log('CLEANUP SUMMARY');
  console.log('='.repeat(60));
  console.log(`Test Tag: ${TEST_TAG}`);
  console.log(`Users Deleted: ${userCount}`);
  console.log(`Discharge Summaries Deleted: ${summaryCount}`);
  console.log('='.repeat(60));
}

/**
 * Confirm cleanup action
 */
function confirmCleanup(): boolean {
  // In non-interactive mode or CI, skip confirmation
  if (process.env.CI || process.env.NON_INTERACTIVE) {
    return true;
  }

  // For interactive mode, we'll just proceed (could add readline for confirmation)
  return true;
}

/**
 * Main cleanup function
 */
async function main() {
  console.log('🧹 Portal Integration Test Data Cleanup');
  console.log('========================================\n');
  console.log(`This script will delete all data tagged with: "${TEST_TAG}"`);
  console.log('This includes:');
  console.log('  - Test users (all roles)');
  console.log('  - Test discharge summaries');
  console.log('  - Associated GCS files');
  console.log('');

  if (!confirmCleanup()) {
    console.log('❌ Cleanup cancelled');
    process.exit(0);
  }

  try {
    // Initialize clients
    const { firestore, storage } = initializeClients();
    console.log('✅ Initialized Firestore and Storage clients');

    // Perform cleanup
    const userCount = await cleanupTestUsers(firestore);
    const summaryCount = await cleanupTestDischargeSummaries(firestore, storage);
    await cleanupOtherTestData(firestore);

    // Display summary
    displaySummary(userCount, summaryCount);

    console.log('\n✅ Cleanup completed successfully!\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Cleanup failed:', error);
    console.error(error);
    process.exit(1);
  }
}

// Handle command line arguments
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Usage: npm run cleanup-test-data

Cleans up all test data created by the portal integration tests.

This script is safe to run at any time. It only deletes data tagged with
"${TEST_TAG}" which is automatically added to all test users and discharge
summaries created by the test suite.

Options:
  --help, -h    Show this help message

Environment Variables:
  NODE_ENV            Environment (dev, staging, prod) - defaults to 'dev'
  SERVICE_ACCOUNT_PATH  Path to service account JSON file
  GCS_BUCKET_NAME     GCS bucket name
  CI                  Set to 'true' to skip confirmation prompts
  NON_INTERACTIVE     Set to 'true' to skip confirmation prompts

Examples:
  # Clean up test data in dev environment
  npm run cleanup-test-data

  # Clean up test data in staging environment
  NODE_ENV=staging npm run cleanup-test-data

  # Run in CI mode (no confirmations)
  CI=true npm run cleanup-test-data
`);
  process.exit(0);
}

// Run the main function
main();
