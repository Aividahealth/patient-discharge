# Expert Portal - Quick Start Guide

## ✅ What's Been Built

A simple MVP for expert reviewers to provide feedback on discharge summary simplifications.

**Features:**
- 📋 List all discharge summaries with review stats
- 👁️ Side-by-side view (original vs simplified)
- ⭐ 1-5 star rating system
- 📝 Free-text feedback (what works, what needs improvement)
- 🚩 Quick flags for hallucinations and missing info
- 💾 All feedback stored in Firestore

## 🚀 How to Run

### 1. Start Backend (Already Configured)

```bash
cd /Users/sekharcidambi/patient-discharge/backend
npm run start:dev
```

Backend will run on `http://localhost:3000`

### 2. Start Frontend

```bash
cd /Users/sekharcidambi/patient-discharge/frontend
npm run dev
```

Frontend will run on `http://localhost:3001`

### 3. Access Expert Portal

Open browser: `http://localhost:3001/expert`

## 📊 How to Use

### For Expert Reviewers:

1. **Go to Expert Portal**: `http://localhost:3001/expert`
2. **See list of discharge summaries** with review counts
3. **Click "Review" button** on any summary
4. **Compare original vs simplified** side-by-side
5. **Fill out feedback form**:
   - Enter your name
   - Rate 1-5 stars
   - Write what works well
   - Write what needs improvement
   - Copy/paste specific problematic text
   - Check boxes if hallucination or missing info found
6. **Click "Submit Review"**

### For Developers:

**View all feedback in Firestore:**
- Open Firebase Console
- Go to Firestore Database
- Look at `expert_feedback` collection

**Export feedback for analysis:**
```bash
# Via Firestore console, export collection as JSON/CSV
# Or use Firebase CLI:
firebase firestore:export gs://YOUR_BUCKET/feedback-export
```

## 📁 Files Created

### Backend (4 files)
```
backend/src/expert/
├── expert.types.ts          # TypeScript types
├── expert.service.ts         # Business logic
├── expert.controller.ts      # API endpoints
└── expert.module.ts          # Module config

backend/src/app.module.ts     # Updated to include ExpertModule
```

### Frontend (3 files)
```
frontend/lib/
└── expert-api.ts             # API client

frontend/app/expert/
├── page.tsx                  # List page
└── review/[id]/page.tsx      # Review form page
```

## 🔧 API Endpoints

```
GET  /expert/list              # Get summaries for review
POST /expert/feedback          # Submit feedback
GET  /expert/feedback/:id      # Get feedback for summary
```

## 📈 Next Steps

### Week 1: Pilot
- [ ] Share with 2-3 expert reviewers
- [ ] Collect 10-20 reviews
- [ ] Monitor for bugs/issues

### Week 2: Analyze
- [ ] Export feedback from Firestore
- [ ] Identify top 3 recurring issues
- [ ] Look for patterns (hallucinations, missing info, etc.)

### Week 3: Improve
- [ ] Update prompts in `simtran/common/utils/prompts.ts`
- [ ] Test updated prompts
- [ ] Deploy improved cloud function
- [ ] Measure improvement

## 🐛 Troubleshooting

**Problem: Can't see any discharge summaries**
- ✅ Make sure you have summaries in Firestore `discharge_summaries` collection
- ✅ Verify they have `simplifiedAt` field populated
- ✅ Check backend logs for errors

**Problem: Can't submit feedback**
- ✅ Check browser console for errors
- ✅ Verify backend is running
- ✅ Check CORS settings in `backend/src/main.ts`
- ✅ Ensure Firestore is accessible

**Problem: Frontend can't connect to backend**
- ✅ Check `NEXT_PUBLIC_API_URL` in `frontend/.env.local`
- ✅ Should be `http://localhost:3000` for local development
- ✅ Verify backend is running on port 3000

## 💡 Tips

1. **Start small**: Get 5-10 quality reviews before scaling
2. **Focus on patterns**: Look for recurring issues, not one-off complaints
3. **Iterate quickly**: Update prompts weekly based on feedback
4. **Measure impact**: Track if ratings improve after prompt updates
5. **Keep it simple**: Don't add features until you need them

## 🎯 Success Metrics

Track these manually each week:

| Metric | Target | How to Check |
|--------|--------|--------------|
| Reviews submitted | 20+ | Count docs in `expert_feedback` |
| Average rating | >4.0 | Average of `overallRating` field |
| Hallucination rate | <10% | % where `hasHallucination=true` |
| Missing info rate | <10% | % where `hasMissingInfo=true` |

## 🔄 Feedback → Improvement Loop

```
1. Collect Feedback (Week 1)
   ↓
2. Analyze Patterns (Week 2)
   ↓
3. Update Prompts (Week 3)
   ↓
4. Deploy & Test (Week 3)
   ↓
5. Measure Impact (Week 4)
   ↓
6. Repeat
```

## 📝 Sample Feedback Export Query

```javascript
// In Firestore console or Node.js
const feedbackRef = db.collection('expert_feedback');
const snapshot = await feedbackRef
  .orderBy('reviewDate', 'desc')
  .limit(50)
  .get();

snapshot.forEach(doc => {
  const data = doc.data();
  console.log(`
    Reviewer: ${data.reviewerName}
    Rating: ${data.overallRating}/5
    Hallucination: ${data.hasHallucination}
    Issues: ${data.specificIssues}
  `);
});
```

## 🚢 Deployment

**To deploy to production:**

1. Deploy backend to Cloud Run (existing script):
```bash
cd backend
./deploy-to-cloud-run.sh
```

2. Update frontend env:
```bash
# In frontend/.env.production
NEXT_PUBLIC_API_URL=https://patient-discharge-backend-xxx.run.app
```

3. Deploy frontend to Vercel (existing setup)

4. Access at: `https://www.aividahealth.ai/expert`

## 📚 Related Docs

- Main design: [Simplified MVP Design](#) (the design doc I created earlier)
- Backend README: `backend/EXPERT_PORTAL_README.md`
- Discharge Summaries API: `backend/DISCHARGE_SUMMARIES_API.md`

---

**That's it! You now have a working expert review portal. Start collecting feedback and improving your prompts! 🎉**
