import { Firestore } from '@google-cloud/firestore';
import { resolveServiceAccountPath } from '../src/utils/path.helper';

/**
 * Get Firestore client
 */
function getFirestore(): Firestore {
  try {
    // Try to get service account path from environment or use default
    const envPath = process.env.FIRESTORE_SERVICE_ACCOUNT_PATH || process.env.SERVICE_ACCOUNT_PATH;
    let serviceAccountPath: string | undefined;
    
    if (envPath) {
      serviceAccountPath = resolveServiceAccountPath(envPath);
      console.log(`📁 Using service account: ${serviceAccountPath}`);
    } else {
      console.log('📁 Using default credentials (no service account path specified)');
    }

    return new Firestore();
  } catch (error) {
    console.error('❌ Error initializing Firestore:', (error as Error).message);
    throw error;
  }
}

/**
 * Update demo tenant's supported languages
 */
async function updateDemoTenantLanguages() {
  console.log('🌐 Updating demo tenant supported languages...\n');

  try {
    const firestore = getFirestore();
    console.log('✅ Firestore client initialized\n');

    const tenantId = 'demo';
    const docRef = firestore.collection('config').doc(tenantId);
    
    // Check if tenant exists
    const existingDoc = await docRef.get();
    
    if (!existingDoc.exists) {
      console.error(`❌ Tenant '${tenantId}' not found in Firestore`);
      console.log('   Creating new tenant config...');
      
      // Create new tenant config
      await docRef.set({
        id: tenantId,
        name: 'Demo Hospital',
        status: 'active',
        type: 'demo',
        branding: {
          logo: 'https://storage.googleapis.com/aivida-assets/logos/demo.png',
          favicon: 'https://storage.googleapis.com/aivida-assets/favicons/demo.ico',
          primaryColor: '#3b82f6',
          secondaryColor: '#60a5fa',
          accentColor: '#1e40af',
        },
        features: {
          aiGeneration: true,
          multiLanguage: true,
          supportedLanguages: ['es', 'hi', 'vi', 'fr', 'zh', 'ps'], // Spanish, Hindi, Vietnamese, French, Mandarin, Pashto
          fileUpload: true,
          expertPortal: true,
          clinicianPortal: true,
          adminPortal: true,
        },
        config: {
          simplificationEnabled: true,
          translationEnabled: true,
          defaultLanguage: 'en',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      console.log(`✅ Created tenant '${tenantId}' with supported languages: es, hi, vi, fr, zh, ps`);
    } else {
      // Update existing tenant's supported languages
      await docRef.update({
        'features.supportedLanguages': ['es', 'hi', 'vi', 'fr', 'zh', 'ps'], // Spanish, Hindi, Vietnamese, French, Mandarin, Pashto
        'features.multiLanguage': true,
        'config.translationEnabled': true,
        updatedAt: new Date(),
      });
      console.log(`✅ Updated tenant '${tenantId}' supported languages`);
    }

    console.log('\n📋 Updated configuration:');
    console.log('   Tenant: demo');
    console.log('   Supported Languages:');
    console.log('     - es (Spanish)');
    console.log('     - hi (Hindi)');
    console.log('     - vi (Vietnamese)');
    console.log('     - fr (French)');
    console.log('     - zh (Mandarin Chinese)');
    console.log('     - ps (Pashto)');
    console.log('   Translation Enabled: true');
    console.log('   Multi-language Enabled: true');
    
    console.log('\n✅ Language configuration updated successfully!');
  } catch (error) {
    console.error('\n❌ Update failed:', error);
    process.exit(1);
  }
}

// Run the update script
updateDemoTenantLanguages();

