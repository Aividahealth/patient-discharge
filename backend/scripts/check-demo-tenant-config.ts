/**
 * Script to check if demo tenant is completely configured as Manual
 * and does not have any Cerner configuration
 */

import { Firestore } from '@google-cloud/firestore';
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

async function checkDemoTenant() {
  console.log('🔍 Checking demo tenant configuration...\n');

  try {
    const firestore = getFirestore();
    const doc = await firestore.collection('config').doc('demo').get();
    
    if (!doc.exists) {
      console.log('❌ Demo tenant not found in Firestore');
      return;
    }
    
    const data = doc.data();
    console.log('📋 Demo Tenant Configuration:');
    console.log('='.repeat(60));
    console.log('Tenant ID:', data?.id || 'demo');
    console.log('Tenant Name:', data?.name || 'N/A');
    console.log('');
    
    // Check EHR Integration
    console.log('🔍 EHR Integration Check:');
    const ehrIntegration = data?.ehrIntegration;
    
    if (!ehrIntegration) {
      console.log('   ✅ No EHR integration configured (defaults to Manual)');
    } else {
      console.log('   Type:', ehrIntegration.type || 'N/A');
      
      if (ehrIntegration.type === 'Manual') {
        console.log('   ✅ EHR Integration Type is Manual');
      } else {
        console.log(`   ❌ EHR Integration Type is "${ehrIntegration.type}" (should be Manual)`);
      }
      
      // Check for Cerner config
      if (ehrIntegration.cerner) {
        console.log('   ❌ WARNING: Cerner configuration found!');
        console.log('      Base URL:', ehrIntegration.cerner.base_url || 'N/A');
        console.log('      System App:', !!ehrIntegration.cerner.system_app);
        console.log('      Provider App:', !!ehrIntegration.cerner.provider_app);
        console.log('      Patients:', ehrIntegration.cerner.patients?.length || 0);
      } else {
        console.log('   ✅ No Cerner configuration (correct for Manual)');
      }
      
      // Check for EPIC config
      if (ehrIntegration.epic) {
        console.log('   ⚠️  EPIC configuration found (should be removed for Manual)');
      }
    }
    
    console.log('');
    console.log('🔍 Legacy Config Check:');
    if (data?.config?.tenantConfig?.cerner) {
      console.log('   ⚠️  WARNING: Legacy Cerner config found in config.tenantConfig.cerner');
      console.log('      This should have been migrated or removed');
    } else {
      console.log('   ✅ No legacy Cerner config');
    }
    
    console.log('');
    console.log('🔍 YAML Config Check:');
    const env = process.env.NODE_ENV || 'dev';
    const yamlPath = `.settings.${env}/config.yaml`;
    if (fs.existsSync(yamlPath)) {
      const yamlContent = fs.readFileSync(yamlPath, 'utf8');
      // Check if demo tenant section has cerner config
      const demoSectionMatch = yamlContent.match(/^\s*demo:\s*$/m);
      if (demoSectionMatch) {
        const demoSectionStart = yamlContent.indexOf('demo:');
        const nextTenantMatch = yamlContent.substring(demoSectionStart).match(/^\s*[a-z_]+:\s*$/m);
        const demoSectionEnd = nextTenantMatch && nextTenantMatch.index !== undefined
          ? demoSectionStart + nextTenantMatch.index 
          : yamlContent.length;
        const demoSection = yamlContent.substring(demoSectionStart, demoSectionEnd);
        
        if (demoSection.includes('cerner:') && demoSection.includes('base_url:')) {
          console.log('   ⚠️  WARNING: YAML config file contains Cerner config for demo tenant');
          console.log('      This will be used as fallback if Firestore config is missing');
          console.log('      Recommendation: Remove Cerner config from YAML for demo tenant');
        } else {
          console.log('   ✅ No Cerner config in YAML for demo tenant');
        }
      } else {
        console.log('   ✅ Demo tenant not found in YAML (this is OK)');
      }
    } else {
      console.log('   ℹ️  YAML config file not found (this is OK)');
    }
    
    console.log('');
    console.log('='.repeat(60));
    console.log('📊 Summary:');
    console.log('='.repeat(60));
    
    const issues: string[] = [];
    
    if (ehrIntegration?.type !== 'Manual') {
      issues.push(`EHR Integration Type is "${ehrIntegration?.type}" instead of "Manual"`);
    }
    
    if (ehrIntegration?.cerner) {
      issues.push('Cerner configuration exists in Firestore (should be removed for Manual tenant)');
    }
    
    if (data?.config?.tenantConfig?.cerner) {
      issues.push('Legacy Cerner config exists in config.tenantConfig.cerner');
    }
    
    if (issues.length === 0) {
      console.log('✅ Demo tenant is correctly configured as Manual in Firestore');
      console.log('⚠️  However, check YAML config - it may still have Cerner config as fallback');
      console.log('✅ Demo tenant should NOT connect to Cerner sandbox');
    } else {
      console.log('❌ Issues found:');
      issues.forEach((issue, index) => {
        console.log(`   ${index + 1}. ${issue}`);
      });
      console.log('');
      console.log('⚠️  Demo tenant may still connect to Cerner sandbox');
    }
    
  } catch (error) {
    console.error('❌ Error checking demo tenant:', error);
    throw error;
  }
}

checkDemoTenant()
  .then(() => {
    console.log('\n✅ Check completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Check failed:', error);
    process.exit(1);
  });

