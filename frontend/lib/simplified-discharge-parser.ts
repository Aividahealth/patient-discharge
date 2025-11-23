/**
 * Common parser for AI-simplified discharge summary and instructions
 * Handles the standardized format from the Gemini model
 */

export interface ParsedDischargeSummary {
  reasonsForStay?: string;
  whatHappened?: string;
  raw?: string;
}

export interface MedicationRow {
  medicineName: string;
  frequency: string;
  whenToTake: string;
  specialInstructions: string;
}

export interface ParsedDischargeInstructions {
  medications?: MedicationRow[];
  appointments?: string[];
  dietActivity?: {
    foodsToInclude?: string[];
    foodsToLimit?: string[];
    recommendedActivities?: string[];
    activitiesToAvoid?: string[];
  };
  warningSigns?: {
    call911?: string[];
    callDoctor?: string[];
    emergencyContacts?: string[];
  };
  raw?: string;
}

/**
 * Parse discharge summary (Overview section)
 * Expected format:
 * ## Overview
 * **Reasons for Hospital Stay**
 * [text content]
 * 
 * **What Happened During Your Stay**
 * [text content]
 */
export function parseDischargeSummary(content: string): ParsedDischargeSummary {
  if (!content || content.trim().length === 0) {
    return { raw: '' };
  }

  const result: ParsedDischargeSummary = { raw: content };

  try {
    // Check if content starts with ## Overview
    const overviewMatch = content.match(/^##\s+Overview\s*\n/i);
    if (!overviewMatch) {
      // If no Overview header, treat entire content as raw
      return { raw: content };
    }

    // Extract "Reasons for Hospital Stay" section
    const reasonsMatch = content.match(/\*\*Reasons for Hospital Stay\*\*\s*\n([\s\S]*?)(?=\*\*What Happened During Your Stay\*\*|$)/i);
    if (reasonsMatch) {
      result.reasonsForStay = reasonsMatch[1].trim();
    }

    // Extract "What Happened During Your Stay" section
    const happenedMatch = content.match(/\*\*What Happened During Your Stay\*\*\s*\n([\s\S]*?)(?=\*\*|##|$)/i);
    if (happenedMatch) {
      result.whatHappened = happenedMatch[1].trim();
    }

    // If no structured sections found, return raw
    if (!result.reasonsForStay && !result.whatHappened) {
      result.raw = content;
    }
  } catch (error) {
    console.error('[SimplifiedDischargeParser] Failed to parse discharge summary:', error);
    return { raw: content };
  }

  return result;
}

/**
 * Parse discharge instructions
 * Expected format:
 * ## Your Medications
 * [markdown table]
 * 
 * ## Upcoming Appointments
 * - [bullet list]
 * 
 * ## Diet & Activity
 * **Foods to Include**
 * - [bullet list]
 * ...
 * 
 * ## Warning Signs
 * **When to Seek Help - Call 911**
 * - [bullet list]
 * ...
 */
export function parseDischargeInstructions(content: string): ParsedDischargeInstructions {
  if (!content || content.trim().length === 0) {
    return { raw: '' };
  }

  const result: ParsedDischargeInstructions = { raw: content };

  try {
    // Language-aware section header patterns
    // English
    const medicationsHeaders = [
      'Your Medications',
      'Medications',
      'Your Medication',
    ];
    // French
    const medicationsHeadersFr = [
      'Vos Médicaments',
      'Médicaments',
      'Votre Médicament',
    ];
    // Spanish
    const medicationsHeadersEs = [
      'Sus Medicamentos',
      'Medicamentos',
      'Su Medicamento',
    ];
    const appointmentsHeaders = [
      'Upcoming Appointments',
      'Appointments',
      'Follow-up Appointments',
    ];
    const appointmentsHeadersFr = [
      'Rendez-vous à Venir',
      'Rendez-vous',
      'Rendez-vous de Suivi',
    ];
    const appointmentsHeadersEs = [
      'Próximas Citas',
      'Citas',
      'Citas de Seguimiento',
    ];
    const appointmentsHeadersPs = [
      'راتلونکي ناستې',
      'ناستې',
    ];

    const dietActivityHeaders = [
      'Diet & Activity',
      'Diet and Activity',
      'Diet & Activities',
    ];
    const dietActivityHeadersFr = [
      'Régime et Activité',
      'Régime et Activités',
      'Alimentation et Activité',
    ];
    const dietActivityHeadersEs = [
      'Dieta y Actividad',
      'Dieta y Actividades',
      'Alimentación y Actividad',
    ];

    const warningSignsHeaders = [
      'Warning Signs',
      'Warning Sign',
      'Warning Symptoms',
    ];
    const warningSignsHeadersFr = [
      'Signes d\'Alerte',
      'Signe d\'Alerte',
      'Symptômes d\'Alerte',
    ];
    const warningSignsHeadersEs = [
      'Señales de Advertencia',
      'Señal de Advertencia',
      'Síntomas de Advertencia',
    ];
    // Pashto (using Unicode escape sequences for webpack compatibility)
    const medicationsHeadersPs = [
      '\u0633\u062a\u0627\u0633\u0648\u0020\u062f\u0631\u0645\u0644', // ستاسو درمل
      '\u062f\u0631\u0645\u0644', // درمل
    ];
    const appointmentsHeadersPs = [
      '\u0631\u0627\u062a\u0644\u0648\u0646\u06a9\u064a\u0020\u0646\u0627\u0633\u062a\u06d0', // راتلونکي ناستې
      '\u0646\u0627\u0633\u062a\u06d0', // ناستې
    ];
    const dietActivityHeadersPs = [
      '\u062e\u0648\u0631\u0627\u06a9\u0020\u0627\u0648\u0020\u0641\u0639\u0627\u0644\u06cc\u062a', // خوراک او فعالیت
      '\u062e\u0648\u0631\u0627\u06a9\u0020\u0627\u0648\u0020\u0641\u0639\u0627\u0644\u06cc\u062a\u0648\u0646\u0647', // خوراک او فعالیتونه
    ];
    const warningSignsHeadersPs = [
      '\u062f\u0020\u062e\u0637\u0631\u0020\u0646\u069a\u06d0', // د خطر نښې
      '\u062f\u0020\u062e\u0637\u0631\u0020\u0646\u069a\u0627\u0646\u06d0', // د خطر نښانې
    ];

    // Combine all language variants
    const allMedicationsHeaders = [...medicationsHeaders, ...medicationsHeadersFr, ...medicationsHeadersEs, ...medicationsHeadersPs];
    const allAppointmentsHeaders = [...appointmentsHeaders, ...appointmentsHeadersFr, ...appointmentsHeadersEs, ...appointmentsHeadersPs];
    const allDietActivityHeaders = [...dietActivityHeaders, ...dietActivityHeadersFr, ...dietActivityHeadersEs, ...dietActivityHeadersPs];
    const allWarningSignsHeaders = [...warningSignsHeaders, ...warningSignsHeadersFr, ...warningSignsHeadersEs, ...warningSignsHeadersPs];

    // Create regex patterns that match any of the headers
    const medicationsPattern = allMedicationsHeaders.map(h => h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    const appointmentsPattern = allAppointmentsHeaders.map(h => h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    const dietActivityPattern = allDietActivityHeaders.map(h => h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    const warningSignsPattern = allWarningSignsHeaders.map(h => h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');

    // Parse Medications section (markdown table)
    // Capture group 1 is the content (header is not captured)
    const medicationsMatch = content.match(new RegExp(`##\\s+(?:${medicationsPattern})\\s*\\n([\\s\\S]*?)(?=##\\s+(?:${appointmentsPattern}|${dietActivityPattern}|${warningSignsPattern})|$)`, 'i'));
    if (medicationsMatch) {
      result.medications = parseMedicationsTable(medicationsMatch[1]);
    }

    // Parse Appointments section (bullet list)
    const appointmentsMatch = content.match(new RegExp(`##\\s+(?:${appointmentsPattern})\\s*\\n([\\s\\S]*?)(?=##\\s+(?:${dietActivityPattern}|${warningSignsPattern})|$)`, 'i'));
    if (appointmentsMatch) {
      result.appointments = parseBulletList(appointmentsMatch[1]);
    }

    // Parse Diet & Activity section
    const dietActivityMatch = content.match(new RegExp(`##\\s+(?:${dietActivityPattern})\\s*\\n([\\s\\S]*?)(?=##\\s+${warningSignsPattern}|$)`, 'i'));
    if (dietActivityMatch) {
      result.dietActivity = parseDietActivity(dietActivityMatch[1]);
    }

    // Parse Warning Signs section
    const warningSignsMatch = content.match(new RegExp(`##\\s+(?:${warningSignsPattern})\\s*\\n([\\s\\S]*?)$`, 'i'));
    if (warningSignsMatch) {
      result.warningSigns = parseWarningSigns(warningSignsMatch[1]);
    }

    // If no structured sections found, return raw
    if (!result.medications && !result.appointments && !result.dietActivity && !result.warningSigns) {
      result.raw = content;
    }
  } catch (error) {
    console.error('[SimplifiedDischargeParser] Failed to parse discharge instructions:', error);
    return { raw: content };
  }

  return result;
}

/**
 * Parse medications from markdown table
 * Expected format:
 * | Medicine Name | Frequency | When to Take | Special Instructions |
 * |---------------|-----------|--------------|----------------------|
 * | [name] | [freq] | [when] | [instructions] |
 */
function parseMedicationsTable(tableContent: string): MedicationRow[] {
  const medications: MedicationRow[] = [];

  try {
    const lines = tableContent.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    // Find the table header row
    let headerIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('Medicine Name') || lines[i].includes('|')) {
        headerIndex = i;
        break;
      }
    }

    if (headerIndex === -1) {
      // No table found, try to parse as list
      return parseMedicationsAsList(tableContent);
    }

    // Skip header and separator rows
    for (let i = headerIndex + 2; i < lines.length; i++) {
      const line = lines[i];
      if (!line.startsWith('|') || line.match(/^[\|\s-]+$/)) {
        continue; // Skip separator rows
      }

      const cells = line.split('|').map(cell => cell.trim()).filter(cell => cell.length > 0);
      
      if (cells.length >= 4) {
        medications.push({
          medicineName: cells[0] || '',
          frequency: cells[1] || '',
          whenToTake: cells[2] || '',
          specialInstructions: cells[3] || '',
        });
      } else if (cells.length >= 1) {
        // Fallback: if table format is incomplete, use first cell as name
        medications.push({
          medicineName: cells[0] || '',
          frequency: '',
          whenToTake: '',
          specialInstructions: cells.slice(1).join(' ') || '',
        });
      }
    }
  } catch (error) {
    console.error('[SimplifiedDischargeParser] Failed to parse medications table:', error);
    // Fallback to list parsing
    return parseMedicationsAsList(tableContent);
  }

  return medications;
}

/**
 * Fallback: Parse medications as list if table format is not found
 */
function parseMedicationsAsList(content: string): MedicationRow[] {
  const medications: MedicationRow[] = [];
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('|') || trimmed.startsWith('#')) {
      continue;
    }

    // Try to extract medication info from bullet points or paragraphs
    const bulletMatch = trimmed.match(/^[-•*]\s*(.+)$/);
    const medText = bulletMatch ? bulletMatch[1] : trimmed;

    if (medText.length > 0) {
      // Try to extract structured info
      const nameMatch = medText.match(/^(.+?)(?:\s*[-–—]\s*|\s*:\s*|\s*\(|$)/);
      const name = nameMatch ? nameMatch[1].trim() : medText;

      medications.push({
        medicineName: name,
        frequency: '',
        whenToTake: '',
        specialInstructions: medText.replace(name, '').trim(),
      });
    }
  }

  return medications;
}

/**
 * Parse bullet list
 */
function parseBulletList(content: string): string[] {
  const items: string[] = [];
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    // Match bullet points: -, *, •, or numbered
    const bulletMatch = trimmed.match(/^[-•*]\s*(.+)$/);
    if (bulletMatch) {
      items.push(bulletMatch[1].trim());
    } else if (trimmed.length > 0 && !trimmed.startsWith('|')) {
      // Also include non-bullet lines that aren't table separators
      items.push(trimmed);
    }
  }

  return items;
}

/**
 * Parse Diet & Activity section
 * Expected format:
 * **Foods to Include**
 * - [list]
 * **Foods to Limit**
 * - [list]
 * **Recommended Activities**
 * - [list]
 * **Activities to Avoid**
 * - [list]
 */
function parseDietActivity(content: string): ParsedDischargeInstructions['dietActivity'] {
  const result: ParsedDischargeInstructions['dietActivity'] = {};

  try {
    // Extract Foods to Include
    const foodsIncludeMatch = content.match(/\*\*Foods to Include\*\*\s*\n([\s\S]*?)(?=\*\*Foods to Limit\*\*|\*\*Recommended Activities\*\*|\*\*Activities to Avoid\*\*|$)/i);
    if (foodsIncludeMatch) {
      result.foodsToInclude = parseBulletList(foodsIncludeMatch[1]);
    }

    // Extract Foods to Limit
    const foodsLimitMatch = content.match(/\*\*Foods to Limit\*\*\s*\n([\s\S]*?)(?=\*\*Recommended Activities\*\*|\*\*Activities to Avoid\*\*|$)/i);
    if (foodsLimitMatch) {
      result.foodsToLimit = parseBulletList(foodsLimitMatch[1]);
    }

    // Extract Recommended Activities
    const recommendedMatch = content.match(/\*\*Recommended Activities\*\*\s*\n([\s\S]*?)(?=\*\*Activities to Avoid\*\*|$)/i);
    if (recommendedMatch) {
      result.recommendedActivities = parseBulletList(recommendedMatch[1]);
    }

    // Extract Activities to Avoid
    const avoidMatch = content.match(/\*\*Activities to Avoid\*\*\s*\n([\s\S]*?)$/i);
    if (avoidMatch) {
      result.activitiesToAvoid = parseBulletList(avoidMatch[1]);
    }
  } catch (error) {
    console.error('[SimplifiedDischargeParser] Failed to parse diet & activity:', error);
  }

  return result;
}

/**
 * Parse Warning Signs section
 * Expected format:
 * **When to Seek Help - Call 911**
 * - [list]
 * **When to Call Your Doctor**
 * - [list]
 * **Emergency Contacts**
 * - [list]
 */
function parseWarningSigns(content: string): ParsedDischargeInstructions['warningSigns'] {
  const result: ParsedDischargeInstructions['warningSigns'] = {};

  try {
    // Extract Call 911
    const call911Match = content.match(/\*\*When to Seek Help\s*[-–—]\s*Call\s+911\*\*\s*\n([\s\S]*?)(?=\*\*When to Call Your Doctor\*\*|\*\*Emergency Contacts\*\*|$)/i);
    if (call911Match) {
      result.call911 = parseBulletList(call911Match[1]);
    }

    // Extract Call Doctor
    const callDoctorMatch = content.match(/\*\*When to Call Your Doctor\*\*\s*\n([\s\S]*?)(?=\*\*Emergency Contacts\*\*|$)/i);
    if (callDoctorMatch) {
      result.callDoctor = parseBulletList(callDoctorMatch[1]);
    }

    // Extract Emergency Contacts
    const contactsMatch = content.match(/\*\*Emergency Contacts\*\*\s*\n([\s\S]*?)$/i);
    if (contactsMatch) {
      result.emergencyContacts = parseBulletList(contactsMatch[1]);
    }
  } catch (error) {
    console.error('[SimplifiedDischargeParser] Failed to parse warning signs:', error);
  }

  return result;
}

