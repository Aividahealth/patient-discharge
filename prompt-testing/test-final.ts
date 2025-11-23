#!/usr/bin/env tsx

/**
 * Final optimization: Target FK Grade 6.5-7.5 with FRE > 80
 * Strategy: Slightly longer sentences (14-16 words) with selective use of 2-3 syllable medical terms
 */

import { testReadability, SAMPLE_DISCHARGE_SUMMARY } from './test-prompt';

// Target FK Grade ~7 with FRE > 80
const EXAMPLE_TARGET_FK7 = `## Overview

**Reasons for Hospital Stay**

You came to the hospital with lung pneumonia which is a serious infection in your lungs that made it hard for you to breathe. Your oxygen level in your blood was too low which can be dangerous. You also have other health problems including COPD which is a lung disease that makes breathing difficult, type 2 diabetes which causes high blood sugar levels, and high blood pressure.

**What Happened During Your Stay**

When you arrived at the emergency room you had a high fever of 101.8 degrees and your heart was beating very fast at 112 beats per minute. You were also breathing very fast at 28 breaths per minute and your oxygen level was low at only 84 percent. A chest X-ray showed that you had pneumonia in your right lower lung and there was also some fluid sitting near your lung. Blood tests showed clear signs that you had an infection and your blood sugar level was very high at 325 which is not safe.

Doctors started giving you antibiotic medicine through your veins to kill the germs that were causing the lung infection. The antibiotics were called ceftriaxone at a dose of 2 grams each day and azithromycin at 500 mg each day. You also received breathing treatments to help with your COPD symptoms. At first you needed to have extra oxygen flowing at 3 to 4 liters per minute through a small tube placed in your nose. A lung specialist doctor came to see you because your oxygen was so low and because of your history with COPD. Lab tests of the mucus from your lungs found bacteria germs called Streptococcus pneumoniae and your antibiotics were able to kill this type of bacteria. Later on the doctors changed you to just one antibiotic and then switched you to antibiotic pills called levofloxacin on your fifth day in the hospital.

Your blood sugar levels were difficult to control at first so the doctors had to adjust and change your insulin doses multiple times throughout each day. A diabetes educator came to visit you and helped teach you better ways to manage your blood sugar at home. By your fourth day in the hospital your blood sugar levels improved quite a bit and became more stable. You experienced some confusion during the night time on a few occasions which was most likely caused by having low oxygen and having the infection but this confusion went away after we treated these underlying problems.

By your sixth day in the hospital you were feeling much better overall. You no longer had any fever at all and your oxygen level was back to normal at more than 94 percent even without any extra oxygen being given to you. You were able to walk around the hospital floor without feeling short of breath or having any difficulty. A chest X-ray that was done just before you left the hospital showed that your pneumonia was improving and getting much better. You received antibiotic medicine through your veins for a full 7 days while staying in the hospital and you will need to continue taking antibiotic pills for 5 more additional days after you go home.`;

console.log('='.repeat(80));
console.log('FINAL TARGET: FK Grade ~7.0, FRE > 80');
console.log('='.repeat(80));
testReadability(EXAMPLE_TARGET_FK7);

console.log('\n' + '='.repeat(80));
console.log('ANALYSIS OF TECHNIQUES USED');
console.log('='.repeat(80));
console.log(`
Techniques to achieve FK Grade ~7 while maintaining FRE > 80:

1. SENTENCE LENGTH: 14-18 words per sentence
   - Not too short (pushes FK Grade down)
   - Not too long (hurts FRE)
   - Use "which" and "that" clauses to extend sentences naturally

2. VOCABULARY BALANCE:
   - Keep 70-80% of words as 1-2 syllables
   - Allow some 3-4 syllable medical terms when necessary
   - Always explain medical terms inline with "which is" or "which means"

3. WORD REPLACEMENTS:
   ✓ "antibiotic medicine" instead of just "antibiotics" (adds context)
   ✓ "germs" or "bacteria germs" instead of complex medical terms
   ✓ "breathing treatments" instead of "bronchodilator therapy"
   ✓ "lung specialist" instead of "pulmonologist"
   ✓ "diabetes educator" instead of "diabetic counselor"

4. SENTENCE CONNECTORS:
   - Use "which" clauses to add explanations
   - Use "and" to connect related ideas
   - Use "so" to show cause and effect
   - Use "because" to explain reasons

5. ADDITIVE PHRASES (slight word count increase without complexity):
   - "very" before adjectives (very fast, very high)
   - "quite a bit" instead of "significantly"
   - "multiple times" instead of "repeatedly"
   - "a full X days" instead of just "X days"
   - "more additional" instead of just "additional"
`);
