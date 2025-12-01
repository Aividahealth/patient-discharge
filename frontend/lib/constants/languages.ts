/**
 * Supported languages configuration
 */

export interface LanguageConfig {
  code: string
  name: string
  nativeName: string
  flag?: string
}

export const SUPPORTED_LANGUAGES: Record<string, LanguageConfig> = {
  en: {
    code: 'en',
    name: 'English',
    nativeName: 'English',
  },
  es: {
    code: 'es',
    name: 'Spanish',
    nativeName: 'Español',
  },
  hi: {
    code: 'hi',
    name: 'Hindi',
    nativeName: 'हिंदी',
  },
  vi: {
    code: 'vi',
    name: 'Vietnamese',
    nativeName: 'Tiếng Việt',
  },
  fr: {
    code: 'fr',
    name: 'French',
    nativeName: 'Français',
  },
  ps: {
    code: 'ps',
    name: 'Pashto',
    nativeName: 'پښتو',
  },
  zh: {
    code: 'zh',
    name: 'Chinese (Mandarin)',
    nativeName: '中文',
  },
}

export type SupportedLanguageCode = keyof typeof SUPPORTED_LANGUAGES

export const DEFAULT_LANGUAGE: SupportedLanguageCode = 'en'

/**
 * Get language display name
 */
export function getLanguageName(code: string, useNative = true): string {
  const lang = SUPPORTED_LANGUAGES[code]
  if (!lang) return code
  return useNative ? lang.nativeName : lang.name
}

/**
 * Get all language codes
 */
export function getLanguageCodes(): SupportedLanguageCode[] {
  return Object.keys(SUPPORTED_LANGUAGES) as SupportedLanguageCode[]
}

/**
 * Check if language is supported
 */
export function isLanguageSupported(code: string): code is SupportedLanguageCode {
  return code in SUPPORTED_LANGUAGES
}
