/**
 * Migration script to move legacy config.tenantConfig.cerner to ehrIntegration.cerner
 * 
 * This script:
 * 1. Finds all tenants with legacy config.tenantConfig.cerner structure
 * 2. Migrates them to ehrIntegration.cerner structure
 * 3. Preserves all existing data
 */

import { Firestore } from '@google-cloud/firestore';
import * as fs from 'fs';
import * as path from 'path';

function getFirestore(): Firestore {
  try {
    // Try to use service account if available
    const serviceAccountPath = process.env.FIRESTORE_SERVICE_ACCOUNT_PATH || 
                               process.env.SERVICE_ACCOUNT_PATH;
    
    if (serviceAccountPath) {
      const resolved = path.resolve(process.cwd(), serviceAccountPath);
      if (fs.existsSync(resolved)) {
        return new Firestore({ keyFilename: resolved });
      }
    }
    
    // Fall back to Application Default Credentials
    return new Firestore();
  } catch (error) {
    console.error('Failed to initialize Firestore:', error);
    throw error;
  }
}

async function migrateTenantConfigs() {
  console.log('🔄 Starting migration of legacy config to ehrIntegration structure...\n');

  try {
    const firestore = getFirestore();
    console.log('✅ Firestore client initialized\n');

    // Get all tenant documents
    const configCollection = firestore.collection('config');
    const snapshot = await configCollection.get();

    if (snapshot.empty) {
      console.log('⚠️  No tenant configs found in Firestore');
      return;
    }

    console.log(`📋 Found ${snapshot.size} tenant config(s) to check\n`);

    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const doc of snapshot.docs) {
      const tenantId = doc.id;
      const data = doc.data();

      console.log(`\n📝 Processing tenant: ${tenantId}`);

      try {
        // Check if legacy config exists
        const legacyConfig = data.config?.tenantConfig?.cerner;
        const hasLegacyConfig = legacyConfig && (
          legacyConfig.base_url || 
          legacyConfig.client_id || 
          legacyConfig.system_app
        );

        // Check if new structure already exists
        const hasNewConfig = data.ehrIntegration?.cerner && (
          data.ehrIntegration.cerner.base_url || 
          data.ehrIntegration.cerner.system_app
        );

        if (!hasLegacyConfig) {
          if (hasNewConfig) {
            console.log(`   ✅ Already using new structure (ehrIntegration.cerner)`);
            skippedCount++;
          } else {
            console.log(`   ⚠️  No Cerner config found (neither legacy nor new)`);
            skippedCount++;
          }
          continue;
        }

        if (hasNewConfig) {
          console.log(`   ⚠️  Both legacy and new config exist. Keeping new structure.`);
          skippedCount++;
          continue;
        }

        // Migrate legacy config to new structure
        console.log(`   🔄 Migrating legacy config to ehrIntegration.cerner...`);

        const updateData: any = {
          updatedAt: new Date(),
        };

        // Build ehrIntegration structure
        if (!data.ehrIntegration) {
          updateData.ehrIntegration = {
            type: 'Cerner',
            cerner: {},
          };
        } else if (!data.ehrIntegration.cerner) {
          updateData.ehrIntegration = {
            ...data.ehrIntegration,
            type: data.ehrIntegration.type || 'Cerner',
            cerner: {},
          };
        } else {
          updateData['ehrIntegration.cerner'] = {};
        }

        const cernerConfig: any = {};

        // Migrate base_url
        if (legacyConfig.base_url) {
          cernerConfig.base_url = legacyConfig.base_url;
          console.log(`      ✅ Migrated base_url`);
        }

        // Migrate system_app (new structure) or legacy client_id/client_secret
        if (legacyConfig.system_app) {
          cernerConfig.system_app = {
            client_id: legacyConfig.system_app.client_id,
            client_secret: legacyConfig.system_app.client_secret,
            token_url: legacyConfig.system_app.token_url,
            scopes: legacyConfig.system_app.scopes,
          };
          console.log(`      ✅ Migrated system_app`);
        } else if (legacyConfig.client_id && legacyConfig.client_secret) {
          // Convert legacy single app config to system_app
          cernerConfig.system_app = {
            client_id: legacyConfig.client_id,
            client_secret: legacyConfig.client_secret,
            token_url: legacyConfig.token_url || '',
            scopes: legacyConfig.scopes || '',
          };
          console.log(`      ✅ Migrated legacy client_id/client_secret to system_app`);
        }

        // Migrate provider_app if exists
        if (legacyConfig.provider_app) {
          cernerConfig.provider_app = {
            client_id: legacyConfig.provider_app.client_id,
            client_secret: legacyConfig.provider_app.client_secret,
            authorization_url: legacyConfig.provider_app.authorization_url,
            token_url: legacyConfig.provider_app.token_url,
            redirect_uri: legacyConfig.provider_app.redirect_uri,
            scopes: legacyConfig.provider_app.scopes,
          };
          console.log(`      ✅ Migrated provider_app`);
        }

        // Migrate patients list if exists
        if (legacyConfig.patients && Array.isArray(legacyConfig.patients)) {
          cernerConfig.patients = legacyConfig.patients;
          console.log(`      ✅ Migrated patients list (${legacyConfig.patients.length} patients)`);
        }

        // Update Firestore
        if (updateData.ehrIntegration) {
          updateData.ehrIntegration.cerner = cernerConfig;
          await doc.ref.update(updateData);
        } else {
          // Use dot notation for nested update
          await doc.ref.update({
            'ehrIntegration.cerner': cernerConfig,
            updatedAt: new Date(),
          });
        }

        console.log(`   ✅ Successfully migrated ${tenantId}`);
        migratedCount++;

      } catch (error) {
        console.error(`   ❌ Error migrating ${tenantId}:`, error.message);
        errorCount++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 Migration Summary');
    console.log('='.repeat(60));
    console.log(`✅ Migrated: ${migratedCount}`);
    console.log(`⏭️  Skipped: ${skippedCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log('='.repeat(60));

    if (migratedCount > 0) {
      console.log('\n✅ Migration complete! Legacy configs have been moved to ehrIntegration.cerner');
    } else {
      console.log('\nℹ️  No migrations were needed. All configs are already in the new structure.');
    }

  } catch (error) {
    console.error('❌ Fatal error during migration:', error);
    throw error;
  }
}

// Run the migration
migrateTenantConfigs()
  .then(() => {
    console.log('\n✅ Migration script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration script failed:', error);
    process.exit(1);
  });

