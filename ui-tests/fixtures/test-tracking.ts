/**
 * Playwright Fixture for Automatic Test Tracking
 * 
 * This fixture automatically tracks test timeouts and failures
 */

import { test as baseTest, TestInfo } from '@playwright/test';
import { testTracker } from '../utils/test-tracker';
import * as path from 'path';

// Extend the base test with tracking
export const test = baseTest.extend({
  // Add tracking to test context
});

// Global setup to track all test outcomes
export function setupGlobalTracking() {
  // This will be called in playwright.config.ts
}

/**
 * Track test outcome after it completes
 */
export function trackTestOutcome(testInfo: TestInfo): void {
  const file = testInfo.file || 'unknown';
  const testName = testInfo.title || 'unknown';
  
  // Get relative file path for cleaner output
  const relativeFile = path.relative(process.cwd(), file);
  
  if (testInfo.status === 'timedout') {
    const timeout = testInfo.timeout || 0;
    const error = testInfo.error?.message || undefined;
    testTracker.recordTimeout(relativeFile, testName, timeout, error);
  } else if (testInfo.status === 'failed') {
    const error = testInfo.error?.message || undefined;
    testTracker.recordFailure(relativeFile, testName, error);
  }
}

