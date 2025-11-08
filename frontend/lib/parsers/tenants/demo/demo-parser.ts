/**
 * Demo Tenant Discharge Summary Parser (Frontend)
 *
 * This parser handles the standard discharge format used by the demo tenant.
 * It expects discharge summaries with the following sections:
 * - Admitting Diagnosis
 * - Discharge Diagnosis
 * - Hospital Course
 * - Pertinent Results
 * - Condition at Discharge
 *
 * All discharge summaries uploaded to the demo tenant (regardless of condition)
 * should follow this format and will be parsed by this parser.
 */

export interface ParsedDischargeSummary {
  admittingDiagnosis: string[];
  dischargeDiagnosis: string[];
  hospitalCourse: string[];
  pertinentResults: string[];
  conditionAtDischarge: string[];
}

export interface ParsedDischargeInstructions {
  dischargeMedications: {
    new: string[];
    continued: string[];
    stopped: string[];
  };
  followUpAppointments: string[];
  dietAndLifestyle: string[];
  patientInstructions: string[];
  returnPrecautions: string[];
}

export class DemoParser {
  /**
   * Detect if this parser can handle the given text
   * Checks for the standard demo tenant discharge summary structure
   */
  canParse(text: string): boolean {
    // Check for standard discharge sections that demo tenant uses
    // Use \s+ to handle multiple spaces that PDF extraction often adds
    const hasAdmittingDiagnosis = /Admitting\s+Diagnosis/i.test(text);
    const hasDischargeDiagnosis = /Discharge\s+Diagnosis/i.test(text);
    const hasHospitalCourse = /Hospital\s+Course/i.test(text);

    const canHandle = hasAdmittingDiagnosis && hasDischargeDiagnosis && hasHospitalCourse;

    console.log('🔍 [Demo Parser] Auto-Detection:');
    console.log(`   ✓ Admitting Diagnosis: ${hasAdmittingDiagnosis ? 'FOUND ✅' : 'MISSING ❌'}`);
    console.log(`   ✓ Discharge Diagnosis: ${hasDischargeDiagnosis ? 'FOUND ✅' : 'MISSING ❌'}`);
    console.log(`   ✓ Hospital Course: ${hasHospitalCourse ? 'FOUND ✅' : 'MISSING ❌'}`);

    if (canHandle) {
      console.log('   ✅ Demo parser CAN HANDLE this document');
    } else {
      console.log('   ❌ Demo parser CANNOT HANDLE this document');
      console.log(`   📋 Text preview (first 500 chars): ${text.substring(0, 500)}`);
    }

    return canHandle;
  }

  /**
   * Parse the raw discharge summary text into structured JSON
   */
  parseDischargeSummary(text: string): ParsedDischargeSummary {
    console.log('📝 [Demo Parser] Parsing discharge summary');

    // Clean up text - remove file path annotations that may be in the PDF
    let cleanText = text.replace(/\d{1,2}\/\d{1,2}\/\d{2,4},\s+\d{1,2}:\d{2}\s+[AP]M\s+.*?\.md\s+fi\s*le:\/\/\/.*?\.md\s+\d+\/\d+/g, '');

    // Unescape markdown characters (for .md files)
    cleanText = cleanText.replace(/\\([[\](){}*_+\->])/g, '$1');

    console.log(`   🧹 Cleaned text: removed ${text.length - cleanText.length} characters of file path annotations and unescaped markdown`);

    const result: ParsedDischargeSummary = {
      admittingDiagnosis: [],
      dischargeDiagnosis: [],
      hospitalCourse: [],
      pertinentResults: [],
      conditionAtDischarge: [],
    };

    try {
      // Extract Admitting Diagnosis section
      // Handle both plain and markdown formats (###, **), and multiple spaces from PDF extraction
      const admittingMatch = cleanText.match(/#{0,3}\s*\*{0,2}Admitting\s+Diagnosis[^:]*:?\*{0,2}(.*?)(?=#{0,3}\s*\*{0,2}Discharge\s+Diagnosis:|$)/is);
      if (admittingMatch) {
        result.admittingDiagnosis = this.extractBulletPoints(admittingMatch[1]);
        console.log(`   ✓ Admitting Diagnosis: ${result.admittingDiagnosis.length} items`);
      } else {
        console.log(`   ✗ Admitting Diagnosis: NOT FOUND`);
      }

      // Extract Discharge Diagnosis section
      const dischargeMatch = cleanText.match(/#{0,3}\s*\*{0,2}Discharge\s+Diagnosis:?\*{0,2}(.*?)(?=#{0,3}\s*\*{0,2}Hospital\s+Course:|$)/is);
      if (dischargeMatch) {
        result.dischargeDiagnosis = this.extractBulletPoints(dischargeMatch[1]);
        console.log(`   ✓ Discharge Diagnosis: ${result.dischargeDiagnosis.length} items`);
      } else {
        console.log(`   ✗ Discharge Diagnosis: NOT FOUND`);
      }

      // Extract Hospital Course section
      const hospitalCourseMatch = cleanText.match(/#{0,3}\s*\*{0,2}Hospital\s+Course:?\*{0,2}(.*?)(?=#{0,3}\s*\*{0,2}Pertinent\s+Results:|$)/is);
      if (hospitalCourseMatch) {
        result.hospitalCourse = this.extractBulletPoints(hospitalCourseMatch[1]);
        console.log(`   ✓ Hospital Course: ${result.hospitalCourse.length} items`);
      } else {
        console.log(`   ✗ Hospital Course: NOT FOUND`);
      }

      // Extract Pertinent Results section
      const resultsMatch = cleanText.match(/#{0,3}\s*\*{0,2}Pertinent\s+Results:?\*{0,2}(.*?)(?=#{0,3}\s*\*{0,2}Condition\s+at\s+Discharge:|$)/is);
      if (resultsMatch) {
        result.pertinentResults = this.extractBulletPoints(resultsMatch[1]);
        console.log(`   ✓ Pertinent Results: ${result.pertinentResults.length} items`);
      } else {
        console.log(`   ✗ Pertinent Results: NOT FOUND`);
      }

      // Extract Condition at Discharge section
      const conditionMatch = cleanText.match(/#{0,3}\s*\*{0,2}Condition\s+at\s+Discharge:?\*{0,2}(.*?)(?=#{0,3}\s*\*{0,2}Discharge\s+Medications:|$)/is);
      if (conditionMatch) {
        result.conditionAtDischarge = this.extractBulletPoints(conditionMatch[1]);
        console.log(`   ✓ Condition at Discharge: ${result.conditionAtDischarge.length} items`);
      } else {
        console.log(`   ✗ Condition at Discharge: NOT FOUND`);
      }

      console.log(`✅ Summary parsed successfully: ${result.dischargeDiagnosis.length} diagnoses, ${result.hospitalCourse.length} course items`);

      return result;
    } catch (error) {
      console.error(`❌ Failed to parse discharge summary:`, error);
      throw error;
    }
  }

  /**
   * Parse the discharge instructions into structured JSON
   */
  parseDischargeInstructions(text: string): ParsedDischargeInstructions {
    console.log('📋 [Demo Parser] Parsing discharge instructions');

    // Clean up text - remove file path annotations that may be in the PDF
    let cleanText = text.replace(/\d{1,2}\/\d{1,2}\/\d{2,4},\s+\d{1,2}:\d{2}\s+[AP]M\s+.*?\.md\s+fi\s*le:\/\/\/.*?\.md\s+\d+\/\d+/g, '');

    // Unescape markdown characters (for .md files)
    cleanText = cleanText.replace(/\\([[\](){}*_+\->])/g, '$1');

    console.log(`   🧹 Cleaned text: removed ${text.length - cleanText.length} characters of file path annotations and unescaped markdown`);

    const result: ParsedDischargeInstructions = {
      dischargeMedications: {
        new: [],
        continued: [],
        stopped: [],
      },
      followUpAppointments: [],
      dietAndLifestyle: [],
      patientInstructions: [],
      returnPrecautions: [],
    };

    try {
      // Extract Discharge Medications section
      // Handle both plain and markdown formats (###, **), and multiple spaces from PDF extraction
      const medicationsMatch = cleanText.match(/#{0,3}\s*\*{0,2}Discharge\s+Medications:?\*{0,2}(.*?)(?=#{0,3}\s*\*{0,2}Follow-?Up\s+Appointments:|$)/is);
      if (medicationsMatch) {
        const medsText = medicationsMatch[1];

        // Extract "New:" medications
        const newMatch = medsText.match(/New:(.*?)(?=Continued:|Stopped:|$)/is);
        if (newMatch) {
          result.dischargeMedications.new = this.extractBulletPoints(newMatch[1]);
          console.log(`   ✓ New Medications: ${result.dischargeMedications.new.length} items`);
        }

        // Extract "Continued:" medications
        const continuedMatch = medsText.match(/Continued:(.*?)(?=Stopped:|$)/is);
        if (continuedMatch) {
          result.dischargeMedications.continued = this.extractBulletPoints(continuedMatch[1]);
          console.log(`   ✓ Continued Medications: ${result.dischargeMedications.continued.length} items`);
        }

        // Extract "Stopped:" medications
        const stoppedMatch = medsText.match(/Stopped:(.*?)(?=#{0,3}\s*\*{0,2}Follow-?Up|$)/is);
        if (stoppedMatch) {
          result.dischargeMedications.stopped = this.extractBulletPoints(stoppedMatch[1]);
          console.log(`   ✓ Stopped Medications: ${result.dischargeMedications.stopped.length} items`);
        }
      } else {
        console.log(`   ✗ Discharge Medications: NOT FOUND`);
      }

      // Extract Follow-Up Appointments section
      const appointmentsMatch = cleanText.match(/#{0,3}\s*\*{0,2}Follow-?Up\s+Appointments:?\*{0,2}(.*?)(?=#{0,3}\s*\*{0,2}Diet\s+and\s+Lifestyle|$)/is);
      if (appointmentsMatch) {
        result.followUpAppointments = this.extractBulletPoints(appointmentsMatch[1]);
        console.log(`   ✓ Follow-Up Appointments: ${result.followUpAppointments.length} items`);
      } else {
        console.log(`   ✗ Follow-Up Appointments: NOT FOUND`);
      }

      // Extract Diet and Lifestyle Instructions section
      const dietMatch = cleanText.match(/#{0,3}\s*\*{0,2}Diet\s+and\s+Lifestyle\s+Instructions:?\*{0,2}(.*?)(?=#{0,3}\s*\*{0,2}Patient\s+Instructions|$)/is);
      if (dietMatch) {
        result.dietAndLifestyle = this.extractBulletPoints(dietMatch[1]);
        console.log(`   ✓ Diet and Lifestyle: ${result.dietAndLifestyle.length} items`);
      } else {
        console.log(`   ✗ Diet and Lifestyle: NOT FOUND`);
      }

      // Extract Patient Instructions section
      const instructionsMatch = cleanText.match(/#{0,3}\s*\*{0,2}Patient\s+Instructions[^:]*:?\*{0,2}(.*?)(?=#{0,3}\s*\*{0,2}Return\s+Precautions:|$)/is);
      if (instructionsMatch) {
        // For this section, we want to capture the full paragraph, not just bullets
        const instructionText = instructionsMatch[1].trim();
        if (instructionText) {
          result.patientInstructions = [instructionText];
          console.log(`   ✓ Patient Instructions: 1 paragraph`);
        }
      } else {
        console.log(`   ✗ Patient Instructions: NOT FOUND`);
      }

      // Extract Return Precautions section
      const precautionsMatch = cleanText.match(/#{0,3}\s*\*{0,2}Return\s+Precautions:?\*{0,2}(.*?)$/is);
      if (precautionsMatch) {
        // Extract the intro line and bullet points
        const precautionsText = precautionsMatch[1];
        const introMatch = precautionsText.match(/^(.*?)(?=●|Return\s+to|$)/is);
        const bullets = this.extractBulletPoints(precautionsText);

        if (introMatch && introMatch[1].trim() && !introMatch[1].includes('*')) {
          const intro = introMatch[1].trim();
          if (intro.length > 5) { // Only add if it's substantial text
            result.returnPrecautions.push(intro);
          }
        }
        result.returnPrecautions.push(...bullets);
        console.log(`   ✓ Return Precautions: ${result.returnPrecautions.length} items`);
      } else {
        console.log(`   ✗ Return Precautions: NOT FOUND`);
      }

      console.log(`✅ Instructions parsed successfully: ${result.dischargeMedications.new.length} new meds, ${result.followUpAppointments.length} appointments`);

      return result;
    } catch (error) {
      console.error(`❌ Failed to parse discharge instructions:`, error);
      throw error;
    }
  }

  /**
   * Extract bullet points from text
   * Handles both "●" and "-" bullet styles
   */
  private extractBulletPoints(text: string): string[] {
    const bullets: string[] = [];

    // First, try to split by asterisk bullets which may be inline
    // Handle both newline-separated and inline asterisk-separated bullets
    const asteriskParts = text.split(/\s*\*\s+/).filter(part => part.trim());

    if (asteriskParts.length > 1) {
      // We have asterisk-separated items
      asteriskParts.forEach(part => {
        const cleaned = part.trim().replace(/^[-●•]\s*/, '').replace(/\s+/g, ' ');
        if (cleaned && !cleaned.match(/^(New|Continued|Stopped|---):?$/i)) {
          bullets.push(cleaned);
        }
      });
      return bullets;
    }

    // Fall back to newline-based extraction
    const lines = text.split(/\n/).map(line => line.trim()).filter(line => line);

    for (const line of lines) {
      // Check if line starts with a bullet (●, •, -, or *)
      const bulletMatch = line.match(/^[●•\-\*]\s*(.+)$/);
      if (bulletMatch) {
        const cleaned = bulletMatch[1].trim().replace(/\s+/g, ' ');
        bullets.push(cleaned);
      } else if (line && !line.match(/^(New|Continued|Stopped):/i)) {
        // If it's a continuation of previous bullet or standalone text
        if (bullets.length > 0) {
          // Append to last bullet
          bullets[bullets.length - 1] += ' ' + line.replace(/\s+/g, ' ');
        } else {
          // First line without bullet, add it anyway
          const cleaned = line.replace(/\s+/g, ' ');
          bullets.push(cleaned);
        }
      }
    }

    return bullets;
  }
}
