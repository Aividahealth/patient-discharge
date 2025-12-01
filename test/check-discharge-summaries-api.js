/**
 * Check discharge summaries via API
 */
const { Firestore } = require('@google-cloud/firestore');
const path = require('path');
const fs = require('fs');
const YAML = require('yaml');

const TENANT_ID = 'demo';
const BACKEND_URL = 'https://patient-discharge-backend-dev-647433528821.us-central1.run.app';

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

  let firestore;
  if (serviceAccountPath && fs.existsSync(serviceAccountPath)) {
    firestore = new Firestore({
      keyFilename: serviceAccountPath,
    });
  } else {
    firestore = new Firestore();
  }

  // Get an admin user to get auth token
  console.log('\n🔍 Finding admin user...\n');
  const usersSnapshot = await firestore
    .collection('users')
    .where('tenantId', '==', TENANT_ID)
    .where('role', '==', 'admin')
    .limit(1)
    .get();

  if (usersSnapshot.empty) {
    console.log('❌ No admin user found. Creating one...');
    // We'd need to create an admin user, but let's try to use test users
    const testUsersSnapshot = await firestore
      .collection('users')
      .where('tenantId', '==', TENANT_ID)
      .where('testTag', '==', 'portal-integration-test')
      .limit(1)
      .get();

    if (testUsersSnapshot.empty) {
      console.log('❌ No test users found either');
      return;
    }
  }

  const userData = usersSnapshot.empty ? null : usersSnapshot.docs[0].data();
  const userId = usersSnapshot.empty ? null : usersSnapshot.docs[0].id;

  console.log(`✅ Using user: ${userData?.username || 'test user'} (${userId})`);

  // Create custom token for this user
  const admin = require('firebase-admin');

  if (!admin.apps.length) {
    if (serviceAccountPath && fs.existsSync(serviceAccountPath)) {
      admin.initializeApp({
        credential: admin.credential.cert(require(serviceAccountPath))
      });
    } else {
      admin.initializeApp();
    }
  }

  const customToken = await admin.auth().createCustomToken(userId);

  // Exchange custom token for ID token
  const apiKey = process.env.FIREBASE_API_KEY || 'AIzaSyDm-W9ZMVR3Ar4TKGVdFIeQd_xYMh-V6z4'; // From frontend config
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: customToken, returnSecureToken: true })
  });

  const authData = await response.json();
  const idToken = authData.idToken;

  console.log(`✅ Got auth token\n`);

  // Now query the API for discharge summaries
  console.log('📊 Fetching discharge summaries via API...\n');

  const apiResponse = await fetch(`${BACKEND_URL}/api/discharge-summaries`, {
    headers: {
      'Authorization': `Bearer ${idToken}`,
      'X-Tenant-ID': TENANT_ID,
      'Content-Type': 'application/json'
    }
  });

  if (!apiResponse.ok) {
    console.log(`❌ API request failed: ${apiResponse.status} ${apiResponse.statusText}`);
    const errorText = await apiResponse.text();
    console.log('Error:', errorText);
    return;
  }

  const summaries = await apiResponse.json();

  console.log(`📋 Found ${summaries.length} discharge summaries:\n`);

  summaries.slice(0, 10).forEach((summary, i) => {
    console.log(`${i + 1}. ${summary.patientName || 'Unknown Patient'}`);
    console.log(`   MRN: ${summary.mrn || 'N/A'}`);
    console.log(`   Status: ${summary.status || 'N/A'}`);
    console.log(`   ID: ${summary.id || summary.compositionId}`);
    console.log(`   Created: ${summary.createdAt || 'N/A'}`);
    console.log('');
  });

  console.log(`\nTotal summaries from API: ${summaries.length}\n`);
}

main().catch(console.error);
