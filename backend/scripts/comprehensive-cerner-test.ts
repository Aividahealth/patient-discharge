/**
 * Comprehensive Cerner Integration Test Script
 *
 * This script performs complete integration testing of the Cerner integration
 * by directly calling the backend API endpoints.
 */

import axios, { AxiosInstance } from 'axios';

// Configuration
const BASE_URL = 'http://localhost:3000';
const TENANT_ID = 'default'; // Using default tenant from YAML config
const TEST_PATIENT_ID = '1'; // Harry Potter in Cerner sandbox

// Test results storage
interface TestResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  duration: number;
  details?: string;
  error?: string;
}

const results: TestResult[] = [];

// Create axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: {
    'X-Tenant-ID': TENANT_ID,
  },
  timeout: 30000,
});

/**
 * Helper to run a test and record results
 */
async function runTest(
  name: string,
  testFn: () => Promise<{ success: boolean; details?: string; error?: string }>,
): Promise<void> {
  console.log(`\n🧪 Running: ${name}`);
  const startTime = Date.now();

  try {
    const result = await testFn();
    const duration = Date.now() - startTime;

    results.push({
      name,
      status: result.success ? 'PASS' : 'FAIL',
      duration,
      details: result.details,
      error: result.error,
    });

    if (result.success) {
      console.log(`✅ PASS (${duration}ms): ${name}`);
      if (result.details) {
        console.log(`   ${result.details}`);
      }
    } else {
      console.log(`❌ FAIL (${duration}ms): ${name}`);
      console.log(`   ${result.error}`);
    }
  } catch (error: any) {
    const duration = Date.now() - startTime;
    results.push({
      name,
      status: 'FAIL',
      duration,
      error: error.message || String(error),
    });
    console.log(`❌ FAIL (${duration}ms): ${name}`);
    console.log(`   Unexpected error: ${error.message}`);
  }
}

/**
 * Test 1: Health Check
 */
async function testHealthCheck(): Promise<{ success: boolean; details?: string; error?: string }> {
  try {
    const response = await apiClient.get('/health');
    return {
      success: response.status === 200,
      details: `Backend is healthy`,
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Health check failed: ${error.message}`,
    };
  }
}

/**
 * Test 2: Get EHR Vendors List
 */
async function testGetVendors(): Promise<{ success: boolean; details?: string; error?: string }> {
  try {
    const response = await apiClient.get('/ehr/vendors');
    const vendors = response.data;

    if (!Array.isArray(vendors)) {
      return {
        success: false,
        error: 'Vendors list is not an array',
      };
    }

    const cernerVendor = vendors.find((v) => v.id === 'cerner');

    if (!cernerVendor) {
      return {
        success: false,
        error: 'Cerner vendor not found in vendors list',
      };
    }

    return {
      success: true,
      details: `Found ${vendors.length} vendors, including Cerner (${cernerVendor.name})`,
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Failed to get vendors: ${error.message}`,
    };
  }
}

/**
 * Test 3: Get Current Vendor for Tenant
 */
async function testGetCurrentVendor(): Promise<{ success: boolean; details?: string; error?: string }> {
  try {
    const response = await apiClient.get('/ehr/vendor');
    const vendor = response.data;

    if (vendor.id === 'cerner') {
      return {
        success: true,
        details: `Tenant is configured with Cerner vendor`,
      };
    } else {
      return {
        success: false,
        error: `Expected Cerner vendor, got: ${vendor.id}`,
      };
    }
  } catch (error: any) {
    return {
      success: false,
      error: `Failed to get current vendor: ${error.message}`,
    };
  }
}

/**
 * Test 4: Fetch Patient Resource from Cerner
 */
async function testFetchPatient(): Promise<{ success: boolean; details?: string; error?: string }> {
  try {
    const response = await apiClient.get(`/ehr/Patient/${TEST_PATIENT_ID}`);
    const patient = response.data;

    if (!patient.resourceType || patient.resourceType !== 'Patient') {
      return {
        success: false,
        error: `Invalid resource type: ${patient.resourceType}`,
      };
    }

    if (!patient.id || patient.id !== TEST_PATIENT_ID) {
      return {
        success: false,
        error: `Patient ID mismatch: expected ${TEST_PATIENT_ID}, got ${patient.id}`,
      };
    }

    const name = patient.name?.[0];
    const fullName = name ? `${name.given?.join(' ')} ${name.family}` : 'Unknown';

    return {
      success: true,
      details: `Fetched patient: ${fullName} (ID: ${patient.id})`,
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Failed to fetch patient: ${error.response?.data?.message || error.message}`,
    };
  }
}

/**
 * Test 5: Search for Discharge Summaries
 */
async function testSearchDischargeSummaries(): Promise<{ success: boolean; details?: string; error?: string }> {
  try {
    const response = await apiClient.get(`/ehr/discharge-summaries/${TEST_PATIENT_ID}`);
    const result = response.data;

    // It's OK if there are no discharge summaries, as long as the endpoint works
    if (result.count !== undefined) {
      return {
        success: true,
        details: `Found ${result.count} discharge summary/summaries for patient ${TEST_PATIENT_ID}`,
      };
    } else if (Array.isArray(result)) {
      return {
        success: true,
        details: `Found ${result.length} discharge summary/summaries for patient ${TEST_PATIENT_ID}`,
      };
    } else {
      return {
        success: false,
        error: `Unexpected response format: ${JSON.stringify(result)}`,
      };
    }
  } catch (error: any) {
    return {
      success: false,
      error: `Failed to search discharge summaries: ${error.response?.data?.message || error.message}`,
    };
  }
}

/**
 * Test 6: Test Token Reuse (Cerner-specific endpoint)
 */
async function testTokenReuse(): Promise<{ success: boolean; details?: string; error?: string }> {
  try {
    const response = await apiClient.get('/cerner/test/token-reuse');
    const result = response.data;

    if (result.success) {
      return {
        success: true,
        details: `Token caching works. First call: ${result.firstCallDuration}ms, Second call: ${result.secondCallDuration}ms`,
      };
    } else {
      return {
        success: false,
        error: `Token reuse test failed: ${result.message}`,
      };
    }
  } catch (error: any) {
    return {
      success: false,
      error: `Failed token reuse test: ${error.response?.data?.message || error.message}`,
    };
  }
}

/**
 * Test 7: Search for Specific FHIR Resources (Encounters)
 */
async function testSearchEncounters(): Promise<{ success: boolean; details?: string; error?: string }> {
  try {
    const response = await apiClient.get(`/ehr/Encounter?patient=${TEST_PATIENT_ID}`);
    const bundle = response.data;

    if (!bundle.resourceType || bundle.resourceType !== 'Bundle') {
      return {
        success: false,
        error: `Invalid resource type: ${bundle.resourceType}`,
      };
    }

    const total = bundle.total || (bundle.entry ? bundle.entry.length : 0);

    return {
      success: true,
      details: `Found ${total} encounter(s) for patient ${TEST_PATIENT_ID}`,
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Failed to search encounters: ${error.response?.data?.message || error.message}`,
    };
  }
}

/**
 * Test 8: Test EHR Cache Stats
 */
async function testCacheStats(): Promise<{ success: boolean; details?: string; error?: string }> {
  try {
    const response = await apiClient.get('/ehr/cache/stats');
    const stats = response.data;

    return {
      success: true,
      details: `Cache stats retrieved: ${JSON.stringify(stats)}`,
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Failed to get cache stats: ${error.response?.data?.message || error.message}`,
    };
  }
}

/**
 * Test 9: Test Cerner Authentication Sessions
 */
async function testAuthSessions(): Promise<{ success: boolean; details?: string; error?: string }> {
  try {
    const response = await apiClient.get('/auth/sessions');
    const sessions = response.data;

    return {
      success: true,
      details: `Active sessions: ${sessions.length || 0}`,
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Failed to get auth sessions: ${error.response?.data?.message || error.message}`,
    };
  }
}

/**
 * Test 10: Test Auth Stats
 */
async function testAuthStats(): Promise<{ success: boolean; details?: string; error?: string }> {
  try {
    const response = await apiClient.get('/auth/stats');
    const stats = response.data;

    return {
      success: true,
      details: `Auth stats: Total sessions: ${stats.totalSessions}, Active: ${stats.activeSessions}`,
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Failed to get auth stats: ${error.response?.data?.message || error.message}`,
    };
  }
}

/**
 * Print test summary
 */
function printSummary(): void {
  console.log('\n' + '='.repeat(80));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(80));

  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;
  const skipped = results.filter((r) => r.status === 'SKIP').length;
  const total = results.length;

  console.log(`\nTotal Tests: ${total}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⏭️  Skipped: ${skipped}`);
  console.log(`\nSuccess Rate: ${((passed / total) * 100).toFixed(1)}%`);

  console.log('\n' + '='.repeat(80));
  console.log('📋 DETAILED RESULTS');
  console.log('='.repeat(80));

  results.forEach((result, index) => {
    const icon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⏭️';
    console.log(`\n${index + 1}. ${icon} ${result.name} (${result.duration}ms)`);
    if (result.details) {
      console.log(`   ${result.details}`);
    }
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
  });

  console.log('\n' + '='.repeat(80));

  // Exit with appropriate code
  if (failed > 0) {
    console.log('❌ Some tests failed');
    process.exit(1);
  } else {
    console.log('✅ All tests passed!');
    process.exit(0);
  }
}

/**
 * Main test execution
 */
async function runAllTests(): Promise<void> {
  console.log('🚀 Starting Comprehensive Cerner Integration Tests');
  console.log('='.repeat(80));
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Tenant ID: ${TENANT_ID}`);
  console.log(`Test Patient ID: ${TEST_PATIENT_ID}`);
  console.log('='.repeat(80));

  // Run all tests
  await runTest('1. Health Check', testHealthCheck);
  await runTest('2. Get EHR Vendors List', testGetVendors);
  await runTest('3. Get Current Vendor for Tenant', testGetCurrentVendor);
  await runTest('4. Fetch Patient Resource from Cerner', testFetchPatient);
  await runTest('5. Search for Discharge Summaries', testSearchDischargeSummaries);
  await runTest('6. Test Token Reuse (Cerner)', testTokenReuse);
  await runTest('7. Search for Encounters', testSearchEncounters);
  await runTest('8. Test EHR Cache Stats', testCacheStats);
  await runTest('9. Test Cerner Authentication Sessions', testAuthSessions);
  await runTest('10. Test Auth Stats', testAuthStats);

  // Print summary
  printSummary();
}

// Run tests
runAllTests().catch((error) => {
  console.error('Fatal error running tests:', error);
  process.exit(1);
});
