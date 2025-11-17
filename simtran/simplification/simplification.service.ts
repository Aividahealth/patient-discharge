import { VertexAI } from '@google-cloud/vertexai';
import {
  SimplificationRequest,
  SimplificationResponse,
  VertexAIError,
  GenerationConfig,
} from './common/types';
import { getConfig } from './common/utils/config';
import { createLogger } from './common/utils/logger';
import { SIMPLIFICATION_SYSTEM_PROMPT, createSimplificationPrompt } from './common/utils/prompts';

const logger = createLogger('SimplificationService');

/**
 * Service for simplifying medical content using Vertex AI Gemini
 */
export class SimplificationService {
  private vertexAI: VertexAI;
  private config = getConfig();
  private generationConfig: GenerationConfig;

  constructor() {
    this.vertexAI = new VertexAI({
      project: this.config.projectId,
      location: this.config.location,
    });

    this.generationConfig = {
      maxOutputTokens: this.config.maxOutputTokens,
      temperature: this.config.temperature,
      topP: this.config.topP,
      topK: this.config.topK,
    };

    logger.info('Simplification Service initialized', {
      projectId: this.config.projectId,
      location: this.config.location,
      modelName: this.config.modelName,
    });
  }

  /**
   * Simplify medical discharge summary using Gemini
   */
  async simplify(request: SimplificationRequest): Promise<SimplificationResponse> {
    const startTime = Date.now();

    logger.info('Starting simplification', {
      fileName: request.fileName,
      contentLength: request.content.length,
    });

    try {
      const result = await this.callGeminiWithRetry(request);
      const processingTime = Date.now() - startTime;

      logger.info('Simplification completed successfully', {
        fileName: request.fileName,
        originalLength: request.content.length,
        simplifiedLength: result.simplifiedContent.length,
        processingTimeMs: processingTime,
        tokensUsed: result.tokensUsed,
      });

      return result;
    } catch (error) {
      const processingTime = Date.now() - startTime;
      logger.error('Simplification failed', error as Error, {
        fileName: request.fileName,
        processingTimeMs: processingTime,
      });

      throw error;
    }
  }

  /**
   * Call Gemini API with retry logic
   */
  private async callGeminiWithRetry(
    request: SimplificationRequest,
    attemptNumber: number = 1
  ): Promise<SimplificationResponse> {
    try {
      logger.debug(`Gemini API call attempt ${attemptNumber}`, {
        fileName: request.fileName,
        maxRetries: this.config.maxRetries,
      });

      const response = await this.callGemini(request);
      return response;
    } catch (error) {
      const isRetryable = this.isRetryableError(error);
      const shouldRetry = isRetryable && attemptNumber < this.config.maxRetries;

      if (shouldRetry) {
        const delay = this.config.retryDelayMs * attemptNumber; // Exponential backoff
        logger.warning(`Retrying Gemini API call after ${delay}ms`, {
          fileName: request.fileName,
          attemptNumber,
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        await this.sleep(delay);
        return this.callGeminiWithRetry(request, attemptNumber + 1);
      }

      // No more retries or non-retryable error
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new VertexAIError(`Gemini API call failed after ${attemptNumber} attempts: ${errorMessage}`, false);
    }
  }

  /**
   * Call Gemini API
   */
  private async callGemini(request: SimplificationRequest): Promise<SimplificationResponse> {
    try {
      const model = this.vertexAI.getGenerativeModel({
        model: this.config.modelName,
        generationConfig: this.generationConfig,
        systemInstruction: {
          role: 'system',
          parts: [{ text: SIMPLIFICATION_SYSTEM_PROMPT }],
        },
      });

      const userPrompt = createSimplificationPrompt(request.content, request.fileName);

      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      });

      const response = result.response;

      if (!response.candidates || response.candidates.length === 0) {
        throw new VertexAIError('No candidates returned from Gemini API', false);
      }

      const candidate = response.candidates[0];

      // Check for safety blocks
      if (candidate.finishReason === 'SAFETY') {
        logger.warning('Content blocked by safety filters', {
          fileName: request.fileName,
          safetyRatings: candidate.safetyRatings,
        });
        throw new VertexAIError('Content was blocked by safety filters', false);
      }

      // Check for other finish reasons
      if (candidate.finishReason !== 'STOP' && candidate.finishReason !== 'MAX_TOKENS') {
        throw new VertexAIError(`Unexpected finish reason: ${candidate.finishReason}`, false);
      }

      const rawContent = candidate.content.parts.map((part: any) => part.text).join('');

      if (!rawContent || rawContent.trim().length === 0) {
        throw new VertexAIError('Empty response from Gemini API', false);
      }

      // Normalize output: enforce one occurrence per section and prevent cross-section repeats
      const simplifiedContent = this.normalizeSimplifiedMarkdown(rawContent.trim());

      // Extract token usage if available
      const tokensUsed = response.usageMetadata?.totalTokenCount;

      return {
        simplifiedContent,
        tokensUsed,
      };
    } catch (error) {
      if (error instanceof VertexAIError) {
        throw error;
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new VertexAIError(`Gemini API error: ${errorMessage}`, this.isRetryableError(error));
    }
  }

  /**
   * Normalize simplified markdown:
   * - Keep only the first occurrence of each required section
   * - Trim content in each section to exclude content belonging to other sections
   * - Ensure sections are in the canonical order
   */
  private normalizeSimplifiedMarkdown(text: string): string {
    const sectionOrder = [
      'Overview',
      'Your Medications',
      'Upcoming Appointments',
      'Diet & Activity',
      'Warning Signs',
    ];

    // Build regex to split on H2 headings "## <Section>"
    const headingRegex = /^##\s+(Overview|Your Medications|Upcoming Appointments|Diet\s*&\s*Activity|Diet\s*&?\s*Activity|Warning Signs)\s*$/im;
    const lines = text.split('\n');

    // Find indices of headings
    const sectionsFound: Array<{ name: string; start: number; end: number }> = [];
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(headingRegex);
      if (m) {
        const name = m[1]
          .replace(/Diet\s*&\s*Activity|Diet\s*&?\s*Activity/i, 'Diet & Activity');
        sectionsFound.push({ name, start: i, end: lines.length });
      }
    }

    // Determine section ranges
    for (let i = 0; i < sectionsFound.length - 1; i++) {
      sectionsFound[i].end = sectionsFound[i + 1].start;
    }

    // Keep only the first occurrence of each section
    const firstOccurrence: Record<string, { start: number; end: number } | undefined> = {};
    for (const s of sectionsFound) {
      if (!firstOccurrence[s.name]) {
        firstOccurrence[s.name] = { start: s.start, end: s.end };
      }
    }

    // Helper to extract clean content for a section and strip any stray subheadings for other sections
    const stripCrossSectionContent = (contentLines: string[]): string[] => {
      const otherHeading = /^##\s+/i;
      const allowedSub = /^###\s+|^####\s+/i;
      const result: string[] = [];
      for (const line of contentLines) {
        // Stop if another H2 heading (should not happen inside extracted range, but safe)
        if (otherHeading.test(line)) break;
        result.push(line);
      }
      // Trim trailing empty lines
      while (result.length > 0 && result[result.length - 1].trim() === '') {
        result.pop();
      }
      return result;
    };

    // Reassemble in canonical order
    const out: string[] = [];
    for (const name of sectionOrder) {
      const occ = firstOccurrence[name];
      if (!occ) continue; // Allow missing sections
      const header = `## ${name}`;
      const bodyLines = lines.slice(occ.start + 1, occ.end);
      const cleaned = stripCrossSectionContent(bodyLines);
      out.push(header, ...cleaned, ''); // add blank line after each
    }

    const normalized = out.join('\n').trim();
    return normalized.length > 0 ? normalized : text;
  }

  /**
   * Determine if an error is retryable
   */
  private isRetryableError(error: unknown): boolean {
    if (error instanceof VertexAIError) {
      return error.retryable;
    }

    if (error instanceof Error) {
      const message = error.message.toLowerCase();

      // Retryable error patterns
      const retryablePatterns = [
        'timeout',
        'econnreset',
        'econnrefused',
        'etimedout',
        'rate limit',
        'quota exceeded',
        'service unavailable',
        'internal error',
        '429',
        '500',
        '503',
        '504',
      ];

      return retryablePatterns.some((pattern) => message.includes(pattern));
    }

    return false;
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Validate that content looks like a medical document
   */
  validateMedicalContent(content: string): boolean {
    // Simple heuristic validation
    const medicalKeywords = [
      'patient',
      'discharge',
      'diagnosis',
      'medication',
      'treatment',
      'hospital',
      'doctor',
      'admission',
      'follow-up',
      'prescription',
    ];

    const contentLower = content.toLowerCase();
    const keywordCount = medicalKeywords.filter((keyword) => contentLower.includes(keyword)).length;

    // Require at least 3 medical keywords
    const isValid = keywordCount >= 3;

    logger.debug('Medical content validation', {
      keywordCount,
      isValid,
      contentLength: content.length,
    });

    return isValid;
  }
}
