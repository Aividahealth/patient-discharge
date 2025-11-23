/**
 * Parse AI-simplified discharge content into structured sections
 * 
 * The simplified content follows this format:
 * ## Overview
 * ## Your Medications
 * ## Upcoming Appointments
 * ## Diet & Activity
 * ## Warning Signs
 */

export interface DischargeSections {
  overview?: string;
  medications?: string;
  appointments?: string;
  dietActivity?: string;
  warningsSigns?: string;
  raw?: string; // Fallback if parsing fails
}

/**
 * Parse markdown sections from AI-simplified discharge content
 */
export function parseDischargeIntoSections(content: string): DischargeSections {
  if (!content || content.trim().length === 0) {
    return { raw: '' };
  }

  const sections: DischargeSections = { raw: content };

  try {
    // Split by markdown headers (## SectionName)
    const lines = content.split('\n');
    let currentSection: keyof DischargeSections | null = null;
    let currentContent: string[] = [];

    // Language-aware section mapping
    const sectionMap: Record<string, keyof DischargeSections> = {
      // English
      'overview': 'overview',
      'your medications': 'medications',
      'medications': 'medications',
      'upcoming appointments': 'appointments',
      'appointments': 'appointments',
      'diet & activity': 'dietActivity',
      'diet and activity': 'dietActivity',
      'warning signs': 'warningsSigns',
      // French
      'vos médicaments': 'medications',
      'médicaments': 'medications',
      'rendez-vous à venir': 'appointments',
      'rendez-vous': 'appointments',
      'régime et activité': 'dietActivity',
      'régime et activités': 'dietActivity',
      'alimentation et activité': 'dietActivity',
      'signes d\'alerte': 'warningsSigns',
      'signe d\'alerte': 'warningsSigns',
      // Spanish
      'sus medicamentos': 'medications',
      'medicamentos': 'medications',
      'próximas citas': 'appointments',
      'citas': 'appointments',
      'citas de seguimiento': 'appointments',
      'dieta y actividad': 'dietActivity',
      'dieta y actividades': 'dietActivity',
      'alimentación y actividad': 'dietActivity',
      'señales de advertencia': 'warningsSigns',
      'señal de advertencia': 'warningsSigns',
      // Pashto (using Unicode escape sequences for webpack compatibility)
      '\u0633\u062a\u0627\u0633\u0648\u0020\u062f\u0631\u0645\u0644': 'medications', // ستاسو درمل
      '\u062f\u0631\u0645\u0644': 'medications', // درمل
      '\u0631\u0627\u062a\u0644\u0648\u0646\u06a9\u064a\u0020\u0646\u0627\u0633\u062a\u06d0': 'appointments', // راتلونکي ناستې
      '\u0646\u0627\u0633\u062a\u06d0': 'appointments', // ناستې
      '\u062e\u0648\u0631\u0627\u06a9\u0020\u0627\u0648\u0020\u0641\u0639\u0627\u0644\u06cc\u062a': 'dietActivity', // خوراک او فعالیت
      '\u062e\u0648\u0631\u0627\u06a9\u0020\u0627\u0648\u0020\u0641\u0639\u0627\u0644\u06cc\u062a\u0648\u0646\u0647': 'dietActivity', // خوراک او فعالیتونه
      '\u062f\u0020\u062e\u0637\u0631\u0020\u0646\u069a\u06d0': 'warningsSigns', // د خطر نښې
      '\u062f\u0020\u062e\u0637\u0631\u0020\u0646\u069a\u0627\u0646\u06d0': 'warningsSigns', // د خطر نښانې
      '\u0644\u0646\u0689\u06cc\u0632': 'overview', // لنډیز
    };

    const flushSection = () => {
      if (currentSection && currentContent.length > 0) {
        sections[currentSection] = currentContent.join('\n').trim();
        currentContent = [];
      }
    };

    for (const line of lines) {
      // Check if line is a section header (## SectionName)
      const headerMatch = line.match(/^##\s+(.+)$/);
      
      if (headerMatch) {
        // Flush previous section
        flushSection();
        
        // Start new section
        const headerText = headerMatch[1].trim().toLowerCase();
        currentSection = sectionMap[headerText] || null;
        
        if (!currentSection) {
          console.warn(`[Parse] Unknown section header: "${headerText}"`);
        }
      } else if (currentSection) {
        // Add line to current section
        currentContent.push(line);
      }
    }

    // Flush final section
    flushSection();

    console.log('[Parse] Parsed discharge sections:', {
      hasOverview: !!sections.overview,
      hasMedications: !!sections.medications,
      hasAppointments: !!sections.appointments,
      hasDietActivity: !!sections.dietActivity,
      hasWarnings: !!sections.warningsSigns,
    });

  } catch (error) {
    console.error('[Parse] Failed to parse discharge sections:', error);
    // Return raw content as fallback
    return { raw: content };
  }

  return sections;
}

/**
 * Extract medications as structured array from the medications section
 */
export interface Medication {
  name: string;
  dose?: string;
  frequency?: string;
  howToTake?: string;
  instructions: string;
}

/**
 * Clean markdown formatting from text (remove **, *, etc.)
 */
export function cleanMarkdown(text: string): string {
  if (!text) return '';
  
  return text
    // Remove bold markdown
    .replace(/\*\*(.+?)\*\*/g, '$1')
    // Remove italic markdown
    .replace(/\*(.+?)\*/g, '$1')
    // Remove bullet points
    .replace(/^[-•*]\s*/gm, '')
    // Trim extra whitespace
    .trim();
}

export function extractMedications(medicationsSection: string): Medication[] {
  if (!medicationsSection) return [];

  const medications: Medication[] = [];
  
  try {
    // Split by patterns that indicate a new medication:
    // - Lines starting with **MedicationName** or bold markers
    // - Bullet points followed by medication names
    const text = medicationsSection;
    
    // Split on patterns like "**MedicationName:**" or "- **MedicationName"
    // But keep the entire medication entry together
    const medSections = text.split(/\n(?=[-•*]\s*\*\*|\*\*(?:[A-Z]|New |Dose:))/);
    
    for (const section of medSections) {
      const trimmed = section.trim();
      if (!trimmed || trimmed.startsWith('#') || trimmed.toLowerCase().includes('special instructions medications')) continue;
      
      // Extract medication name (look for **Name:** or **Name**)
      const nameMatch = trimmed.match(/\*\*([^*:]+?)(?::|\*\*)/);
      let medName = nameMatch ? cleanMarkdown(nameMatch[1]) : 'Medication';
      
      // Skip if this is just a section header like "New" or "Dose:"
      if (medName.toLowerCase() === 'new' || medName.toLowerCase() === 'dose') {
        continue;
      }
      
      // Clean the full text
      const cleanedText = cleanMarkdown(trimmed);
      
      // Try to extract dose (look for patterns like "40 mg", "5 mg", etc.)
      const doseMatch = cleanedText.match(/(\d+\s*mg)/i);
      const dose = doseMatch ? doseMatch[1] : undefined;
      
      // Try to extract frequency (once daily, twice daily, etc.)
      const frequencyMatch = cleanedText.match(/(once|twice|three times|[\d]+\s*times?)\s*(daily|a day|per day)/i);
      const frequency = frequencyMatch ? frequencyMatch[0] : undefined;
      
      // Try to extract "how to take" method (by mouth, injection, etc.)
      const methodMatch = cleanedText.match(/(by mouth|as an injection|under the skin|with food|sublingual)/i);
      const howToTake = methodMatch ? methodMatch[0] : undefined;
      
      // The full instructions are the cleaned text
      const instructions = cleanedText;
      
      medications.push({
        name: medName,
        dose,
        frequency,
        howToTake,
        instructions,
      });
    }
  } catch (error) {
    console.error('[Parse] Failed to extract medications:', error);
  }

  return medications;
}

/**
 * Extract appointments as structured array
 */
export interface Appointment {
  date?: string;
  doctor?: string;
  specialty?: string;
  location?: string;
  rawText: string;
}

export function extractAppointments(appointmentsSection: string): Appointment[] {
  if (!appointmentsSection) return [];

  const appointments: Appointment[] = [];
  
  try {
    // Split by patterns that indicate a new appointment:
    // - Lines starting with **ClinicName:** or bold markers
    // - Bullet points followed by appointment details
    const text = appointmentsSection;
    
    // Split on patterns like "**Clinic Name:**" to keep each appointment together
    const apptSections = text.split(/\n(?=[-•*]\s*\*\*|\*\*[A-Z])/);
    
    for (const section of apptSections) {
      const trimmed = section.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      
      const cleanedText = cleanMarkdown(trimmed);
      
      // Try to extract clinic/specialty from patterns like "**Orthopedic Clinic:**" or "**Primary Care Provider (PCP):**"
      const specialtyMatch = trimmed.match(/\*\*([^:*]+?)(?::|\*\*)/);
      const specialty = specialtyMatch ? cleanMarkdown(specialtyMatch[1]) : undefined;
      
      // Try to extract timing like "in 2 weeks", "in 1 to 2 weeks"
      const dateMatch = cleanedText.match(/in (\d+(?:\s+to\s+\d+)?\s+(?:week|day|month)s?)/i);
      const date = dateMatch ? dateMatch[1] : undefined;
      
      // Try to extract location/address
      const locationMatch = cleanedText.match(/(?:at|location:|address:)\s*([^.]+)/i);
      const location = locationMatch ? locationMatch[1].trim() : undefined;
      
      appointments.push({
        specialty,
        date,
        location,
        rawText: cleanedText,
      });
    }
  } catch (error) {
    console.error('[Parse] Failed to extract appointments:', error);
  }

  return appointments;
}

