/**
 * Script to update ctest tenant pub/sub topic to use the default topic
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
  console.log('🔧 Updating ctest tenant pub/sub configuration');
  console.log('='.repeat(80));

  try {
    const firestore = await getFirestore();
    const docRef = firestore.collection('config').doc('ctest');
    const doc = await docRef.get();

    if (!doc.exists) {
      console.log('❌ ctest tenant config not found in Firestore');
      process.exit(1);
    }

    console.log('✅ Found ctest tenant config');

    // Update with pub/sub configuration
    await docRef.update({
      'pubsub.topic_name': 'discharge-export-events',
      updatedAt: new Date(),
    });

    console.log('✅ Updated ctest tenant pub/sub configuration');
    console.log('   Topic name: discharge-export-events');

    // Verify the update
    const updatedDoc = await docRef.get();
    const data = updatedDoc.data();

    console.log('\n🔍 Verification:');
    console.log('   Pub/Sub topic:', data?.pubsub?.topic_name || '(not found)');

    console.log('\n' + '='.repeat(80));
    console.log('✅ Configuration update complete!');
    console.log('\n📝 Next step:');
    console.log('   The backend will now publish events to the default topic');
    console.log('   that the discharge-export-processor is listening to.');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
