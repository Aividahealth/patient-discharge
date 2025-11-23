# Test Data Cleanup

This directory contains scripts for managing test data created during UI tests.

## Overview

UI tests create test users and discharge summaries that are tagged with specific test tags. These remain in the database after tests complete to allow manual inspection and debugging.

## Cleanup Script

To clean up test data, run:

```bash
node cleanup-test-data.js
```

This will delete:
- All test users with test tags (`portal-integration-test`, `clinician-portal-test`, `patient-portal-test`)
- All test discharge summaries with test tags
- Associated files in Google Cloud Storage

## Test Tags

The following test tags are used:
- `portal-integration-test` - Used by all-portals.spec.ts
- `clinician-portal-test` - Used by clinician-portal.spec.ts (currently using `portal-integration-test`)
- `patient-portal-test` - Used by patient-portal.spec.ts (currently using `portal-integration-test`)

## When to Clean Up

You should clean up test data:
- Before running tests if you want a fresh start
- After debugging to remove test data from the database
- When test data accumulates and affects performance

## Manual Cleanup

If you need to manually identify test data, look for documents with a `testTag` field in:
- `users` collection
- `discharge_summaries` collection

All test users have usernames starting with `test-` (e.g., `test-expert-1234567890`).
