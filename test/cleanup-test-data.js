/**
 * Cleanup script for test data
 * Run this manually to clean up test users and discharge summaries
 */
const { Firestore } = require('@google-cloud/firestore');
const { Storage } = require('@google-cloud/storage');
const path = require('path');
const fs = require('fs');
const YAML = require('yaml');

const TENANT_ID = 'demo';
const TEST_TAGS = [
  'portal-integration-test',
  'clinician-portal-test',
  'patient-portal-test'
];

function getServiceAccountPath() {
  const env = process.env.TEST_ENV || process.env.NODE_ENV || 'dev';
  const configPath = path.resolve(__dirname, `../backend/.settings.${env}/config.yaml`);

  if (fs.existsSync(configPath)) {
    try {
      const raw = fs.readFileSync(configPath, 'utf8');
      const config = YAML.parse(raw);
      return config.service_account_path;
    } catch (error) {
      // Fall back to environment variable
    }
  }

  return process.env.SERVICE_ACCOUNT_PATH;
}

async function main() {
  const serviceAccountPath = getServiceAccountPath();

  let firestore, storage;
  if (serviceAccountPath && fs.existsSync(serviceAccountPath)) {
    firestore = new Firestore({
      keyFilename: serviceAccountPath,
    });
    storage = new Storage({
      keyFilename: serviceAccountPath,
    });
  } else {
    firestore = new Firestore();
    storage = new Storage();
  }

  console.log('\n🧹 Cleaning up test data...\n');

  // Clean up test users
  console.log('👥 Cleaning up test users...');
  let totalUsers = 0;
  for (const tag of TEST_TAGS) {
    const usersSnapshot = await firestore
      .collection('users')
      .where('testTag', '==', tag)
      .get();

    for (const doc of usersSnapshot.docs) {
      await doc.ref.delete();
      totalUsers++;
    }
  }
  console.log(`   ✅ Deleted ${totalUsers} test users`);

  // Clean up test discharge summaries
  console.log('📄 Cleaning up test discharge summaries...');
  let totalSummaries = 0;
  for (const tag of TEST_TAGS) {
    const summariesSnapshot = await firestore
      .collection('discharge_summaries')
      .where('testTag', '==', tag)
      .get();

    for (const doc of summariesSnapshot.docs) {
      const data = doc.data();

      // Delete from GCS if file exists
      if (data.gcsPath) {
        try {
          const bucket = storage.bucket(data.gcsPath.split('/')[2]);
          const filePath = data.gcsPath.split('/').slice(3).join('/');
          await bucket.file(filePath).delete();
        } catch (error) {
          // File might not exist, continue
        }
      }

      await doc.ref.delete();
      totalSummaries++;
    }
  }
  console.log(`   ✅ Deleted ${totalSummaries} test discharge summaries`);

  console.log('\n✅ Cleanup complete!\n');
}

main().catch(console.error);
