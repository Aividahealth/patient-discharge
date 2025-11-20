# Quality Metrics for Discharge Summary Simplification

## Overview

The Patient Discharge Summary Simplification system includes automated quality metrics to measure and validate the effectiveness of text simplification. These metrics help ensure that simplified discharge summaries meet target readability standards while preserving essential medical information.

## Metrics Categories

### 1. Readability Metrics

These metrics assess how easy the text is to read and understand.

#### Flesch-Kincaid Grade Level
- **What it measures**: U.S. grade level required to comprehend the text
- **Formula**: Based on average sentence length and syllables per word
- **Target**: ≤ 9.0 (9th grade or below)
- **Interpretation**:
  - 0-5: Elementary level
  - 6-8: Middle school level ✅ **Target range**
  - 9-10: High school level
  - 11-12: Advanced high school
  - 13+: College level and above

#### Flesch Reading Ease
- **What it measures**: Readability on a 0-100 scale (higher = easier)
- **Formula**: 206.835 - 1.015(total words / total sentences) - 84.6(total syllables / total words)
- **Target**: ≥ 60
- **Interpretation**:
  - 90-100: Very Easy (5th grade)
  - 80-90: Easy (6th grade)
  - 70-80: Fairly Easy (7th grade)
  - 60-70: Standard (8th-9th grade) ✅ **Target range**
  - 50-60: Fairly Difficult (10th-12th grade)
  - 30-50: Difficult (College)
  - 0-30: Very Difficult (Graduate)

#### SMOG Index (Simple Measure of Gobbledygook)
- **What it measures**: Years of education needed to understand the text
- **Why it's important**: Recommended by NIH and CDC for patient education materials
- **Formula**: 1.0430 × √(polysyllables × (30 / sentences)) + 3.1291
- **Target**: ≤ 9.0
- **Usage**: Specifically designed for health literacy assessment

#### Coleman-Liau Index
- **What it measures**: Grade level based on character count (not syllables)
- **Why it's useful**: More accurate for medical terminology with Latinagreek roots
- **Formula**: 0.0588L - 0.296S - 15.8 (where L = letters per 100 words, S = sentences per 100 words)
- **Provides**: Alternative validation of readability

#### Automated Readability Index (ARI)
- **What it measures**: Grade level using character counts and word frequency
- **Formula**: 4.71(characters / words) + 0.5(words / sentences) - 21.43
- **Provides**: Additional confirmation of reading difficulty

### 2. Simplification Metrics

These metrics quantify how much the text has been simplified.

#### Compression Ratio
- **What it measures**: Percentage reduction in text length
- **Formula**: ((original words - simplified words) / original words) × 100
- **Typical range**: 20-40% for medical text simplification
- **Interpretation**:
  - < 10%: Minimal simplification
  - 10-20%: Light simplification
  - 20-40%: Good simplification ✅ **Target range**
  - 40-60%: Heavy simplification
  - > 60%: May indicate information loss

#### Sentence Length Reduction
- **What it measures**: Change in average sentence length
- **Formula**: ((original avg - simplified avg) / original avg) × 100
- **Target**: Positive value indicating shorter sentences

#### Average Sentence Length
- **What it measures**: Mean number of words per sentence
- **Target**: ≤ 20 words
- **Interpretation**:
  - < 15 words: Very easy to read
  - 15-20 words: Easy to read ✅ **Target range**
  - 20-25 words: Moderate difficulty
  - > 25 words: Difficult to read

#### Average Word Length
- **What it measures**: Mean characters per word
- **Typical values**:
  - 4-5 characters: Simple vocabulary
  - 5-6 characters: Standard vocabulary
  - > 6 characters: Complex vocabulary

### 3. Lexical Metrics

These metrics analyze vocabulary complexity and diversity.

#### Type-Token Ratio (TTR)
- **What it measures**: Vocabulary diversity (unique words / total words)
- **Range**: 0.0 to 1.0
- **Interpretation**:
  - Low TTR (< 0.4): Repetitive text (may be good for clarity)
  - Medium TTR (0.4-0.6): Balanced vocabulary
  - High TTR (> 0.6): Diverse vocabulary (may be complex)

#### Word Count
- **What it measures**: Total number of words in simplified text
- **Usage**: Context for other metrics

#### Sentence Count
- **What it measures**: Total number of sentences
- **Usage**: Context for average sentence length

#### Syllable Count
- **What it measures**: Total syllables in the text
- **Usage**: Component of readability formulas

#### Complex Word Count
- **What it measures**: Number of words with 3+ syllables
- **Usage**: Indicator of vocabulary complexity
- **Target**: Lower is better for patient comprehension

## Target Simplification Goals

All simplified discharge summaries should meet these criteria:

| Metric | Target | Rationale |
|--------|--------|-----------|
| Flesch-Kincaid Grade | ≤ 9.0 | 8th-9th grade reading level |
| Flesch Reading Ease | ≥ 60 | Standard readability |
| SMOG Index | ≤ 9.0 | NIH recommendation for patient materials |
| Avg Sentence Length | ≤ 20 words | Easier comprehension |

**Why 5th-9th Grade?**
- National average adult reading level: 7th-8th grade
- Health literacy often 2-3 grades below general literacy
- Target ensures accessibility for most patients

## How Metrics Are Calculated

### Automatic Calculation
Metrics are automatically calculated for every simplified discharge summary:

1. **During Simplification**: After Gemini AI generates the simplified text
2. **Before Storage**: Metrics calculated and validated against targets
3. **With Firestore**: Stored alongside the discharge summary metadata
4. **In Real-Time**: No manual calculation required

### Implementation Location

```typescript
// Cloud Function: simtran/simplification/index.ts
// Step 4: Calculate quality metrics
const qualityMetrics = calculateQualityMetrics(
  originalText,
  simplifiedText
);
```

### Data Storage

Metrics are stored in Firestore:

```typescript
{
  id: "summary-id",
  patientName: "John Doe",
  status: "simplified",
  qualityMetrics: {
    readability: {
      fleschKincaidGradeLevel: 8.5,
      fleschReadingEase: 65.2,
      smogIndex: 8.8,
      // ...
    },
    simplification: {
      compressionRatio: 28.5,
      avgSentenceLength: 16.2,
      // ...
    },
    lexical: {
      typeTokenRatio: 0.52,
      wordCount: 450,
      // ...
    },
    metadata: {
      calculatedAt: "2025-11-17T10:30:00Z",
      originalWordCount: 625,
      simplifiedWordCount: 450
    }
  }
}
```

## Viewing Metrics

### Expert Portal

Quality metrics are displayed in the expert review portal:

1. **Summary List**: Compact view showing key metrics
   - Flesch-Kincaid Grade Level badge
   - Flesch Reading Ease score
   - Target compliance indicator (✓ or ⚠️)

2. **Review Details**: Full metrics card with:
   - All readability metrics with interpretations
   - Color-coded badges (green = meets target, orange = needs review)
   - Simplification statistics
   - Target validation results

### Clinician Portal

Metrics appear when viewing discharge summaries:

1. **Quality Metrics Card**: Displayed below the side-by-side comparison
2. **Full Details**: All metrics with interpretations
3. **Visual Indicators**: Easy-to-understand status badges

### API Access

Metrics are available via the backend API:

```typescript
GET /api/patients/discharge-queue
// Returns summaries with qualityMetrics field

GET /discharge-summaries/:id
// Returns metadata including qualityMetrics
```

## Interpreting Results

### ✅ Meets All Targets
- **Flesch-Kincaid**: 7.5
- **Reading Ease**: 68
- **SMOG**: 8.2
- **Sentence Length**: 17 words

**Action**: Ready for patient distribution, no further review needed.

### ⚠️ Partially Meets Targets
- **Flesch-Kincaid**: 10.2 ❌
- **Reading Ease**: 62 ✅
- **SMOG**: 9.5 ❌
- **Sentence Length**: 18 words ✅

**Action**: Consider expert review. May need further simplification of complex passages.

### ❌ Does Not Meet Targets
- **Flesch-Kincaid**: 12.5 ❌
- **Reading Ease**: 52 ❌
- **SMOG**: 11.8 ❌
- **Sentence Length**: 24 words ❌

**Action**: Requires expert review and likely re-simplification.

## Using Metrics for Quality Improvement

### 1. Identify Problem Areas

If simplification consistently fails targets:
- Check Gemini prompt configuration
- Review source material complexity
- Analyze specific medical terminology usage

### 2. Track Trends Over Time

Monitor metrics across all summaries:
- Calculate average Flesch-Kincaid for all summaries
- Identify improvement trends
- Benchmark against healthcare industry standards

### 3. Correlate with Expert Reviews

Compare automated metrics with expert ratings:
- Do low-metric summaries get lower expert ratings?
- Are there edge cases where metrics don't align with quality?
- Use insights to refine target thresholds

### 4. Prioritize Review Queue

Use metrics to prioritize expert review:
- **High Priority**: Fails 3+ targets
- **Medium Priority**: Fails 1-2 targets
- **Low Priority**: Meets all targets

## Scientific Basis

These metrics are well-established in readability research:

| Metric | Research Support | Healthcare Application |
|--------|------------------|------------------------|
| Flesch-Kincaid | Developed by U.S. Navy (1975) | Widely used in medical education |
| Flesch Reading Ease | Standard since 1948 | FDA drug label guidelines |
| SMOG | McLaughlin (1969) | NIH/CDC recommendation |
| Coleman-Liau | Coleman & Liau (1975) | Effective for technical texts |

### Relevant Studies

1. **Health Literacy**: Patients with low health literacy have 1.5x higher hospitalization rates (Berkman et al., 2011)

2. **Readability Targets**: NIH recommends 6th-8th grade level for patient materials (NIH Clear Communication, 2022)

3. **Simplification Impact**: Simplified discharge instructions reduce 30-day readmissions by 12% (Jack et al., 2009)

## Limitations

### What Metrics Don't Measure

1. **Medical Accuracy**: Metrics don't validate clinical correctness
   - Solution: Expert review for medical accuracy

2. **Cultural Appropriateness**: Language may be simple but culturally insensitive
   - Solution: Diversity review and patient feedback

3. **Information Completeness**: High compression may indicate missing details
   - Solution: Check `hasMissingInfo` flag from expert reviews

4. **Context Understanding**: Patient background knowledge varies
   - Solution: Combine metrics with patient comprehension testing

### Edge Cases

- **Technical Terms**: Some medical terms can't be simplified (e.g., "chemotherapy")
- **Short Summaries**: Metrics less reliable for very short texts (< 100 words)
- **Specialized Vocabulary**: Certain specialties may require higher reading levels

## Future Enhancements

### Planned: Semantic Preservation Metrics

**BERTScore** (Coming Soon)
- Measures semantic similarity between original and simplified text
- Ensures meaning is preserved during simplification
- Range: 0.0 to 1.0 (higher = better preservation)
- Implementation: Python-based cloud function using transformers library

### Under Consideration

1. **Medical Term Reduction Rate**: Track how many complex medical terms were simplified
2. **Critical Information Preservation**: NER-based validation of key entities (medications, dates, dosages)
3. **Patient Comprehension Testing**: Direct feedback from patients
4. **Cross-Language Metrics**: Extend to translated content

## Troubleshooting

### Metrics Not Appearing

**Problem**: Quality metrics not showing in UI

**Solutions**:
1. Check if summary was simplified after metrics feature deployment
2. Verify Firestore document has `qualityMetrics` field
3. Rebuild simplification cloud function
4. Re-process summary through simplification pipeline

### Inconsistent Results

**Problem**: Metrics seem inaccurate or unexpected

**Solutions**:
1. Verify original and simplified text are correct
2. Check for text encoding issues
3. Review syllable counting algorithm for medical terms
4. Compare with manual readability assessment tools

### Build Errors

**Problem**: TypeScript compilation fails

**Solutions**:
1. Build common module first: `cd simtran/common && npm run build`
2. Then build simplification: `cd simtran/simplification && npm run build`
3. Check for missing dependencies: `npm install`

## References

1. Kincaid, J.P., Fishburne, R.P., Rogers, R.L., & Chissom, B.S. (1975). *Derivation of new readability formulas for Navy enlisted personnel*. Research Branch Report 8-75, Naval Technical Training Command.

2. Flesch, R. (1948). "A new readability yardstick". *Journal of Applied Psychology*, 32(3), 221-233.

3. McLaughlin, G.H. (1969). "SMOG grading: A new readability formula". *Journal of Reading*, 12(8), 639-646.

4. NIH (2022). *Clear Communication: Health Literacy*. National Institutes of Health.

5. Berkman, N.D., Sheridan, S.L., Donahue, K.E., et al. (2011). "Low health literacy and health outcomes: an updated systematic review". *Annals of Internal Medicine*, 155(2), 97-107.

6. Jack, B.W., Chetty, V.K., Anthony, D., et al. (2009). "A reengineered hospital discharge program to decrease rehospitalization". *Annals of Internal Medicine*, 150(3), 178-187.

## Support

For questions or issues with quality metrics:
- **GitHub Issues**: https://github.com/Aividahealth/patient-discharge/issues
- **Documentation**: See this file
- **Code**: `simtran/common/utils/quality-metrics.ts`
