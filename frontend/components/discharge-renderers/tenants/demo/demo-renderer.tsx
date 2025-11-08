import React from 'react';

/**
 * Demo Tenant Discharge Summary Renderer
 *
 * This renderer displays discharge summaries for the demo tenant with structured formatting.
 * All discharge summaries uploaded to the demo tenant (regardless of condition - STEMI, pneumonia, etc.)
 * are expected to follow this format with the following sections:
 * - Admitting Diagnosis
 * - Discharge Diagnosis
 * - Hospital Course
 * - Pertinent Results
 * - Condition at Discharge
 */

/**
 * Interface matching the backend demo tenant parser structure
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

interface DemoDischargeSummaryRendererProps {
  data: ParsedDischargeSummary;
  language?: string;
}

interface DemoDischargeInstructionsRendererProps {
  data: ParsedDischargeInstructions;
  language?: string;
}

/**
 * Render Demo Tenant Discharge Summary with structured formatting
 * Displays all sections with bold headers and bullet points
 */
export function DemoDischargeSummaryRenderer({
  data,
  language = 'en'
}: DemoDischargeSummaryRendererProps) {
  return (
    <div className="space-y-6 text-sm">
      {/* Admitting Diagnosis */}
      {data.admittingDiagnosis && data.admittingDiagnosis.length > 0 && (
        <div>
          <h4 className="font-bold text-foreground mb-2">ADMITTING DIAGNOSIS:</h4>
          <ul className="space-y-1 text-muted-foreground">
            {data.admittingDiagnosis.map((item, index) => (
              <li key={index} className="flex items-start gap-2">
                <span className="text-primary mt-1">•</span>
                <span className="flex-1">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Discharge Diagnosis */}
      {data.dischargeDiagnosis && data.dischargeDiagnosis.length > 0 && (
        <div>
          <h4 className="font-bold text-foreground mb-2">DISCHARGE DIAGNOSIS:</h4>
          <ul className="space-y-1 text-muted-foreground">
            {data.dischargeDiagnosis.map((item, index) => (
              <li key={index} className="flex items-start gap-2">
                <span className="text-primary mt-1">•</span>
                <span className="flex-1">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Hospital Course */}
      {data.hospitalCourse && data.hospitalCourse.length > 0 && (
        <div>
          <h4 className="font-bold text-foreground mb-2">HOSPITAL COURSE:</h4>
          <ul className="space-y-1 text-muted-foreground">
            {data.hospitalCourse.map((item, index) => (
              <li key={index} className="flex items-start gap-2">
                <span className="text-primary mt-1">•</span>
                <span className="flex-1">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Pertinent Results */}
      {data.pertinentResults && data.pertinentResults.length > 0 && (
        <div>
          <h4 className="font-bold text-foreground mb-2">PERTINENT RESULTS:</h4>
          <ul className="space-y-1 text-muted-foreground">
            {data.pertinentResults.map((item, index) => (
              <li key={index} className="flex items-start gap-2">
                <span className="text-primary mt-1">•</span>
                <span className="flex-1">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Condition at Discharge */}
      {data.conditionAtDischarge && data.conditionAtDischarge.length > 0 && (
        <div>
          <h4 className="font-bold text-foreground mb-2">CONDITION AT DISCHARGE:</h4>
          <ul className="space-y-1 text-muted-foreground">
            {data.conditionAtDischarge.map((item, index) => (
              <li key={index} className="flex items-start gap-2">
                <span className="text-primary mt-1">•</span>
                <span className="flex-1">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * Render Demo Tenant Discharge Instructions with structured formatting
 * Displays medications (new, continued, stopped), appointments, diet, instructions, and precautions
 */
export function DemoDischargeInstructionsRenderer({
  data,
  language = 'en'
}: DemoDischargeInstructionsRendererProps) {
  return (
    <div className="space-y-6 text-sm">
      {/* Discharge Medications */}
      {(data.dischargeMedications.new.length > 0 ||
        data.dischargeMedications.continued.length > 0 ||
        data.dischargeMedications.stopped.length > 0) && (
        <div>
          <h4 className="font-bold text-foreground mb-2">DISCHARGE MEDICATIONS:</h4>

          {data.dischargeMedications.new.length > 0 && (
            <div className="mb-3">
              <p className="font-semibold text-foreground mb-1">New:</p>
              <ul className="space-y-1 text-muted-foreground">
                {data.dischargeMedications.new.map((item, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="text-primary mt-1">•</span>
                    <span className="flex-1">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {data.dischargeMedications.continued.length > 0 && (
            <div className="mb-3">
              <p className="font-semibold text-foreground mb-1">Continued:</p>
              <ul className="space-y-1 text-muted-foreground">
                {data.dischargeMedications.continued.map((item, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="text-primary mt-1">•</span>
                    <span className="flex-1">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {data.dischargeMedications.stopped.length > 0 && (
            <div className="mb-3">
              <p className="font-semibold text-foreground mb-1">Stopped:</p>
              <ul className="space-y-1 text-muted-foreground">
                {data.dischargeMedications.stopped.map((item, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="text-primary mt-1">•</span>
                    <span className="flex-1">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Follow-Up Appointments */}
      {data.followUpAppointments && data.followUpAppointments.length > 0 && (
        <div>
          <h4 className="font-bold text-foreground mb-2">FOLLOW-UP APPOINTMENTS:</h4>
          <ul className="space-y-1 text-muted-foreground">
            {data.followUpAppointments.map((item, index) => (
              <li key={index} className="flex items-start gap-2">
                <span className="text-primary mt-1">•</span>
                <span className="flex-1">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Diet and Lifestyle */}
      {data.dietAndLifestyle && data.dietAndLifestyle.length > 0 && (
        <div>
          <h4 className="font-bold text-foreground mb-2">DIET AND LIFESTYLE INSTRUCTIONS:</h4>
          <ul className="space-y-1 text-muted-foreground">
            {data.dietAndLifestyle.map((item, index) => (
              <li key={index} className="flex items-start gap-2">
                <span className="text-primary mt-1">•</span>
                <span className="flex-1">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Patient Instructions */}
      {data.patientInstructions && data.patientInstructions.length > 0 && (
        <div>
          <h4 className="font-bold text-foreground mb-2">PATIENT INSTRUCTIONS:</h4>
          <div className="text-muted-foreground">
            {data.patientInstructions.map((item, index) => (
              <p key={index} className="mb-2">{item}</p>
            ))}
          </div>
        </div>
      )}

      {/* Return Precautions */}
      {data.returnPrecautions && data.returnPrecautions.length > 0 && (
        <div>
          <h4 className="font-bold text-foreground mb-2">RETURN PRECAUTIONS:</h4>
          <ul className="space-y-1 text-muted-foreground">
            {data.returnPrecautions.map((item, index) => (
              <li key={index} className="flex items-start gap-2">
                <span className="text-primary mt-1">•</span>
                <span className="flex-1">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
