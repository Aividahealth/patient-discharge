/**
 * Script to fix ctest tenant Google FHIR store configuration
 * Moves infrastructure.google to top-level google field
 */

import { Firestore } from '@google-cloud/firestore';
import * as fs from 'fs';
import * as path from 'path';

async function getFirestore(): Promise<Firestore> {
  try {
    const serviceAccountPath = process.env.FIRESTORE_SERVICE_ACCOUNT_PATH ||
                               process.env.SERVICE_ACCOUNT_PATH;

    if (serviceAccountPath) {
      const resolved = path.resolve(process.cwd(), serviceAccountPath);
      if (fs.existsSync(resolved)) {
        return new Firestore({ keyFilename: resolved });
      }
    }

    return new Firestore();
  } catch (error) {
    console.error('Failed to initialize Firestore:', error);
    throw error;
  }
}

async function main() {
  console.log('🔧 Fixing ctest tenant Google FHIR store configuration');
  console.log('='.repeat(80));

  try {
    const firestore = await getFirestore();
    const docRef = firestore.collection('config').doc('ctest');
    const doc = await docRef.get();

    if (!doc.exists) {
      console.log('❌ ctest tenant config not found in Firestore');
      process.exit(1);
    }

    const data = doc.data();
    console.log('✅ Found ctest tenant config\n');

    // Check current configuration
    console.log('📍 Current configuration:');
    console.log('   infrastructure.google:', JSON.stringify(data?.infrastructure?.google, null, 2));
    console.log('   google (top-level):', JSON.stringify(data?.google, null, 2));

    // Move infrastructure.google to top-level google
    const googleConfig = data?.infrastructure?.google;

    if (!googleConfig) {
      console.log('\n❌ No infrastructure.google configuration found');
      process.exit(1);
    }

    console.log('\n🔄 Moving infrastructure.google to top-level google field...');

    await docRef.update({
      google: googleConfig,
      updatedAt: new Date(),
    });

    console.log('✅ Updated configuration successfully\n');

    // Verify the update
    const updatedDoc = await docRef.get();
    const updatedData = updatedDoc.data();

    console.log('🔍 Verification:');
    console.log('   google.dataset:', updatedData?.google?.dataset || '(not found)');
    console.log('   google.fhir_store:', updatedData?.google?.fhir_store || '(not found)');

    console.log('\n' + '='.repeat(80));
    console.log('✅ Configuration fix complete!');
    console.log('\n📝 Next step:');
    console.log('   The backend will now write to ctest-dataset/ctest-fhir-store');
    console.log('   Re-run the encounter export to create resources in the correct store');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
