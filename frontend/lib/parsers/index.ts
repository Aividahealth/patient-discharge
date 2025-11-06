/**
 * Discharge Summary Parser System
 *
 * This module provides a flexible, tenant-specific parsing system for discharge summaries.
 *
 * Features:
 * - Base parser interface for extensibility
 * - Default parser for standard formats
 * - Parser registry for managing multiple parsers
 * - Tenant-specific configuration
 * - Easy integration with API routes
 *
 * Usage:
 * ```typescript
 * import { ParserFactory } from '@/lib/parsers';
 *
 * // Get parser for a tenant
 * const parser = ParserFactory.getParser('hospital-a');
 *
 * // Parse a discharge summary
 * const result = await parser.parse(fileBuffer, 'application/pdf');
 * ```
 */

export { DischargeSummaryParser, type ParsedDischargeSummary, type ParserConfig } from './base-parser';
export { DefaultDischargeSummaryParser } from './default-parser';
export { ParserRegistry, ParserFactory, type TenantParserConfig } from './parser-registry';
export { initializeTenantParsers, getTenantParserInfo, listConfiguredTenants } from './tenant-configs';
