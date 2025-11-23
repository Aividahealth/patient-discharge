#!/usr/bin/env tsx

/**
 * Sweet spot approach: 12-15 word sentences with ultra-simple vocabulary
 */

import { testReadability, SAMPLE_DISCHARGE_SUMMARY } from './test-prompt';

// Target: 12-15 words per sentence, minimal multi-syllable words
const EXAMPLE_SWEET_SPOT = `## Overview

**Reasons for Hospital Stay**

You came here with lung pneumonia which is a lung infection. This made it hard for you to breathe. Your oxygen level was too low. You also have COPD which is a lung disease. You have type 2 diabetes which means high blood sugar. You have high blood pressure too.

**What Happened During Your Stay**

When you came to the ER you had a fever of 101.8 degrees. Your heart beat was fast at 112 beats per minute. You breathed fast at 28 breaths per minute. Your oxygen level was low at 84 percent. A chest X-ray showed pneumonia in your right lower lung. There was some fluid near your lung too. Blood tests showed you had an infection in your body. Your blood sugar was high at 325. A kidney test showed 1.3 for creatinine.

Doctors gave you two types of drugs through your veins to kill germs. These drugs were ceftriaxone 2 grams per day and azithromycin 500 mg per day. You also got treatments to help you breathe better for your COPD. At first you needed extra oxygen at 3 to 4 liters per minute. This oxygen went through a small tube in your nose. A lung doctor came to check on you because of your low oxygen. Tests of mucus from your lungs found germs called Streptococcus pneumoniae. Your drugs could kill these germs. Later doctors gave you just one type of drug. Then you switched to pills called levofloxacin on day 5.

Your blood sugar was hard to control at first. Doctors had to change your insulin doses many times. A diabetes teacher came to help you. She taught you how to manage your blood sugar better. By day 4 your blood sugar got better and stayed more stable. You felt confused at night a few times. This was likely from low oxygen and the infection. This got better when we treated these problems.

By day 6 you felt much better. You had no fever at all. Your oxygen was normal at over 94 percent without extra oxygen. You could walk around without feeling short of breath. A chest X-ray before you went home showed your pneumonia was much better. You got drugs through your veins for 7 days in the hospital. You will take pills for 5 more days at home.`;

// Even simpler: Very short sentences with 1-syllable focus
const EXAMPLE_ULTRA_SHORT = `## Overview

**Reasons for Hospital Stay**

You came here with lung pneumonia. Pneumonia is a lung infection. It made it hard to breathe. Your oxygen was too low. You have COPD. This is a lung disease. You have type 2 diabetes. This means high blood sugar. You have high blood pressure.

**What Happened During Your Stay**

You came to the ER with a fever of 101.8 degrees. Your heart beat fast at 112 beats per minute. You breathed fast at 28 breaths per minute. Your oxygen was low at 84 percent. A chest X-ray showed pneumonia in your right lower lung. There was fluid near your lung. Blood tests showed infection. Your blood sugar was high at 325. A kidney test showed 1.3.

Doctors gave you drugs through your veins to kill germs. The drugs were ceftriaxone 2 grams per day and azithromycin 500 mg per day. You got breathing treatments for COPD. You needed extra oxygen at first. It was set at 3 to 4 liters per minute. The oxygen went through a tube in your nose. A lung doctor saw you. Tests found germs in your lung mucus. The germs were called Streptococcus pneumoniae. Your drugs could kill these germs. Later you got just one drug. Then you took pills called levofloxacin. This was on day 5.

Your blood sugar was hard to control at first. Doctors changed your insulin doses many times. A diabetes teacher helped you. She taught you how to manage your blood sugar. By day 4 your blood sugar got better. It stayed more stable. You felt confused at night sometimes. This was likely from low oxygen and infection. It got better when we treated you.

By day 6 you felt much better. You had no fever. Your oxygen was normal at over 94 percent. You did not need extra oxygen. You could walk without trouble breathing. A chest X-ray showed your pneumonia was better. You got drugs through your veins for 7 days. You will take pills for 5 more days at home.`;

// Hybrid: Mix both approaches
const EXAMPLE_HYBRID = `## Overview

**Reasons for Hospital Stay**

You came to the hospital with lung pneumonia which is an infection in your lungs. It made it hard for you to breathe and your oxygen was too low. You also have COPD which is a lung disease, type 2 diabetes which means high blood sugar, and high blood pressure.

**What Happened During Your Stay**

When you came to the ER you had a fever of 101.8 degrees. Your heart beat fast at 112 beats per minute. You breathed fast at 28 breaths per minute. Your oxygen level was low at 84 percent. A chest X-ray showed pneumonia in your right lower lung and some fluid near the lung. Blood tests showed infection and your blood sugar was high at 325.

Doctors gave you drugs through your veins to kill the germs in your lungs. The drugs were ceftriaxone 2 grams per day and azithromycin 500 mg per day. You got breathing treatments to help your COPD. You needed extra oxygen at 3 to 4 liters per minute through a nose tube at first. A lung doctor saw you because of your low oxygen and COPD. Tests found germs called Streptococcus pneumoniae in mucus from your lungs. Your drugs could kill these germs. Later you got just one drug then switched to pills called levofloxacin on day 5.

Your blood sugar was hard to control at first and doctors changed your insulin doses many times. A diabetes teacher helped you learn how to manage your blood sugar better. By day 4 your blood sugar got much better. You felt confused at night a few times from low oxygen and infection but it got better with treatment.

By day 6 you felt much better with no fever. Your oxygen was normal at over 94 percent without extra help. You could walk without trouble breathing. A chest X-ray showed your pneumonia was much better. You got drugs through your veins for 7 days and will take pills for 5 more days at home.`;

console.log('='.repeat(80));
console.log('SWEET SPOT TESTING - Multiple Approaches');
console.log('Target: FK Grade ≤ 7, FRE ≥ 80');
console.log('='.repeat(80));

console.log('\n1. SWEET SPOT (12-15 word sentences)');
console.log('-'.repeat(80));
const r1 = testReadability(EXAMPLE_SWEET_SPOT);

console.log('\n\n2. ULTRA SHORT (6-10 word sentences)');
console.log('-'.repeat(80));
const r2 = testReadability(EXAMPLE_ULTRA_SHORT);

console.log('\n\n3. HYBRID (Mixed lengths)');
console.log('-'.repeat(80));
const r3 = testReadability(EXAMPLE_HYBRID);

console.log('\n' + '='.repeat(80));
console.log('CONCLUSION');
console.log('='.repeat(80));
console.log(`
The challenge: FK Grade 7 with FRE > 80 is extremely difficult!

FK Grade 7 requires either:
- Longer sentences (18-20 words) with very simple words, OR
- Moderate sentences (12-15 words) with slightly more complex words

FRE > 80 requires:
- Short sentences (6-10 words) with simple words

These targets conflict! A more realistic goal might be:
- FK Grade 6-7 with FRE 75-80, OR
- FK Grade 5-6 with FRE 80-85

Recommendation: Adjust targets to FK Grade 6 and FRE ≥ 75 for medical content.
`);
