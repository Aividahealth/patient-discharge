import { v2 } from '@google-cloud/translate';
import { TranslationError, TranslationRequest, TranslationResponse } from './common/types';
import { getConfig } from './common/utils/config';
import { createLogger } from './common/utils/logger';

const logger = createLogger('TranslationService');

/**
 * Service for translating medical content using Google Translate
 */
export class TranslationService {
  private translateClient: v2.Translate;
  private config = getConfig();

  constructor() {
    this.translateClient = new v2.Translate({
      projectId: this.config.projectId,
    });
    logger.info('Translation Service initialized', { projectId: this.config.projectId });
  }

  /**
   * Translate simplified discharge summary to target language
   */
  async translateContent(request: TranslationRequest): Promise<TranslationResponse> {
    const startTime = Date.now();

    logger.info('Starting translation', {
      fileName: request.fileName,
      targetLanguage: request.targetLanguage,
      contentLength: request.content.length,
    });

    try {
      const result = await this.callTranslateWithRetry(request);
      const processingTime = Date.now() - startTime;

      // Calculate word count for quality metrics
      const translatedWordCount = result.translatedContent
        .split(/\s+/)
        .filter(word => word.length > 0).length;

      logger.info('Translation completed successfully', {
        fileName: request.fileName,
        targetLanguage: request.targetLanguage,
        originalLength: request.content.length,
        translatedLength: result.translatedContent.length,
        translatedWordCount,
        processingTimeMs: processingTime,
      });

      // Add quality metrics to the response
      return {
        ...result,
        qualityMetrics: {
          translatedWordCount,
          processingTimeMs: processingTime,
          detectedSourceLanguage: result.sourceLanguage,
        },
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      logger.error('Translation failed', error as Error, {
        fileName: request.fileName,
        targetLanguage: request.targetLanguage,
        processingTimeMs: processingTime,
      });

      throw error;
    }
  }

  /**
   * Call Google Translate API with retry logic
   */
  private async callTranslateWithRetry(
    request: TranslationRequest,
    attemptNumber: number = 1
  ): Promise<TranslationResponse> {
    try {
      logger.debug(`Translate API call attempt ${attemptNumber}`, {
        fileName: request.fileName,
        targetLanguage: request.targetLanguage,
        maxRetries: this.config.maxRetries,
      });

      const response = await this.callTranslate(request);
      return response;
    } catch (error) {
      const isRetryable = this.isRetryableError(error);
      const shouldRetry = isRetryable && attemptNumber < this.config.maxRetries;

      if (shouldRetry) {
        const delay = this.config.retryDelayMs * attemptNumber; // Exponential backoff
        logger.warning(`Retrying Translate API call after ${delay}ms`, {
          fileName: request.fileName,
          targetLanguage: request.targetLanguage,
          attemptNumber,
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        await this.sleep(delay);
        return this.callTranslateWithRetry(request, attemptNumber + 1);
      }

      // No more retries or non-retryable error
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new TranslationError(`Translate API call failed after ${attemptNumber} attempts: ${errorMessage}`, false);
    }
  }

  /**
   * Call Google Translate API
   */
  private async callTranslate(request: TranslationRequest): Promise<TranslationResponse> {
    try {
      const [translation] = await this.translateClient.translate(request.content, {
        from: 'en', // Source language (English)
        to: request.targetLanguage,
        format: 'text',
      });

      if (!translation || translation.trim().length === 0) {
        throw new TranslationError('Empty translation response from Google Translate', false);
      }

      // Post-process translation to ensure section headers are correctly translated
      const processedTranslation = this.postProcessTranslation(translation.trim(), request.targetLanguage);

      return {
        translatedContent: processedTranslation,
        sourceLanguage: 'en',
        targetLanguage: request.targetLanguage,
      };
    } catch (error) {
      if (error instanceof TranslationError) {
        throw error;
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new TranslationError(`Google Translate API error: ${errorMessage}`, this.isRetryableError(error));
    }
  }

  /**
   * Post-process translation to ensure section headers match expected patterns
   * This ensures consistent header translation for proper parsing and preserves formatting
   */
  private postProcessTranslation(translatedContent: string, targetLanguage: string): string {
    // Define expected header translations for each language
    // These match the headers expected by the frontend parsers
    const headerMappings: Record<string, Array<{ patterns: string[]; replacement: string }>> = {
      fr: [
        {
          patterns: [
            '## vos médicaments',
            '## médicaments',
            '## vos medicaments',
            '## vos médicament',
            '## votre médicament',
            '## vos médicaments:',
            '## médicaments:',
          ],
          replacement: '## Vos Médicaments',
        },
        {
          patterns: [
            '## rendez-vous à venir',
            '## rendez-vous',
            '## rendez vous à venir',
            '## rendez-vous à venir:',
            '## rendez-vous:',
            '## prochains rendez-vous',
          ],
          replacement: '## Rendez-vous à Venir',
        },
        {
          patterns: [
            '## régime et activité',
            '## régime et activités',
            '## alimentation et activité',
            '## régime et activité:',
            '## alimentation et activités',
          ],
          replacement: '## Régime et Activité',
        },
        {
          patterns: [
            '## signes d\'alerte',
            '## signes d\'alerte:',
            '## symptômes d\'alerte',
            '## signes d\'alarme',
            '## signes d\'avertissement',
          ],
          replacement: '## Signes d\'Alerte',
        },
        {
          patterns: [
            '## aperçu',
            '## résumé',
            '## vue d\'ensemble',
            '## aperçu:',
            '## résumé:',
          ],
          replacement: '## Aperçu',
        },
      ],
      es: [
        {
          patterns: [
            '## sus medicamentos',
            '## medicamentos',
            '## sus medicamento',
            '## su medicamento',
            '## sus medicamentos:',
            '## medicamentos:',
          ],
          replacement: '## Sus Medicamentos',
        },
        {
          patterns: [
            '## próximas citas',
            '## citas',
            '## próximas citas:',
            '## citas:',
            '## citas próximas',
            '## citas de seguimiento',
          ],
          replacement: '## Próximas Citas',
        },
        {
          patterns: [
            '## dieta y actividad',
            '## dieta y actividades',
            '## alimentación y actividad',
            '## dieta y actividad:',
            '## alimentación y actividades',
          ],
          replacement: '## Dieta y Actividad',
        },
        {
          patterns: [
            '## señales de advertencia',
            '## señales de advertencia:',
            '## síntomas de advertencia',
            '## señales de alarma',
            '## signos de advertencia',
          ],
          replacement: '## Señales de Advertencia',
        },
        {
          patterns: [
            '## resumen',
            '## resumen:',
            '## vista general',
            '## visión general',
            '## resumen de alta',
            '## resumen del alta',
            '## resumen del alta:',
          ],
          replacement: '## Resumen',
        },
      ],
      ps: [
        {
          patterns: [
            '## ستاسو درمل',
            '## درمل',
            '## ستاسو درمل:',
            '## درمل:',
          ],
          replacement: '## ستاسو درمل',
        },
        {
          patterns: [
            '## راتلونکي ناستې',
            '## ناستې',
            '## راتلونکي ناستې:',
            '## ناستې:',
          ],
          replacement: '## راتلونکي ناستې',
        },
        {
          patterns: [
            '## خوراک او فعالیت',
            '## خوراک او فعالیتونه',
            '## خوراک او فعالیت:',
          ],
          replacement: '## خوراک او فعالیت',
        },
        {
          patterns: [
            '## د خطر نښې',
            '## د خطر نښې:',
            '## د خطر نښانې',
          ],
          replacement: '## د خطر نښې',
        },
        {
          patterns: [
            '## لنډیز',
            '## لنډیز:',
            '## کتنه',
          ],
          replacement: '## لنډیز',
        },
      ],
    };

    const mappings = headerMappings[targetLanguage];
    if (!mappings) {
      // No post-processing needed for unsupported languages
      return translatedContent;
    }

    let processed = translatedContent;
    const lines = processed.split('\n');

    // Process each line to normalize headers while preserving formatting
    const processedLines = lines.map((line) => {
      const trimmedLine = line.trim();
      
      // Check if this line is a section header (starts with ##)
      if (trimmedLine.startsWith('##')) {
        // For RTL languages (like Pashto), don't convert to lowercase
        // For LTR languages, convert to lowercase for matching
        const isRTL = targetLanguage === 'ps' || targetLanguage === 'ar' || targetLanguage === 'he' || targetLanguage === 'ur';
        const lineForMatching = isRTL ? trimmedLine : trimmedLine.toLowerCase();
        
        // Check against all mappings
        for (const mapping of mappings) {
          for (const pattern of mapping.patterns) {
            // For RTL languages, match exactly (case-sensitive)
            // For LTR languages, match case-insensitively
            const patternForMatching = isRTL ? pattern : pattern.toLowerCase();
            const matchPattern = isRTL ? pattern : pattern.toLowerCase();
            
            // Match exact pattern or pattern with colon
            if (lineForMatching === matchPattern || lineForMatching === matchPattern + ':') {
              // Preserve original indentation if any
              const leadingWhitespace = line.match(/^(\s*)/)?.[1] || '';
              return leadingWhitespace + mapping.replacement;
            }
          }
        }
      }
      
      // Preserve all other lines as-is (including markdown formatting, bold headers, tables, etc.)
      return line;
    });

    return processedLines.join('\n');
  }

  /**
   * Determine if an error is retryable
   */
  private isRetryableError(error: unknown): boolean {
    if (error instanceof TranslationError) {
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
   * Validate that content looks like a simplified discharge summary
   */
  validateSimplifiedContent(content: string): boolean {
    // Check for simplified discharge summary structure
    const simplifiedKeywords = [
      'overview',
      'medications',
      'appointments',
      'diet',
      'activity',
      'warning signs',
      'reasons for hospital stay',
      'what happened during your stay',
    ];

    const contentLower = content.toLowerCase();
    const keywordCount = simplifiedKeywords.filter((keyword) => contentLower.includes(keyword)).length;

    // Require at least 2 simplified keywords
    const isValid = keywordCount >= 2;

    logger.debug('Simplified content validation', {
      keywordCount,
      isValid,
      contentLength: content.length,
    });

    return isValid;
  }

  /**
   * Get supported languages
   */
  async getSupportedLanguages(): Promise<string[]> {
    try {
      const [languages] = await this.translateClient.getLanguages();
      return languages.map((lang: any) => lang.code);
    } catch (error) {
      logger.error('Failed to get supported languages', error as Error);
      // Return common languages as fallback
      return ['es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh', 'ar', 'hi'];
    }
  }

  /**
   * Detect language of content
   */
  async detectLanguage(content: string): Promise<string> {
    try {
      const [detection] = await this.translateClient.detect(content);
      return detection.language;
    } catch (error) {
      logger.error('Failed to detect language', error as Error);
      return 'en'; // Default to English
    }
  }
}
