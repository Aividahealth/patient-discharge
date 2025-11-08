/**
 * Parser Registry for Tenant-Specific Discharge Summary Parsers (Frontend)
 *
 * Parsers are organized by tenant in lib/parsers/tenants/{tenantId}/
 * Each tenant has a parser that extracts structured data from their discharge summary format.
 *
 * For example, the demo tenant has a parser that expects:
 * - Admitting Diagnosis, Discharge Diagnosis, Hospital Course, etc.
 */

import { DemoParser, ParsedDischargeSummary, ParsedDischargeInstructions } from './tenants/demo/demo-parser';

export interface DischargeParser {
  canParse(text: string): boolean;
  parseDischargeSummary(text: string): ParsedDischargeSummary;
  parseDischargeInstructions(text: string): ParsedDischargeInstructions;
}

export interface ParseResult {
  parserUsed: boolean;
  parsedSummary: ParsedDischargeSummary | null;
  parsedInstructions: ParsedDischargeInstructions | null;
}

/**
 * Get parsers for a specific tenant
 */
function getTenantParsers(tenantId: string): DischargeParser[] {
  const parsers: DischargeParser[] = [];

  // Demo tenant - uses DemoParser
  if (tenantId === 'demo') {
    parsers.push(new DemoParser());
  }

  // Add more tenant parsers here as needed
  // Example:
  // if (tenantId === 'stanford') {
  //   parsers.push(new StanfordParser());
  // }

  return parsers;
}

/**
 * Auto-detect and parse discharge summary and instructions
 *
 * @param tenantId - Tenant identifier (e.g., 'demo', 'stanford')
 * @param rawSummary - Raw discharge summary text
 * @param rawInstructions - Raw discharge instructions text
 * @returns ParseResult with parsed data or null if no parser could handle it
 */
export function parseDischargeDocument(
  tenantId: string,
  rawSummary: string,
  rawInstructions: string
): ParseResult {
  const parsers = getTenantParsers(tenantId);

  if (parsers.length === 0) {
    console.warn(`[Parser Registry] No parsers registered for tenant: ${tenantId}`);
    return {
      parserUsed: false,
      parsedSummary: null,
      parsedInstructions: null,
    };
  }

  // Try to auto-detect which parser can handle this document
  for (const parser of parsers) {
    if (parser.canParse(rawSummary)) {
      try {
        const parsedSummary = parser.parseDischargeSummary(rawSummary);
        const parsedInstructions = parser.parseDischargeInstructions(rawInstructions);

        return {
          parserUsed: true,
          parsedSummary,
          parsedInstructions,
        };
      } catch (error) {
        console.error(`[Parser Registry] Parser failed:`, error);
        return {
          parserUsed: false,
          parsedSummary: null,
          parsedInstructions: null,
        };
      }
    }
  }

  console.warn(`[Parser Registry] No parser could handle this document`);

  return {
    parserUsed: false,
    parsedSummary: null,
    parsedInstructions: null,
  };
}

// Export types
export type { ParsedDischargeSummary, ParsedDischargeInstructions };
