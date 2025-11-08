/**
 * Discharge Summary Parser System
 *
 * This module provides a tenant-specific parsing system for discharge summaries.
 *
 * Usage:
 * ```typescript
 * import { parseDischargeDocument } from '@/lib/parsers/parser-registry';
 *
 * // Parse discharge summary and instructions
 * const result = parseDischargeDocument(tenantId, rawSummary, rawInstructions);
 * ```
 */

// Export the parser registry functions
export { parseDischargeDocument } from './parser-registry';
export type { ParsedDischargeSummary, ParsedDischargeInstructions } from './parser-registry';
