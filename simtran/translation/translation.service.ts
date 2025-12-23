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
        // English headers that slipped through translation
        {
          patterns: [
            '## reasons for hospital stay',
            '## reason for hospital stay',
          ],
          replacement: '## Raisons de l\'Hospitalisation',
        },
        {
          patterns: [
            '## what happened during your stay',
            '## what happened during your hospital stay',
          ],
          replacement: '## Ce qui s\'est Passé Pendant Votre Séjour',
        },
        {
          patterns: [
            '## your medications',
            '## medications',
          ],
          replacement: '## Vos Médicaments',
        },
        {
          patterns: [
            '## upcoming appointments',
            '## your appointments',
            '## appointments',
          ],
          replacement: '## Vos Rendez-vous',
        },
        {
          patterns: [
            '## diet & activity',
            '## diet and activity',
          ],
          replacement: '## Régime et Activité',
        },
        {
          patterns: [
            '## warning signs',
          ],
          replacement: '## Signes d\'Alerte',
        },
        {
          patterns: [
            '## emergency contacts',
          ],
          replacement: '## Contacts d\'Urgence',
        },
        // French variants
        {
          patterns: [
            '## raisons de l\'hospitalisation',
            '## raisons de l\'hospitalisation:',
            '## raison de l\'hospitalisation',
            '## raisons du séjour à l\'hôpital',
            '## raisons du séjour',
            '## motif d\'hospitalisation',
            '## motifs d\'hospitalisation',
          ],
          replacement: '## Raisons de l\'Hospitalisation',
        },
        {
          patterns: [
            '## ce qui s\'est passé pendant votre séjour',
            '## ce qui s\'est passé pendant votre séjour:',
            '## ce qui s\'est passé durant votre séjour',
            '## déroulement de votre séjour',
            '## que s\'est-il passé pendant votre séjour',
            '## ce qui s\'est passé',
          ],
          replacement: '## Ce qui s\'est Passé Pendant Votre Séjour',
        },
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
            '## vos rendez-vous',
          ],
          replacement: '## Vos Rendez-vous',
        },
        {
          patterns: [
            '## régime et activité',
            '## régime et activités',
            '## alimentation et activité',
            '## régime et activité:',
            '## alimentation et activités',
            '## régime alimentaire et activité',
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
            '## signaux d\'alarme',
          ],
          replacement: '## Signes d\'Alerte',
        },
        {
          patterns: [
            '## contacts d\'urgence',
            '## contacts d\'urgence:',
            '## coordonnées d\'urgence',
            '## numéros d\'urgence',
          ],
          replacement: '## Contacts d\'Urgence',
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
        // English headers that slipped through translation
        {
          patterns: [
            '## reasons for hospital stay',
            '## reason for hospital stay',
          ],
          replacement: '## Razones de la Hospitalización',
        },
        {
          patterns: [
            '## what happened during your stay',
            '## what happened during your hospital stay',
          ],
          replacement: '## Qué Sucedió Durante su Estancia',
        },
        {
          patterns: [
            '## your medications',
            '## medications',
          ],
          replacement: '## Sus Medicamentos',
        },
        {
          patterns: [
            '## upcoming appointments',
            '## your appointments',
            '## appointments',
          ],
          replacement: '## Sus Citas',
        },
        {
          patterns: [
            '## diet & activity',
            '## diet and activity',
          ],
          replacement: '## Dieta y Actividad',
        },
        {
          patterns: [
            '## warning signs',
          ],
          replacement: '## Señales de Advertencia',
        },
        {
          patterns: [
            '## emergency contacts',
          ],
          replacement: '## Contactos de Emergencia',
        },
        // Spanish variants
        {
          patterns: [
            '## razones de la hospitalización',
            '## razones de la hospitalización:',
            '## razón de la hospitalización',
            '## razones de la estancia hospitalaria',
            '## razones de la estancia',
            '## motivo de hospitalización',
            '## motivos de hospitalización',
          ],
          replacement: '## Razones de la Hospitalización',
        },
        {
          patterns: [
            '## qué sucedió durante su estancia',
            '## qué sucedió durante su estancia:',
            '## qué pasó durante su estancia',
            '## lo que sucedió durante su estancia',
            '## lo que pasó durante su estancia',
            '## qué ocurrió durante su estancia',
          ],
          replacement: '## Qué Sucedió Durante su Estancia',
        },
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
            '## sus citas',
          ],
          replacement: '## Sus Citas',
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
            '## contactos de emergencia',
            '## contactos de emergencia:',
            '## contactos de urgencia',
          ],
          replacement: '## Contactos de Emergencia',
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
        // English headers that slipped through translation
        {
          patterns: [
            '## reasons for hospital stay',
            '## reason for hospital stay',
          ],
          replacement: '## د روغتون د پاتې کیدو دلایل',
        },
        {
          patterns: [
            '## what happened during your stay',
            '## what happened during your hospital stay',
          ],
          replacement: '## ستاسو د پاتې کیدو په جریان کې څه پیښ شول',
        },
        {
          patterns: [
            '## your medications',
            '## medications',
          ],
          replacement: '## ستاسو درمل',
        },
        {
          patterns: [
            '## upcoming appointments',
            '## your appointments',
            '## appointments',
          ],
          replacement: '## ستاسو ناستې',
        },
        {
          patterns: [
            '## diet & activity',
            '## diet and activity',
          ],
          replacement: '## خوراک او فعالیت',
        },
        {
          patterns: [
            '## warning signs',
          ],
          replacement: '## د خطر نښې',
        },
        {
          patterns: [
            '## emergency contacts',
          ],
          replacement: '## د بیړني اړیکو معلومات',
        },
        // Pashto variants
        {
          patterns: [
            '## د روغتون د پاتې کیدو دلایل',
            '## د روغتون د پاتې کیدو دلایل:',
            '## د روغتون دلایل',
            '## د بستر کیدو دلایل',
          ],
          replacement: '## د روغتون د پاتې کیدو دلایل',
        },
        {
          patterns: [
            '## ستاسو د پاتې کیدو په جریان کې څه پیښ شول',
            '## ستاسو د پاتې کیدو په جریان کې څه پیښ شول:',
            '## ستاسو د پاتې کیدو په موده کې څه پیښ شول',
            '## د پاتې کیدو په جریان کې څه پیښ شول',
          ],
          replacement: '## ستاسو د پاتې کیدو په جریان کې څه پیښ شول',
        },
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
            '## ستاسو ناستې',
          ],
          replacement: '## ستاسو ناستې',
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
            '## د بیړني اړیکو معلومات',
            '## د بیړني اړیکو معلومات:',
            '## د بیړني اړیکې',
          ],
          replacement: '## د بیړني اړیکو معلومات',
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
      hi: [
        // English headers that slipped through translation
        {
          patterns: [
            '## reasons for hospital stay',
            '## reason for hospital stay',
          ],
          replacement: '## अस्पताल में रहने के कारण',
        },
        {
          patterns: [
            '## what happened during your stay',
            '## what happened during your hospital stay',
          ],
          replacement: '## आपके प्रवास के दौरान क्या हुआ',
        },
        {
          patterns: [
            '## your medications',
            '## medications',
          ],
          replacement: '## आपकी दवाएं',
        },
        {
          patterns: [
            '## upcoming appointments',
            '## your appointments',
            '## appointments',
          ],
          replacement: '## आगामी अपॉइंटमेंट',
        },
        {
          patterns: [
            '## diet & activity',
            '## diet and activity',
          ],
          replacement: '## आहार और गतिविधि',
        },
        {
          patterns: [
            '## warning signs',
          ],
          replacement: '## चेतावनी के संकेत',
        },
        {
          patterns: [
            '## emergency contacts',
          ],
          replacement: '## आपातकालीन संपर्क',
        },
        // Hindi variants
        {
          patterns: [
            '## अस्पताल में रहने के कारण',
            '## अस्पताल में रहने के कारण:',
            '## अस्पताल में भर्ती के कारण',
          ],
          replacement: '## अस्पताल में रहने के कारण',
        },
        {
          patterns: [
            '## आपके प्रवास के दौरान क्या हुआ',
            '## आपके प्रवास के दौरान क्या हुआ:',
            '## आपके रहने के दौरान क्या हुआ',
          ],
          replacement: '## आपके प्रवास के दौरान क्या हुआ',
        },
        {
          patterns: [
            '## आपकी दवाएं',
            '## आपकी दवाएं:',
            '## दवाएं',
          ],
          replacement: '## आपकी दवाएं',
        },
        {
          patterns: [
            '## आगामी अपॉइंटमेंट',
            '## आगामी अपॉइंटमेंट:',
            '## आपके अपॉइंटमेंट',
          ],
          replacement: '## आगामी अपॉइंटमेंट',
        },
        {
          patterns: [
            '## आहार और गतिविधि',
            '## आहार और गतिविधि:',
            '## भोजन और गतिविधि',
          ],
          replacement: '## आहार और गतिविधि',
        },
        {
          patterns: [
            '## चेतावनी के संकेत',
            '## चेतावनी के संकेत:',
            '## चेतावनी संकेत',
          ],
          replacement: '## चेतावनी के संकेत',
        },
        {
          patterns: [
            '## आपातकालीन संपर्क',
            '## आपातकालीन संपर्क:',
            '## आपातकालीन नंबर',
          ],
          replacement: '## आपातकालीन संपर्क',
        },
      ],
      vi: [
        // English headers that slipped through translation
        {
          patterns: [
            '## reasons for hospital stay',
            '## reason for hospital stay',
          ],
          replacement: '## Lý Do Nhập Viện',
        },
        {
          patterns: [
            '## what happened during your stay',
            '## what happened during your hospital stay',
          ],
          replacement: '## Điều Gì Đã Xảy Ra Trong Thời Gian Nằm Viện',
        },
        {
          patterns: [
            '## your medications',
            '## medications',
          ],
          replacement: '## Thuốc Của Bạn',
        },
        {
          patterns: [
            '## upcoming appointments',
            '## your appointments',
            '## appointments',
          ],
          replacement: '## Các Cuộc Hẹn Sắp Tới',
        },
        {
          patterns: [
            '## diet & activity',
            '## diet and activity',
          ],
          replacement: '## Chế Độ Ăn và Hoạt Động',
        },
        {
          patterns: [
            '## warning signs',
          ],
          replacement: '## Dấu Hiệu Cảnh Báo',
        },
        {
          patterns: [
            '## emergency contacts',
          ],
          replacement: '## Liên Hệ Khẩn Cấp',
        },
        // Vietnamese variants
        {
          patterns: [
            '## lý do nhập viện',
            '## lý do nhập viện:',
            '## lí do nhập viện',
          ],
          replacement: '## Lý Do Nhập Viện',
        },
        {
          patterns: [
            '## điều gì đã xảy ra trong thời gian nằm viện',
            '## điều gì đã xảy ra trong thời gian nằm viện:',
            '## chuyện gì đã xảy ra',
          ],
          replacement: '## Điều Gì Đã Xảy Ra Trong Thời Gian Nằm Viện',
        },
        {
          patterns: [
            '## thuốc của bạn',
            '## thuốc của bạn:',
            '## thuốc',
          ],
          replacement: '## Thuốc Của Bạn',
        },
        {
          patterns: [
            '## các cuộc hẹn sắp tới',
            '## các cuộc hẹn sắp tới:',
            '## cuộc hẹn',
          ],
          replacement: '## Các Cuộc Hẹn Sắp Tới',
        },
        {
          patterns: [
            '## chế độ ăn và hoạt động',
            '## chế độ ăn và hoạt động:',
            '## chế độ ăn uống và hoạt động',
          ],
          replacement: '## Chế Độ Ăn và Hoạt Động',
        },
        {
          patterns: [
            '## dấu hiệu cảnh báo',
            '## dấu hiệu cảnh báo:',
            '## các dấu hiệu cảnh báo',
          ],
          replacement: '## Dấu Hiệu Cảnh Báo',
        },
        {
          patterns: [
            '## liên hệ khẩn cấp',
            '## liên hệ khẩn cấp:',
            '## thông tin liên hệ khẩn cấp',
          ],
          replacement: '## Liên Hệ Khẩn Cấp',
        },
      ],
      zh: [
        // English headers that slipped through translation
        {
          patterns: [
            '## reasons for hospital stay',
            '## reason for hospital stay',
          ],
          replacement: '## 住院原因',
        },
        {
          patterns: [
            '## what happened during your stay',
            '## what happened during your hospital stay',
          ],
          replacement: '## 住院期间发生的事情',
        },
        {
          patterns: [
            '## your medications',
            '## medications',
          ],
          replacement: '## 您的药物',
        },
        {
          patterns: [
            '## upcoming appointments',
            '## your appointments',
            '## appointments',
          ],
          replacement: '## 即将到来的预约',
        },
        {
          patterns: [
            '## diet & activity',
            '## diet and activity',
          ],
          replacement: '## 饮食和活动',
        },
        {
          patterns: [
            '## warning signs',
          ],
          replacement: '## 警告信号',
        },
        {
          patterns: [
            '## emergency contacts',
          ],
          replacement: '## 紧急联系方式',
        },
        // Chinese variants
        {
          patterns: [
            '## 住院原因',
            '## 住院原因:',
            '## 入院原因',
          ],
          replacement: '## 住院原因',
        },
        {
          patterns: [
            '## 住院期间发生的事情',
            '## 住院期间发生的事情:',
            '## 您住院期间发生了什么',
          ],
          replacement: '## 住院期间发生的事情',
        },
        {
          patterns: [
            '## 您的药物',
            '## 您的药物:',
            '## 药物',
          ],
          replacement: '## 您的药物',
        },
        {
          patterns: [
            '## 即将到来的预约',
            '## 即将到来的预约:',
            '## 您的预约',
          ],
          replacement: '## 即将到来的预约',
        },
        {
          patterns: [
            '## 饮食和活动',
            '## 饮食和活动:',
            '## 饮食与活动',
          ],
          replacement: '## 饮食和活动',
        },
        {
          patterns: [
            '## 警告信号',
            '## 警告信号:',
            '## 警告标志',
          ],
          replacement: '## 警告信号',
        },
        {
          patterns: [
            '## 紧急联系方式',
            '## 紧急联系方式:',
            '## 紧急联系',
          ],
          replacement: '## 紧急联系方式',
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
