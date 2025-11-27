/**
 * Custom Playwright Reporter for Test Tracking
 * 
 * Automatically tracks test timeouts and failures
 */

import { FullConfig, FullResult, Reporter, Suite, TestCase, TestResult } from '@playwright/test/reporter';
import { testTracker } from '../utils/test-tracker';
import * as path from 'path';
import { execSync } from 'child_process';

class TestTrackerReporter implements Reporter {
  private config?: FullConfig;

  onBegin(config: FullConfig, suite: Suite) {
    this.config = config;
    testTracker.load();
    console.log('\n📊 Test tracker reporter initialized\n');
  }

  onTestEnd(test: TestCase, result: TestResult) {
    const file = test.location.file || 'unknown';
    const testName = test.title || 'unknown';
    
    // Get relative file path for cleaner output
    const relativeFile = path.relative(process.cwd(), file);
    
    if (result.status === 'timedout') {
      const timeout = test.timeout || this.config?.timeout || 0;
      const error = result.error?.message || undefined;
      testTracker.recordTimeout(relativeFile, testName, timeout, error);
    } else if (result.status === 'failed') {
      const error = result.error?.message || undefined;
      testTracker.recordFailure(relativeFile, testName, error);
    }
  }

  async onEnd(result: FullResult) {
    // Print summary at end
    testTracker.printSummary();
    
    const testsToRerun = testTracker.getTestsToRerun();
    if (testsToRerun.length > 0) {
      console.log('\n' + '='.repeat(80));
      console.log('🔄 AUTOMATIC RE-RUN: Waiting for backend processing to complete...');
      console.log('='.repeat(80));
      console.log(`\n⏳ Waiting 30 seconds for async backend operations (simplification/translation) to complete...\n`);
      
      // Wait for backend processing to complete
      await new Promise(resolve => setTimeout(resolve, 30000)); // 30 seconds
      
      console.log('\n🔄 Re-running timed-out/failed tests with expectation that backend processing completed...\n');
      
      // Re-run the tests
      await this.rerunTests(testsToRerun);
    }
  }

  private async rerunTests(testsToRerun: any[]): Promise<void> {
    // Group tests by file
    const testsByFile: { [file: string]: string[] } = {};
    testsToRerun.forEach((test) => {
      // Use the file path as-is (already relative from tracker)
      const testFile = test.file.startsWith('test/') ? test.file : `test/${test.file}`;
      if (!testsByFile[testFile]) {
        testsByFile[testFile] = [];
      }
      testsByFile[testFile].push(test.testName);
    });
    
    let successCount = 0;
    let failureCount = 0;
    
    for (const [file, testNames] of Object.entries(testsByFile)) {
      console.log(`\n📄 Re-running: ${file}`);
      console.log(`   Tests: ${testNames.join(', ')}\n`);
      
      // Build grep pattern for specific tests
      const grepPattern = testNames
        .map(name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join('|');
      
      try {
        // Run with increased timeout for previously timed-out tests
        // Use list reporter to avoid duplicate HTML reports
        const command = `npx playwright test "${file}" --grep "${grepPattern}" --timeout 900000 --reporter=list`;
        execSync(command, {
          stdio: 'inherit',
          cwd: process.cwd(),
          env: { ...process.env },
        });
        
        successCount += testNames.length;
        console.log(`\n   ✅ All tests passed!\n`);
      } catch (error) {
        failureCount += testNames.length;
        console.log(`\n   ❌ Some tests still failed or timed out\n`);
      }
    }
    
    // Print final summary
    console.log('\n' + '='.repeat(80));
    console.log('📊 AUTOMATIC RE-RUN SUMMARY');
    console.log('='.repeat(80));
    console.log(`✅ Passed: ${successCount}`);
    console.log(`❌ Failed/Timed Out: ${failureCount}`);
    console.log(`📊 Total Re-run: ${testsToRerun.length}`);
    console.log('='.repeat(80) + '\n');
    
    // Clear tracker if all tests passed
    if (failureCount === 0 && successCount > 0) {
      console.log('🎉 All previously timed-out/failed tests now pass! Clearing tracker...\n');
      testTracker.clear();
    }
  }
}

export default TestTrackerReporter;

