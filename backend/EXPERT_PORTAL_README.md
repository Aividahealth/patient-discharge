# Expert Review Portal - MVP

## Overview
A simple feedback system for experts to review discharge summary simplifications and translations.

## What Was Built

### Backend (NestJS)

**Files Created:**
- `src/expert/expert.types.ts` - TypeScript types and interfaces
- `src/expert/expert.service.ts` - Business logic for feedback and review lists
- `src/expert/expert.controller.ts` - API endpoints
- `src/expert/expert.module.ts` - Module configuration
- Updated `src/app.module.ts` - Added ExpertModule

**API Endpoints:**

1. **GET /expert/list** - Get list of discharge summaries for review
   - Query params: `type`, `filter` (all/no_reviews/low_rating), `limit`, `offset`
   - Returns: Array of summaries with review stats

2. **POST /expert/feedback** - Submit expert feedback
   - Body: Feedback form data
   - Returns: Success response with feedback ID

3. **GET /expert/feedback/:summaryId** - Get feedback for a summary
   - Query params: `summaryId`, `reviewType` (optional)
   - Returns: Array of feedback for that summary

### Frontend (Next.js)

**Files Created:**
- `frontend/lib/expert-api.ts` - API client for expert endpoints
- `frontend/app/expert/page.tsx` - List page showing all summaries
- `frontend/app/expert/review/[id]/page.tsx` - Review form with side-by-side comparison

**Features:**
- Filter summaries (all, no reviews, low rating)
- View summaries with review counts and ratings
- Side-by-side original vs simplified view
- Simple feedback form with:
  - Reviewer name
  - Review type (simplification/translation)
  - Overall rating (1-5 stars)
  - What works well
  - What needs improvement
  - Specific issues (copy/paste)
  - Quick flags for hallucination and missing info

### Firestore Collection

**Collection: `expert_feedback`**

Fields:
- `dischargeSummaryId` - Link to discharge summary
- `reviewType` - 'simplification' | 'translation'
- `language` - (optional, for translations)
- `reviewerName` - Reviewer's name
- `reviewDate` - When reviewed
- `overallRating` - 1-5
- `whatWorksWell` - Text
- `whatNeedsImprovement` - Text
- `specificIssues` - Text with examples
- `hasHallucination` - Boolean
- `hasMissingInfo` - Boolean
- `createdAt` - Timestamp

## How to Use

### 1. Access the Portal
Navigate to: `http://localhost:3001/expert` (or your frontend URL)

### 2. Review a Summary
1. Click on any discharge summary from the list
2. Read both original and simplified versions
3. Fill out the feedback form
4. Submit review

### 3. View Feedback (for developers)
Query Firestore `expert_feedback` collection to see all reviews

## Next Steps

### Week 1: Test & Iterate
1. Share portal with 2-3 expert reviewers
2. Collect 10-20 reviews
3. Fix any bugs or UX issues

### Week 2: Analysis
1. Export feedback from Firestore
2. Look for patterns in issues
3. Identify top 3 problems

### Week 3: Prompt Improvement
1. Update `simtran/common/utils/prompts.ts` based on feedback
2. Test updated prompt on sample summaries
3. Deploy improved cloud function

### Future Enhancements (Only if needed)
- [ ] Inline text annotations/highlighting
- [ ] Analytics dashboard
- [ ] Email weekly summary
- [ ] Multi-reviewer consensus
- [ ] Automated prompt versioning
- [ ] A/B testing framework

## Quick Export of Feedback Data

To analyze feedback, use Firestore console or run this query:

```javascript
// In Firestore console
db.collection('expert_feedback')
  .orderBy('reviewDate', 'desc')
  .get()
  .then(snapshot => {
    snapshot.forEach(doc => {
      console.log(doc.id, doc.data());
    });
  });
```

Or export to CSV:
```bash
# Install Firebase CLI
npm install -g firebase-tools

# Export data
firebase firestore:export gs://YOUR_BUCKET/expert-feedback-export
```

## Monitoring Key Metrics

Track these manually each week:
- Total reviews submitted
- Average rating (target: >4.0)
- Hallucination rate (% with hasHallucination=true)
- Missing info rate (% with hasMissingInfo=true)
- Common themes in "whatNeedsImprovement"

## Troubleshooting

**Backend not starting?**
- Ensure Firestore credentials are configured
- Check `.settings.dev/config.yaml` exists
- Run: `cd backend && npm run start:dev`

**Frontend can't connect to backend?**
- Check `NEXT_PUBLIC_API_URL` in frontend `.env.local`
- Verify backend is running on correct port
- Check CORS settings in `backend/src/main.ts`

**Can't see discharge summaries?**
- Ensure summaries exist in Firestore `discharge_summaries` collection
- Check they have `simplifiedAt` field populated
- Verify GCS buckets have simplified files

## File Structure

```
backend/
└── src/
    └── expert/
        ├── expert.types.ts
        ├── expert.service.ts
        ├── expert.controller.ts
        └── expert.module.ts

frontend/
├── lib/
│   └── expert-api.ts
└── app/
    └── expert/
        ├── page.tsx
        └── review/
            └── [id]/
                └── page.tsx

firestore/
└── expert_feedback/  (collection created automatically)
```

## Success Criteria

**Month 1:**
- ✅ 20+ reviews submitted
- ✅ At least 3 different reviewers
- ✅ Identify top 3 recurring issues
- ✅ Make 1 prompt improvement

**Month 2:**
- ✅ 50+ reviews
- ✅ Average rating trending up
- ✅ Hallucination rate trending down
- ✅ Team agrees system is useful

If metrics look good, invest in more features. If not, fix the basics first.
