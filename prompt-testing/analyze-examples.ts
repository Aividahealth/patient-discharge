#!/usr/bin/env tsx

/**
 * Analyze different simplification approaches to find optimal strategy
 * Run with: npx tsx prompt-testing/analyze-examples.ts
 */

import { testReadability, SAMPLE_DISCHARGE_SUMMARY } from './test-prompt';

// Example 1: Current approach (Grade ~9, Reading Ease ~65)
const EXAMPLE_CURRENT = `## Overview

**Reasons for Hospital Stay**

You came to the hospital because of pneumonia in your right lung (community-acquired pneumonia). You also had trouble breathing and low oxygen levels (acute hypoxemic respiratory failure). You have other health conditions including COPD (chronic obstructive pulmonary disease), type 2 diabetes, and high blood pressure.

**What Happened During Your Stay**

When you arrived at the emergency room, you had a fever of 101.8°F, fast heart rate (112 beats per minute), fast breathing (28 breaths per minute), and low oxygen (84%). The chest X-ray showed pneumonia with fluid in your right lower lung. Your blood tests showed signs of infection and high blood sugar (325 mg/dL).

You were given antibiotics through an IV (ceftriaxone 2 grams daily and azithromycin 500 mg daily) and breathing treatments for your COPD. You needed oxygen support at first (3-4 liters). The lung doctor was consulted because of your low oxygen and COPD history. Tests of your mucus showed Streptococcus pneumoniae bacteria, which your antibiotics could treat. Later, you switched to just one antibiotic, then to pills (levofloxacin).

Your blood sugar was hard to control at first, requiring insulin adjustments. A diabetes educator helped. By day 4, your blood sugar improved. You had some confusion at night (likely from low oxygen and infection), which got better with treatment.

By day 6, you had no fever, oxygen levels were normal (>94% on room air), and you could walk without trouble breathing. A chest X-ray before discharge showed your pneumonia was improving. You finished 7 days of antibiotics in the hospital and will take 5 more days of pills at home.`;

// Example 2: Simpler version (targeting Grade 7, Reading Ease 80+)
const EXAMPLE_SIMPLIFIED = `## Overview

**Reasons for Hospital Stay**

You came to the hospital with lung pneumonia. You had trouble breathing. Your oxygen was low. You also have COPD, diabetes, and high blood pressure.

**What Happened During Your Stay**

You arrived at the ER with a fever of 101.8°F. Your heart was beating fast at 112. You were breathing fast at 28 times per minute. Your oxygen was at 84%. A chest X-ray showed pneumonia in your right lung. There was also fluid near your lung. Blood tests showed infection. Your blood sugar was high at 325.

Doctors gave you antibiotics through your veins. You got breathing treatments for COPD. You needed oxygen at first. A lung doctor checked you. Tests found bacteria in your lungs called Streptococcus pneumoniae. Your antibiotics worked on this bacteria. Later you switched to antibiotic pills.

Your blood sugar was hard to control. You needed insulin changes. A diabetes teacher helped you. By day 4 your blood sugar got better. You had some confusion at night. This was from low oxygen and infection. It got better with treatment.

By day 6 you felt better. You had no fever. Your oxygen was normal at 94% without help. You could walk without trouble breathing. A chest X-ray showed your pneumonia was better. You took antibiotics for 7 days in the hospital. You will take pills for 5 more days at home.`;

// Example 3: Very simple version (targeting Grade 6-7, Reading Ease 85+)
const EXAMPLE_VERY_SIMPLE = `## Overview

**Reasons for Hospital Stay**

You came here with lung pneumonia. You had trouble breathing. Your oxygen was low.

**What Happened During Your Stay**

You had a fever of 101.8°F. Your heart beat fast. You breathed fast. Your oxygen was low at 84%. An X-ray showed pneumonia in your right lung. There was fluid by your lung. Blood tests showed you had an infection. Your blood sugar was high at 325.

Doctors gave you medicine through your veins. This medicine fights infections. You got breathing treatments. You needed oxygen help at first. A lung doctor saw you. Tests found germs in your lungs. The germs were Streptococcus pneumoniae. Your medicine worked on these germs. Later you switched to pills.

Your blood sugar was hard to control. You needed insulin. A diabetes teacher helped. Your blood sugar got better by day 4. You felt confused at night. This was from low oxygen and infection. You got better with treatment.

By day 6 you felt much better. You had no fever. Your oxygen was normal at 94%. You did not need oxygen help. You could walk fine. An X-ray showed your pneumonia was better. You took medicine for 7 days here. You will take pills for 5 more days at home.`;

// Example 4: Ultra simple (targeting Grade 5-6, Reading Ease 90+)
const EXAMPLE_ULTRA_SIMPLE = `## Overview

**Reasons for Hospital Stay**

You came here with lung pneumonia. You had trouble breathing. Your oxygen was too low.

**What Happened During Your Stay**

You had a fever. It was 101.8°F. Your heart beat fast. You breathed fast. Your oxygen was low. It was at 84%. An X-ray showed pneumonia. It was in your right lung. There was fluid by your lung. Blood tests showed infection. Your blood sugar was high. It was 325.

Doctors gave you medicine. It went through your veins. This medicine fights germs. You got breathing treatments. You needed oxygen at first. A lung doctor saw you. Tests found germs in your lungs. The germs were called Streptococcus pneumoniae. Your medicine worked on these germs. Later you took pills instead.

Your blood sugar was hard to control. You needed insulin shots. A diabetes teacher helped. Your blood sugar got better by day 4. You felt confused at night. This was from low oxygen. It was also from infection. You got better with treatment.

By day 6 you felt much better. You had no fever. Your oxygen was normal. It was 94%. You did not need oxygen help. You could walk fine. An X-ray showed your pneumonia was better. You took medicine for 7 days here. You will take pills for 5 more days at home.`;

function analyzeAll() {
  console.log('='.repeat(80));
  console.log('ANALYZING DIFFERENT SIMPLIFICATION LEVELS');
  console.log('Target: FK Grade Level ≤ 7.0, Flesch Reading Ease ≥ 80');
  console.log('='.repeat(80));

  const examples = [
    { name: 'Current Approach', text: EXAMPLE_CURRENT },
    { name: 'Simplified', text: EXAMPLE_SIMPLIFIED },
    { name: 'Very Simple', text: EXAMPLE_VERY_SIMPLE },
    { name: 'Ultra Simple', text: EXAMPLE_ULTRA_SIMPLE },
  ];

  const results: any[] = [];

  for (const example of examples) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`EXAMPLE: ${example.name}`);
    console.log('='.repeat(80));

    const { metrics, targetMet } = testReadability(example.text);

    results.push({
      name: example.name,
      fkgl: metrics.readability.fleschKincaidGradeLevel,
      fre: metrics.readability.fleschReadingEase,
      avgSentLen: metrics.simplification.avgSentenceLength,
      avgWordLen: metrics.simplification.avgWordLength,
      complexWords: metrics.lexical.complexWordCount,
      targetMet,
    });
  }

  // Summary table
  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY COMPARISON');
  console.log('='.repeat(80));
  console.log(
    '\nExample'.padEnd(20),
    'FK Grade'.padEnd(12),
    'Flesch Ease'.padEnd(13),
    'Avg Sent'.padEnd(12),
    'Avg Word'.padEnd(12),
    'Complex'.padEnd(10),
    'Target?'
  );
  console.log('-'.repeat(95));

  for (const r of results) {
    const fkglStr = r.fkgl.toFixed(1) + (r.fkgl <= 7.0 ? ' ✓' : ' ✗');
    const freStr = r.fre.toFixed(1) + (r.fre >= 80 ? ' ✓' : ' ✗');
    const sentStr = r.avgSentLen.toFixed(1) + (r.avgSentLen <= 16 ? ' ✓' : ' ✗');

    console.log(
      r.name.padEnd(20),
      fkglStr.padEnd(12),
      freStr.padEnd(13),
      sentStr.padEnd(12),
      r.avgWordLen.toFixed(1).padEnd(12),
      r.complexWords.toString().padEnd(10),
      r.targetMet ? '✓ YES' : '✗ NO'
    );
  }

  // Recommendations
  console.log('\n' + '='.repeat(80));
  console.log('RECOMMENDATIONS');
  console.log('='.repeat(80));

  const bestExample = results.find((r) => r.targetMet);
  if (bestExample) {
    console.log(`\n✓ The "${bestExample.name}" approach meets targets!`);
    console.log('\nKey characteristics:');
    console.log(`  - Average sentence length: ${bestExample.avgSentLen.toFixed(1)} words`);
    console.log(`  - Average word length: ${bestExample.avgWordLen.toFixed(1)} characters`);
    console.log(`  - Complex words: ${bestExample.complexWords}`);
  } else {
    console.log('\n⚠️  None of the examples fully meet targets.');
    console.log('\nClosest approach:');
    const closest = results.reduce((prev, curr) => {
      const prevDiff = Math.abs(prev.fkgl - 7) + Math.abs(prev.fre - 80);
      const currDiff = Math.abs(curr.fkgl - 7) + Math.abs(curr.fre - 80);
      return currDiff < prevDiff ? curr : prev;
    });
    console.log(`  "${closest.name}"`);
    console.log(`  FK Grade: ${closest.fkgl.toFixed(1)} (target: ≤7.0)`);
    console.log(`  Flesch Ease: ${closest.fre.toFixed(1)} (target: ≥80)`);
  }
}

analyzeAll();
