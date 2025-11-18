# Patient Chatbot Fix - CRITICAL

## 🚨 Problem Identified

The patient chatbot was giving the **same generic response** to all questions:

> "Thank you for your question: '[question]'. For detailed medical advice, please consult with your healthcare provider or call your doctor's office. If you're experiencing urgent symptoms, please call 911 immediately."

### User Examples

```
User: "what is arthroplasty"
Bot: "Thank you for your question... please consult with your healthcare provider"

User: "what medications am I on"
Bot: "Thank you for your question... please consult with your healthcare provider"
```

The chatbot was **completely ignoring the patient's discharge information** and not providing any helpful answers.

---

## 🔍 Root Cause Analysis

The issue had **two root causes**:

### 1. **Wrong API Endpoint**

The `PatientChatbot` component was calling `/api/chat` which is a **Next.js API route** with a hardcoded response:

```typescript:1:15:frontend/app/api/chat/route.ts
import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { message, patientData, conversationHistory } = await request.json()

    // Simple response without AI SDK
    const response = `Thank you for your question: "${message}". For detailed medical advice, please consult with your healthcare provider or call your doctor's office. If you're experiencing urgent symptoms, please call 911 immediately.`

    return NextResponse.json({ message: response })
  } catch (error) {
    console.error("Chat API error:", error)
    return NextResponse.json({ error: "Failed to process chat message" }, { status: 500 })
  }
}
```

**This is just a placeholder!** It doesn't call any AI service or use the discharge information.

### 2. **Missing Props**

The `PatientChatbot` component was not receiving the discharge summary and instructions:

**Before (broken):**
```typescript
<PatientChatbot 
  isOpen={showChat} 
  onClose={() => setShowChat(false)} 
  patientData={patientData} 
/>
```

**Missing:**
- `dischargeSummary` - The patient's actual discharge information
- `dischargeInstructions` - The care instructions
- `compositionId` - The FHIR composition ID
- `patientId` - The patient ID

Without these props, the chatbot had **no context** about the patient's actual discharge information.

---

## ✅ Fix Applied

### 1. **Updated Chatbot Endpoint**

Changed the chatbot to call the **real backend AI service**:

```typescript
// OLD: Called dummy Next.js route
const chatbotUrl = process.env.NEXT_PUBLIC_CHATBOT_SERVICE_URL || '/api/chat'

// NEW: Calls backend Gemini AI service
const getBackendUrl = () => {
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return 'http://localhost:3000'
  }
  return 'https://patient-discharge-backend-qnzythtpnq-uc.a.run.app'
}

const chatbotUrl = `${getBackendUrl()}/api/patient-chatbot/chat`
```

### 2. **Added Debug Logging**

```typescript
console.log('[Chatbot] Sending message to backend:', chatbotUrl)
console.log('[Chatbot] Message context:', {
  patientId,
  compositionId,
  hasSummary: !!dischargeSummary,
  hasInstructions: !!dischargeInstructions,
  hasToken: !!token,
  tenantId
})
```

### 3. **Passed Required Props**

**After (fixed):**
```typescript
<PatientChatbot 
  isOpen={showChat} 
  onClose={() => setShowChat(false)} 
  patientData={patientData}
  dischargeSummary={dischargeSummary}
  dischargeInstructions={dischargeInstructions}
  compositionId={compositionId || ''}
  patientId={patientId || ''}
/>
```

---

## 🤖 Backend AI Service Features

The backend chatbot service (which was **never being used before**) has sophisticated AI capabilities:

### **Technology Stack**
- **Model:** Google Gemini 2.0 Flash Exp (via Vertex AI)
- **Temperature:** 0.3 (conservative, accurate responses)
- **Max Tokens:** 1000 per response

### **System Prompt with Guardrails**

The backend has a **strict system prompt** that:

1. ✅ **ONLY answers from discharge documents** - No general medical advice
2. ✅ **Explains medical terms** - Can define medical jargon from the discharge summary (like "arthroplasty")
3. ✅ **Lists medications** - Shows medications from the patient's discharge instructions
4. ✅ **Quotes exact information** - For critical details like dosages, quotes directly from documents
5. ❌ **NO diagnosis** - Won't diagnose new symptoms
6. ❌ **NO medication changes** - Won't suggest changes not in discharge docs
7. ❌ **NO off-topic advice** - Politely declines questions outside discharge scope

### **Example System Prompt Snippet**

```typescript
You are a helpful patient discharge assistant. Your role is to help patients understand their discharge information.

**CRITICAL RESTRICTIONS:**
1. ONLY answer questions using information found in the discharge summary and discharge instructions provided below
2. If the answer is not in the discharge documents, say "I don't see that information in your discharge summary. Please contact your healthcare provider."
3. DO NOT provide general medical advice beyond what's in the discharge documents
4. You CAN explain medical acronyms and provide simple explanations of medical terms mentioned in the discharge documents

**DISCHARGE SUMMARY:**
---
${dischargeSummary}
---

**DISCHARGE INSTRUCTIONS:**
---
${dischargeInstructions}
---
```

---

## 🧪 Testing the Fix

### 1. **Wait for Vercel Deployment** (2-3 minutes)

The commit `d297a2b` has been pushed and Vercel should auto-deploy.

### 2. **Clear Browser Cache**

- **Hard Refresh:** `Ctrl+F5` (Windows) or `Cmd+Shift+R` (Mac)
- **Or:** Open incognito window

### 3. **Visit Patient Portal**

```
https://www.aividahealth.ai/demo/patient?patientId=661ea147-b707-4534-bf47-243190d3e27c&compositionId=b9fa5eb4-1366-4828-a292-fbaf6644e802
```

### 4. **Open Browser Console** (`F12`)

### 5. **Click Chatbot Button** (bottom-right corner)

### 6. **Test Questions**

Try the same questions that were broken before:

#### **Question 1: "what is arthroplasty"**

**Before:** Generic "consult your provider" response

**After (Expected):** 
> "Arthroplasty is a surgical procedure to replace or repair a damaged joint. Based on your discharge summary, you underwent a total hip arthroplasty (hip replacement surgery) on [date]. This procedure replaces the damaged hip joint with an artificial implant to relieve pain and improve mobility."

#### **Question 2: "what medications am I on"**

**Before:** Generic "consult your provider" response

**After (Expected):**
> "According to your discharge instructions, you are prescribed the following medications:
> 
> 1. **[Medication 1]** - [Dose] - [Instructions from discharge docs]
> 2. **[Medication 2]** - [Dose] - [Instructions from discharge docs]
> 3. **[Medication 3]** - [Dose] - [Instructions from discharge docs]
> 
> Please take these medications exactly as prescribed. If you have questions about any medication, contact your healthcare provider."

#### **Question 3: "when is my follow-up appointment"**

Should extract appointment dates from the discharge instructions.

#### **Question 4: "what foods should I avoid"**

Should reference dietary restrictions from the discharge instructions.

---

## 🔍 Debugging in Console

With the new debug logging, you should see:

```javascript
[Chatbot] Sending message to backend: https://patient-discharge-backend-qnzythtpnq-uc.a.run.app/api/patient-chatbot/chat
[Chatbot] Message context: {
  patientId: '661ea147-b707-4534-bf47-243190d3e27c',
  compositionId: 'b9fa5eb4-1366-4828-a292-fbaf6644e802',
  hasSummary: true,
  hasInstructions: true,
  hasToken: true,
  tenantId: 'demo'
}
```

**If you see:**
- `hasSummary: false` - Discharge summary didn't load
- `hasInstructions: false` - Discharge instructions didn't load
- `hasToken: false` - Auto-login failed
- Network error - Backend might be down

---

## 🐛 Troubleshooting

### **Still Getting Generic Responses?**

**Check:**
1. ✅ Vercel deployment completed (wait 3-5 minutes)
2. ✅ Browser cache cleared
3. ✅ Console shows chatbot calling backend URL (not `/api/chat`)
4. ✅ Console shows `hasSummary: true` and `hasInstructions: true`

### **"Failed to get response" Error?**

**Possible causes:**
1. Backend service is down
2. Authentication failed
3. CORS issue

**Test backend health:**
```bash
curl https://patient-discharge-backend-qnzythtpnq-uc.a.run.app/health
```

Should return:
```json
{
  "status": "ok",
  "timestamp": "2024-...",
  "uptime": 12345
}
```

### **Chatbot Says "I don't see that information"**

This is **correct behavior** if:
- The question asks about something not in the discharge documents
- The backend is working properly and following its guardrails

**Example:**
```
User: "Can you prescribe me antibiotics for a cold?"
Bot: "I can only discuss information from your discharge summary. For questions about new symptoms or prescriptions, please contact your healthcare provider."
```

This is the **desired safe behavior** to prevent medical misinformation.

---

## 📊 Files Changed

| File | Change | Lines |
|------|--------|-------|
| `frontend/components/patient-chatbot.tsx` | Updated endpoint URL + debug logs | +21, -3 |
| `frontend/app/[tenantId]/patient/page.tsx` | Passed required props to chatbot | +8, -1 |

**Commit:** `d297a2b`  
**Branch:** `main`  
**Status:** ✅ Pushed to GitHub

---

## 🎯 Expected Behavior After Fix

| Scenario | Before | After |
|----------|--------|-------|
| "what is arthroplasty" | Generic response | ✅ Explains term from discharge docs |
| "what medications am I on" | Generic response | ✅ Lists patient's medications |
| "when is my appointment" | Generic response | ✅ Extracts appointment dates |
| "what's the weather today" | Generic response | ✅ Declines politely (out of scope) |
| New symptom questions | Generic response | ✅ Advises calling doctor |
| Emergency symptoms | Generic response | ✅ Advises calling 911 |

---

## 🔒 Security Notes

### **Authentication**
- Chatbot requires valid JWT token
- Token extracted from localStorage (set during auto-login)
- Backend validates token with `AuthGuard`

### **Tenant Isolation**
- `X-Tenant-ID` header ensures multi-tenant security
- Patients can only access their own discharge information
- Backend enforces tenant-level data isolation

### **AI Safety**
- Gemini content safety filters enabled
- System prompt has strict guardrails
- No off-topic medical advice
- No medication recommendations beyond discharge docs

---

## 📞 Support

If chatbot still not working after all troubleshooting:

1. **Check Vercel deployment logs** - Look for build errors
2. **Check backend logs** - Look for API errors in Cloud Run
3. **Check browser console** - Look for network errors
4. **Verify backend health** - Test `/health` endpoint

---

## ✅ Deployment Checklist

- [x] Code changes committed
- [x] Pushed to GitHub (`d297a2b`)
- [ ] Vercel deployment completed (wait 2-3 minutes)
- [ ] Browser cache cleared
- [ ] Chatbot called with test questions
- [ ] Console logs verified
- [ ] Chatbot provides context-aware responses

---

**Last Updated:** November 18, 2025  
**Fixed By:** AI Assistant  
**Commit:** `d297a2b`  
**Related Commits:** `7be0c2c` (data loading fix), `c12ca0c` (documentation)

