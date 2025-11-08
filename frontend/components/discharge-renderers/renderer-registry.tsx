import React from 'react';
import {
  DemoDischargeSummaryRenderer,
  DemoDischargeInstructionsRenderer,
  type ParsedDischargeSummary as DemoDischargeSummary,
  type ParsedDischargeInstructions as DemoDischargeInstructions,
} from './tenants/demo/demo-renderer';

/**
 * Registry for tenant-specific discharge summary renderers
 *
 * Renderers are organized by tenant in discharge-renderers/tenants/{tenantId}/
 * Each tenant has a standard format for their discharge summaries and instructions.
 * The renderer displays the structured data from the corresponding parser.
 *
 * For example, the demo tenant uses a format with:
 * - Discharge Summary: admitting diagnosis, discharge diagnosis, hospital course, pertinent results, condition at discharge
 * - Discharge Instructions: medications (new/continued/stopped), appointments, diet/lifestyle, instructions, precautions
 */

export interface RendererProps {
  data: any;
  language?: string;
}

/**
 * Get the appropriate renderer component for a discharge summary
 *
 * @param tenantId - Tenant identifier (e.g., 'demo', 'stanford')
 * @param documentType - Document type (unused, kept for future extensibility)
 * @param data - Parsed discharge summary data
 * @param language - Language code (default: 'en')
 * @returns React component to render the data, or null if raw text should be used
 */
export function getDischargeSummaryRenderer(
  tenantId: string,
  documentType: string | null,
  data: any,
  language: string = 'en'
): React.ReactNode | null {
  // Demo tenant renderer
  // All discharge summaries for demo tenant use the same format
  if (tenantId === 'demo') {
    // Check if data has the demo tenant structure
    if (data && typeof data === 'object' && 'admittingDiagnosis' in data) {
      return <DemoDischargeSummaryRenderer data={data as DemoDischargeSummary} language={language} />;
    }
  }

  // Add more tenant renderers here
  // Example:
  // if (tenantId === 'stanford') {
  //   if (data && typeof data === 'object' && 'stanfordField' in data) {
  //     return <StanfordDischargeSummaryRenderer data={data} language={language} />;
  //   }
  // }

  // No renderer found - caller should fall back to raw text
  return null;
}

/**
 * Get the appropriate renderer component for discharge instructions
 *
 * @param tenantId - Tenant identifier (e.g., 'demo', 'stanford')
 * @param documentType - Document type (unused, kept for future extensibility)
 * @param data - Parsed discharge instructions data
 * @param language - Language code (default: 'en')
 * @returns React component to render the data, or null if raw text should be used
 */
export function getDischargeInstructionsRenderer(
  tenantId: string,
  documentType: string | null,
  data: any,
  language: string = 'en'
): React.ReactNode | null {
  // Demo tenant renderer
  // All discharge instructions for demo tenant use the same format
  if (tenantId === 'demo') {
    // Check if data has the demo tenant structure
    if (data && typeof data === 'object' && 'dischargeMedications' in data) {
      return <DemoDischargeInstructionsRenderer data={data as DemoDischargeInstructions} language={language} />;
    }
  }

  // Add more tenant renderers here
  // Example:
  // if (tenantId === 'stanford') {
  //   if (data && typeof data === 'object' && 'stanfordMeds' in data) {
  //     return <StanfordDischargeInstructionsRenderer data={data} language={language} />;
  //   }
  // }

  // No renderer found - caller should fall back to raw text
  return null;
}

/**
 * Check if a structured renderer is available for this data
 */
export function hasStructuredRenderer(tenantId: string, data: any): boolean {
  if (!data || typeof data !== 'object') return false;

  // Demo tenant - check for demo tenant structure
  if (tenantId === 'demo') {
    return 'admittingDiagnosis' in data || 'dischargeMedications' in data;
  }

  // Add more tenant checks here

  return false;
}
