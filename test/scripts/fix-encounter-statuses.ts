/**
 * Script to fix encounter statuses in ctest FHIR store
 * Changes status from "finished" to "in-progress" so they appear in discharge queue
 */

import axios from 'axios';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const FHIR_BASE = 'https://healthcare.googleapis.com/v1/projects/simtran-474018/locations/us-central1/datasets/ctest-dataset/fhirStores/ctest-fhir-store/fhir';

async function getAccessToken(): Promise<string> {
  const { stdout } = await execAsync('gcloud auth print-access-token');
  return stdout.trim();
}

async function main() {
  console.log('🔧 Fixing encounter statuses in ctest FHIR store');
  console.log('='.repeat(80));

  try {
    const token = await getAccessToken();
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/fhir+json',
    };

    // Get all encounters with status=finished
    console.log('\n📋 Fetching encounters with status=finished...');
    const searchResponse = await axios.get(`${FHIR_BASE}/Encounter?status=finished&_count=100`, { headers });

    if (!searchResponse.data.entry) {
      console.log('✅ No encounters to fix');
      return;
    }

    const encounters = searchResponse.data.entry.map((e: any) => e.resource);
    console.log(`✅ Found ${encounters.length} encounters to fix\n`);

    let fixed = 0;
    for (const encounter of encounters) {
      try {
        console.log(`   Fixing Encounter/${encounter.id} (Patient: ${encounter.subject.reference})...`);

        // Update status to in-progress
        encounter.status = 'in-progress';

        await axios.put(`${FHIR_BASE}/Encounter/${encounter.id}`, encounter, { headers });
        console.log(`   ✅ Fixed Encounter/${encounter.id} -> status: in-progress`);
        fixed++;
      } catch (error: any) {
        console.error(`   ❌ Failed to fix ${encounter.id}: ${error.message}`);
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log(`✅ Fixed ${fixed} out of ${encounters.length} encounters`);
    console.log('\n📝 Discharge queue mapping:');
    console.log('   - in-progress -> "review" status (shows in clinician queue)');
    console.log('   - finished/completed -> "approved" status (filtered out)');
    console.log('   - planned -> "pending" status (shows in clinician queue)');
    console.log('\n🎯 Next step: Refresh https://www.aividahealth.ai/ctest/clinician');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
