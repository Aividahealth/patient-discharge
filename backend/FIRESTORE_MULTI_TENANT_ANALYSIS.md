# Firestore Collections Multi-Tenant Analysis

## Summary

**Status**: ⚠️ **NOT all collections are multi-tenant**

### ✅ Multi-Tenant Collections (3/5)

1. **config** - ✅ Multi-tenant
   - Uses `tenantId` as document ID
   - Location: `backend/src/config/dev-config.service.ts`, `backend/src/config/config.service.ts`
   - Status: ✅ Properly isolated

2. **users** - ✅ Multi-tenant
   - Stores `tenantId` field in documents
   - All queries filter by `tenantId`
   - Location: `backend/src/auth/user.service.ts`
   - Example: `.where('tenantId', '==', tenantId)`
   - Status: ✅ Properly isolated

3. **audit_logs** - ✅ Multi-tenant
   - Stores `tenantId` field in documents
   - All queries require `tenantId` filter
   - Location: `backend/src/audit/audit.service.ts`
   - Example: `firestoreQuery.where('tenantId', '==', query.tenantId)`
   - Status: ✅ Properly isolated

### ❌ NOT Multi-Tenant Collections (2/5)

4. **discharge_summaries** - ❌ NOT multi-tenant
   - **Issue**: No `tenantId` field in `DischargeSummaryMetadata` type
   - **Issue**: No tenant filtering in queries
   - **Issue**: `list()` method returns ALL discharge summaries across all tenants
   - **Issue**: `getById()`, `create()`, `update()`, `delete()` don't check tenantId
   - **Issue**: `getStats()` returns stats for ALL tenants
   - **Location**: `backend/src/discharge-summaries/firestore.service.ts`
   - **Controller**: `backend/src/discharge-summaries/discharge-summaries.controller.ts` - No `@TenantContext()` decorator
   - **Security Risk**: ⚠️ **HIGH** - Tenants can access other tenants' discharge summaries

5. **expert_feedback** - ❌ NOT multi-tenant
   - **Issue**: No `tenantId` field in `ExpertFeedback` type
   - **Issue**: `submitFeedback()` doesn't store `tenantId`
   - **Issue**: `getFeedbackForSummary()` has optional `tenantId` filter but it's not always applied
   - **Issue**: `getReviewList()` doesn't filter by tenantId
   - **Issue**: System admin service gets ALL feedback without tenant filtering (line 456)
   - **Location**: `backend/src/expert/expert.service.ts`
   - **Security Risk**: ⚠️ **MEDIUM** - Expert feedback can leak across tenants

## Detailed Analysis

### 1. discharge_summaries Collection

**Current Implementation:**
```typescript
// backend/src/discharge-summaries/discharge-summary.types.ts
export interface DischargeSummaryMetadata {
  id: string;
  patientId?: string;
  patientName?: string;
  // ... other fields
  // ❌ NO tenantId field
}

// backend/src/discharge-summaries/firestore.service.ts
async list(query: DischargeSummaryListQuery): Promise<DischargeSummaryListResponse> {
  let firestoreQuery = this.getFirestore().collection('discharge_summaries') as any;
  
  // ❌ NO tenantId filter
  if (query.patientId) {
    firestoreQuery = firestoreQuery.where('patientId', '==', query.patientId);
  }
  // ... other filters but NO tenantId
}
```

**Problems:**
1. No `tenantId` field in the type definition
2. No tenant filtering in `list()` method
3. No tenant validation in `getById()`, `create()`, `update()`, `delete()`
4. Controller doesn't use `@TenantContext()` decorator
5. `getStats()` returns stats for all tenants

**Impact:**
- ⚠️ **CRITICAL**: Any tenant can access discharge summaries from other tenants
- Data leakage across tenants
- Statistics are incorrect (include all tenants)

### 2. expert_feedback Collection

**Current Implementation:**
```typescript
// backend/src/expert/expert.types.ts
export interface ExpertFeedback {
  id?: string;
  dischargeSummaryId: string;
  reviewType: ReviewType;
  // ... other fields
  // ❌ NO tenantId field
}

// backend/src/expert/expert.service.ts
async submitFeedback(dto: SubmitFeedbackDto): Promise<ExpertFeedback> {
  const feedback: any = {
    dischargeSummaryId: dto.dischargeSummaryId,
    // ... other fields
    // ❌ NO tenantId stored
  };
  await firestore.collection('expert_feedback').add(feedback);
}

async getFeedbackForSummary(summaryId: string, options: { tenantId?: string } = {}): Promise<FeedbackResponse> {
  let query = firestore.collection('expert_feedback')
    .where('dischargeSummaryId', '==', summaryId);
  
  // ⚠️ Optional tenantId filter - not always applied
  if (tenantId) {
    query = query.where('tenantId', '==', tenantId);
  }
}
```

**Problems:**
1. No `tenantId` field in the type definition
2. `submitFeedback()` doesn't store `tenantId`
3. `getFeedbackForSummary()` has optional tenantId filter (not always used)
4. `getReviewList()` doesn't filter by tenantId
5. System admin service gets ALL feedback without tenant filtering

**Impact:**
- ⚠️ **MEDIUM**: Expert feedback can be accessed across tenants
- Feedback statistics include all tenants

## Recommendations

### Priority 1: Fix discharge_summaries Collection (CRITICAL)

1. **Add `tenantId` to type definition:**
   ```typescript
   export interface DischargeSummaryMetadata {
     id: string;
     tenantId: string; // ✅ ADD THIS
     patientId?: string;
     // ... rest of fields
   }
   ```

2. **Update FirestoreService to filter by tenantId:**
   ```typescript
   async list(
     query: DischargeSummaryListQuery,
     tenantId: string, // ✅ ADD THIS
   ): Promise<DischargeSummaryListResponse> {
     let firestoreQuery = this.getFirestore()
       .collection('discharge_summaries')
       .where('tenantId', '==', tenantId); // ✅ ADD THIS
     // ... rest of filters
   }
   ```

3. **Update controller to use TenantContext:**
   ```typescript
   @Get()
   async list(
     @Query() query: DischargeSummaryListQuery,
     @TenantContext() ctx: TenantContext, // ✅ ADD THIS
   ) {
     return this.dischargeSummariesService.list(query, ctx.tenantId);
   }
   ```

4. **Add tenant validation to all methods:**
   - `getById()` - Verify document belongs to tenant
   - `create()` - Store tenantId
   - `update()` - Verify tenantId matches
   - `delete()` - Verify tenantId matches
   - `getStats()` - Filter by tenantId

### Priority 2: Fix expert_feedback Collection

1. **Add `tenantId` to type definition:**
   ```typescript
   export interface ExpertFeedback {
     id?: string;
     tenantId: string; // ✅ ADD THIS
     dischargeSummaryId: string;
     // ... rest of fields
   }
   ```

2. **Update submitFeedback to store tenantId:**
   ```typescript
   async submitFeedback(
     dto: SubmitFeedbackDto,
     tenantId: string, // ✅ ADD THIS
   ): Promise<ExpertFeedback> {
     const feedback: any = {
       tenantId, // ✅ ADD THIS
       dischargeSummaryId: dto.dischargeSummaryId,
       // ... rest of fields
     };
   }
   ```

3. **Make tenantId filter required in getFeedbackForSummary:**
   ```typescript
   async getFeedbackForSummary(
     summaryId: string,
     tenantId: string, // ✅ Make required
   ): Promise<FeedbackResponse> {
     let query = firestore.collection('expert_feedback')
       .where('dischargeSummaryId', '==', summaryId)
       .where('tenantId', '==', tenantId); // ✅ Always filter
   }
   ```

4. **Update getReviewList to filter by tenantId:**
   ```typescript
   async getReviewList(
     query: ReviewListQuery,
     tenantId: string, // ✅ ADD THIS
   ): Promise<ReviewListResponse> {
     let summariesQuery = firestore
       .collection('discharge_summaries')
       .where('tenantId', '==', tenantId) // ✅ ADD THIS
       .orderBy('updatedAt', 'desc');
   }
   ```

### Priority 3: Migration Script

Create a migration script to:
1. Add `tenantId` field to existing `discharge_summaries` documents
2. Add `tenantId` field to existing `expert_feedback` documents
3. Determine tenantId from:
   - Patient ID lookup in FHIR (if available)
   - File path patterns (if available)
   - Default to 'default' tenant if cannot determine

## Testing Checklist

After implementing fixes:

- [ ] Verify `discharge_summaries.list()` only returns summaries for the requesting tenant
- [ ] Verify `discharge_summaries.getById()` throws error if summary belongs to different tenant
- [ ] Verify `discharge_summaries.create()` stores tenantId
- [ ] Verify `expert_feedback.submitFeedback()` stores tenantId
- [ ] Verify `expert_feedback.getFeedbackForSummary()` only returns feedback for the tenant
- [ ] Verify statistics are tenant-specific
- [ ] Test with multiple tenants to ensure data isolation

## Security Impact

**Current State:**
- ⚠️ **CRITICAL**: Discharge summaries are accessible across tenants
- ⚠️ **MEDIUM**: Expert feedback can leak across tenants

**After Fix:**
- ✅ All collections properly isolated by tenant
- ✅ No cross-tenant data access
- ✅ Statistics are tenant-specific

