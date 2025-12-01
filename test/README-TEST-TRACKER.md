# Test Tracker System

This directory includes a test tracking system that automatically records tests that timeout or fail, allowing you to re-run them later to verify fixes.

## How It Works

1. **Automatic Tracking**: When you run Playwright tests, a custom reporter automatically tracks:
   - Tests that timeout
   - Tests that fail
   
2. **Persistent Storage**: Tracked tests are saved to `test/ui-tests/.test-tracker.json`

3. **Re-run Command**: After tests complete, you'll see a summary and can re-run just the problematic tests

## Usage

### Running Tests Normally

```bash
# Run all UI tests
npm run test:ui

# Run specific test files
npx playwright test test/ui-tests/clinician-upload-workflow.spec.ts
```

After tests complete, you'll see a summary like:

```
📊 TEST TRACKER SUMMARY
================================================================================

⏱️  Timed Out Tests (2):
   1. test/ui-tests/clinician-upload-workflow.spec.ts > should complete full upload workflow with all required fields
      Timeout: 300000ms | 2024-01-15T10:30:00.000Z
   2. test/ui-tests/expert-review-workflow.spec.ts > should complete full expert review submission workflow
      Timeout: 300000ms | 2024-01-15T10:35:00.000Z

💡 To re-run timed-out/failed tests, use:
   npm run test:rerun-timeouts
```

### Viewing Tracker Summary

```bash
npm run test:tracker-summary
```

This will show you all currently tracked tests without running them.

### Re-running Timed-Out/Failed Tests

```bash
npm run test:rerun-timeouts
```

This command will:
1. Load the tracker data
2. Re-run only the tests that previously timed out or failed
3. Use increased timeouts (15 minutes) for previously timed-out tests
4. Show a summary of results
5. Clear the tracker if all tests now pass

### Clearing the Tracker

The tracker is automatically cleared when all tracked tests pass during re-run. To manually clear:

```bash
# Edit test/ui-tests/.test-tracker.json and delete its contents, or
# The tracker will be cleared automatically when all tests pass
```

## Files

- `test/ui-tests/utils/test-tracker.ts` - Core tracking logic
- `test/ui-tests/reporters/test-tracker-reporter.ts` - Playwright reporter that tracks tests
- `test/ui-tests/scripts/rerun-timeout-tests.ts` - Script to re-run tracked tests
- `test/ui-tests/.test-tracker.json` - Persistent storage (gitignored)

## Integration

The tracker is automatically integrated into Playwright via:
- Custom reporter in `playwright.config.ts`
- Automatically tracks all test outcomes
- Prints summary at end of test run

## Example Workflow

1. Run tests: `npm run test:ui`
2. Some tests timeout or fail
3. Review the tracker summary
4. Make fixes to the code or tests
5. Re-run only problematic tests: `npm run test:rerun-timeouts`
6. If all pass, tracker is automatically cleared
7. If some still fail, they remain tracked for next iteration

This allows you to iteratively fix test issues without re-running the entire suite each time.

