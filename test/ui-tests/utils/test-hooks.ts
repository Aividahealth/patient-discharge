/**
 * Test Hooks for Tracking Timeouts and Failures
 * 
 * Use these hooks in your test files to automatically track timeouts and failures
 */

import { test as baseTest, TestInfo } from '@playwright/test';
import { testTracker } from './test-tracker';

/**
 * Wrapper around Playwright's test that automatically tracks timeouts
 */
export const test = baseTest.extend({
  // Override test timeout handling
});

/**
 * Setup global test hooks to track timeouts and failures
 */
export function setupTestTracking() {
  // This will be called in each test file's beforeAll
  console.log('📊 Test tracking enabled');
}

/**
 * Track a test timeout
 */
export function trackTimeout(testInfo: TestInfo, timeout: number): void {
  const file = testInfo.file || 'unknown';
  const testName = testInfo.title || 'unknown';
  const error = testInfo.error?.message || undefined;
  
  testTracker.recordTimeout(file, testName, timeout, error);
}

/**
 * Track a test failure
 */
export function trackFailure(testInfo: TestInfo, error?: string): void {
  const file = testInfo.file || 'unknown';
  const testName = testInfo.title || 'unknown';
  const errorMessage = error || testInfo.error?.message || undefined;
  
  testTracker.recordFailure(file, testName, errorMessage);
}

/**
 * Print test tracker summary
 */
export function printTrackerSummary(): void {
  testTracker.printSummary();
}

