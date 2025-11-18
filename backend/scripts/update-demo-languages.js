const { Firestore } = require('@google-cloud/firestore');

/**
 * Update demo tenant's supported languages
 */
async function updateDemoTenantLanguages() {
  console.log('🌐 Updating demo tenant supported languages...\n');

  try {
    // Initialize Firestore with project ID
    const firestore = new Firestore({
      projectId: 'simtran-474018',
    });
    console.log('✅ Firestore client initialized\n');

    const tenantId = 'demo';
    const docRef = firestore.collection('config').doc(tenantId);
    
    // Check if tenant exists
    const existingDoc = await docRef.get();
    
    if (!existingDoc.exists) {
      console.log(`Creating new tenant config for '${tenantId}'...`);
      
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
          supportedLanguages: ['es', 'vi', 'fr', 'zh'], // Spanish, Vietnamese, French, Mandarin
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
      console.log(`✅ Created tenant '${tenantId}' with supported languages: es, vi, fr, zh`);
    } else {
      console.log(`Updating existing tenant '${tenantId}'...`);
      
      // Update existing tenant's supported languages
      await docRef.update({
        'features.supportedLanguages': ['es', 'vi', 'fr', 'zh'], // Spanish, Vietnamese, French, Mandarin
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
    console.log('     - vi (Vietnamese)');
    console.log('     - fr (French)');
    console.log('     - zh (Mandarin Chinese)');
    console.log('   Translation Enabled: true');
    console.log('   Multi-language Enabled: true');
    
    console.log('\n✅ Language configuration updated successfully!');
  } catch (error) {
    console.error('\n❌ Update failed:', error.message);
    console.error('\n💡 Tip: Make sure you have Firestore permissions for project simtran-474018');
    console.error('   Run: gcloud auth application-default login');
    process.exit(1);
  }
}

// Run the update script
updateDemoTenantLanguages();

