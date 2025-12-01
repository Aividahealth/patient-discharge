/**
 * Test Tracker Utility
 * 
 * Tracks tests that timeout or fail, allowing them to be re-run at the end
 */

interface TimedOutTest {
  file: string;
  testName: string;
  timeout: number;
  timestamp: Date;
  error?: string;
}

class TestTracker {
  private timedOutTests: TimedOutTest[] = [];
  private failedTests: TimedOutTest[] = [];
  private readonly trackerFile = 'test/ui-tests/.test-tracker.json';

  /**
   * Record a timed-out test
   */
  recordTimeout(file: string, testName: string, timeout: number, error?: string): void {
    // Check if this test is already tracked (avoid duplicates)
    const alreadyTracked = this.timedOutTests.some(
      t => t.file === file && t.testName === testName
    );
    
    if (!alreadyTracked) {
      const timedOutTest: TimedOutTest = {
        file,
        testName,
        timeout,
        timestamp: new Date(),
        error,
      };
      this.timedOutTests.push(timedOutTest);
      console.log(`\n⏱️  TIMEOUT TRACKED: ${file} > ${testName} (timeout: ${timeout}ms)\n`);
      this.save();
    }
  }

  /**
   * Record a failed test
   */
  recordFailure(file: string, testName: string, error?: string): void {
    // Check if this test is already tracked (avoid duplicates)
    const alreadyTracked = this.failedTests.some(
      t => t.file === file && t.testName === testName
    );
    
    if (!alreadyTracked) {
      const failedTest: TimedOutTest = {
        file,
        testName,
        timeout: 0,
        timestamp: new Date(),
        error,
      };
      this.failedTests.push(failedTest);
      console.log(`\n❌ FAILURE TRACKED: ${file} > ${testName}\n`);
      this.save();
    }
  }

  /**
   * Get all timed-out tests
   */
  getTimedOutTests(): TimedOutTest[] {
    return [...this.timedOutTests];
  }

  /**
   * Get all failed tests
   */
  getFailedTests(): TimedOutTest[] {
    return [...this.failedTests];
  }

  /**
   * Get all tests that need re-running (timed out or failed)
   */
  getTestsToRerun(): TimedOutTest[] {
    return [...this.timedOutTests, ...this.failedTests];
  }

  /**
   * Clear all tracked tests
   */
  clear(): void {
    this.timedOutTests = [];
    this.failedTests = [];
    this.save();
  }

  /**
   * Save tracker state to file
   */
  private save(): void {
    try {
      const fs = require('fs');
      const path = require('path');
      const data = {
        timedOut: this.timedOutTests,
        failed: this.failedTests,
        lastUpdated: new Date().toISOString(),
      };
      const dir = path.dirname(this.trackerFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.trackerFile, JSON.stringify(data, null, 2));
    } catch (error) {
      // Ignore file write errors in test environment
      console.warn('Could not save test tracker:', error);
    }
  }

  /**
   * Load tracker state from file
   */
  load(): void {
    try {
      const fs = require('fs');
      if (fs.existsSync(this.trackerFile)) {
        const data = JSON.parse(fs.readFileSync(this.trackerFile, 'utf-8'));
        this.timedOutTests = (data.timedOut || []).map((t: any) => ({
          ...t,
          timestamp: new Date(t.timestamp),
        }));
        this.failedTests = (data.failed || []).map((t: any) => ({
          ...t,
          timestamp: new Date(t.timestamp),
        }));
      }
    } catch (error) {
      // Ignore file read errors
      console.warn('Could not load test tracker:', error);
    }
  }

  /**
   * Print summary of tracked tests
   */
  printSummary(): void {
    console.log('\n' + '='.repeat(80));
    console.log('📊 TEST TRACKER SUMMARY');
    console.log('='.repeat(80));
    
    if (this.timedOutTests.length > 0) {
      console.log(`\n⏱️  Timed Out Tests (${this.timedOutTests.length}):`);
      this.timedOutTests.forEach((test, index) => {
        console.log(`   ${index + 1}. ${test.file} > ${test.testName}`);
        console.log(`      Timeout: ${test.timeout}ms | ${test.timestamp.toISOString()}`);
      });
    }
    
    if (this.failedTests.length > 0) {
      console.log(`\n❌ Failed Tests (${this.failedTests.length}):`);
      this.failedTests.forEach((test, index) => {
        console.log(`   ${index + 1}. ${test.file} > ${test.testName}`);
        console.log(`      ${test.timestamp.toISOString()}`);
        if (test.error) {
          console.log(`      Error: ${test.error.substring(0, 100)}...`);
        }
      });
    }
    
    if (this.timedOutTests.length === 0 && this.failedTests.length === 0) {
      console.log('\n✅ No timed-out or failed tests tracked!');
    }
    
    console.log('\n' + '='.repeat(80) + '\n');
  }

  /**
   * Generate Playwright test command to re-run tracked tests
   */
  generateRerunCommand(): string {
    const testsToRerun = this.getTestsToRerun();
    if (testsToRerun.length === 0) {
      return 'echo "No tests to re-run"';
    }

    // Group by file
    const testsByFile: { [file: string]: string[] } = {};
    testsToRerun.forEach((test) => {
      if (!testsByFile[test.file]) {
        testsByFile[test.file] = [];
      }
      // Escape test name for grep pattern
      const escapedName = test.testName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      testsByFile[test.file].push(escapedName);
    });

    // Generate command for each file
    const commands: string[] = [];
    Object.entries(testsByFile).forEach(([file, testNames]) => {
      // Use grep to filter specific tests
      const grepPattern = testNames.join('|');
      commands.push(`npx playwright test ${file} --grep "${grepPattern}"`);
    });

    return commands.join(' && ');
  }
}

// Singleton instance
export const testTracker = new TestTracker();

// Load existing tracker state on import
testTracker.load();

