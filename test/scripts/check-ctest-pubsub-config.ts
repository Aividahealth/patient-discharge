/**
 * Script to check ctest tenant pub/sub configuration in Firestore
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
  console.log('🔍 Checking ctest tenant pub/sub configuration in Firestore');
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
    console.log('\n📄 Full ctest tenant configuration:');
    console.log(JSON.stringify(data, null, 2));

    // Check pub/sub configuration
    console.log('\n🔍 Pub/Sub Configuration Analysis:');
    console.log('='.repeat(80));

    if (data?.pubsub) {
      console.log('✅ Pub/Sub configuration found:');
      console.log('   Topic Name:', data.pubsub.topic_name || data.pubsub.topicName || '(not set)');
      console.log('   Service Account Path:', data.pubsub.service_account_path || data.pubsub.serviceAccountPath || '(not set)');
    } else {
      console.log('⚠️  No pub/sub configuration found in tenant config');
      console.log('   This means the tenant will use the default topic');
    }

    // Check EHR integration
    console.log('\n🏥 EHR Integration:');
    console.log('='.repeat(80));
    if (data?.ehrIntegration?.type) {
      console.log(`✅ EHR Type: ${data.ehrIntegration.type}`);
    }
    if (data?.ehrIntegration?.cerner) {
      console.log('✅ Cerner configuration exists');
      console.log('   Base URL:', data.ehrIntegration.cerner.base_url);
      console.log('   Patients:', data.ehrIntegration.cerner.patients?.join(', ') || 'none');
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ Configuration check complete');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
