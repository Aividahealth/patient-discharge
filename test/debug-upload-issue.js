/**
 * Debug script to understand why test uploads don't trigger event processing
 */
const { Firestore } = require('@google-cloud/firestore');
const path = require('path');
const fs = require('fs');
const YAML = require('yaml');

const TENANT_ID = 'demo';

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

  console.log('\n🔍 Comparing test uploads vs manual uploads...\n');

  // Get all summaries for demo tenant (no ordering to avoid index requirement)
  const allSnapshot = await firestore
    .collection('discharge_summaries')
    .where('tenantId', '==', TENANT_ID)
    .limit(50)
    .get();

  const testSummaries = [];
  const nonTestSummaries = [];

  allSnapshot.forEach(doc => {
    const data = doc.data();
    if (data.testTag === 'portal-integration-test') {
      testSummaries.push({ id: doc.id, ...data });
    } else if (!data.testTag) {
      nonTestSummaries.push({ id: doc.id, ...data });
    }
  });

  const testSnapshot = {
    empty: testSummaries.length === 0,
    docs: testSummaries.map(s => ({ id: s.id, data: () => s }))
  };

  if (!testSnapshot.empty) {
    console.log(`📋 FOUND ${testSummaries.length} TEST UPLOADS:\n`);

    // Sort by creation time (most recent first)
    testSummaries.sort((a, b) => {
      const aTime = a.createdAt?.toMillis() || 0;
      const bTime = b.createdAt?.toMillis() || 0;
      return bTime - aTime;
    });

    // Show latest test upload
    const testData = testSummaries[0];

    console.log('📋 LATEST TEST UPLOAD:');
    console.log('  ID:', testData.id);
    console.log('  Patient Name:', testData.patientName);
    console.log('  Status:', testData.status);
    console.log('  Created By:', testData.createdBy);
    console.log('  Uploaded By (User ID):', testData.uploadedBy);
    console.log('  Created At:', testData.createdAt?.toDate());
    console.log('  Test Tag:', testData.testTag);
    console.log('  Has FHIR ID:', !!testData.fhirResourceId);
    console.log('  Composition ID:', testData.compositionId);
    console.log('  Files:', Object.keys(testData.files || {}));
    console.log('\n  All fields:', Object.keys(testData).sort().join(', '));

    // Check if this looks like a UI upload vs direct Firestore creation
    const isUIUpload = testData.patientName && testData.patientName.includes('[TEST] Patient');
    console.log('  Likely UI Upload:', isUIUpload);
    console.log('');

    // Show all test uploads to find UI ones
    console.log('\n📋 ALL TEST UPLOADS (sorted by creation time):');
    testSummaries.forEach((summary, i) => {
      const isUI = summary.patientName && summary.patientName.includes('[TEST] Patient');
      console.log(`  ${i + 1}. ${summary.patientName} (${summary.createdAt?.toDate().toISOString()}) ${isUI ? '👉 UI UPLOAD' : ''}`);
      console.log(`     Created By: ${summary.createdBy}, FHIR ID: ${summary.fhirResourceId || 'NONE'}`);
    });
    console.log('');
  } else {
    console.log('❌ No test uploads found\n');
  }

  if (nonTestSummaries.length > 0) {
    const manualData = nonTestSummaries[0];

    console.log('📋 MANUAL UPLOAD (from UI by real user):');
    console.log('  ID:', manualData.id);
    console.log('  Patient Name:', manualData.patientName);
    console.log('  Status:', manualData.status);
    console.log('  Created By:', manualData.createdBy);
    console.log('  Uploaded By (User ID):', manualData.uploadedBy);
    console.log('  Created At:', manualData.createdAt?.toDate());
    console.log('  Test Tag:', manualData.testTag || 'none');
    console.log('  Has FHIR ID:', !!manualData.fhirResourceId);
    console.log('  Files:', Object.keys(manualData.files || {}));
    console.log('\n  All fields:', Object.keys(manualData).sort().join(', '));
    console.log('');
  } else {
    console.log('❌ No manual uploads found\n');
  }

  // Compare field differences
  if (!testSnapshot.empty && nonTestSummaries.length > 0) {
    const testData = testSnapshot.docs[0].data();
    const manualData = nonTestSummaries[0];

    const testFields = new Set(Object.keys(testData));
    const manualFields = new Set(Object.keys(manualData));

    const onlyInTest = Array.from(testFields).filter(f => !manualFields.has(f));
    const onlyInManual = Array.from(manualFields).filter(f => !testFields.has(f));

    if (onlyInTest.length > 0 || onlyInManual.length > 0) {
      console.log('🔍 FIELD DIFFERENCES:');
      if (onlyInTest.length > 0) {
        console.log('  Only in test upload:', onlyInTest.join(', '));
      }
      if (onlyInManual.length > 0) {
        console.log('  Only in manual upload:', onlyInManual.join(', '));
      }
      console.log('');
    }

    // Check specific field value differences
    console.log('🔍 KEY FIELD COMPARISON:');
    const compareFields = ['status', 'createdBy', 'uploadedBy', 'fhirResourceId', 'compositionId'];
    compareFields.forEach(field => {
      const testVal = testData[field];
      const manualVal = manualData[field];
      if (testVal !== manualVal) {
        console.log(`  ${field}:`);
        console.log(`    Test:   ${testVal}`);
        console.log(`    Manual: ${manualVal}`);
      }
    });
  }

  console.log('\n');
}

main().catch(console.error);
