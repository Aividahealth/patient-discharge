import { calculateQualityMetrics } from '../simtran/common/utils/quality-metrics';

/**
 * Test script for iteratively refining the simplification prompt
 * Goal: Flesch-Kincaid Grade Level = 7, Flesch Reading Ease > 80
 */

const SAMPLE_DISCHARGE_SUMMARY = `# **Discharge Summary**

Patient Name: [Redacted]

MRN: [Redacted]

DOB: [Redacted]

Admit Date: 09/28/2025

Discharge Date: 10/05/2025

Attending Physician: [Redacted], MD

Service: Internal Medicine

---

### **Admitting Diagnosis (ICD-10):**

* Community-Acquired Pneumonia, Right Lower Lobe (J18.9)

* Acute Hypoxemic Respiratory Failure (J96.01)

* Type 2 Diabetes Mellitus (E11.9)

* Chronic Obstructive Pulmonary Disease (J44.9)

* Hypertension (I10)

---

### **Discharge Diagnosis:**

* CAP, improved after IV and oral antibiotics

* Acute Hypoxemic Respiratory Failure, resolved

* COPD, stable

* Type 2 Diabetes Mellitus, suboptimally controlled (A1c 8.2%)

* Hypertension, controlled

---

### **Hospital Course:**

The patient is a 72-year-old female with COPD, type 2 diabetes mellitus, and hypertension who presented with 5 days of productive cough, pleuritic chest pain, subjective fevers, and dyspnea. In the ED, she was febrile to 101.8°F, tachycardic to 112, RR 28, SpO₂ 84% RA, improved to 93% on 3 L NC. Exam: right basilar crackles, dullness to percussion, mild wheeze. CXR: right lower lobe consolidation with small parapneumonic effusion. Labs showed leukocytosis (WBC 16.2), CRP 16 mg/dL, procalcitonin 2.1 ng/mL. Blood glucose 325 mg/dL, creatinine 1.3 mg/dL. ABG: pH 7.32, pCO₂ 48, pO₂ 59.

The patient was admitted with diagnosis of CAP with hypoxemia. She was started on IV ceftriaxone 2 g daily and IV azithromycin 500 mg daily, along with bronchodilator therapy for COPD. O₂ support maintained at 3–4 L NC initially. Pulmonology was consulted due to hypoxemia and history of COPD. Sputum cultures grew Streptococcus pneumoniae (pan-sensitive). Antibiotics were narrowed to ceftriaxone monotherapy, later transitioned to oral levofloxacin on HD#5.

Glycemic control was difficult, requiring basal-bolus insulin adjustments. Diabetes educator consulted. Blood glucose stabilized by HD#4. Patient had intermittent delirium at night (likely multifactorial hypoxemia/infection), resolved with reorientation and correction of metabolic derangements.

By HD#6, the patient was afebrile, saturating >94% on room air, ambulating without dyspnea. CXR prior to discharge showed interval improvement in consolidation. She completed 7 days IV/PO antibiotics inpatient and was discharged home on 5 additional days of oral therapy.

---

### **Pertinent Results:**

* CBC (admission): WBC 16.2 → 8.9 by discharge; Hb 11.2, Plt 390

* BMP: Na 134, K 4.1, CO₂ 22, BUN 22, Cr 1.3 → 1.0

* HbA1c: 8.2%

* CRP: 16 → 4.2

* Procalcitonin: 2.1 → 0.3

* ABG (RA): pH 7.32 / pCO₂ 48 / pO₂ 59 → normalized at discharge

* CXR: RLL consolidation with small effusion → improved aeration at discharge

---

### **Condition at Discharge:**

* Vitals: T 98.1°F, HR 88, RR 18, BP 128/74, SpO₂ 95% RA

* Exam: Improved aeration at R base, mild residual crackles, no wheeze, no retractions

* Ambulating, tolerating diet, pain-free at rest and with exertion

---

### **Discharge Medications:**

New:

* Levofloxacin 750 mg PO daily × 5 days

* Benzonatate 100 mg PO TID PRN cough

Continued:

* Lisinopril 20 mg PO daily

* Metformin 1000 mg PO BID

* Insulin glargine 25 units QHS + lispro sliding scale with meals

* Tiotropium inhaler daily, albuterol PRN

Stopped:

* Azithromycin, ceftriaxone (completed course inpatient)

---

### **Follow-Up Appointments:**

* PCP in 1 week with repeat CBC, BMP

* Pulmonology clinic in 2–3 weeks for COPD management and repeat CXR

* Endocrinology clinic in 4 weeks for diabetes optimization

---

### **Diet and Lifestyle Instructions:**

* Regular diabetic diet, avoid concentrated sugars

* Monitor blood glucose before meals and at bedtime

* Avoid smoking, continue pulmonary hygiene with incentive spirometry

* Gradually increase ambulation and activity as tolerated

---

### **Patient Instructions (Clinical Style):**

Patient counseled on importance of completing full antibiotic course, adherence to COPD and diabetes regimens, and use of incentive spirometer. Educated on signs of pneumonia relapse, sick-day management for diabetes, and when to seek care. Written pneumonia and COPD action plans provided.

---

### **Return Precautions:**

Return to ED or call provider for:

* Fever >100.5°F after completion of antibiotics

* Worsening cough or dyspnea

* Chest pain, hemoptysis, confusion

* Persistent hyperglycemia >350 mg/dL despite insulin

* Hypoxemia, SpO₂ <90% at home`;

// Test function to analyze readability
export function testReadability(simplifiedText: string) {
  const metrics = calculateQualityMetrics(SAMPLE_DISCHARGE_SUMMARY, simplifiedText);

  console.log('\n=== READABILITY METRICS ===');
  console.log(`Flesch-Kincaid Grade Level: ${metrics.readability.fleschKincaidGradeLevel} (target: 7.0)`);
  console.log(`Flesch Reading Ease: ${metrics.readability.fleschReadingEase} (target: >80)`);
  console.log(`SMOG Index: ${metrics.readability.smogIndex}`);
  console.log(`\nAvg Sentence Length: ${metrics.simplification.avgSentenceLength} words (target: 12-16)`);
  console.log(`Avg Word Length: ${metrics.simplification.avgWordLength} chars`);
  console.log(`Complex Words (3+ syllables): ${metrics.lexical.complexWordCount}`);

  const targetMet =
    metrics.readability.fleschKincaidGradeLevel <= 7.0 &&
    metrics.readability.fleschReadingEase >= 80;

  console.log(`\n✓ Target Met: ${targetMet ? 'YES' : 'NO'}`);

  return { metrics, targetMet };
}

// Export for use in tests
export { SAMPLE_DISCHARGE_SUMMARY };
