#!/usr/bin/env tsx

/**
 * Ultra-optimized approach: Very simple words in longer sentences
 */

import { testReadability, SAMPLE_DISCHARGE_SUMMARY } from './test-prompt';

// Ultra-optimized: Maximize 1-syllable words, use longer sentences with conjunctions
const EXAMPLE_ULTRA_OPT = `## Overview

**Reasons for Hospital Stay**

You came to the hospital with lung pneumonia which made it hard to breathe and your oxygen level in your blood was too low. You also have COPD which is a lung disease that makes it hard to breathe, type 2 diabetes which means your blood sugar is too high, and high blood pressure.

**What Happened During Your Stay**

When you came to the ER you had a fever of 101.8 degrees and your heart was beating fast at 112 beats per minute and you were breathing fast at 28 times per minute and your oxygen was low at 84 percent. A chest X-ray showed pneumonia in your right lower lung and some fluid near your lung. Blood tests showed signs of infection in your body and your blood sugar was high at 325. Your kidney test showed a value of 1.3 for creatinine.

Doctors gave you germ-killing drugs through your veins to fight the lung infection and these drugs were ceftriaxone 2 grams each day and azithromycin 500 mg each day. You also got breathing treatments to help your COPD and at first you needed extra oxygen at 3 to 4 liters per minute through a nose tube. A lung doctor came to see you due to your low oxygen and your history of COPD. Tests of the mucus from your lungs found germs called Streptococcus pneumoniae and your drugs could kill these germs. Later the doctors gave you just one drug and then switched you to pills called levofloxacin on hospital day 5.

Your blood sugar was hard to control at first so doctors had to change your insulin doses many times. A diabetes teacher came to help you learn how to manage your blood sugar in a better way. By hospital day 4 your blood sugar levels got better and were more stable. You felt confused at night a few times and this was likely from the low oxygen and the infection but this got better once we treated these problems.

By hospital day 6 you felt much better with no fever and your oxygen was normal at more than 94 percent without any extra oxygen and you could walk without feeling short of breath. A chest X-ray done before you left the hospital showed that your pneumonia was getting much better. You took germ-killing drugs through your veins for 7 days while you were in the hospital and you will need to take pills for 5 more days at home.`;

// Another attempt: Even more aggressive simplification
const EXAMPLE_MAX_SIMPLE = `## Overview

**Reasons for Hospital Stay**

You came here with lung pneumonia which is an infection that made it hard to breathe and your oxygen in your blood was too low. You also have COPD which is a lung disease, type 2 diabetes which means high blood sugar, and high blood pressure.

**What Happened During Your Stay**

When you came to the ER your fever was 101.8 degrees and your heart beat was fast at 112 beats per minute and you breathed fast at 28 breaths per minute and your oxygen was low at 84 percent. A chest X-ray showed pneumonia in your right lower lung and some fluid near the lung. Blood tests showed you had an infection and your blood sugar was high at 325. A kidney test showed 1.3 for creatinine.

Doctors gave you two drugs through your veins to kill the germs in your lungs and these were ceftriaxone 2 grams per day and azithromycin 500 mg per day. You got breathing treatments for your COPD and you needed extra oxygen at first set at 3 to 4 liters per minute through a nose tube. A lung doctor saw you because of your low oxygen and your COPD. Tests of mucus from your lungs found germs called Streptococcus pneumoniae and your drugs could kill these germs. Later you got just one drug and then you switched to pills called levofloxacin on day 5 in the hospital.

Your blood sugar was hard to control at first and doctors changed your insulin doses many times. A diabetes teacher helped you learn how to manage your blood sugar in a better way. By day 4 your blood sugar got much better and stayed more stable. You felt confused at night sometimes and this was likely due to low oxygen and infection but it got better when we treated these problems.

By day 6 you felt much better with no fever and your oxygen was normal at over 94 percent without extra oxygen and you could walk with no trouble breathing. A chest X-ray before you went home showed your pneumonia was much better. You got drugs through your veins for 7 days in the hospital and you will take pills for 5 more days at home.`;

console.log('='.repeat(80));
console.log('ULTRA-OPTIMIZED TESTING');
console.log('Target: FK Grade = 7, FRE > 80');
console.log('='.repeat(80));

console.log('\nAPPROACH 1: Long sentences + Simple words');
console.log('-'.repeat(80));
const result1 = testReadability(EXAMPLE_ULTRA_OPT);

console.log('\n\nAPPROACH 2: Maximum simplification');
console.log('-'.repeat(80));
const result2 = testReadability(EXAMPLE_MAX_SIMPLE);

console.log('\n' + '='.repeat(80));
console.log('KEY INSIGHTS');
console.log('='.repeat(80));
console.log(`
Replace complex medical terms with simpler equivalents:
❌ "antibiotics" (4 syllables) → ✓ "germ-killing drugs" (4 syllables but simpler components)
❌ "intravenously" (5 syllables) → ✓ "through your veins" (4 syllables, simpler words)
❌ "administered" (4 syllables) → ✓ "gave" (1 syllable)
❌ "medication" (4 syllables) → ✓ "drugs" or "pills" (1 syllable)
❌ "saturating" (4 syllables) → ✓ "oxygen was" (3 syllables, simpler)
❌ "ambulating" (4 syllables) → ✓ "walk" (1 syllable)

Sentence structure:
- Use "and" to connect short clauses into longer sentences
- Use "which is" and "which means" to add explanations inline
- Avoid breaking every thought into a new sentence
`);
