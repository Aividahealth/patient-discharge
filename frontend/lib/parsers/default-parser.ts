import { DischargeSummaryParser, ParsedDischargeSummary, ParserConfig } from './base-parser';

/**
 * Default parser for standard discharge summary format
 * Handles common hospital discharge summary formats
 */
export class DefaultDischargeSummaryParser extends DischargeSummaryParser {
  constructor(config: ParserConfig) {
    super({
      ...config,
      parserType: 'default',
      version: '1.0.0',
    });
  }

  async parse(file: Buffer, fileType: string): Promise<ParsedDischargeSummary> {
    let text: string;

    // Extract text based on file type
    if (fileType === 'application/pdf') {
      text = await this.extractTextFromPDF(file);
    } else if (
      fileType === 'application/msword' ||
      fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ) {
      text = await this.extractTextFromWord(file);
    } else if (fileType === 'text/plain') {
      text = file.toString('utf-8');
    } else {
      throw new Error(`Unsupported file type: ${fileType}`);
    }

    text = this.cleanText(text);

    const result: ParsedDischargeSummary = {
      rawText: text,
      warnings: [],
      parserVersion: this.config.version,
    };

    try {
      // Parse patient information
      result.patientName = this.parsePatientName(text);
      result.mrn = this.parseMRN(text);
      result.dob = this.parseDOB(text);
      result.admitDate = this.parseAdmitDate(text);
      result.dischargeDate = this.parseDischargeDate(text);
      result.attendingPhysician = this.parseAttendingPhysician(text);
      result.service = this.parseService(text);

      // Parse diagnoses
      result.admittingDiagnosis = this.parseAdmittingDiagnosis(text);
      result.dischargeDiagnosis = this.parseDischargeDiagnosis(text);

      // Parse hospital course
      result.hospitalCourse = this.parseHospitalCourse(text);

      // Parse results
      result.labResults = this.parseLabResults(text);
      result.vitalSigns = this.parseVitalSigns(text);

      // Parse condition at discharge
      result.conditionAtDischarge = this.parseConditionAtDischarge(text);

      // Parse medications
      result.medications = this.parseMedications(text);

      // Parse follow-up appointments
      result.followUpAppointments = this.parseFollowUpAppointments(text);

      // Parse diet and activity
      result.dietInstructions = this.parseDietInstructions(text);
      result.activityRestrictions = this.parseActivityRestrictions(text);

      // Parse patient instructions
      result.patientInstructions = this.parsePatientInstructions(text);

      // Parse return precautions
      result.returnPrecautions = this.parseReturnPrecautions(text);

      // Calculate confidence score
      result.confidence = this.calculateConfidence(result);
    } catch (error) {
      result.warnings?.push(`Parsing error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      result.confidence = 0.5;
    }

    return result;
  }

  private parsePatientName(text: string): string | undefined {
    const patterns = [
      /Patient\s+Name:\s*([^\n]+)/i,
      /Name:\s*([^\n]+)/i,
      /Patient:\s*([^\n]+)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return match[1].trim().replace(/\[Redacted\]/i, '');
      }
    }

    return undefined;
  }

  private parseMRN(text: string): string | undefined {
    const patterns = [
      /MRN:\s*([^\n]+)/i,
      /Medical\s+Record\s+Number:\s*([^\n]+)/i,
      /MR#:\s*([^\n]+)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return match[1].trim().replace(/\[Redacted\]/i, '');
      }
    }

    return undefined;
  }

  private parseDOB(text: string): string | undefined {
    const patterns = [
      /DOB:\s*([^\n]+)/i,
      /Date\s+of\s+Birth:\s*([^\n]+)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return match[1].trim().replace(/\[Redacted\]/i, '');
      }
    }

    return undefined;
  }

  private parseAdmitDate(text: string): string | undefined {
    const patterns = [
      /Admit\s+Date:\s*(\d{1,2}\/\d{1,2}\/\d{4})/i,
      /Admission\s+Date:\s*(\d{1,2}\/\d{1,2}\/\d{4})/i,
      /Date\s+of\s+Admission:\s*(\d{1,2}\/\d{1,2}\/\d{4})/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return undefined;
  }

  private parseDischargeDate(text: string): string | undefined {
    const patterns = [
      /Discharge\s+Date:\s*(\d{1,2}\/\d{1,2}\/\d{4})/i,
      /Date\s+of\s+Discharge:\s*(\d{1,2}\/\d{1,2}\/\d{4})/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return undefined;
  }

  private parseAttendingPhysician(text: string): { name: string; id?: string } | undefined {
    const patterns = [
      /Attending\s+Physician:\s*([^\n]+)/i,
      /Attending:\s*([^\n]+)/i,
      /Physician:\s*([^\n]+)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const name = match[1].trim().replace(/\[Redacted\]/i, '');
        return { name };
      }
    }

    return undefined;
  }

  private parseService(text: string): string | undefined {
    const patterns = [
      /Service:\s*([^\n]+)/i,
      /Department:\s*([^\n]+)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return undefined;
  }

  private parseAdmittingDiagnosis(text: string): string[] | undefined {
    const section = this.extractSection(
      text,
      /Admitting\s+Diagnosis/i,
      [/Discharge\s+Diagnosis/i, /Hospital\s+Course/i, /Pertinent\s+Results/i]
    );

    if (!section) return undefined;

    const items = this.parseList(section);
    if (items.length > 0) return items;

    // If no bullet points, try to split by ICD codes
    const icdPattern = /\([A-Z]\d+\.?\d*\)/g;
    const parts = section.split(icdPattern);
    return parts
      .map(p => p.trim())
      .filter(p => p.length > 0)
      .slice(0, -1); // Remove last empty part
  }

  private parseDischargeDiagnosis(text: string): string[] | undefined {
    const section = this.extractSection(
      text,
      /Discharge\s+Diagnosis/i,
      [/Hospital\s+Course/i, /Pertinent\s+Results/i, /Condition\s+at\s+Discharge/i]
    );

    if (!section) return undefined;

    const items = this.parseList(section);
    if (items.length > 0) return items;

    // If no bullet points, return as single item
    return [section];
  }

  private parseHospitalCourse(text: string): string | undefined {
    return this.extractSection(
      text,
      /Hospital\s+Course/i,
      [/Pertinent\s+Results/i, /Condition\s+at\s+Discharge/i, /Discharge\s+Medications/i]
    );
  }

  private parseLabResults(text: string): Array<{ name: string; value: string; unit?: string }> | undefined {
    const section = this.extractSection(
      text,
      /Pertinent\s+Results/i,
      [/EKG/i, /Echo/i, /Condition\s+at\s+Discharge/i]
    );

    if (!section) return undefined;

    const results: Array<{ name: string; value: string; unit?: string }> = [];

    // Parse lab values like "troponin I: 12.3 ng/mL"
    const labPattern = /([A-Za-z0-9\s]+):\s*([\d.]+)\s*([A-Za-z/%]+)?/g;
    let match;

    while ((match = labPattern.exec(section)) !== null) {
      results.push({
        name: match[1].trim(),
        value: match[2].trim(),
        unit: match[3]?.trim(),
      });
    }

    return results.length > 0 ? results : undefined;
  }

  private parseVitalSigns(text: string): ParsedDischargeSummary['vitalSigns'] | undefined {
    const section = this.extractSection(
      text,
      /Vitals/i,
      [/Exam/i, /Assessment/i]
    );

    if (!section) return undefined;

    const vitals: ParsedDischargeSummary['vitalSigns'] = {};

    // Temperature
    const tempMatch = section.match(/T[:\s]*(\d+\.?\d*)\s*°?F/i);
    if (tempMatch) vitals.temperature = `${tempMatch[1]}°F`;

    // Heart Rate
    const hrMatch = section.match(/HR[:\s]*(\d+)/i);
    if (hrMatch) vitals.heartRate = hrMatch[1];

    // Blood Pressure
    const bpMatch = section.match(/BP[:\s]*(\d+\/\d+)/i);
    if (bpMatch) vitals.bloodPressure = bpMatch[1];

    // Respiratory Rate
    const rrMatch = section.match(/RR[:\s]*(\d+)/i);
    if (rrMatch) vitals.respiratoryRate = rrMatch[1];

    // Oxygen Saturation
    const o2Match = section.match(/SpO[₂2][:\s]*(\d+)%?/i);
    if (o2Match) vitals.oxygenSaturation = `${o2Match[1]}%`;

    return Object.keys(vitals).length > 0 ? vitals : undefined;
  }

  private parseConditionAtDischarge(text: string): string | undefined {
    return this.extractSection(
      text,
      /Condition\s+at\s+Discharge/i,
      [/Discharge\s+Medications/i, /Follow-?Up/i]
    );
  }

  private parseMedications(text: string): ParsedDischargeSummary['medications'] | undefined {
    const newSection = this.extractSection(
      text,
      /Discharge\s+Medications|New:/i,
      [/Continued/i, /Stopped/i, /Follow-?Up/i, /Diet/i]
    );

    const continuedSection = this.extractSection(
      text,
      /Continued/i,
      [/Stopped/i, /Follow-?Up/i]
    );

    const stoppedSection = this.extractSection(
      text,
      /Stopped/i,
      [/Follow-?Up/i, /Diet/i]
    );

    const medications: ParsedDischargeSummary['medications'] = [];

    // Parse new medications
    if (newSection) {
      const items = this.parseList(newSection);
      for (const item of items) {
        const med = this.parseMedicationLine(item);
        if (med) {
          med.isNew = true;
          medications.push(med);
        }
      }
    }

    // Parse continued medications
    if (continuedSection) {
      const items = this.parseList(continuedSection);
      for (const item of items) {
        const med = this.parseMedicationLine(item);
        if (med) medications.push(med);
      }
    }

    // Parse stopped medications
    if (stoppedSection) {
      const items = this.parseList(stoppedSection);
      for (const item of items) {
        const med = this.parseMedicationLine(item);
        if (med) {
          med.isStopped = true;
          medications.push(med);
        }
      }
    }

    return medications.length > 0 ? medications : undefined;
  }

  private parseMedicationLine(line: string): ParsedDischargeSummary['medications'][0] | null {
    // Pattern: "Metoprolol 25mg PO BID"
    const match = line.match(/^([A-Za-z\s]+)\s+(\d+\s*mg|mg)\s+(PO|IV|SQ|IM)?\s*(.+)?$/i);

    if (match) {
      return {
        name: match[1].trim(),
        dose: match[2].trim(),
        frequency: match[4] ? match[4].trim() : 'as directed',
        instructions: line,
      };
    }

    // Fallback: treat entire line as medication
    const parts = line.split(/\s+/);
    if (parts.length >= 2) {
      return {
        name: parts[0],
        dose: parts[1],
        frequency: parts.slice(2).join(' ') || 'as directed',
        instructions: line,
      };
    }

    return null;
  }

  private parseFollowUpAppointments(text: string): ParsedDischargeSummary['followUpAppointments'] | undefined {
    const section = this.extractSection(
      text,
      /Follow-?Up\s+Appointments?/i,
      [/Diet/i, /Activity/i, /Patient\s+Instructions/i]
    );

    if (!section) return undefined;

    const appointments: ParsedDischargeSummary['followUpAppointments'] = [];
    const items = this.parseList(section);

    for (const item of items) {
      // Pattern: "Cardiology clinic in 1 week"
      const match = item.match(/([A-Za-z\s]+)\s+(?:in|within)\s+([^\n]+)/i);
      if (match) {
        appointments.push({
          provider: match[1].trim(),
          timeframe: match[2].trim(),
          notes: item,
        });
      } else {
        appointments.push({
          provider: 'Unknown',
          timeframe: item,
        });
      }
    }

    return appointments.length > 0 ? appointments : undefined;
  }

  private parseDietInstructions(text: string): string | undefined {
    return this.extractSection(
      text,
      /Diet\s+(?:and\s+)?(?:Lifestyle\s+)?Instructions?/i,
      [/Activity/i, /Patient\s+Instructions/i, /Return\s+Precautions/i]
    );
  }

  private parseActivityRestrictions(text: string): string | undefined {
    const section = this.extractSection(
      text,
      /Activity|Activity\s+Restrictions/i,
      [/Patient\s+Instructions/i, /Return\s+Precautions/i, /Diet/i]
    );

    return section;
  }

  private parsePatientInstructions(text: string): string | undefined {
    return this.extractSection(
      text,
      /Patient\s+Instructions/i,
      [/Return\s+Precautions/i]
    );
  }

  private parseReturnPrecautions(text: string): string[] | undefined {
    const section = this.extractSection(
      text,
      /Return\s+Precautions|Return\s+to\s+ED/i,
      []
    );

    if (!section) return undefined;

    return this.parseList(section);
  }

  private calculateConfidence(result: ParsedDischargeSummary): number {
    let score = 0;
    let totalFields = 0;

    // Required fields
    const requiredFields = [
      result.patientName,
      result.mrn,
      result.dischargeDate,
      result.dischargeDiagnosis,
    ];

    for (const field of requiredFields) {
      totalFields++;
      if (field) score++;
    }

    // Optional but important fields
    const importantFields = [
      result.medications,
      result.followUpAppointments,
      result.hospitalCourse,
      result.conditionAtDischarge,
    ];

    for (const field of importantFields) {
      totalFields++;
      if (field) score += 0.5;
    }

    return Math.min(score / totalFields, 1.0);
  }
}
