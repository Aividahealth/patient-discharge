/**
 * Test Cerner authentication using exact same logic as CernerService
 */

import axios from 'axios';
import * as qs from 'qs';

const TENANT_ID = 'ec2458f2-1e24-41c8-b71b-0e701af7583d';

// Test configurations
const configs = [
  {
    name: 'Original credentials (from YAML)',
    client_id: '586c9547-92a4-49dd-8663-0ff3479c21fa',
    client_secret: '6Zxem8_cbX2ruxTPTmlBpdKAAoI78Bpb',
    token_url: `https://authorization.cerner.com/tenants/${TENANT_ID}/hosts/fhir-ehr-code.cerner.com/protocols/oauth2/profiles/smart-v1/token`,
    scopes: 'system/Patient.read system/DocumentReference.read system/Observation.read',
  },
  {
    name: 'NEW System credentials',
    client_id: '70cb05e1-9e4c-4b90-ae8e-4de00c92d9e7',
    client_secret: 'bEFd20RyzMktBu_5YTLEzrdzQw2-oSE9',
    token_url: `https://authorization.cerner.com/tenants/${TENANT_ID}/hosts/fhir-ehr-code.cerner.com/protocols/oauth2/profiles/smart-v1/token`,
    scopes: 'system/Patient.read system/DocumentReference.read system/Observation.read',
  },
];

async function testAuthentication(config: typeof configs[0]) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`Testing: ${config.name}`);
  console.log(`${'='.repeat(70)}`);
  console.log(`Client ID: ${config.client_id}`);
  console.log(`Token URL: ${config.token_url}`);
  console.log(`Scopes: ${config.scopes}`);
  console.log('');

  const credentials = Buffer.from(`${config.client_id}:${config.client_secret}`).toString('base64');
  const headers = {
    Authorization: `Basic ${credentials}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  };

  const data = qs.stringify({
    grant_type: 'client_credentials',
    scope: config.scopes,
  });

  console.log(`Request body (encoded): ${data}`);
  console.log('');

  try {
    const response = await axios.post(config.token_url, data, { headers });

    console.log('✅ SUCCESS!');
    console.log(`Access Token: ${response.data.access_token.substring(0, 50)}...`);
    console.log(`Token Type: ${response.data.token_type}`);
    console.log(`Expires In: ${response.data.expires_in} seconds`);

    return { success: true, token: response.data.access_token };
  } catch (error: any) {
    console.log('❌ FAILED!');
    console.log(`Status: ${error.response?.status || 'N/A'}`);
    console.log(`Status Text: ${error.response?.statusText || 'N/A'}`);
    console.log(`Error Message: ${error.message}`);

    if (error.response?.data) {
      console.log(`Response Data: ${JSON.stringify(error.response.data, null, 2)}`);
    }

    return { success: false, error: error.message };
  }
}

async function testPatientFetch(token: string) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`Testing Patient Fetch with Token`);
  console.log(`${'='.repeat(70)}`);

  const url = `https://fhir-ehr-code.cerner.com/r4/${TENANT_ID}/Patient/1`;

  try {
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/fhir+json',
      },
    });

    const patient = response.data;
    const name = patient.name?.[0];
    const fullName = name ? `${name.given?.join(' ')} ${name.family}` : 'Unknown';

    console.log('✅ SUCCESS!');
    console.log(`Patient: ${fullName} (ID: ${patient.id})`);
    console.log(`Resource Type: ${patient.resourceType}`);

    return true;
  } catch (error: any) {
    console.log('❌ FAILED!');
    console.log(`Status: ${error.response?.status || 'N/A'}`);
    console.log(`Error: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('\n🚀 Starting Cerner Authentication Tests');
  console.log('Using exact same logic as CernerService');
  console.log('');

  for (const config of configs) {
    const result = await testAuthentication(config);

    if (result.success && result.token) {
      // If auth succeeded, test patient fetch
      await testPatientFetch(result.token);
      break; // Stop after first successful auth
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('Tests Complete');
  console.log('='.repeat(70));
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
