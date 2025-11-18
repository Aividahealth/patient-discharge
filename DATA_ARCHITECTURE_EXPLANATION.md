# Patient Portal Data Architecture

## ✅ What IS Currently Pulled from Backend

### **1. Discharge Summary**
- **Source:** `dischargeSummary` state variable
- **API:** `/google/fhir/Composition/{compositionId}/binaries`
- **Format:** Plain text (AI-simplified version)
- **Displayed In:** "Overview" tab → "Recovery Summary" card
- **Status:** ✅ **Working** - Shows real patient-specific discharge information

### **2. Discharge Instructions**
- **Source:** `dischargeInstructions` state variable
- **API:** `/google/fhir/Composition/{compositionId}/binaries`
- **Format:** Plain text (AI-simplified version)
- **Displayed In:** Currently not directly displayed in any tab (used by chatbot)
- **Status:** ✅ **Working** - Available but not rendered in UI

### **3. Patient Name**
- **Source:** `patientName` state variable
- **API:** `/google/fhir/Patient/{patientId}`
- **Format:** FHIR Patient.name[0]
- **Displayed In:** 
  - Header: "Welcome back, {name}"
  - Chatbot greeting: "Hi {name}!"
- **Status:** ✅ **Working** - Shows "Morgan King"

---

## ⚠️ What is STILL Hardcoded

### **1. Medications Tab**
**Current Code:**
```typescript
medications: [
  {
    name: "Metoprolol",
    dose: "25mg",
    instructions: "Take twice daily with food. Do not stop suddenly.",
  },
  {
    name: "Atorvastatin",
    dose: "20mg",
    instructions: "Take once daily at bedtime. Avoid grapefruit.",
  },
  {
    name: "Aspirin",
    dose: "81mg",
    instructions: "Take once daily with food to prevent stomach upset.",
  },
]
```

**Status:** ⚠️ **Hardcoded** - Not patient-specific

**Why?** 
- The discharge instructions contain medication info as **plain text**
- We don't currently parse this text into structured data
- Ideal solution: Fetch from FHIR `MedicationRequest` resources

### **2. Appointments Tab**
**Current Code:**
```typescript
appointments: [
  {
    date: "March 22, 2024",
    doctor: "Dr. Sarah Johnson",
    specialty: "Cardiology Follow-up",
  },
  {
    date: "April 5, 2024",
    doctor: "Dr. Michael Chen",
    specialty: "Primary Care Check-up",
  },
]
```

**Status:** ⚠️ **Hardcoded** - Not patient-specific

**Why?**
- Appointment info may be in discharge instructions as text
- We don't parse it into structured data
- Ideal solution: Fetch from FHIR `Appointment` resources

### **3. Diet & Activity Guidelines Tab**
**Current Code:**
```typescript
// Hardcoded lists in the render function
Foods to Include:
- Fresh fruits and vegetables
- Whole grains (brown rice, oats)
- Lean proteins (fish, chicken, beans)
...

Foods to Limit:
- High-sodium foods (processed meats, canned soups)
- Fried and fast foods
...
```

**Status:** ⚠️ **Hardcoded** - Generic guidelines

**Why?**
- Diet guidelines are likely in discharge instructions as text
- We don't parse them into structured format
- Could potentially extract from `dischargeInstructions` with AI

### **4. Warning Signs Tab**
**Current Code:**
```typescript
// Hardcoded in render
Call 911 if experiencing:
- Severe chest pain or pressure
- Difficulty breathing or shortness of breath
- Sudden weakness or numbness
...

Call your doctor if experiencing:
- Increased swelling in legs or feet
- Rapid weight gain (3+ pounds in 2 days)
...
```

**Status:** ⚠️ **Hardcoded** - Generic warning signs

**Why?**
- Warning signs are in discharge instructions as text
- We don't extract them programmatically
- Could extract from `dischargeInstructions` with pattern matching or AI

---

## 🤔 Should These Tabs Be Populated from Backend?

### **Short Answer:** YES (but with caveats)

### **Current Situation:**

**Discharge Summary & Instructions Format:**
```
DISCHARGE SUMMARY
-----------------
[Patient narrative about hospital stay, procedures, outcomes...]

DISCHARGE INSTRUCTIONS
----------------------
Medications:
- Metoprolol 25mg twice daily
- Atorvastatin 20mg at bedtime
...

Follow-up Appointments:
- Cardiology: Dr. Johnson on March 22, 2024
- Primary Care: Dr. Chen on April 5, 2024
...

Diet:
Eat plenty of fresh fruits and vegetables...
Avoid high-sodium foods...

Activity:
You may walk 20-30 minutes daily...
Do not lift more than 10 pounds...

Warning Signs:
Call 911 if you experience:
- Severe chest pain
- Difficulty breathing
...
```

**Problem:** This is **unstructured plain text**, not structured JSON.

---

## 🎯 Three Approaches to Fix This

### **Approach 1: Parse Plain Text Discharge Instructions** ⚠️ Complex

**Pros:**
- Uses existing data
- No backend changes needed
- Works with current FHIR structure

**Cons:**
- Text parsing is fragile and error-prone
- Different formats from different hospitals
- Hard to maintain
- May miss or misparse critical info

**Implementation:**
```typescript
function parseDischargeInstructions(text: string) {
  // Use regex or AI to extract sections
  const medicationsSection = extractSection(text, "Medications:", "Follow-up")
  const appointments = extractAppointments(medicationsSection)
  // ... more parsing
}
```

**Complexity:** High  
**Reliability:** Low  
**Recommended:** ❌ No

---

### **Approach 2: Fetch FHIR Resources** ✅ Best for Production

**Pros:**
- Structured, reliable data
- FHIR standard format
- Easy to maintain
- Scales well

**Cons:**
- Requires backend changes
- Assumes FHIR resources exist
- Need to create resources if missing

**Implementation:**

**Backend: Add new endpoints**
```typescript
// backend/src/google/google.controller.ts

@Get('fhir/MedicationRequest')
async getMedicationRequests(
  @Query('patient') patientId: string,
  @TenantContext() ctx: TenantContextType
) {
  return this.googleService.fhirSearch('MedicationRequest', { patient: patientId }, ctx);
}

@Get('fhir/Appointment')
async getAppointments(
  @Query('patient') patientId: string,
  @TenantContext() ctx: TenantContextType
) {
  return this.googleService.fhirSearch('Appointment', { patient: patientId }, ctx);
}
```

**Frontend: Fetch structured data**
```typescript
// Fetch medications
const medsResponse = await fetch(
  `${backendUrl}/google/fhir/MedicationRequest?patient=${patientId}`,
  {
    headers: {
      'Authorization': `Bearer ${token}`,
      'X-Tenant-ID': tenant.id,
    },
  }
)
const medicationsBundle = await medsResponse.json()
const medications = medicationsBundle.entry?.map(entry => ({
  name: entry.resource.medicationCodeableConcept?.text,
  dose: entry.resource.dosageInstruction?.[0]?.doseAndRate?.[0]?.doseQuantity?.value,
  instructions: entry.resource.dosageInstruction?.[0]?.text,
}))
```

**Complexity:** Medium  
**Reliability:** High  
**Recommended:** ✅ **Yes** (for production)

---

### **Approach 3: Use AI to Extract Structured Data** 🤖 Hybrid Approach

**Pros:**
- Works with unstructured text
- More reliable than regex
- Can handle variations
- Uses existing data

**Cons:**
- Requires AI API calls (cost)
- Slight latency
- Still dependent on text quality

**Implementation:**
```typescript
// Use the existing discharge instructions with Gemini AI
const extractMedications = async (dischargeInstructions: string) => {
  const prompt = `Extract medications from this discharge instructions and return as JSON:
${dischargeInstructions}

Return format:
{
  "medications": [
    {"name": "...", "dose": "...", "instructions": "..."}
  ]
}`

  const response = await callGeminiAI(prompt)
  return JSON.parse(response)
}
```

**Complexity:** Medium  
**Reliability:** Medium-High  
**Recommended:** ⚠️ **Maybe** (good interim solution)

---

## 📊 Current vs Ideal State

| Tab | Current Source | Ideal Source | Effort |
|-----|----------------|--------------|--------|
| **Overview** | ✅ Backend API (plain text) | ✅ Same | Done |
| **Medications** | ❌ Hardcoded array | ✅ FHIR MedicationRequest | High |
| **Appointments** | ❌ Hardcoded array | ✅ FHIR Appointment | Medium |
| **Diet & Activity** | ❌ Hardcoded text | 🤖 AI extraction from instructions | Medium |
| **Warning Signs** | ❌ Hardcoded text | 🤖 AI extraction from instructions | Low |

---

## 🚀 Recommended Implementation Plan

### **Phase 1: Quick Wins** (Current Sprint)

1. ✅ **DONE:** Fetch patient name from FHIR
2. ✅ **DONE:** Display real discharge summary
3. ✅ **DONE:** Fix welcome message
4. ⏳ **TODO:** Display discharge instructions in a dedicated tab/section
5. ⏳ **TODO:** Use AI to extract warning signs from instructions

**Effort:** Low (1-2 days)

---

### **Phase 2: AI Extraction** (Next Sprint)

1. Create backend endpoint to extract structured data with AI
2. Extract medications from discharge instructions
3. Extract appointments from discharge instructions
4. Extract diet guidelines from discharge instructions
5. Cache extracted data to avoid repeated AI calls

**Effort:** Medium (3-5 days)

**Example Backend Endpoint:**
```typescript
@Post('api/discharge/extract-structured-data')
async extractStructuredData(
  @Body() dto: { compositionId: string },
  @TenantContext() ctx: TenantContextType
) {
  // Get discharge instructions
  const instructions = await this.getDischargeInstructions(dto.compositionId, ctx)
  
  // Use Gemini AI to extract structured data
  const structured = await this.geminiService.extract({
    text: instructions,
    schema: {
      medications: [...],
      appointments: [...],
      diet: {...},
      warnings: {...}
    }
  })
  
  return structured
}
```

---

### **Phase 3: FHIR Resources** (Future)

1. Add endpoints to fetch FHIR MedicationRequest resources
2. Add endpoints to fetch FHIR Appointment resources
3. Create FHIR resources when importing discharge data
4. Migrate from AI extraction to structured FHIR data

**Effort:** High (1-2 weeks)

---

## 💡 Immediate Recommendation

### **For Your Current Question:**

> "Are we also populating the medications, appointments, Diet & Activity, Warning signs tabs from discharge instructions from the backend?"

**Answer:**

**Currently (Today):**
- ❌ **No** - These tabs show hardcoded generic data
- ✅ **But** - The discharge instructions (which contain this info) ARE pulled from the backend
- ⚠️ **Issue** - The instructions are plain text, not parsed into the UI tabs

**What Should Happen:**
- ✅ **Yes** - Ideally, these should come from the backend
- 🎯 **Approach** - Use AI to extract structured data from discharge instructions (Phase 2)
- 📈 **Long-term** - Fetch from FHIR resources (Phase 3)

**Quickest Fix (Today):**
1. Add a new tab called "Discharge Instructions" (raw)
2. Display `dischargeInstructions` text content
3. This gives patients access to ALL their info immediately
4. Then iterate on Phase 2 for structured display

---

## 🛠️ Quick Fix Code

To immediately show discharge instructions in the UI:

```typescript
<TabsContent value="instructions" className="space-y-6">
  <Card>
    <CardHeader>
      <CardTitle className="font-heading">Discharge Instructions</CardTitle>
      <CardDescription>
        Complete instructions from your healthcare team
      </CardDescription>
    </CardHeader>
    <CardContent>
      <div className="prose prose-sm max-w-none whitespace-pre-wrap">
        {dischargeInstructions || "Loading instructions..."}
      </div>
    </CardContent>
  </Card>
</TabsContent>
```

This would show patients ALL their discharge information immediately, even if it's not perfectly formatted into tabs yet.

---

## 📝 Summary

**Current Data Flow:**
```
Backend FHIR → Plain Text Discharge Instructions → Frontend State
                                                   ↓
                                          (Not parsed into tabs)
                                                   ↓
                                            Hardcoded tabs shown
```

**Desired Data Flow (Phase 2):**
```
Backend FHIR → Plain Text Instructions → AI Extraction → Structured JSON
                                                              ↓
                                                    Frontend Dynamic Tabs
```

**Ideal Data Flow (Phase 3):**
```
Backend FHIR → Structured FHIR Resources → Frontend Dynamic Tabs
               (MedicationRequest,
                Appointment, etc.)
```

---

**Last Updated:** November 18, 2025  
**Status:** Discharge summary/instructions pulled from backend; tabs still hardcoded  
**Next Step:** Add AI extraction endpoint for structured data

