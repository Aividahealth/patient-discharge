#!/usr/bin/env tsx

/**
 * Interactive prompt testing tool
 * Run with: npx tsx prompt-testing/run-tests.ts
 */

import { SimplificationService } from '../simtran/simplification/simplification.service';
import { testReadability, SAMPLE_DISCHARGE_SUMMARY } from './test-prompt';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const service = new SimplificationService();

  console.log('Testing prompt with sample discharge summary...\n');
  console.log('Sample length:', SAMPLE_DISCHARGE_SUMMARY.length, 'characters');

  try {
    const result = await service.simplify({
      content: SAMPLE_DISCHARGE_SUMMARY,
      fileName: 'discharge-summary.txt',
    });

    console.log('\n=== SIMPLIFIED OUTPUT ===\n');
    console.log(result.simplifiedContent);

    // Save output
    const outputDir = path.join(__dirname, 'outputs');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputFile = path.join(outputDir, `simplified-${timestamp}.md`);
    fs.writeFileSync(outputFile, result.simplifiedContent);
    console.log(`\nSaved to: ${outputFile}`);

    // Analyze readability
    const { metrics, targetMet } = testReadability(result.simplifiedContent);

    // Save metrics
    const metricsFile = path.join(outputDir, `metrics-${timestamp}.json`);
    fs.writeFileSync(metricsFile, JSON.stringify(metrics, null, 2));
    console.log(`Metrics saved to: ${metricsFile}`);

    if (targetMet) {
      console.log('\n🎉 SUCCESS! Target readability achieved!');
    } else {
      console.log('\n⚠️  Target not met. Adjustments needed:');

      if (metrics.readability.fleschKincaidGradeLevel > 7.0) {
        const diff = metrics.readability.fleschKincaidGradeLevel - 7.0;
        console.log(`  - Reduce grade level by ${diff.toFixed(1)} grades`);
        console.log('    → Use shorter sentences');
        console.log('    → Replace complex words with simpler alternatives');
      }

      if (metrics.readability.fleschReadingEase < 80) {
        const diff = 80 - metrics.readability.fleschReadingEase;
        console.log(`  - Increase reading ease by ${diff.toFixed(1)} points`);
        console.log('    → Reduce syllables per word');
        console.log('    → Shorten sentences further');
      }

      if (metrics.simplification.avgSentenceLength > 16) {
        console.log(`  - Avg sentence length is ${metrics.simplification.avgSentenceLength.toFixed(1)} (target: 12-16)`);
        console.log('    → Break long sentences into multiple shorter ones');
      }
    }
  } catch (error) {
    console.error('Error during simplification:', error);
    process.exit(1);
  }
}

main();
