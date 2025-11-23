/**
 * Script to clean up Cerner configuration from demo tenant in Firestore
 * This ensures demo tenant is completely configured as Manual with no Cerner config
 */

import { Firestore, FieldValue } from '@google-cloud/firestore';
import { resolveServiceAccountPath } from '../src/utils/path.helper';
import * as fs from 'fs';

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

async function cleanupDemoTenant() {
  console.log('🧹 Cleaning up Cerner configuration from demo tenant...\n');

  try {
    const firestore = getFirestore();
    const docRef = firestore.collection('config').doc('demo');
    const doc = await docRef.get();
    
    if (!doc.exists) {
      console.log('❌ Demo tenant not found in Firestore');
      return;
    }
    
    const data = doc.data();
    console.log('📋 Current Demo Tenant Configuration:');
    console.log('   EHR Integration Type:', data?.ehrIntegration?.type || 'N/A');
    console.log('   Has Cerner Config:', !!data?.ehrIntegration?.cerner);
    console.log('   Has Legacy Cerner Config:', !!data?.config?.tenantConfig?.cerner);
    console.log('');
    
    const updates: any = {};
    let hasChanges = false;
    
    // Build the updated ehrIntegration object
    const currentEhrIntegration = data?.ehrIntegration || {};
    const updatedEhrIntegration: any = {
      type: 'Manual',
    };
    
    // Copy over any non-Cerner fields (like epic, etc.)
    if (currentEhrIntegration.epic) {
      updatedEhrIntegration.epic = currentEhrIntegration.epic;
    }
    
    // Check if we need to update ehrIntegration
    if (currentEhrIntegration.type !== 'Manual' || currentEhrIntegration.cerner) {
      console.log('✏️  Updating ehrIntegration to Manual and removing Cerner config...');
      updates.ehrIntegration = updatedEhrIntegration;
      hasChanges = true;
    }
    
    // Remove legacy Cerner config if it exists
    if (data?.config?.tenantConfig?.cerner) {
      console.log('🗑️  Removing legacy Cerner config from config.tenantConfig.cerner...');
      updates['config.tenantConfig.cerner'] = FieldValue.delete();
      hasChanges = true;
    }
    
    if (hasChanges) {
      updates.updatedAt = new Date();
      await docRef.update(updates);
      console.log('');
      console.log('✅ Successfully cleaned up demo tenant configuration');
      console.log('   ✅ Removed Cerner config from ehrIntegration');
      console.log('   ✅ Removed legacy Cerner config');
      console.log('   ✅ Ensured ehrIntegration.type is Manual');
    } else {
      console.log('✅ Demo tenant is already clean - no changes needed');
    }
    
  } catch (error) {
    console.error('❌ Error cleaning up demo tenant:', error);
    throw error;
  }
}

cleanupDemoTenant()
  .then(() => {
    console.log('\n✅ Cleanup completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Cleanup failed:', error);
    process.exit(1);
  });

