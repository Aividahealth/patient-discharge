#!/usr/bin/env tsx

/**
 * Validate the optimized prompt produces target readability scores
 */

import { SimplificationService } from '../simtran/simplification/simplification.service';
import { testReadability, SAMPLE_DISCHARGE_SUMMARY } from './test-prompt';
import * as fs from 'fs';
import * as path from 'path';

async function validateOptimizedPrompt() {
  console.log('='.repeat(80));
  console.log('VALIDATING OPTIMIZED PROMPT');
  console.log('Target: FK Grade ≤ 7.0, Flesch Reading Ease ≥ 80');
  console.log('='.repeat(80));
  console.log('\nTesting with sample discharge summary...\n');

  const service = new SimplificationService();

  try {
    const result = await service.simplify({
      content: SAMPLE_DISCHARGE_SUMMARY,
      fileName: 'discharge-summary.txt',
    });

    console.log('\n' + '='.repeat(80));
    console.log('SIMPLIFIED OUTPUT');
    console.log('='.repeat(80));
    console.log(result.simplifiedContent);

    // Save output
    const outputDir = path.join(__dirname, 'validation-outputs');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputFile = path.join(outputDir, `optimized-output-${timestamp}.md`);
    fs.writeFileSync(outputFile, result.simplifiedContent);

    console.log('\n' + '='.repeat(80));
    console.log('READABILITY ANALYSIS');
    console.log('='.repeat(80));

    const { metrics, targetMet } = testReadability(result.simplifiedContent);

    // Save metrics
    const metricsFile = path.join(outputDir, `metrics-${timestamp}.json`);
    fs.writeFileSync(metricsFile, JSON.stringify(metrics, null, 2));

    console.log('\n' + '='.repeat(80));
    console.log('VALIDATION RESULT');
    console.log('='.repeat(80));

    if (targetMet) {
      console.log('\n✅ SUCCESS! The optimized prompt achieves target readability!');
      console.log('\n✓ Flesch-Kincaid Grade Level:', metrics.readability.fleschKincaidGradeLevel, '(target: ≤7.0)');
      console.log('✓ Flesch Reading Ease:', metrics.readability.fleschReadingEase, '(target: ≥80)');
      console.log('\nKey characteristics:');
      console.log('  - Average sentence length:', metrics.simplification.avgSentenceLength, 'words');
      console.log('  - Average word length:', metrics.simplification.avgWordLength, 'characters');
      console.log('  - Complex words (3+ syllables):', metrics.lexical.complexWordCount);
      console.log('  - Total words:', metrics.lexical.wordCount);
      console.log('  - Total sentences:', metrics.lexical.sentenceCount);
    } else {
      console.log('\n⚠️  Target not fully met. Results:');
      console.log('\nMetrics:');
      console.log('  FK Grade Level:', metrics.readability.fleschKincaidGradeLevel, targetMet ? '✓' : metrics.readability.fleschKincaidGradeLevel <= 7 ? '✓' : '✗');
      console.log('  Flesch Reading Ease:', metrics.readability.fleschReadingEase, targetMet ? '✓' : metrics.readability.fleschReadingEase >= 80 ? '✓' : '✗');
      console.log('  SMOG Index:', metrics.readability.smogIndex);
      console.log('  Avg Sentence Length:', metrics.simplification.avgSentenceLength, 'words');
      console.log('  Complex words:', metrics.lexical.complexWordCount);

      console.log('\nRecommendations:');
      if (metrics.readability.fleschKincaidGradeLevel > 7.0) {
        console.log('  → Further reduce sentence length or simplify vocabulary');
      }
      if (metrics.readability.fleschReadingEase < 80) {
        console.log('  → Use more 1-2 syllable words and shorter sentences');
      }
    }

    console.log(`\nOutput saved to: ${outputFile}`);
    console.log(`Metrics saved to: ${metricsFile}`);

    return metrics;
  } catch (error) {
    console.error('\n❌ Error during validation:', error);
    throw error;
  }
}

// Run validation
validateOptimizedPrompt()
  .then(() => {
    console.log('\n' + '='.repeat(80));
    console.log('Validation complete!');
    console.log('='.repeat(80));
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nValidation failed:', error);
    process.exit(1);
  });
