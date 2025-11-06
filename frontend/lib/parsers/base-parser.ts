/**
 * Base interface for discharge summary parsers
 * Each tenant can implement their own parser based on their document format
 */

export interface ParsedDischargeSummary {
  // Patient Information
  patientName?: string;
  mrn?: string;
  dob?: string;
  admitDate?: string;
  dischargeDate?: string;
  attendingPhysician?: {
    name: string;
    id?: string;
  };
  service?: string;
  unit?: string;
  room?: string;

  // Clinical Information
  admittingDiagnosis?: string[];
  dischargeDiagnosis?: string[];
  hospitalCourse?: string;
  procedures?: string[];

  // Results
  labResults?: {
    name: string;
    value: string;
    unit?: string;
    date?: string;
  }[];
  imagingResults?: string[];
  vitalSigns?: {
    temperature?: string;
    heartRate?: string;
    bloodPressure?: string;
    respiratoryRate?: string;
    oxygenSaturation?: string;
  };

  // Discharge Information
  conditionAtDischarge?: string;
  medications?: {
    name: string;
    dose: string;
    frequency: string;
    instructions?: string;
    isNew?: boolean;
    isStopped?: boolean;
  }[];
  followUpAppointments?: {
    provider: string;
    specialty?: string;
    timeframe: string;
    notes?: string;
  }[];
  dietInstructions?: string;
  activityRestrictions?: string;
  patientInstructions?: string;
  returnPrecautions?: string[];

  // Metadata
  rawText?: string;
  confidence?: number; // 0-1 score indicating parsing confidence
  warnings?: string[]; // Any warnings during parsing
  parserVersion?: string;
}

export interface ParserConfig {
  tenantId: string;
  parserType: string;
  version: string;
  settings?: Record<string, any>;
}

export abstract class DischargeSummaryParser {
  protected config: ParserConfig;

  constructor(config: ParserConfig) {
    this.config = config;
  }

  /**
   * Main parsing method - must be implemented by subclasses
   * @param file - The file to parse
   * @param fileType - MIME type of the file
   * @returns Parsed discharge summary data
   */
  abstract parse(file: Buffer, fileType: string): Promise<ParsedDischargeSummary>;

  /**
   * Validate the parsed data
   * @param data - Parsed discharge summary
   * @returns Validation result with errors if any
   */
  validate(data: ParsedDischargeSummary): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Basic validation - can be overridden by subclasses
    if (!data.patientName && !data.mrn) {
      errors.push('Either patient name or MRN must be present');
    }

    if (!data.dischargeDate && !data.admitDate) {
      errors.push('Either discharge date or admit date must be present');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get parser information
   */
  getInfo(): ParserConfig {
    return this.config;
  }

  /**
   * Extract text from PDF
   * @param buffer - PDF file buffer
   * @returns Extracted text
   */
  protected async extractTextFromPDF(buffer: Buffer): Promise<string> {
    // This will be implemented using a PDF parsing library
    // For now, return a placeholder
    return buffer.toString('utf-8');
  }

  /**
   * Extract text from Word document
   * @param buffer - Word document buffer
   * @returns Extracted text
   */
  protected async extractTextFromWord(buffer: Buffer): Promise<string> {
    // This will be implemented using a Word parsing library
    // For now, return a placeholder
    return buffer.toString('utf-8');
  }

  /**
   * Clean and normalize text
   * @param text - Raw text
   * @returns Cleaned text
   */
  protected cleanText(text: string): string {
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  /**
   * Extract section by header
   * @param text - Full text
   * @param header - Section header to find
   * @param nextHeaders - Headers that indicate end of section
   * @returns Section text or null
   */
  protected extractSection(
    text: string,
    header: string | RegExp,
    nextHeaders?: (string | RegExp)[]
  ): string | null {
    const headerRegex = typeof header === 'string'
      ? new RegExp(`${header}\\s*:?\\s*`, 'i')
      : header;

    const match = text.match(headerRegex);
    if (!match) return null;

    let startIndex = match.index! + match[0].length;
    let endIndex = text.length;

    // Find the next section header
    if (nextHeaders && nextHeaders.length > 0) {
      for (const nextHeader of nextHeaders) {
        const nextRegex = typeof nextHeader === 'string'
          ? new RegExp(`\\n${nextHeader}\\s*:?\\s*`, 'i')
          : nextHeader;

        const nextMatch = text.slice(startIndex).match(nextRegex);
        if (nextMatch && nextMatch.index !== undefined) {
          const potentialEnd = startIndex + nextMatch.index;
          if (potentialEnd < endIndex) {
            endIndex = potentialEnd;
          }
        }
      }
    }

    return text.slice(startIndex, endIndex).trim();
  }

  /**
   * Parse a list of items
   * @param text - Text containing list
   * @param bulletPoints - Array of bullet point characters/patterns
   * @returns Array of list items
   */
  protected parseList(text: string, bulletPoints: string[] = ['•', '-', '*', '●']): string[] {
    const items: string[] = [];
    const lines = text.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Check if line starts with any bullet point
      const startsWithBullet = bulletPoints.some(bullet => trimmed.startsWith(bullet));

      if (startsWithBullet) {
        // Remove bullet point and add to items
        const cleaned = trimmed.replace(/^[•\-*●]\s*/, '').trim();
        if (cleaned) items.push(cleaned);
      } else {
        // Add as item if it looks like a list item (e.g., "1.", "a)", etc.)
        if (/^\d+\.|\w+\)/.test(trimmed)) {
          const cleaned = trimmed.replace(/^\d+\.|\w+\)\s*/, '').trim();
          if (cleaned) items.push(cleaned);
        }
      }
    }

    return items;
  }
}
