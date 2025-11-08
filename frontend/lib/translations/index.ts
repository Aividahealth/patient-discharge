/**
 * Centralized translations for all portals
 */

import { patientTranslations } from './patient'

export { patientTranslations }

// Export types
export type { PatientTranslationKey } from './patient'

// Re-export for convenience
export const translations = {
  patient: patientTranslations,
}
