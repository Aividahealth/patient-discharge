#!/usr/bin/env ts-node

/**
 * Re-run Tests That Timed Out or Failed
 * 
 * This script reads the test tracker and re-runs tests that previously
 * timed out or failed, allowing you to verify if fixes resolved the issues.
 */

import { testTracker } from '../utils/test-tracker';
import { execSync } from 'child_process';
import * as path from 'path';

function main() {
  console.log('\n🔄 Re-running Timed-Out and Failed Tests\n');
  
  // Load tracker state
  testTracker.load();
  
  // Print summary
  testTracker.printSummary();
  
  const testsToRerun = testTracker.getTestsToRerun();
  
  if (testsToRerun.length === 0) {
    console.log('✅ No tests to re-run!\n');
    process.exit(0);
  }
  
  console.log(`\n📋 Re-running ${testsToRerun.length} test(s)...\n`);
  
  // Group tests by file
  const testsByFile: { [file: string]: string[] } = {};
  testsToRerun.forEach((test) => {
    // Extract relative file path
    const relativeFile = path.relative(process.cwd(), test.file);
    if (!testsByFile[relativeFile]) {
      testsByFile[relativeFile] = [];
    }
    testsByFile[relativeFile].push(test.testName);
  });
  
  // Re-run tests file by file
  let successCount = 0;
  let failureCount = 0;
  
  Object.entries(testsByFile).forEach(([file, testNames]) => {
    console.log(`\n📄 Re-running tests in: ${file}`);
    console.log(`   Tests: ${testNames.join(', ')}\n`);
    
    // Build grep pattern for specific tests
    const grepPattern = testNames
      .map(name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('|');
    
    try {
      // Run with increased timeout for previously timed-out tests
      const command = `npx playwright test "${file}" --grep "${grepPattern}" --timeout 900000`;
      console.log(`   Command: ${command}\n`);
      
      execSync(command, {
        stdio: 'inherit',
        cwd: path.join(process.cwd(), 'test'),
        env: { ...process.env },
      });
      
      successCount += testNames.length;
      console.log(`\n   ✅ All tests in ${file} passed!\n`);
    } catch (error) {
      failureCount += testNames.length;
      console.log(`\n   ❌ Some tests in ${file} failed or timed out again\n`);
    }
  });
  
  // Print final summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 RE-RUN SUMMARY');
  console.log('='.repeat(80));
  console.log(`✅ Passed: ${successCount}`);
  console.log(`❌ Failed/Timed Out: ${failureCount}`);
  console.log(`📊 Total: ${testsToRerun.length}`);
  console.log('='.repeat(80) + '\n');
  
  // Optionally clear tracker if all tests passed
  if (failureCount === 0) {
    console.log('🎉 All previously timed-out/failed tests now pass! Clearing tracker...\n');
    testTracker.clear();
  } else {
    console.log('⚠️  Some tests still failing. Tracker will be updated on next test run.\n');
  }
  
  process.exit(failureCount > 0 ? 1 : 0);
}

if (require.main === module) {
  main();
}

