import { Firestore } from '@google-cloud/firestore';
import { resolveServiceAccountPath } from '../src/utils/path.helper';
import * as fs from 'fs';

/**
 * Get Firestore client
 */
function getFirestore(): Firestore {
  try {
    const env = process.env.NODE_ENV || 'dev';
    const configPath = resolveServiceAccountPath('fhir_store_sa.json', env);
    
    if (fs.existsSync(configPath)) {
      console.log(`Using service account: ${configPath}`);
      return new Firestore({ keyFilename: configPath });
    } else {
      console.log('Using Application Default Credentials');
      return new Firestore();
    }
  } catch (error) {
    console.error('Error initializing Firestore:', (error as Error).message);
    throw error;
  }
}

/**
 * Update tenant EHR integration configuration
 */
async function updateTenantEhrIntegration() {
  console.log('🔄 Updating tenant EHR integration configurations...\n');

  try {
    const firestore = getFirestore();
    console.log('✅ Firestore client initialized\n');

    // Update demo tenant to Manual
    const demoTenantId = 'demo';
    const demoDocRef = firestore.collection('config').doc(demoTenantId);
    const demoDoc = await demoDocRef.get();
    
    if (demoDoc.exists) {
      await demoDocRef.update({
        ehrIntegration: {
          type: 'Manual',
        },
        updatedAt: new Date(),
      });
      console.log(`✅ Updated '${demoTenantId}' tenant: EHR Integration = Manual`);
    } else {
      console.log(`⚠️  Tenant '${demoTenantId}' not found in Firestore`);
    }

    // Update ctest tenant to Cerner
    const ctestTenantId = 'ctest';
    const ctestDocRef = firestore.collection('config').doc(ctestTenantId);
    const ctestDoc = await ctestDocRef.get();
    
    if (ctestDoc.exists) {
      // Get existing cerner config from YAML or use defaults
      // For now, we'll set it to Cerner type but the actual Cerner config should be set via system admin UI
      await ctestDocRef.update({
        ehrIntegration: {
          type: 'Cerner',
          // Note: Cerner connection details should be configured via system admin portal
          // This script just sets the type
        },
        updatedAt: new Date(),
      });
      console.log(`✅ Updated '${ctestTenantId}' tenant: EHR Integration = Cerner`);
      console.log(`   Note: Cerner connection details should be configured via system admin portal`);
    } else {
      console.log(`⚠️  Tenant '${ctestTenantId}' not found in Firestore`);
    }

    console.log('\n✅ EHR integration update complete!');
  } catch (error) {
    console.error('❌ Error updating EHR integration:', (error as Error).message);
    throw error;
  }
}

// Run the update
updateTenantEhrIntegration()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });

