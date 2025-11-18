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

    const sectionMap: Record<string, keyof DischargeSections> = {
      'overview': 'overview',
      'your medications': 'medications',
      'upcoming appointments': 'appointments',
      'diet & activity': 'dietActivity',
      'diet and activity': 'dietActivity',
      'warning signs': 'warningsSigns',
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
    // Match patterns like:
    // - Metoprolol succinate (a medicine...) — take 50 mg by mouth once daily.
    // - Aspirin 81mg - Take once daily with food
    const lines = medicationsSection.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Skip empty lines or section headers
      if (!trimmed || trimmed.startsWith('#')) continue;
      
      // Match bullet points or numbered lists
      const bulletMatch = trimmed.match(/^[-•*]\s*(.+)$/);
      const numberMatch = trimmed.match(/^\d+\.\s*(.+)$/);
      
      const content = bulletMatch?.[1] || numberMatch?.[1] || trimmed;
      
      if (content) {
        // Try to extract name and dose
        // Pattern: "MedicationName (description) — take dose instructions"
        const medMatch = content.match(/^([^—\-–]+)[\s—\-–]+(.+)$/);
        
        if (medMatch) {
          const nameWithDose = medMatch[1].trim();
          const instructions = medMatch[2].trim();
          
          // Try to extract dose from name
          const doseMatch = nameWithDose.match(/^(.+?)\s+(\d+\s*mg)(.*)$/i);
          
          if (doseMatch) {
            medications.push({
              name: cleanMarkdown((doseMatch[1] + doseMatch[3]).trim()),
              dose: cleanMarkdown(doseMatch[2].trim()),
              instructions: cleanMarkdown(instructions),
            });
          } else {
            medications.push({
              name: cleanMarkdown(nameWithDose),
              instructions: cleanMarkdown(instructions),
            });
          }
        } else {
          // Fallback: treat entire line as medication entry
          medications.push({
            name: 'Medication',
            instructions: cleanMarkdown(content),
          });
        }
      }
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
    const lines = appointmentsSection.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Skip empty lines or section headers
      if (!trimmed || trimmed.startsWith('#')) continue;
      
      // Match bullet points or numbered lists
      const bulletMatch = trimmed.match(/^[-•*]\s*(.+)$/);
      const numberMatch = trimmed.match(/^\d+\.\s*(.+)$/);
      
      const content = bulletMatch?.[1] || numberMatch?.[1] || trimmed;
      
      if (content) {
        const cleanedText = cleanMarkdown(content);
        
        // Try to extract clinic/specialty from patterns like "**Orthopedic Clinic:**" or "**Primary Care Provider (PCP):**"
        const specialtyMatch = content.match(/\*\*([^:]+):\*\*/);
        const specialty = specialtyMatch ? cleanMarkdown(specialtyMatch[1]) : undefined;
        
        // Try to extract timing like "in 2 weeks", "in 1 to 2 weeks"
        const dateMatch = cleanedText.match(/in (\d+(?:\s+to\s+\d+)?\s+(?:week|day|month)s?)/i);
        const date = dateMatch ? dateMatch[1] : undefined;
        
        appointments.push({
          specialty,
          date,
          rawText: cleanedText,
        });
      }
    }
  } catch (error) {
    console.error('[Parse] Failed to extract appointments:', error);
  }

  return appointments;
}

