/**
 * Script to perform initial sync of discharge summaries from GCS to Firestore
 * Run with: npm run sync-discharge-summaries
 */

import axios from 'axios';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';

async function main() {
  console.log('Starting discharge summaries sync...');
  console.log(`Backend URL: ${BACKEND_URL}`);
  console.log('');

  try {
    // Call the sync endpoint
    const response = await axios.post(
      `${BACKEND_URL}/discharge-summaries/sync/all`,
    );

    const result = response.data;

    console.log('Sync completed:');
    console.log(`  Success: ${result.success}`);
    console.log(`  Synced: ${result.synced}`);
    console.log(`  Failed: ${result.failed}`);
    console.log('');

    if (result.errors && result.errors.length > 0) {
      console.log('Errors:');
      result.errors.forEach((error: string) => {
        console.log(`  - ${error}`);
      });
    }

    // Get statistics
    console.log('Fetching statistics...');
    const statsResponse = await axios.get(
      `${BACKEND_URL}/discharge-summaries/stats/overview`,
    );

    const stats = statsResponse.data;

    console.log('');
    console.log('Statistics:');
    console.log('  Firestore:');
    console.log(`    Total: ${stats.firestore.total}`);
    console.log('    By Status:');
    Object.entries(stats.firestore.byStatus).forEach(([status, count]) => {
      console.log(`      ${status}: ${count}`);
    });

    console.log('  GCS:');
    console.log(`    Raw: ${stats.gcs.raw}`);
    console.log(`    Simplified: ${stats.gcs.simplified}`);
    console.log(`    Translated: ${stats.gcs.translated}`);

    process.exit(0);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('Error syncing discharge summaries:');
      console.error(`  Status: ${error.response?.status}`);
      console.error(`  Message: ${error.response?.data?.message || error.message}`);
    } else {
      console.error('Error:', error);
    }
    process.exit(1);
  }
}

main();
