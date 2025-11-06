import { DischargeSummaryParser, ParsedDischargeSummary, ParserConfig } from './base-parser';

/**
 * STEMI Discharge Summary Parser
 * Optimized for the STEMI discharge summary format
 * Example: "Adult - STEMI DISCHARGE.pdf"
 */
export class STEMIDischargeSummaryParser extends DischargeSummaryParser {
  constructor(config: ParserConfig) {
    super({
      ...config,
      parserType: 'stemi',
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
      // Parse header information
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

      // Parse pertinent results
      result.labResults = this.parseLabResults(text);
      result.vitalSigns = this.parseVitalSigns(text);

      // Parse condition at discharge
      result.conditionAtDischarge = this.parseConditionAtDischarge(text);

      // Parse medications
      result.medications = this.parseMedications(text);

      // Parse follow-up
      result.followUpAppointments = this.parseFollowUpAppointments(text);

      // Parse diet and activity
      result.dietInstructions = this.parseDietInstructions(text);
      result.activityRestrictions = this.parseActivityRestrictions(text);

      // Parse patient instructions
      result.patientInstructions = this.parsePatientInstructions(text);

      // Parse return precautions
      result.returnPrecautions = this.parseReturnPrecautions(text);

      // Calculate confidence
      result.confidence = this.calculateConfidence(result);
    } catch (error) {
      result.warnings?.push(`Parsing error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      result.confidence = 0.5;
    }

    return result;
  }

  private parsePatientName(text: string): string | undefined {
    const match = text.match(/Patient\s+Name:\s*([^\n]+)/i);
    if (match && match[1]) {
      const name = match[1].trim();
      return name !== '[Redacted]' ? name : undefined;
    }
    return undefined;
  }

  private parseMRN(text: string): string | undefined {
    const match = text.match(/MRN:\s*([^\n]+)/i);
    if (match && match[1]) {
      const mrn = match[1].trim();
      return mrn !== '[Redacted]' ? mrn : undefined;
    }
    return undefined;
  }

  private parseDOB(text: string): string | undefined {
    const match = text.match(/DOB:\s*([^\n]+)/i);
    if (match && match[1]) {
      const dob = match[1].trim();
      return dob !== '[Redacted]' ? dob : undefined;
    }
    return undefined;
  }

  private parseAdmitDate(text: string): string | undefined {
    const match = text.match(/Admit\s+Date:\s*(\d{2}\/\d{2}\/\d{4})/i);
    return match ? match[1].trim() : undefined;
  }

  private parseDischargeDate(text: string): string | undefined {
    const match = text.match(/Discharge\s+Date:\s*(\d{2}\/\d{2}\/\d{4})/i);
    return match ? match[1].trim() : undefined;
  }

  private parseAttendingPhysician(text: string): { name: string; id?: string } | undefined {
    const match = text.match(/Attending\s+Physician:\s*([^\n]+)/i);
    if (match && match[1]) {
      const name = match[1].trim();
      return name !== '[Redacted], MD' ? { name } : undefined;
    }
    return undefined;
  }

  private parseService(text: string): string | undefined {
    const match = text.match(/Service:\s*([^\n]+)/i);
    return match ? match[1].trim() : undefined;
  }

  private parseAdmittingDiagnosis(text: string): string[] | undefined {
    const section = this.extractSection(
      text,
      /Admitting\s+Diagnosis\s*\(ICD-10\):/i,
      [/Discharge\s+Diagnosis:/i]
    );

    if (!section) return undefined;

    const diagnoses: string[] = [];
    const lines = section.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === 'Admitting Diagnosis (ICD-10):') continue;

      // Remove bullet points and ICD codes
      const cleaned = trimmed
        .replace(/^[●•]\s*/, '')
        .replace(/\([A-Z]\d+\.?\d*\)\s*$/, '')
        .trim();

      if (cleaned) diagnoses.push(cleaned);
    }

    return diagnoses.length > 0 ? diagnoses : undefined;
  }

  private parseDischargeDiagnosis(text: string): string[] | undefined {
    const section = this.extractSection(
      text,
      /Discharge\s+Diagnosis:/i,
      [/Hospital\s+Course:/i]
    );

    if (!section) return undefined;

    const diagnoses: string[] = [];
    const lines = section.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === 'Discharge Diagnosis:') continue;

      // Remove bullet points
      const cleaned = trimmed.replace(/^[●•]\s*/, '').trim();

      if (cleaned) diagnoses.push(cleaned);
    }

    return diagnoses.length > 0 ? diagnoses : undefined;
  }

  private parseHospitalCourse(text: string): string | undefined {
    const section = this.extractSection(
      text,
      /Hospital\s+Course:/i,
      [/Pertinent\s+Results:/i]
    );

    return section;
  }

  private parseLabResults(text: string): ParsedDischargeSummary['labResults'] | undefined {
    const section = this.extractSection(
      text,
      /Pertinent\s+Results:/i,
      [/EKG:/i, /Echo:/i, /Condition\s+at\s+Discharge:/i]
    );

    if (!section) return undefined;

    const results: ParsedDischargeSummary['labResults'] = [];

    // Parse patterns like "Admission troponin I: 12.3 ng/mL → peak 28.0 → 5.2 at discharge"
    const troponinMatch = section.match(/troponin\s+I:\s*([\d.]+)\s*ng\/mL\s*→\s*peak\s*([\d.]+)\s*→\s*([\d.]+)/i);
    if (troponinMatch) {
      results.push({
        name: 'Troponin I (admission)',
        value: troponinMatch[1],
        unit: 'ng/mL',
      });
      results.push({
        name: 'Troponin I (peak)',
        value: troponinMatch[2],
        unit: 'ng/mL',
      });
      results.push({
        name: 'Troponin I (discharge)',
        value: troponinMatch[3],
        unit: 'ng/mL',
      });
    }

    // Parse CBC
    const hbMatch = section.match(/Hb\s*([\d.]+)/i);
    if (hbMatch) results.push({ name: 'Hemoglobin', value: hbMatch[1], unit: 'g/dL' });

    const pltMatch = section.match(/Plt\s*(\d+)/i);
    if (pltMatch) results.push({ name: 'Platelets', value: pltMatch[1], unit: 'K/µL' });

    // Parse BMP
    const naMatch = section.match(/Na\s*(\d+)/i);
    if (naMatch) results.push({ name: 'Sodium', value: naMatch[1], unit: 'mEq/L' });

    const kMatch = section.match(/K\s*([\d.]+)/i);
    if (kMatch) results.push({ name: 'Potassium', value: kMatch[1], unit: 'mEq/L' });

    const crMatch = section.match(/Cr\s*([\d.]+)/i);
    if (crMatch) results.push({ name: 'Creatinine', value: crMatch[1], unit: 'mg/dL' });

    // Parse Lipid Panel
    const ldlMatch = section.match(/LDL\s*(\d+)/i);
    if (ldlMatch) results.push({ name: 'LDL', value: ldlMatch[1], unit: 'mg/dL' });

    const hdlMatch = section.match(/HDL\s*(\d+)/i);
    if (hdlMatch) results.push({ name: 'HDL', value: hdlMatch[1], unit: 'mg/dL' });

    const tgMatch = section.match(/TG\s*(\d+)/i);
    if (tgMatch) results.push({ name: 'Triglycerides', value: tgMatch[1], unit: 'mg/dL' });

    // Parse HbA1c
    const a1cMatch = section.match(/HbA1c:\s*([\d.]+)%/i);
    if (a1cMatch) results.push({ name: 'HbA1c', value: a1cMatch[1], unit: '%' });

    return results.length > 0 ? results : undefined;
  }

  private parseVitalSigns(text: string): ParsedDischargeSummary['vitalSigns'] | undefined {
    const section = this.extractSection(
      text,
      /Condition\s+at\s+Discharge:/i,
      [/Discharge\s+Medications:/i]
    );

    if (!section) return undefined;

    const vitals: ParsedDischargeSummary['vitalSigns'] = {};

    // Parse vitals from "Vitals: T 98.2°F, HR 76, RR 18, BP 122/70, SpO₂ 97% RA"
    const tempMatch = section.match(/T\s*([\d.]+)°F/i);
    if (tempMatch) vitals.temperature = `${tempMatch[1]}°F`;

    const hrMatch = section.match(/HR\s*(\d+)/i);
    if (hrMatch) vitals.heartRate = hrMatch[1];

    const rrMatch = section.match(/RR\s*(\d+)/i);
    if (rrMatch) vitals.respiratoryRate = rrMatch[1];

    const bpMatch = section.match(/BP\s*(\d+\/\d+)/i);
    if (bpMatch) vitals.bloodPressure = bpMatch[1];

    const o2Match = section.match(/SpO[₂2]\s*(\d+)%/i);
    if (o2Match) vitals.oxygenSaturation = `${o2Match[1]}%`;

    return Object.keys(vitals).length > 0 ? vitals : undefined;
  }

  private parseConditionAtDischarge(text: string): string | undefined {
    const section = this.extractSection(
      text,
      /Condition\s+at\s+Discharge:/i,
      [/Discharge\s+Medications:/i]
    );

    return section;
  }

  private parseMedications(text: string): ParsedDischargeSummary['medications'] | undefined {
    const medications: ParsedDischargeSummary['medications'] = [];

    // Parse "New:" section
    const newSection = this.extractSection(
      text,
      /Discharge\s+Medications:\s*New:/i,
      [/Continued:/i, /Stopped:/i]
    );

    if (newSection) {
      const lines = newSection.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === 'New:') continue;

        const med = this.parseMedicationLine(trimmed);
        if (med) {
          med.isNew = true;
          medications.push(med);
        }
      }
    }

    // Parse "Stopped:" section
    const stoppedSection = this.extractSection(
      text,
      /Stopped:/i,
      [/Follow-Up\s+Appointments:/i]
    );

    if (stoppedSection) {
      const lines = stoppedSection.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === 'Stopped:') continue;

        const med = this.parseMedicationLine(trimmed);
        if (med) {
          med.isStopped = true;
          medications.push(med);
        }
      }
    }

    return medications.length > 0 ? medications : undefined;
  }

  private parseMedicationLine(line: string): ParsedDischargeSummary['medications'][0] | null {
    // Remove bullet points
    const cleaned = line.replace(/^[●•]\s*/, '').trim();

    // Pattern: "Aspirin 81 mg PO daily (indefinitely)"
    // Pattern: "Metoprolol succinate 50 mg PO daily"
    const match = cleaned.match(/^([A-Za-z\s]+?)\s+(\d+\s*mg)\s+(PO|IV|SQ)\s+(.+?)(?:\s*\(([^)]+)\))?$/i);

    if (match) {
      return {
        name: match[1].trim(),
        dose: match[2].trim(),
        frequency: match[4].trim(),
        instructions: cleaned,
      };
    }

    // Fallback: treat entire line as medication
    const parts = cleaned.split(/\s+/);
    if (parts.length >= 2) {
      return {
        name: parts[0],
        dose: parts[1],
        frequency: parts.slice(2).join(' ') || 'as directed',
        instructions: cleaned,
      };
    }

    return null;
  }

  private parseFollowUpAppointments(text: string): ParsedDischargeSummary['followUpAppointments'] | undefined {
    const section = this.extractSection(
      text,
      /Follow-Up\s+Appointments:/i,
      [/Diet\s+and\s+Lifestyle/i]
    );

    if (!section) return undefined;

    const appointments: ParsedDischargeSummary['followUpAppointments'] = [];
    const lines = section.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === 'Follow-Up Appointments:') continue;

      // Remove bullet points
      const cleaned = trimmed.replace(/^[●•]\s*/, '').trim();

      // Pattern: "Cardiology clinic in 1 week for post-MI follow-up and med titration"
      const match = cleaned.match(/^([A-Za-z\s]+?)\s+in\s+([\d\-]+\s+\w+)\s+(?:for\s+)?(.*)$/i);

      if (match) {
        appointments.push({
          provider: match[1].trim(),
          timeframe: match[2].trim(),
          notes: match[3].trim() || cleaned,
        });
      } else {
        // Fallback
        appointments.push({
          provider: 'Unknown',
          timeframe: cleaned,
        });
      }
    }

    return appointments.length > 0 ? appointments : undefined;
  }

  private parseDietInstructions(text: string): string | undefined {
    const section = this.extractSection(
      text,
      /Diet\s+and\s+Lifestyle\s+Instructions:/i,
      [/Patient\s+Instructions/i]
    );

    return section;
  }

  private parseActivityRestrictions(text: string): string | undefined {
    const dietSection = this.parseDietInstructions(text);
    if (!dietSection) return undefined;

    // Extract activity-related lines
    const lines = dietSection.split('\n');
    const activityLines = lines.filter(line => {
      const lower = line.toLowerCase();
      return lower.includes('lifting') ||
             lower.includes('activity') ||
             lower.includes('walking') ||
             lower.includes('exercise');
    });

    return activityLines.length > 0 ? activityLines.join('\n') : undefined;
  }

  private parsePatientInstructions(text: string): string | undefined {
    return this.extractSection(
      text,
      /Patient\s+Instructions\s*\(Clinical\s+Style\):/i,
      [/Return\s+Precautions:/i]
    );
  }

  private parseReturnPrecautions(text: string): string[] | undefined {
    const section = this.extractSection(
      text,
      /Return\s+Precautions:/i,
      []
    );

    if (!section) return undefined;

    const precautions: string[] = [];
    const lines = section.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('Return to ED') || trimmed === 'Return Precautions:') continue;

      // Remove bullet points
      const cleaned = trimmed.replace(/^[●•]\s*/, '').trim();

      if (cleaned) precautions.push(cleaned);
    }

    return precautions.length > 0 ? precautions : undefined;
  }

  private calculateConfidence(result: ParsedDischargeSummary): number {
    let score = 0;
    let totalFields = 0;

    // Critical fields (worth 1 point each)
    const criticalFields = [
      result.mrn,
      result.dischargeDate,
      result.dischargeDiagnosis,
      result.medications,
    ];

    for (const field of criticalFields) {
      totalFields++;
      if (field) score++;
    }

    // Important fields (worth 0.5 points each)
    const importantFields = [
      result.patientName,
      result.attendingPhysician,
      result.hospitalCourse,
      result.followUpAppointments,
      result.labResults,
      result.vitalSigns,
    ];

    for (const field of importantFields) {
      totalFields += 0.5;
      if (field) score += 0.5;
    }

    return totalFields > 0 ? Math.min(score / totalFields, 1.0) : 0;
  }
}
