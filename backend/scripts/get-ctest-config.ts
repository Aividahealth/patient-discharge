/**
 * Script to get ctest tenant configuration from Firestore
 */

import { Firestore } from '@google-cloud/firestore';
import * as fs from 'fs';
import * as path from 'path';

function getFirestore(): Firestore {
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

async function getCtestConfig() {
  try {
    const firestore = getFirestore();
    const doc = await firestore.collection('config').doc('ctest').get();
    
    if (!doc.exists) {
      console.log('❌ ctest tenant not found in Firestore');
      return;
    }
    
    const data = doc.data();
    console.log('\n📋 ctest Tenant Configuration:');
    console.log('='.repeat(60));
    console.log(JSON.stringify(data, null, 2));
    console.log('='.repeat(60));
    
    // Specifically check ehrIntegration
    if (data?.ehrIntegration) {
      console.log('\n🔍 EHR Integration:');
      console.log('Type:', data.ehrIntegration.type);
      
      if (data.ehrIntegration.cerner) {
        console.log('\n✅ Cerner Configuration Found:');
        console.log('Base URL:', data.ehrIntegration.cerner.base_url || 'N/A');
        console.log('System App Client ID:', data.ehrIntegration.cerner.system_app?.client_id ? '✅ Present' : '❌ Missing');
        console.log('System App Client Secret:', data.ehrIntegration.cerner.system_app?.client_secret ? '✅ Present' : '❌ Missing');
        console.log('System App Token URL:', data.ehrIntegration.cerner.system_app?.token_url || 'N/A');
        console.log('System App Scopes:', data.ehrIntegration.cerner.system_app?.scopes || 'N/A');
        console.log('Provider App Client ID:', data.ehrIntegration.cerner.provider_app?.client_id ? '✅ Present' : '❌ Missing');
        console.log('Patients:', data.ehrIntegration.cerner.patients?.length || 0, 'configured');
      } else {
        console.log('\n❌ Cerner configuration not found in ehrIntegration');
      }
    } else {
      console.log('\n❌ ehrIntegration not found');
    }
    
    // Check legacy config structure
    if (data?.config?.tenantConfig?.cerner) {
      console.log('\n⚠️  Legacy config.tenantConfig.cerner found (should be migrated):');
      console.log('Base URL:', data.config.tenantConfig.cerner.base_url || 'N/A');
    }
    
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

getCtestConfig()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });

