#!/usr/bin/env tsx

/**
 * Test the optimal balance for FK Grade = 7, FRE > 80
 */

import { testReadability, SAMPLE_DISCHARGE_SUMMARY } from './test-prompt';

// Optimal approach: ~20 word sentences with 1-syllable words
const EXAMPLE_OPTIMAL = `## Overview

**Reasons for Hospital Stay**

You came to the hospital with lung pneumonia that made it hard to breathe and your oxygen level was too low. You also have COPD which is a lung disease that makes breathing hard, type 2 diabetes which affects your blood sugar, and high blood pressure.

**What Happened During Your Stay**

When you came to the ER you had a fever of 101.8 degrees, your heart was beating fast at 112 beats per minute, you were breathing fast at 28 times per minute, and your oxygen was low at 84%. A chest X-ray showed pneumonia in your right lower lung and some fluid near your lung. Blood tests showed signs of infection and your blood sugar was high at 325. Your kidney test showed a creatinine of 1.3.

Doctors gave you antibiotics through your veins to fight the lung infection, which were ceftriaxone 2 grams each day and azithromycin 500 mg each day. You also got breathing treatments to help your COPD. At first you needed extra oxygen at 3 to 4 liters per minute through a nose tube. A lung doctor came to see you because of your low oxygen and your history of COPD. Tests of the mucus from your lungs found bacteria called Streptococcus pneumoniae which your antibiotics could treat. Later the doctors gave you just one antibiotic, then switched you to pills called levofloxacin on hospital day 5.

Your blood sugar was hard to control at first so doctors had to adjust your insulin doses many times. A diabetes teacher came to help you learn how to manage your blood sugar better. By hospital day 4 your blood sugar levels got better and were more stable. You felt confused at night a few times which was likely from the low oxygen and the infection, but this got better once we treated these problems.

By hospital day 6 you felt much better with no fever, your oxygen was normal at more than 94% without any extra oxygen, and you could walk without feeling short of breath. A chest X-ray done before you left showed that your pneumonia was getting better. You took antibiotics through your veins for 7 days while you were in the hospital and you will need to take antibiotic pills for 5 more days at home.`;

// Balanced approach: Mix of sentence lengths, targeting sweet spot
const EXAMPLE_BALANCED = `## Overview

**Reasons for Hospital Stay**

You came to the hospital with pneumonia in your right lung. This made it hard for you to breathe and your oxygen level was too low. You also have COPD which is a lung disease, type 2 diabetes which affects blood sugar, and high blood pressure.

**What Happened During Your Stay**

When you came to the ER you had a fever of 101.8 degrees. Your heart was beating fast at 112 beats per minute. You were breathing fast at 28 times per minute. Your oxygen was low at 84%. A chest X-ray showed pneumonia in your right lower lung. There was also some fluid near your lung. Blood tests showed signs of infection. Your blood sugar was high at 325.

Doctors gave you two antibiotics through your veins to fight the lung infection. These were ceftriaxone 2 grams per day and azithromycin 500 mg per day. You also got breathing treatments to help your COPD. At first you needed extra oxygen at 3 to 4 liters per minute. A lung doctor came to see you because of your low oxygen and your COPD. Tests of mucus from your lungs found bacteria called Streptococcus pneumoniae. Your antibiotics could kill this bacteria. Later doctors gave you just one antibiotic. Then they switched you to pills called levofloxacin on day 5 of your hospital stay.

Your blood sugar was hard to control at first. Doctors had to change your insulin doses many times. A diabetes teacher came to help you. She taught you how to manage your blood sugar better. By day 4 your blood sugar got better. You felt confused at night a few times. This was likely from low oxygen and infection. This got better once we treated these problems.

By day 6 you felt much better. You had no fever. Your oxygen was normal at more than 94% without extra oxygen help. You could walk without feeling short of breath. A chest X-ray before you left showed your pneumonia was getting better. You took antibiotics for 7 days in the hospital. You will take antibiotic pills for 5 more days at home.`;

console.log('Testing optimal approaches for FK Grade = 7, FRE > 80\n');
console.log('='.repeat(80));

console.log('\nEXAMPLE 1: OPTIMAL (Long sentences, simple words)');
console.log('='.repeat(80));
testReadability(EXAMPLE_OPTIMAL);

console.log('\n\nEXAMPLE 2: BALANCED (Mixed sentence lengths)');
console.log('='.repeat(80));
testReadability(EXAMPLE_BALANCED);

console.log('\n' + '='.repeat(80));
console.log('ANALYSIS');
console.log('='.repeat(80));
console.log(`
The mathematical relationship between FK Grade and Flesch Reading Ease:
- FK Grade = 0.39 * (words/sentence) + 11.8 * (syllables/word) - 15.59
- FRE = 206.835 - 1.015 * (words/sentence) - 84.6 * (syllables/word)

To achieve FK Grade = 7 AND FRE > 80:
- Need ~20 words per sentence (long sentences)
- Need ~1.26 syllables per word (very simple words)

This requires:
1. Longer sentences but with coordinating conjunctions (and, but, so)
2. Almost exclusive use of 1-syllable words
3. Minimize 3+ syllable medical terms or always break them into simpler phrases
4. Use simple connectors like "which is" instead of complex constructions
`);
