import { ParserFactory } from './parser-registry';

/**
 * Configure parsers for different tenants
 * This file should be updated as new tenants are onboarded
 */

export function initializeTenantParsers() {
  // Default tenant - uses default parser
  ParserFactory.configureTenant('default-tenant', 'default');

  // Example: Hospital A - uses default parser with custom settings
  ParserFactory.configureTenant('hospital-a', 'default', {
    strictValidation: true,
    requireMedications: true,
  });

  // Example: Hospital B - might use a custom parser in the future
  ParserFactory.configureTenant('hospital-b', 'default', {
    dateFormat: 'MM/DD/YYYY',
  });

  // Add more tenant configurations here as needed
  // ParserFactory.configureTenant('epic-hospital', 'epic');
  // ParserFactory.configureTenant('cerner-hospital', 'cerner');
}

/**
 * Get parser configuration for a tenant
 * This can be used to display configuration info to admins
 */
export function getTenantParserInfo(tenantId: string): {
  tenantId: string;
  parserType: string;
  hasCustomParser: boolean;
  settings?: Record<string, any>;
} {
  const registry = ParserFactory['registry'];
  const config = registry.getTenantConfig(tenantId);

  if (!config) {
    return {
      tenantId,
      parserType: 'default',
      hasCustomParser: false,
    };
  }

  return {
    tenantId: config.tenantId,
    parserType: config.parserType,
    hasCustomParser: !!config.customParser,
    settings: config.settings,
  };
}

/**
 * List all configured tenants
 */
export function listConfiguredTenants(): string[] {
  const registry = ParserFactory['registry'];
  return registry.getConfiguredTenants();
}
