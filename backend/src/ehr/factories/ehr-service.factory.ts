import { Injectable, Logger } from '@nestjs/common';
import { IEHRService, EHRVendor } from '../interfaces/ehr-service.interface';
import { CernerAdapter } from '../adapters/cerner.adapter';
import { EPICAdapter } from '../adapters/epic.adapter';
import { DevConfigService } from '../../config/dev-config.service';
import { AuditService } from '../../audit/audit.service';
import { TenantContext } from '../../tenant/tenant-context';

/**
 * Factory service for creating EHR service instances
 * Uses factory pattern to instantiate the correct adapter based on tenant configuration
 */
@Injectable()
export class EHRServiceFactory {
  private readonly logger = new Logger(EHRServiceFactory.name);

  // Cache instances per tenant+vendor to reuse tokens and connections
  private serviceCache: Map<string, IEHRService> = new Map();

  constructor(
    private readonly configService: DevConfigService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Get the appropriate EHR service for a tenant
   * Automatically selects vendor based on tenant configuration
   *
   * @param ctx - Tenant context
   * @returns EHR service instance (Cerner, EPIC, etc.)
   * @throws Error if no vendor configured or vendor not supported
   */
  async getEHRService(ctx: TenantContext): Promise<IEHRService> {
    // Get tenant's configured EHR vendor
    const vendor = await this.configService.getTenantEHRVendor(ctx.tenantId);
    if (!vendor) {
      throw new Error(`No EHR vendor configured for tenant: ${ctx.tenantId}`);
    }

    const cacheKey = `${ctx.tenantId}:${vendor}`;

    // Return cached instance if available (to reuse tokens)
    if (this.serviceCache.has(cacheKey)) {
      this.logger.log(`Using cached EHR service for ${ctx.tenantId} (${vendor})`);
      return this.serviceCache.get(cacheKey)!;
    }

    // Create new instance based on vendor
    this.logger.log(`Creating new EHR service for ${ctx.tenantId} (${vendor})`);
    const service = this.createEHRService(vendor as EHRVendor);

    // Cache the instance for future use
    this.serviceCache.set(cacheKey, service);

    return service;
  }

  /**
   * Create EHR service instance based on vendor
   *
   * @param vendor - EHR vendor enum
   * @returns Appropriate adapter instance
   * @throws Error if vendor not supported
   */
  private createEHRService(vendor: EHRVendor): IEHRService {
    switch (vendor) {
      case EHRVendor.CERNER:
        return new CernerAdapter(this.configService, this.auditService);

      case EHRVendor.EPIC:
        return new EPICAdapter(this.configService, this.auditService);

      // Future vendors
      // case EHRVendor.ALLSCRIPTS:
      //   return new AllscriptsAdapter(this.configService, this.auditService);
      //
      // case EHRVendor.MEDITECH:
      //   return new MeditechAdapter(this.configService, this.auditService);

      default:
        throw new Error(`Unsupported EHR vendor: ${vendor}. Please implement ${vendor}Adapter.`);
    }
  }

  /**
   * Get EHR service for a specific vendor (bypass tenant config)
   * Useful for testing or admin operations
   *
   * @param vendor - EHR vendor enum
   * @param tenantId - Optional tenant ID for caching
   * @returns EHR service instance
   */
  getEHRServiceByVendor(vendor: EHRVendor, tenantId?: string): IEHRService {
    const cacheKey = tenantId ? `${tenantId}:${vendor}` : vendor;

    if (this.serviceCache.has(cacheKey)) {
      this.logger.log(`Using cached EHR service for vendor: ${vendor}`);
      return this.serviceCache.get(cacheKey)!;
    }

    this.logger.log(`Creating new EHR service for vendor: ${vendor}`);
    const service = this.createEHRService(vendor);

    if (tenantId) {
      this.serviceCache.set(cacheKey, service);
    }

    return service;
  }

  /**
   * Clear cache for a specific tenant
   * Useful when tenant configuration is updated
   *
   * @param tenantId - Tenant ID
   */
  clearCache(tenantId: string): void {
    const keysToDelete: string[] = [];
    for (const key of this.serviceCache.keys()) {
      if (key.startsWith(`${tenantId}:`)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => this.serviceCache.delete(key));
    this.logger.log(`Cleared EHR service cache for tenant: ${tenantId} (${keysToDelete.length} entries)`);
  }

  /**
   * Clear all cached instances
   */
  clearAllCache(): void {
    const count = this.serviceCache.size;
    this.serviceCache.clear();
    this.logger.log(`Cleared all EHR service cache (${count} entries)`);
  }

  /**
   * Get all supported vendors
   *
   * @returns Array of supported vendor enums
   */
  getSupportedVendors(): EHRVendor[] {
    return [
      EHRVendor.CERNER,
      EHRVendor.EPIC,
    ];
  }

  /**
   * Check if a vendor is supported
   *
   * @param vendor - Vendor name as string
   * @returns true if supported
   */
  isVendorSupported(vendor: string): boolean {
    return this.getSupportedVendors().includes(vendor as EHRVendor);
  }

  /**
   * Get cache statistics
   * Useful for monitoring and debugging
   *
   * @returns Cache statistics
   */
  getCacheStats(): { totalEntries: number; tenants: string[]; vendors: string[] } {
    const tenants = new Set<string>();
    const vendors = new Set<string>();

    for (const key of this.serviceCache.keys()) {
      const [tenantId, vendor] = key.split(':');
      if (tenantId) tenants.add(tenantId);
      if (vendor) vendors.add(vendor);
    }

    return {
      totalEntries: this.serviceCache.size,
      tenants: Array.from(tenants),
      vendors: Array.from(vendors),
    };
  }
}
