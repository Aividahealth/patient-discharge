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
    // Hindi
    const medicationsHeadersHi = [
      '\u0906\u092a\u0915\u0940\u0020\u0926\u0935\u093e\u090f\u0901', // आपकी दवाएँ
      '\u0926\u0935\u093e\u090f\u0901', // दवाएँ
      '\u0906\u092a\u0915\u0940\u0020\u0926\u0935\u093e', // आपकी दवा
    ];
    const appointmentsHeadersHi = [
      '\u0906\u0917\u093e\u092e\u0940\u0020\u0905\u092a\u0949\u0907\u0902\u091f\u092e\u0947\u0902\u091f', // आगामी अपॉइंटमेंट
      '\u0905\u092a\u0949\u0907\u0902\u091f\u092e\u0947\u0902\u091f', // अपॉइंटमेंट
    ];
    const dietActivityHeadersHi = [
      '\u0906\u0939\u093e\u0930\u0020\u0914\u0930\u0020\u0917\u0924\u093f\u0935\u093f\u0927\u093f', // आहार और गतिविधि
      '\u0906\u0939\u093e\u0930\u0020\u0914\u0930\u0020\u0917\u0924\u093f\u0935\u093f\u0927\u093f\u092f\u093e\u0902', // आहार और गतिविधियां
    ];
    const warningSignsHeadersHi = [
      '\u091a\u0947\u0924\u093e\u0935\u0928\u0940\u0020\u0938\u0902\u0915\u0947\u0924', // चेतावनी संकेत
      '\u091a\u0947\u0924\u093e\u0935\u0928\u0940\u0020\u0915\u0947\u0020\u0938\u0902\u0915\u0947\u0924', // चेतावनी के संकेत
    ];
    // Vietnamese
    const medicationsHeadersVi = [
      'Thu\u1ed1c c\u1ee7a B\u1ea1n', // Thuốc của Bạn
      'Thu\u1ed1c', // Thuốc
    ];
    const appointmentsHeadersVi = [
      'Cu\u1ed9c H\u1eb9n S\u1eafp T\u1edbi', // Cuộc Hẹn Sắp Tới
      'Cu\u1ed9c H\u1eb9n', // Cuộc Hẹn
    ];
    const dietActivityHeadersVi = [
      'Ch\u1ebf \u0110\u1ed9 \u0102n U\u1ed1ng v\u00e0 Ho\u1ea1t \u0110\u1ed9ng', // Chế Độ Ăn Uống và Hoạt Động
      'Ch\u1ebf \u0110\u1ed9 \u0102n U\u1ed1ng & Ho\u1ea1t \u0110\u1ed9ng', // Chế Độ Ăn Uống & Hoạt Động
    ];
    const warningSignsHeadersVi = [
      'D\u1ea5u Hi\u1ec7u C\u1ea3nh B\u00e1o', // Dấu Hiệu Cảnh Báo
      'C\u1ea3nh B\u00e1o', // Cảnh Báo
    ];

    // Combine all language variants
    const allMedicationsHeaders = [...medicationsHeaders, ...medicationsHeadersFr, ...medicationsHeadersEs, ...medicationsHeadersPs, ...medicationsHeadersHi, ...medicationsHeadersVi];
    const allAppointmentsHeaders = [...appointmentsHeaders, ...appointmentsHeadersFr, ...appointmentsHeadersEs, ...appointmentsHeadersPs, ...appointmentsHeadersHi, ...appointmentsHeadersVi];
    const allDietActivityHeaders = [...dietActivityHeaders, ...dietActivityHeadersFr, ...dietActivityHeadersEs, ...dietActivityHeadersPs, ...dietActivityHeadersHi, ...dietActivityHeadersVi];
    const allWarningSignsHeaders = [...warningSignsHeaders, ...warningSignsHeadersFr, ...warningSignsHeadersEs, ...warningSignsHeadersPs, ...warningSignsHeadersHi, ...warningSignsHeadersVi];

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

    // Multilingual table header keywords
    const medicineNameHeaders = [
      'Medicine Name', 'Nom du Médicament', 'Nombre del Medicamento',
      'دوا نوم', 'दवा का नाम', 'Tên Thuốc'
    ];

    // Find the table header row
    let headerIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Check if line contains any medicine name header keyword OR has table format
      const hasMedicineHeader = medicineNameHeaders.some(header => line.includes(header));
      if (hasMedicineHeader || line.includes('|')) {
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
    // Multilingual subsection headers
    const foodsIncludeHeaders = [
      'Foods to Include',
      'Aliments à Inclure', // French
      'Alimentos a Incluir', // Spanish
      '\u0634\u0627\u0645\u0644\u0648\u0644\u0648\u0020\u062e\u0648\u0631\u0627\u06a9', // Pashto: شاملولو خوراک
      '\u0936\u093e\u092e\u093f\u0932\u0020\u0915\u0930\u0928\u0947\u0020\u0915\u0947\u0020\u0932\u093f\u090f\u0020\u0916\u093e\u0926\u094d\u092f\u0020\u092a\u0926\u093e\u0930\u094d\u0925', // Hindi: शामिल करने के लिए खाद्य पदार्थ
      'Th\u1ef1c Ph\u1ea9m N\u00ean Bao G\u1ed3m', // Vietnamese: Thực Phẩm Nên Bao Gồm
    ];
    const foodsLimitHeaders = [
      'Foods to Limit',
      'Aliments à Limiter', // French
      'Alimentos a Limitar', // Spanish
      '\u0645\u062d\u062f\u0648\u062f\u0648\u0644\u0648\u0020\u062e\u0648\u0631\u0627\u06a9', // Pashto: محدودولو خوراک
      '\u0938\u0940\u092e\u093f\u0924\u0020\u0915\u0930\u0928\u0947\u0020\u0915\u0947\u0020\u0932\u093f\u090f\u0020\u0916\u093e\u0926\u094d\u092f\u0020\u092a\u0926\u093e\u0930\u094d\u0925', // Hindi: सीमित करने के लिए खाद्य पदार्थ
      'Th\u1ef1c Ph\u1ea9m N\u00ean H\u1ea1n Ch\u1ebf', // Vietnamese: Thực Phẩm Nên Hạn Chế
    ];
    const recommendedActivitiesHeaders = [
      'Recommended Activities',
      'Activités Recommandées', // French
      'Actividades Recomendadas', // Spanish
      '\u0633\u067e\u0627\u0631\u069a\u062a\u0646\u0644\u064a\u0020\u0641\u0639\u0627\u0644\u06cc\u062a\u0648\u0646\u0647', // Pashto: سپارښتنلي فعالیتونه
      '\u0905\u0928\u0941\u0936\u0902\u0938\u093f\u0924\u0020\u0917\u0924\u093f\u0935\u093f\u0927\u093f\u092f\u093e\u0901', // Hindi: अनुशंसित गतिविधियाँ
      'C\u00e1c Ho\u1ea1t \u0110\u1ed9ng \u0110\u01b0\u1ee3c Khuy\u1ebfn Ngh\u1ecb', // Vietnamese: Các Hoạt Động Được Khuyến Nghị
    ];
    const activitiesToAvoidHeaders = [
      'Activities to Avoid',
      'Activités à Éviter', // French
      'Actividades a Evitar', // Spanish
      '\u062f\u0020\u0645\u062e\u0646\u064a\u0648\u064a\u0020\u0641\u0639\u0627\u0644\u06cc\u062a\u0648\u0646\u0647', // Pashto: د مخنیوي فعالیتونه
      '\u092c\u091a\u0928\u0947\u0020\u0915\u0947\u0020\u0932\u093f\u090f\u0020\u0917\u0924\u093f\u0935\u093f\u0927\u093f\u092f\u093e\u0901', // Hindi: बचने के लिए गतिविधियाँ
      'C\u00e1c Ho\u1ea1t \u0110\u1ed9ng C\u1ea7n Tr\u00e1nh', // Vietnamese: Các Hoạt Động Cần Tránh
    ];

    // Create regex patterns
    const foodsIncludePattern = foodsIncludeHeaders.map(h => h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    const foodsLimitPattern = foodsLimitHeaders.map(h => h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    const recommendedActivitiesPattern = recommendedActivitiesHeaders.map(h => h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    const activitiesToAvoidPattern = activitiesToAvoidHeaders.map(h => h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');

    // Extract Foods to Include
    const foodsIncludeMatch = content.match(new RegExp(`\\*\\*(?:${foodsIncludePattern})\\*\\*\\s*\\n([\\s\\S]*?)(?=\\*\\*(?:${foodsLimitPattern}|${recommendedActivitiesPattern}|${activitiesToAvoidPattern})\\*\\*|$)`, 'i'));
    if (foodsIncludeMatch) {
      result.foodsToInclude = parseBulletList(foodsIncludeMatch[1]);
    }

    // Extract Foods to Limit
    const foodsLimitMatch = content.match(new RegExp(`\\*\\*(?:${foodsLimitPattern})\\*\\*\\s*\\n([\\s\\S]*?)(?=\\*\\*(?:${recommendedActivitiesPattern}|${activitiesToAvoidPattern})\\*\\*|$)`, 'i'));
    if (foodsLimitMatch) {
      result.foodsToLimit = parseBulletList(foodsLimitMatch[1]);
    }

    // Extract Recommended Activities
    const recommendedMatch = content.match(new RegExp(`\\*\\*(?:${recommendedActivitiesPattern})\\*\\*\\s*\\n([\\s\\S]*?)(?=\\*\\*(?:${activitiesToAvoidPattern})\\*\\*|$)`, 'i'));
    if (recommendedMatch) {
      result.recommendedActivities = parseBulletList(recommendedMatch[1]);
    }

    // Extract Activities to Avoid
    const avoidMatch = content.match(new RegExp(`\\*\\*(?:${activitiesToAvoidPattern})\\*\\*\\s*\\n([\\s\\S]*?)$`, 'i'));
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
    // Multilingual subsection headers
    const call911Headers = [
      'When to Seek Help - Call 911',
      'When to Seek Help – Call 911',
      'Quand Chercher de l\'Aide - Appelez le 911', // French
      'Cuándo Buscar Ayuda - Llame al 911', // Spanish
      '\u06a9\u0644\u0647\u0020\u0686\u06d0\u0020\u0645\u0631\u0633\u062a\u0647\u0020\u0648\u063a\u0648\u0627\u0693\u0626\u0020-\u0020\u06f9\u06f1\u06f1\u0020\u062a\u0647\u0020\u0632\u0646\u06ab\u0020\u0648\u0648\u0647\u0644', // Pashto
      '\u0915\u092c\u0020\u092e\u0926\u0926\u0020\u0932\u0947\u0902\u0020-\u0020\u0967\u0967\u096d\u0020\u092a\u0930\u0020\u0915\u0949\u0932\u0020\u0915\u0930\u0947\u0902', // Hindi: कब मदद लें - ११९ पर कॉल करें
      'Khi N\u00e0o C\u1ea7n T\u00ecm Ki\u1ebfm Tr\u1ee3 Gi\u00fap - G\u1ecdi 911', // Vietnamese
    ];
    const callDoctorHeaders = [
      'When to Call Your Doctor',
      'Quand Appeler Votre Médecin', // French
      'Cuándo Llamar a Su Médico', // Spanish
      '\u06a9\u0644\u0647\u0020\u0686\u06d0\u0020\u062e\u067e\u0644\u0020\u0689\u0627\u06a9\u067c\u0631\u0020\u062a\u0647\u0020\u0632\u0646\u06ab\u0020\u0648\u0648\u0647\u0644', // Pashto
      '\u0905\u092a\u0928\u0947\u0020\u0921\u0949\u0915\u094d\u091f\u0930\u0020\u0915\u094b\u0020\u0915\u092c\u0020\u0915\u0949\u0932\u0020\u0915\u0930\u0947\u0902', // Hindi: अपने डॉक्टर को कब कॉल करें
      'Khi N\u00e0o G\u1ecdi B\u00e1c S\u0129 C\u1ee7a B\u1ea1n', // Vietnamese
    ];
    const emergencyContactsHeaders = [
      'Emergency Contacts',
      'Contacts d\'Urgence', // French
      'Contactos de Emergencia', // Spanish
      '\u0628\u064a\u0691\u0646\u064a\u0648\u0020\u0627\u0631\u062a\u0628\u0627\u0637\u0648\u0646\u0647', // Pashto
      '\u0906\u092a\u093e\u0924\u0915\u093e\u0932\u0940\u0928\u0020\u0938\u0902\u092a\u0930\u094d\u0915', // Hindi: आपातकालीन संपर्क
      'Li\u00ean H\u1ec7 Kh\u1ea9n C\u1ea5p', // Vietnamese
    ];

    // Create regex patterns
    const call911Pattern = call911Headers.map(h => h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    const callDoctorPattern = callDoctorHeaders.map(h => h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    const emergencyContactsPattern = emergencyContactsHeaders.map(h => h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');

    // Extract Call 911
    const call911Match = content.match(new RegExp(`\\*\\*(?:${call911Pattern})\\*\\*\\s*\\n([\\s\\S]*?)(?=\\*\\*(?:${callDoctorPattern}|${emergencyContactsPattern})\\*\\*|$)`, 'i'));
    if (call911Match) {
      result.call911 = parseBulletList(call911Match[1]);
    }

    // Extract Call Doctor
    const callDoctorMatch = content.match(new RegExp(`\\*\\*(?:${callDoctorPattern})\\*\\*\\s*\\n([\\s\\S]*?)(?=\\*\\*(?:${emergencyContactsPattern})\\*\\*|$)`, 'i'));
    if (callDoctorMatch) {
      result.callDoctor = parseBulletList(callDoctorMatch[1]);
    }

    // Extract Emergency Contacts
    const contactsMatch = content.match(new RegExp(`\\*\\*(?:${emergencyContactsPattern})\\*\\*\\s*\\n([\\s\\S]*?)$`, 'i'));
    if (contactsMatch) {
      result.emergencyContacts = parseBulletList(contactsMatch[1]);
    }
  } catch (error) {
    console.error('[SimplifiedDischargeParser] Failed to parse warning signs:', error);
  }

  return result;
}

