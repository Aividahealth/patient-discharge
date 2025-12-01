/**
 * Script to fix composition types in ctest FHIR store
 * Changes type from "11488-4" to "18842-5" for compositions with encounter references
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
  console.log('🔧 Fixing composition types in ctest FHIR store');
  console.log('='.repeat(80));

  try {
    const token = await getAccessToken();
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/fhir+json',
    };

    // Get all compositions with encounters (type 11488-4)
    console.log('\n📋 Fetching compositions with type 11488-4 that have encounter references...');
    const searchResponse = await axios.get(`${FHIR_BASE}/Composition?type=http://loinc.org|11488-4&_count=100`, { headers });

    if (!searchResponse.data.entry) {
      console.log('✅ No compositions to fix');
      return;
    }

    const compositions = searchResponse.data.entry
      .map((e: any) => e.resource)
      .filter((c: any) => c.encounter?.reference); // Only fix compositions with encounter references

    console.log(`✅ Found ${compositions.length} compositions to fix\n`);

    let fixed = 0;
    for (const comp of compositions) {
      try {
        console.log(`   Fixing ${comp.id}...`);

        // Update type to 18842-5
        comp.type = {
          coding: [
            {
              system: 'http://loinc.org',
              code: '18842-5',
              display: 'Discharge Summary',
            },
          ],
        };

        await axios.put(`${FHIR_BASE}/Composition/${comp.id}`, comp, { headers });
        console.log(`   ✅ Fixed ${comp.id}`);
        fixed++;
      } catch (error: any) {
        console.error(`   ❌ Failed to fix ${comp.id}: ${error.message}`);
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log(`✅ Fixed ${fixed} out of ${compositions.length} compositions`);
    console.log('\n📝 Next step: Refresh the clinician portal to see patients');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
