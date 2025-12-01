# Best Practices: Automatic Patient Discovery from Cerner

## Current Limitation

The current system requires a **manual patient list** in `ehrIntegration.cerner.patients` array. This doesn't scale and requires manual updates when new patients are added to Cerner.

## Best Practice Approaches

### Option 1: Encounter-Driven Discovery (Recommended) ⭐

**How it works:**
- Search for recent Encounters (e.g., last 24-48 hours)
- Extract patient IDs from encounter `subject` references
- Process all patients who have recent encounters

**Implementation:**
```typescript
// Search for recent encounters
const encounters = await cernerService.searchResource('Encounter', {
  status: 'finished',
  _lastUpdated: `ge${last24Hours}`,
  _count: 100,
  _sort: '-_lastUpdated'
});

// Extract unique patient IDs
const patientIds = new Set();
for (const encounter of encounters.entry) {
  const patientRef = encounter.resource.subject?.reference;
  if (patientRef?.startsWith('Patient/')) {
    patientIds.add(patientRef.replace('Patient/', ''));
  }
}
```

**Pros:**
- ✅ Automatically discovers new patients
- ✅ Only processes patients with recent activity
- ✅ No manual configuration needed
- ✅ Efficient (only processes active patients)

**Cons:**
- ⚠️ May miss patients without recent encounters
- ⚠️ Requires filtering logic for encounter types

---

### Option 2: DocumentReference-Driven Discovery

**How it works:**
- Search for recent DocumentReferences (discharge summaries)
- Extract patient IDs from document `subject` references
- Process all patients with new discharge summaries

**Implementation:**
```typescript
// Search for recent discharge summaries
const documents = await cernerService.searchResource('DocumentReference', {
  type: 'http://loinc.org|18842-5', // Discharge summary
  _lastUpdated: `ge${last24Hours}`,
  _count: 100,
  _sort: '-_lastUpdated'
});

// Extract unique patient IDs
const patientIds = new Set();
for (const doc of documents.entry) {
  const patientRef = doc.resource.subject?.reference;
  if (patientRef?.startsWith('Patient/')) {
    patientIds.add(patientRef.replace('Patient/', ''));
  }
}
```

**Pros:**
- ✅ Focuses on patients with discharge summaries
- ✅ Automatically discovers new patients
- ✅ No manual configuration needed

**Cons:**
- ⚠️ Only finds patients with discharge summaries
- ⚠️ May miss patients without documents yet

---

### Option 3: Hybrid Approach (Best for Production) ⭐⭐⭐

**How it works:**
- Combine Encounter and DocumentReference searches
- Use `_lastUpdated` to only get new resources
- Maintain a cache of processed patients to avoid duplicates
- Fallback to manual list for specific use cases

**Implementation Strategy:**
```typescript
async function discoverPatients(ctx: TenantContext): Promise<string[]> {
  const patientIds = new Set<string>();
  
  // 1. Get patients from recent encounters
  const encounters = await searchRecentEncounters(ctx);
  extractPatientIds(encounters, patientIds);
  
  // 2. Get patients from recent documents
  const documents = await searchRecentDocuments(ctx);
  extractPatientIds(documents, patientIds);
  
  // 3. Optionally: Include manual list (for specific patients)
  const manualPatients = await getManualPatientList(ctx);
  manualPatients.forEach(id => patientIds.add(id));
  
  return Array.from(patientIds);
}
```

**Pros:**
- ✅ Most comprehensive coverage
- ✅ Automatically discovers new patients
- ✅ Can still use manual list for specific cases
- ✅ Efficient and scalable

**Cons:**
- ⚠️ More complex implementation
- ⚠️ Requires careful deduplication

---

### Option 4: SMART Subscriptions (If Available)

**How it works:**
- Use Cerner's SMART Subscriptions (if supported)
- Subscribe to Patient, Encounter, or DocumentReference resources
- Receive webhooks when new resources are created
- Process patients in real-time

**Implementation:**
```typescript
// Subscribe to new Encounters
POST /cerner/Subscription
{
  "resourceType": "Subscription",
  "status": "active",
  "criteria": "Encounter?status=finished",
  "channel": {
    "type": "rest-hook",
    "endpoint": "https://your-backend.com/webhooks/cerner"
  }
}
```

**Pros:**
- ✅ Real-time processing
- ✅ Most efficient (no polling)
- ✅ No manual configuration

**Cons:**
- ⚠️ May not be available in Cerner sandbox
- ⚠️ Requires webhook infrastructure
- ⚠️ More complex error handling

---

## Recommended Implementation

### Step 1: Modify EncounterExportScheduler

Instead of:
```typescript
const patients = await this.configService.getTenantCernerPatients(tenantId);
```

Use:
```typescript
const patients = await this.discoverPatientsFromCerner(tenantId, ctx);
```

### Step 2: Implement Patient Discovery

```typescript
private async discoverPatientsFromCerner(
  tenantId: string,
  ctx: TenantContext
): Promise<string[]> {
  const patientIds = new Set<string>();
  
  // Search for recent encounters (last 48 hours)
  const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  
  try {
    // Get patients from recent encounters
    const encounters = await this.cernerService.searchResource('Encounter', {
      status: 'finished',
      _lastUpdated: `ge${twoDaysAgo}`,
      _count: 100,
      _sort: '-_lastUpdated'
    }, ctx, AuthType.SYSTEM);
    
    if (encounters?.entry) {
      for (const entry of encounters.entry) {
        const patientRef = entry.resource.subject?.reference;
        if (patientRef?.startsWith('Patient/')) {
          patientIds.add(patientRef.replace('Patient/', ''));
        }
      }
    }
    
    // Get patients from recent discharge summaries
    const documents = await this.cernerService.searchResource('DocumentReference', {
      type: 'http://loinc.org|18842-5',
      _lastUpdated: `ge${twoDaysAgo}`,
      _count: 100,
      _sort: '-_lastUpdated'
    }, ctx, AuthType.SYSTEM);
    
    if (documents?.entry) {
      for (const entry of documents.entry) {
        const patientRef = entry.resource.subject?.reference;
        if (patientRef?.startsWith('Patient/')) {
          patientIds.add(patientRef.replace('Patient/', ''));
        }
      }
    }
    
    // Optionally: Include manual list for specific patients
    const manualPatients = await this.configService.getTenantCernerPatients(tenantId);
    manualPatients.forEach(id => patientIds.add(id));
    
    this.logger.log(`🔍 Discovered ${patientIds.size} patients from Cerner (${encounters?.entry?.length || 0} encounters, ${documents?.entry?.length || 0} documents)`);
    
    return Array.from(patientIds);
  } catch (error) {
    this.logger.error(`❌ Error discovering patients: ${error.message}`);
    // Fallback to manual list
    return await this.configService.getTenantCernerPatients(tenantId);
  }
}
```

### Step 3: Configuration Options

Add to Firestore config:
```json
{
  "ehrIntegration": {
    "cerner": {
      "patientDiscovery": {
        "enabled": true,
        "method": "encounter", // or "document", "hybrid"
        "lookbackHours": 48,
        "includeManualList": true
      }
    }
  }
}
```

---

## Performance Considerations

### 1. Caching
- Cache discovered patient IDs for a short period (e.g., 15 minutes)
- Avoid re-discovering on every scheduler run

### 2. Pagination
- Use `_count` parameter to limit results
- Implement pagination for large result sets

### 3. Rate Limiting
- Be mindful of Cerner API rate limits
- Batch requests when possible

### 4. Deduplication
- Use Set to avoid processing same patient multiple times
- Track processed patients in a cache/database

---

## Migration Strategy

1. **Phase 1**: Implement discovery alongside manual list (hybrid)
2. **Phase 2**: Make discovery default, manual list as fallback
3. **Phase 3**: Remove manual list requirement (optional for specific cases)

---

## Testing

Test with:
- Empty manual list (should discover from Cerner)
- Manual list with some patients (should combine both)
- No recent encounters/documents (should handle gracefully)
- Large number of patients (should paginate)

---

## Summary

**Best Practice**: Use **Hybrid Approach (Option 3)** with encounter-driven discovery as primary method, document-driven as secondary, and manual list as optional fallback.

This provides:
- ✅ Automatic patient discovery
- ✅ No manual configuration needed
- ✅ Scalable and efficient
- ✅ Flexible for edge cases

