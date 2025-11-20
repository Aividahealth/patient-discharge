/**
 * Portal Integration Test Runner
 *
 * Runs comprehensive portal tests and handles cleanup
 */

import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

interface TestRunOptions {
  verbose?: boolean;
  coverage?: boolean;
  cleanup?: boolean;
  watch?: boolean;
}

/**
 * Parse command line arguments
 */
function parseArgs(): TestRunOptions {
  const args = process.argv.slice(2);
  const options: TestRunOptions = {
    verbose: false,
    coverage: false,
    cleanup: true,
    watch: false,
  };

  for (const arg of args) {
    switch (arg) {
      case '--verbose':
      case '-v':
        options.verbose = true;
        break;
      case '--coverage':
      case '-c':
        options.coverage = true;
        break;
      case '--no-cleanup':
        options.cleanup = false;
        break;
      case '--watch':
      case '-w':
        options.watch = true;
        break;
      case '--help':
      case '-h':
        showHelp();
        process.exit(0);
    }
  }

  return options;
}

/**
 * Show help message
 */
function showHelp(): void {
  console.log(`
Portal Integration Test Runner

Usage: npm run test:portals [OPTIONS]

Options:
  --verbose, -v      Show verbose test output
  --coverage, -c     Generate code coverage report
  --no-cleanup       Skip cleanup after tests
  --watch, -w        Watch mode (re-run tests on file changes)
  --help, -h         Show this help message

Examples:
  # Run tests with default settings
  npm run test:portals

  # Run tests with verbose output and coverage
  npm run test:portals -- --verbose --coverage

  # Run tests without cleanup (for debugging)
  npm run test:portals -- --no-cleanup

  # Run tests in watch mode
  npm run test:portals -- --watch

The test suite will:
  1. Create test users for all portal roles (clinician, expert, patient, admin)
  2. Upload sample discharge summaries from test-data directory
  3. Test all portal functionality
  4. Clean up all test data (unless --no-cleanup is specified)

All test data is tagged with 'portal-integration-test' for easy identification
and cleanup. You can manually clean up test data at any time by running:
  npm run cleanup-test-data
`);
}

/**
 * Check prerequisites
 */
function checkPrerequisites(): boolean {
  console.log('🔍 Checking prerequisites...\n');

  // Check if test data directory exists
  const testDataDir = path.join(__dirname, '../test-data/discharge-summaries');
  if (!fs.existsSync(testDataDir)) {
    console.error('❌ Test data directory not found:', testDataDir);
    console.error('   Please ensure test-data/discharge-summaries directory exists');
    return false;
  }

  // Check if test data files exist
  const files = fs.readdirSync(testDataDir);
  const mdFiles = files.filter(f => f.endsWith('.md') && f !== 'README.md');
  if (mdFiles.length === 0) {
    console.error('❌ No test discharge summary files found in:', testDataDir);
    console.error('   Please add .md or .pdf files to the test-data directory');
    return false;
  }

  console.log(`✅ Found ${mdFiles.length} test discharge summary files`);

  // Check for service account configuration (force dev environment)
  const env = process.env.TEST_ENV || process.env.NODE_ENV || 'dev';
  const configPath = path.resolve(process.cwd(), `../backend/.settings.${env}/config.yaml`);

  if (!fs.existsSync(configPath) && !process.env.SERVICE_ACCOUNT_PATH) {
    console.warn('⚠️  Warning: No service account configuration found');
    console.warn('   Tests will use Application Default Credentials');
    console.warn('   Set SERVICE_ACCOUNT_PATH or create .settings.dev/config.yaml');
  } else {
    console.log('✅ Service account configuration found');
  }

  console.log('');
  return true;
}

/**
 * Run tests
 */
function runTests(options: TestRunOptions): number {
  console.log('🧪 Running Portal Integration Tests\n');
  console.log('='.repeat(60));
  console.log('Test Configuration:');
  console.log(`  Verbose: ${options.verbose}`);
  console.log(`  Coverage: ${options.coverage}`);
  console.log(`  Cleanup: ${options.cleanup}`);
  console.log(`  Watch: ${options.watch}`);
  console.log('='.repeat(60));
  console.log('');

  // Build Jest command
  const jestArgs = [
    'jest',
    'test/portals-integration.spec.ts',
    '--runInBand', // Run tests serially
    '--detectOpenHandles', // Detect async operations that prevent Jest from exiting
    '--forceExit', // Force exit after tests complete
  ];

  if (options.verbose) {
    jestArgs.push('--verbose');
  }

  if (options.coverage) {
    jestArgs.push('--coverage');
  }

  if (options.watch) {
    jestArgs.push('--watch');
  }

  const command = jestArgs.join(' ');

  try {
    console.log(`Executing: ${command}\n`);
    execSync(command, {
      stdio: 'inherit',
      cwd: process.cwd(),
    });

    console.log('\n✅ Tests completed successfully!\n');
    return 0;
  } catch (error) {
    console.error('\n❌ Tests failed!\n');
    return 1;
  }
}

/**
 * Run cleanup
 */
function runCleanup(): void {
  console.log('\n🧹 Running cleanup...\n');

  try {
    execSync('ts-node scripts/cleanup-test-data.ts', {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..'),
      env: { ...process.env, NON_INTERACTIVE: 'true' },
    });
  } catch (error) {
    console.error('⚠️  Warning: Cleanup failed');
    console.error('   You can manually run cleanup with: npm run cleanup-test-data');
  }
}

/**
 * Main function
 */
async function main() {
  console.log('\n');
  console.log('='.repeat(60));
  console.log('  PORTAL INTEGRATION TEST SUITE');
  console.log('='.repeat(60));
  console.log('');

  // Set environment variables for dev environment and demo tenant
  process.env.TEST_ENV = 'dev';
  process.env.NODE_ENV = process.env.NODE_ENV || 'dev';
  if (!process.env.BACKEND_API_URL && !process.env.NEXT_PUBLIC_API_URL) {
    process.env.BACKEND_API_URL = 'https://patient-discharge-backend-dev-647433528821.us-central1.run.app';
  }
  console.log(`🔧 Environment: ${process.env.TEST_ENV || process.env.NODE_ENV}`);
  console.log(`🌐 Backend URL: ${process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_API_URL || 'Not set'}`);
  console.log(`🏥 Tenant: demo (hardcoded in test)\n`);

  const options = parseArgs();

  // Check prerequisites
  if (!checkPrerequisites()) {
    console.error('❌ Prerequisites check failed');
    process.exit(1);
  }

  // Run tests
  const testResult = runTests(options);

  // Run cleanup if enabled
  if (options.cleanup && !options.watch) {
    runCleanup();
  }

  // Exit with test result code
  if (testResult !== 0) {
    console.error('\n❌ Test suite failed');
    process.exit(1);
  }

  console.log('\n✅ Test suite completed successfully!\n');
  process.exit(0);
}

// Run the main function
main().catch(error => {
  console.error('\n❌ Unexpected error:', error);
  process.exit(1);
});
