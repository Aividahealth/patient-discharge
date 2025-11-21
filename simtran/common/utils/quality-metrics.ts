/**
 * Quality Metrics Calculation Service
 *
 * Calculates various quality metrics for text simplification:
 * - Readability metrics (Flesch-Kincaid, SMOG, etc.)
 * - Simplification metrics (compression ratio, etc.)
 * - Lexical metrics
 */

/**
 * Quality metrics for simplified text
 */
export interface QualityMetrics {
  // Readability Metrics
  readability: {
    fleschKincaidGradeLevel: number;
    fleschReadingEase: number;
    smogIndex: number;
    colemanLiauIndex: number;
    automatedReadabilityIndex: number;
  };

  // Simplification Metrics
  simplification: {
    compressionRatio: number; // (original - simplified) / original
    sentenceLengthReduction: number; // average sentence length reduction
    avgSentenceLength: number;
    avgWordLength: number;
  };

  // Lexical Metrics
  lexical: {
    typeTokenRatio: number; // vocabulary diversity
    wordCount: number;
    sentenceCount: number;
    syllableCount: number;
    complexWordCount: number; // words with 3+ syllables
  };

  // Semantic Preservation (placeholder for future BERTScore)
  semantic?: {
    bertScore?: number;
    similarity?: number;
  };

  // Metadata
  metadata: {
    calculatedAt: Date;
    originalWordCount: number;
    simplifiedWordCount: number;
  };
}

/**
 * Calculate syllables in a word using a simple heuristic
 */
function countSyllables(word: string): number {
  word = word.toLowerCase();
  if (word.length <= 3) return 1;

  // Remove non-alphabetic characters
  word = word.replace(/[^a-z]/g, '');

  // Count vowel groups
  const vowelGroups = word.match(/[aeiouy]+/g);
  let syllables = vowelGroups ? vowelGroups.length : 1;

  // Adjust for silent e
  if (word.endsWith('e')) {
    syllables--;
  }

  // Adjust for le ending
  if (word.endsWith('le') && word.length > 2) {
    const thirdFromEnd = word[word.length - 3];
    if (thirdFromEnd && !/[aeiouy]/.test(thirdFromEnd)) {
      syllables++;
    }
  }

  // Ensure at least 1 syllable
  return Math.max(syllables, 1);
}

/**
 * Calculate Flesch Reading Ease Score
 * Formula: 206.835 - 1.015 * (total words / total sentences) - 84.6 * (total syllables / total words)
 * Scale: 0-100 (higher = easier)
 * - 90-100: Very easy (5th grade)
 * - 80-90: Easy (6th grade)
 * - 70-80: Fairly easy (7th grade)
 * - 60-70: Standard (8th-9th grade)
 * - 50-60: Fairly difficult (10th-12th grade)
 */
function calculateFleschReadingEase(words: number, sentences: number, syllables: number): number {
  if (sentences === 0 || words === 0) return 0;

  const avgWordsPerSentence = words / sentences;
  const avgSyllablesPerWord = syllables / words;

  const score = 206.835 - (1.015 * avgWordsPerSentence) - (84.6 * avgSyllablesPerWord);
  return Math.max(0, Math.min(100, score)); // Clamp between 0 and 100
}

/**
 * Calculate Flesch-Kincaid Grade Level
 * Formula: 0.39 * (total words / total sentences) + 11.8 * (total syllables / total words) - 15.59
 * Returns the U.S. grade level (e.g., 8.0 = 8th grade)
 */
function calculateFleschKincaidGradeLevel(words: number, sentences: number, syllables: number): number {
  if (sentences === 0 || words === 0) return 0;

  const avgWordsPerSentence = words / sentences;
  const avgSyllablesPerWord = syllables / words;

  const gradeLevel = (0.39 * avgWordsPerSentence) + (11.8 * avgSyllablesPerWord) - 15.59;
  return Math.max(0, gradeLevel);
}

/**
 * Calculate SMOG Index (Simple Measure of Gobbledygook)
 * Formula: 1.0430 * sqrt(polysyllables * (30 / sentences)) + 3.1291
 * Recommended by NIH for health materials
 * Returns grade level needed to understand the text
 */
function calculateSMOGIndex(sentences: number, polysyllables: number): number {
  if (sentences === 0) return 0;

  // SMOG requires at least 30 sentences, but we'll adapt for shorter texts
  const adjustedPolysyllables = sentences >= 30 ? polysyllables : polysyllables * (30 / sentences);
  const smog = 1.0430 * Math.sqrt(adjustedPolysyllables) + 3.1291;

  return Math.max(0, smog);
}

/**
 * Calculate Coleman-Liau Index
 * Formula: 0.0588 * L - 0.296 * S - 15.8
 * Where L = average number of letters per 100 words
 *       S = average number of sentences per 100 words
 */
function calculateColemanLiauIndex(words: number, sentences: number, letters: number): number {
  if (words === 0) return 0;

  const L = (letters / words) * 100;
  const S = (sentences / words) * 100;

  const cli = 0.0588 * L - 0.296 * S - 15.8;
  return Math.max(0, cli);
}

/**
 * Calculate Automated Readability Index
 * Formula: 4.71 * (characters / words) + 0.5 * (words / sentences) - 21.43
 */
function calculateAutomatedReadabilityIndex(words: number, sentences: number, characters: number): number {
  if (words === 0 || sentences === 0) return 0;

  const charactersPerWord = characters / words;
  const wordsPerSentence = words / sentences;

  const ari = 4.71 * charactersPerWord + 0.5 * wordsPerSentence - 21.43;
  return Math.max(0, ari);
}

/**
 * Calculate Type-Token Ratio (lexical diversity)
 * Ratio of unique words to total words
 */
function calculateTypeTokenRatio(words: string[]): number {
  if (words.length === 0) return 0;

  const uniqueWords = new Set(words.map(w => w.toLowerCase()));
  return uniqueWords.size / words.length;
}

/**
 * Tokenize text into words
 */
function tokenizeWords(text: string): string[] {
  // Remove special characters but keep apostrophes for contractions
  const cleaned = text.replace(/[^\w\s']/g, ' ');
  return cleaned
    .split(/\s+/)
    .filter(word => word.length > 0);
}

/**
 * Tokenize text into sentences
 */
function tokenizeSentences(text: string): string[] {
  // Split on period, exclamation, question mark followed by space or end of string
  return text
    .split(/[.!?]+(?:\s+|$)/)
    .filter(sentence => sentence.trim().length > 0);
}

/**
 * Calculate all quality metrics for a simplified text
 */
export function calculateQualityMetrics(
  originalText: string,
  simplifiedText: string
): QualityMetrics {
  // Tokenize
  const originalWords = tokenizeWords(originalText);
  const simplifiedWords = tokenizeWords(simplifiedText);
  const sentences = tokenizeSentences(simplifiedText);

  // Count syllables and letters
  let totalSyllables = 0;
  let totalLetters = 0;
  let totalCharacters = 0;
  let complexWordCount = 0; // Words with 3+ syllables

  for (const word of simplifiedWords) {
    const syllables = countSyllables(word);
    totalSyllables += syllables;
    totalLetters += word.replace(/[^a-zA-Z]/g, '').length;
    totalCharacters += word.length;

    if (syllables >= 3) {
      complexWordCount++;
    }
  }

  // Calculate metrics
  const wordCount = simplifiedWords.length;
  const sentenceCount = sentences.length || 1; // Avoid division by zero

  // Readability metrics
  const fleschReadingEase = calculateFleschReadingEase(wordCount, sentenceCount, totalSyllables);
  const fleschKincaidGradeLevel = calculateFleschKincaidGradeLevel(wordCount, sentenceCount, totalSyllables);
  const smogIndex = calculateSMOGIndex(sentenceCount, complexWordCount);
  const colemanLiauIndex = calculateColemanLiauIndex(wordCount, sentenceCount, totalLetters);
  const automatedReadabilityIndex = calculateAutomatedReadabilityIndex(wordCount, sentenceCount, totalCharacters);

  // Simplification metrics
  const originalSentences = tokenizeSentences(originalText);
  const originalAvgSentenceLength = originalWords.length / (originalSentences.length || 1);
  const simplifiedAvgSentenceLength = wordCount / sentenceCount;
  const sentenceLengthReduction = ((originalAvgSentenceLength - simplifiedAvgSentenceLength) / originalAvgSentenceLength) * 100;

  const compressionRatio = originalWords.length > 0
    ? ((originalWords.length - wordCount) / originalWords.length) * 100
    : 0;

  const avgWordLength = totalCharacters / wordCount;

  // Lexical metrics
  const typeTokenRatio = calculateTypeTokenRatio(simplifiedWords);

  return {
    readability: {
      fleschKincaidGradeLevel: Math.round(fleschKincaidGradeLevel * 10) / 10,
      fleschReadingEase: Math.round(fleschReadingEase * 10) / 10,
      smogIndex: Math.round(smogIndex * 10) / 10,
      colemanLiauIndex: Math.round(colemanLiauIndex * 10) / 10,
      automatedReadabilityIndex: Math.round(automatedReadabilityIndex * 10) / 10,
    },
    simplification: {
      compressionRatio: Math.round(compressionRatio * 10) / 10,
      sentenceLengthReduction: Math.round(sentenceLengthReduction * 10) / 10,
      avgSentenceLength: Math.round(simplifiedAvgSentenceLength * 10) / 10,
      avgWordLength: Math.round(avgWordLength * 10) / 10,
    },
    lexical: {
      typeTokenRatio: Math.round(typeTokenRatio * 100) / 100,
      wordCount,
      sentenceCount,
      syllableCount: totalSyllables,
      complexWordCount,
    },
    metadata: {
      calculatedAt: new Date(),
      originalWordCount: originalWords.length,
      simplifiedWordCount: wordCount,
    },
  };
}

/**
 * Get a human-readable interpretation of Flesch-Kincaid Grade Level
 */
export function interpretFleschKincaidGrade(grade: number): string {
  if (grade <= 5) return 'Elementary (5th grade or below)';
  if (grade <= 8) return 'Middle School (6th-8th grade)';
  if (grade <= 10) return 'High School (9th-10th grade)';
  if (grade <= 12) return 'High School (11th-12th grade)';
  if (grade <= 16) return 'College level';
  return 'Graduate level';
}

/**
 * Get a human-readable interpretation of Flesch Reading Ease
 */
export function interpretFleschReadingEase(score: number): string {
  if (score >= 90) return 'Very Easy (5th grade)';
  if (score >= 80) return 'Easy (6th grade)';
  if (score >= 70) return 'Fairly Easy (7th grade)';
  if (score >= 60) return 'Standard (8th-9th grade)';
  if (score >= 50) return 'Fairly Difficult (10th-12th grade)';
  if (score >= 30) return 'Difficult (College)';
  return 'Very Difficult (Graduate)';
}

/**
 * Check if metrics meet target simplification goals
 * Target: 5th-9th grade reading level
 */
export function meetsSimplificationTarget(metrics: QualityMetrics): {
  meetsTarget: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];
  let meetsTarget = true;

  // Target: Flesch-Kincaid Grade Level between 5 and 9
  if (metrics.readability.fleschKincaidGradeLevel > 9) {
    meetsTarget = false;
    reasons.push(`Grade level too high (${metrics.readability.fleschKincaidGradeLevel.toFixed(1)} > 9.0)`);
  }

  // Target: Flesch Reading Ease >= 60 (8th-9th grade)
  if (metrics.readability.fleschReadingEase < 60) {
    meetsTarget = false;
    reasons.push(`Reading ease too low (${metrics.readability.fleschReadingEase.toFixed(1)} < 60)`);
  }

  // Target: SMOG Index <= 9
  if (metrics.readability.smogIndex > 9) {
    meetsTarget = false;
    reasons.push(`SMOG index too high (${metrics.readability.smogIndex.toFixed(1)} > 9.0)`);
  }

  // Target: Average sentence length <= 20 words
  if (metrics.simplification.avgSentenceLength > 20) {
    meetsTarget = false;
    reasons.push(`Sentences too long (${metrics.simplification.avgSentenceLength.toFixed(1)} > 20 words)`);
  }

  return { meetsTarget, reasons };
}
