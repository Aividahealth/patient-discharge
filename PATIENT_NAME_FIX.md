# Patient Name Display Fix

## 🚨 Problem Identified

The patient portal was displaying **"John Smith"** instead of the actual patient name **"Morgan King"** for patient ID `661ea147-b707-4534-bf47-243190d3e27c`.

### User Report
> "patientId 661ea147-b707-4534-bf47-243190d3e27c is Morgan King but https://www.aividahealth.ai/demo/patient?patientId=661ea147-b707-4534-bf47-243190d3e27c&compositionId=b9fa5eb4-1366-4828-a292-fbaf6644e802 displays it as John Smith"

---

## 🔍 Root Cause

The patient name was coming from the wrong source:

### **Broken Flow:**
```
1. Patient visits portal with patientId in URL
2. Auto-login with generic "patient" account ✅
3. Frontend sets: patientData.name = user?.name ❌
4. user?.name = "John Smith" (generic login account name)
5. Display shows "John Smith" instead of real patient name
```

### **Why This Happened:**

The `patientData` object was using:
```typescript
const patientData = {
  name: user?.name || "Patient",  // ❌ Wrong! This is the login account name
  ...
}
```

The `user` object comes from the auto-login with credentials:
- tenantId: `demo`
- username: `patient`
- password: `Adyar2Austin`

This returns a generic user account with name "John Smith", **NOT** the actual patient whose discharge information is being viewed.

### **The Real Patient Data:**

The actual patient name exists in the **FHIR Patient resource** at `/google/fhir/Patient/{patientId}` but was never being fetched.

FHIR Patient resource structure:
```json
{
  "resourceType": "Patient",
  "id": "661ea147-b707-4534-bf47-243190d3e27c",
  "name": [
    {
      "use": "official",
      "text": "Morgan King",
      "family": "King",
      "given": ["Morgan"]
    }
  ],
  ...
}
```

---

## ✅ Fix Applied

### **1. Added Patient Name Fetch**

Added a fetch call to retrieve the FHIR Patient resource:

```typescript
// Fetch patient name from FHIR Patient resource
const patientResponse = await fetch(
  `${getBackendUrl()}/google/fhir/Patient/${patientId}`,
  {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'X-Tenant-ID': tenant.id,
    },
  }
)
```

### **2. Extract Patient Name**

Parse the FHIR Patient.name structure:

```typescript
if (patientResponse.ok) {
  const patientResource = await patientResponse.json()
  
  // Extract patient name from FHIR Patient resource
  if (patientResource.name && patientResource.name.length > 0) {
    const name = patientResource.name[0]
    const fullName = name.text || `${name.given?.join(' ') || ''} ${name.family || ''}`.trim()
    setPatientName(fullName)
    console.log('[Patient Portal] Patient name:', fullName)
  }
}
```

**Handles multiple formats:**
- `name.text` (e.g., "Morgan King") - preferred
- Fallback: concatenate `name.given[]` + `name.family`

### **3. Updated Patient Data Object**

```typescript
const patientData = {
  name: patientName || user?.name || "Patient",  // ✅ Correct fallback chain
  ...
}
```

**Fallback chain:**
1. `patientName` - From FHIR Patient resource (correct)
2. `user?.name` - From login account (generic fallback)
3. `"Patient"` - Last resort

---

## 🧪 Testing

### **1. Wait for Vercel Deployment** (2-3 minutes)

Commit `31ec5ba` has been pushed.

### **2. Clear Browser Cache**

- Hard refresh: `Ctrl+F5` or `Cmd+Shift+R`
- Or open incognito window

### **3. Visit Patient Portal**

```
https://www.aividahealth.ai/demo/patient?patientId=661ea147-b707-4534-bf47-243190d3e27c&compositionId=b9fa5eb4-1366-4828-a292-fbaf6644e802
```

### **4. Open Browser Console** (`F12`)

You should see:
```javascript
[Patient Portal] Patient resource fetched: {resourceType: 'Patient', id: '661ea147...', name: [...]}
[Patient Portal] Patient name: Morgan King
```

### **5. Verify Display**

The page should now show:
- ✅ **"Morgan King"** in the patient header
- ✅ **"Hi Morgan King!"** in the chatbot greeting
- ✅ Patient name in all other references

---

## 📊 Before vs After

| Component | Before | After |
|-----------|--------|-------|
| Patient Header | "John Smith" | ✅ "Morgan King" |
| Chatbot Greeting | "Hi John Smith!" | ✅ "Hi Morgan King!" |
| PDF Export Filename | `discharge-instructions-john-smith.pdf` | ✅ `discharge-instructions-morgan-king.pdf` |
| Data Source | Login account (`user.name`) | ✅ FHIR Patient resource |

---

## 🔍 Debugging

### **Console Logs to Check:**

**Success:**
```javascript
[Patient Portal] Fetching patient details...
[Patient Portal] Patient resource fetched: {resourceType: 'Patient', ...}
[Patient Portal] Patient name: Morgan King
```

**Failed to fetch patient:**
```javascript
[Patient Portal] Failed to fetch patient resource: Unauthorized
```
→ Check that auto-login succeeded and token is valid

**No name in patient resource:**
```javascript
[Patient Portal] Patient resource fetched: {resourceType: 'Patient', id: '...', name: []}
```
→ Patient resource exists but has no name data

---

## 🐛 Troubleshooting

### **Still Showing "John Smith"**

**Possible causes:**
1. ✅ Vercel deployment not complete (wait 3-5 minutes)
2. ✅ Browser cache not cleared
3. ❌ Patient resource has no name data

**Check:**
- Verify deployment status in Vercel dashboard
- Hard refresh browser: `Ctrl+Shift+F5`
- Check console for patient resource structure

### **Showing "Patient" (Generic Fallback)**

This means both fetches failed:
1. Patient resource fetch failed
2. Auto-login failed (no `user?.name`)

**Check:**
- Console for errors: `[Patient Portal] Failed to fetch patient resource:`
- Network tab for failed requests to `/google/fhir/Patient/...`
- Backend health: `https://patient-discharge-backend-qnzythtpnq-uc.a.run.app/health`

### **401 Unauthorized on Patient Fetch**

**Causes:**
- Auto-login failed (no token)
- Token expired
- User doesn't have permission to read Patient resource

**Solution:**
1. Check auto-login logs in console
2. Verify token is being sent in Authorization header
3. Check backend logs for authentication errors

---

## 📋 Related Issues Fixed

This fix is part of a series of fixes to pull real patient data from the backend:

1. ✅ **Backend API URL** - Fixed in commit `d98a8c8`
2. ✅ **Discharge Summary** - Fixed in commit `7be0c2c`
3. ✅ **Discharge Instructions** - Fixed in commit `7be0c2c`
4. ✅ **Patient Name** - Fixed in commit `31ec5ba` (this fix)
5. ⏳ **Medications** - Still hardcoded (needs FHIR MedicationRequest resources)
6. ⏳ **Appointments** - Still hardcoded (needs FHIR Appointment resources)

---

## 🔄 Data Flow Architecture

### **Complete Patient Data Flow:**

```
┌─────────────────────────────────────────────────────────┐
│  Frontend: Patient Portal                               │
│  /demo/patient?patientId=661ea...&compositionId=b9fa... │
└─────────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────┐
│  1. Auto-Login (generic patient account)                │
│     POST /api/auth/login                                │
│     → Returns: { token, user: { name: "Patient" } }     │
└─────────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────┐
│  2. Fetch Patient Name (NEW!)                           │
│     GET /google/fhir/Patient/{patientId}                │
│     → Returns: FHIR Patient resource                    │
│     → Extract: name[0].text or given + family           │
│     → Display: "Morgan King"                            │
└─────────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────┐
│  3. Fetch Discharge Data                                │
│     GET /google/fhir/Composition/{compositionId}/...    │
│     → Returns: Discharge summary & instructions         │
└─────────────────────────────────────────────────────────┘
```

---

## 📝 Files Changed

| File | Change | Lines |
|------|--------|-------|
| `frontend/app/[tenantId]/patient/page.tsx` | Added patient name fetch + state | +38, -1 |

**Commit:** `31ec5ba`  
**Branch:** `main`  
**Status:** ✅ Pushed to GitHub

---

## ⏭️ Next Steps

### **Still Hardcoded (Future Work):**

1. **Medications List**
   - Currently: Hardcoded (Metoprolol, Atorvastatin, Aspirin)
   - TODO: Fetch from FHIR `MedicationRequest` resources
   - Endpoint: `/google/fhir/MedicationRequest?patient={patientId}`

2. **Appointments**
   - Currently: Hardcoded (Dr. Sarah Johnson, Dr. Michael Chen)
   - TODO: Fetch from FHIR `Appointment` resources
   - Endpoint: `/google/fhir/Appointment?patient={patientId}`

3. **Patient Avatar**
   - Currently: Default avatar
   - TODO: Extract from Patient.photo[0].url if available

4. **Preferred Language**
   - Currently: Hardcoded `en`
   - TODO: Extract from Patient.communication[0].language.coding[0].code

---

## 🔐 Security Considerations

### **Authentication**
- Patient name fetch requires valid JWT token
- Token obtained from auto-login with demo credentials
- Backend validates token with `AuthGuard`

### **Authorization**
- `X-Tenant-ID` header ensures tenant isolation
- Patient can only access data within their tenant
- Backend enforces data access policies

### **Data Privacy**
- Patient name displayed only after successful authentication
- Falls back to generic "Patient" if fetch fails (doesn't expose errors to UI)
- Console logs should be disabled in production (remove before prod deploy)

---

## ✅ Verification Checklist

After deployment:

- [ ] Vercel deployment shows "Ready" status
- [ ] Browser cache cleared
- [ ] Console shows: `[Patient Portal] Patient name: Morgan King`
- [ ] Page displays "Morgan King" instead of "John Smith"
- [ ] Chatbot greeting says "Hi Morgan King!"
- [ ] No JavaScript errors in console
- [ ] Loading state works correctly (shows spinner briefly)

---

**Last Updated:** November 18, 2025  
**Fixed By:** AI Assistant  
**Commit:** `31ec5ba`  
**Related Commits:** `7be0c2c` (data loading), `d297a2b` (chatbot fix)

