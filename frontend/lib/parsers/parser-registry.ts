import { DischargeSummaryParser, ParserConfig } from './base-parser';
import { DefaultDischargeSummaryParser } from './default-parser';

/**
 * Type for parser constructor
 */
type ParserConstructor = new (config: ParserConfig) => DischargeSummaryParser;

/**
 * Tenant parser configuration
 */
export interface TenantParserConfig {
  tenantId: string;
  parserType: string;
  settings?: Record<string, any>;
  customParser?: ParserConstructor;
}

/**
 * Parser Registry - Manages parsers for different tenants
 */
export class ParserRegistry {
  private static instance: ParserRegistry;
  private parsers: Map<string, ParserConstructor> = new Map();
  private tenantConfigs: Map<string, TenantParserConfig> = new Map();

  private constructor() {
    // Register default parser
    this.registerParser('default', DefaultDischargeSummaryParser);
  }

  /**
   * Get singleton instance
   */
  static getInstance(): ParserRegistry {
    if (!ParserRegistry.instance) {
      ParserRegistry.instance = new ParserRegistry();
    }
    return ParserRegistry.instance;
  }

  /**
   * Register a new parser type
   * @param parserType - Unique identifier for the parser
   * @param parserClass - Parser class constructor
   */
  registerParser(parserType: string, parserClass: ParserConstructor): void {
    this.parsers.set(parserType, parserClass);
  }

  /**
   * Configure parser for a specific tenant
   * @param config - Tenant parser configuration
   */
  configureTenant(config: TenantParserConfig): void {
    this.tenantConfigs.set(config.tenantId, config);

    // Register custom parser if provided
    if (config.customParser) {
      this.registerParser(`custom-${config.tenantId}`, config.customParser);
    }
  }

  /**
   * Get parser for a specific tenant
   * @param tenantId - Tenant identifier
   * @returns Parser instance
   */
  getParserForTenant(tenantId: string): DischargeSummaryParser {
    const tenantConfig = this.tenantConfigs.get(tenantId);

    if (!tenantConfig) {
      // Return default parser if no configuration exists
      return this.createParser('default', {
        tenantId,
        parserType: 'default',
        version: '1.0.0',
      });
    }

    const parserType = tenantConfig.customParser
      ? `custom-${tenantId}`
      : tenantConfig.parserType;

    const config: ParserConfig = {
      tenantId,
      parserType,
      version: '1.0.0',
      settings: tenantConfig.settings,
    };

    return this.createParser(parserType, config);
  }

  /**
   * Create parser instance
   * @param parserType - Parser type
   * @param config - Parser configuration
   * @returns Parser instance
   */
  private createParser(parserType: string, config: ParserConfig): DischargeSummaryParser {
    const ParserClass = this.parsers.get(parserType);

    if (!ParserClass) {
      throw new Error(`Parser type '${parserType}' not found. Available parsers: ${Array.from(this.parsers.keys()).join(', ')}`);
    }

    return new ParserClass(config);
  }

  /**
   * Get list of registered parsers
   */
  getRegisteredParsers(): string[] {
    return Array.from(this.parsers.keys());
  }

  /**
   * Get list of configured tenants
   */
  getConfiguredTenants(): string[] {
    return Array.from(this.tenantConfigs.keys());
  }

  /**
   * Get tenant configuration
   */
  getTenantConfig(tenantId: string): TenantParserConfig | undefined {
    return this.tenantConfigs.get(tenantId);
  }
}

/**
 * Parser Factory - Simplified interface for getting parsers
 */
export class ParserFactory {
  private static registry = ParserRegistry.getInstance();

  /**
   * Get parser for tenant
   * @param tenantId - Tenant identifier
   * @returns Parser instance
   */
  static getParser(tenantId: string): DischargeSummaryParser {
    return this.registry.getParserForTenant(tenantId);
  }

  /**
   * Register a custom parser for a tenant
   * @param tenantId - Tenant identifier
   * @param parserClass - Parser class constructor
   * @param settings - Optional settings
   */
  static registerCustomParser(
    tenantId: string,
    parserClass: ParserConstructor,
    settings?: Record<string, any>
  ): void {
    this.registry.configureTenant({
      tenantId,
      parserType: 'custom',
      customParser: parserClass,
      settings,
    });
  }

  /**
   * Configure tenant to use a standard parser type
   * @param tenantId - Tenant identifier
   * @param parserType - Parser type (e.g., 'default', 'epic', 'cerner')
   * @param settings - Optional settings
   */
  static configureTenant(
    tenantId: string,
    parserType: string,
    settings?: Record<string, any>
  ): void {
    this.registry.configureTenant({
      tenantId,
      parserType,
      settings,
    });
  }
}
