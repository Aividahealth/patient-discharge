# Tenant Patients Collection

## Overview

The `tenant_patients` Firestore collection stores patient IDs for each tenant, which are used to filter Encounter searches in Cerner. This prevents the 400 Bad Request error that occurs when searching Encounters without a patient filter.

## Collection Structure

**Collection Name:** `tenant_patients`

**Document ID:** `{tenantId}` (e.g., `default`, `ctest`, `demo`)

**Document Structure:**
```json
{
  "patientIds": ["1", "2", "3", "12822233"],
  "updatedAt": "2025-11-25T00:00:00Z"
}
```

## Fields

- **patientIds** (array of strings): List of Cerner patient IDs to search for encounters
- **updatedAt** (timestamp): Last update timestamp

## How It Works

1. **Patient Discovery Flow:**
   - Step 0: Get patient IDs from `tenant_patients` collection
   - Step 1: For each patient ID, search Encounters with `patient={patientId}` filter
   - Step 2: Search DocumentReferences (without patient filter - if allowed)
   - Step 3: Include manual patient list from config as fallback

2. **Why This Approach:**
   - Cerner requires a patient filter for Encounter searches (400 error without it)
   - We maintain a tenant-specific list of patient IDs in Firestore
   - Each patient is searched individually with the filter
   - Results are combined to get all patients with recent activity

## Setting Up Patient IDs

### Option 1: Manual Setup in Firestore

1. Go to Google Cloud Console → Firestore → Data
2. Create collection: `tenant_patients` (if it doesn't exist)
3. Create document with ID: `{tenantId}` (e.g., `default`, `ctest`)
4. Add fields:
   - `patientIds`: Array of strings (e.g., `["1", "2", "3"]`)
   - `updatedAt`: Current timestamp

### Option 2: Using Script

Create a script to update the collection:

```typescript
// Example script structure
const firestore = getFirestore();
await firestore.collection('tenant_patients').doc('ctest').set({
  patientIds: ['1', '2', '3'],
  updatedAt: new Date()
});
```

### Option 3: System Admin UI (Future)

Add UI in System Admin Portal to manage patient IDs per tenant.

## Example Document

For tenant `ctest`:

```json
{
  "patientIds": ["1", "12822233"],
  "updatedAt": "2025-11-25T00:00:00Z"
}
```

## Integration with Patient Discovery

The `CernerAdapter.discoverPatients()` method:

1. Reads from `tenant_patients/{tenantId}`
2. For each patient ID, searches: `GET /Encounter?patient={patientId}&status=finished&_lastUpdated=ge{1hourAgo}`
3. Combines results with DocumentReference search
4. Falls back to manual config list if collection is empty

## Benefits

- ✅ Prevents 400 Bad Request errors (patient filter required)
- ✅ Tenant-specific patient lists
- ✅ Easy to update without code changes
- ✅ Scalable (can add/remove patients dynamically)
- ✅ Works with Cerner's security requirements

## Migration

If you have existing patient lists in `config/{tenantId}/ehrIntegration.cerner.patients`:

1. Copy those patient IDs to `tenant_patients/{tenantId}.patientIds`
2. The system will use both sources (collection + config fallback)
3. Eventually, you can remove from config and use only the collection

