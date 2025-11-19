import { Controller, Get, Post, Put, Delete, Param, Body, Query, Logger, Headers } from '@nestjs/common';
import { EHRServiceFactory } from '../factories/ehr-service.factory';
import { VendorRegistryService } from '../services/vendor-registry.service';
import { TenantContext } from '../../tenant/tenant-context';
import { TenantContext as TenantContextDecorator } from '../../tenant/tenant.decorator';

/**
 * Generic EHR controller that works with any vendor (Cerner, EPIC, etc.)
 * Automatically routes requests to the appropriate vendor adapter based on tenant configuration
 */
@Controller('ehr')
export class EHRController {
  private readonly logger = new Logger(EHRController.name);

  constructor(
    private readonly ehrFactory: EHRServiceFactory,
    private readonly vendorRegistry: VendorRegistryService,
  ) {}

  /**
   * Get supported EHR vendors
   * GET /ehr/vendors
   */
  @Get('vendors')
  async getSupportedVendors() {
    return {
      vendors: this.vendorRegistry.getAllVendors(),
      supported: this.ehrFactory.getSupportedVendors(),
    };
  }

  /**
   * Get vendor info for current tenant
   * GET /ehr/vendor
   */
  @Get('vendor')
  async getTenantVendor(@TenantContextDecorator() ctx: TenantContext) {
    const ehrService = await this.ehrFactory.getEHRService(ctx);
    const vendor = ehrService.getVendor();
    const metadata = this.vendorRegistry.getVendor(vendor);

    return {
      vendor,
      metadata,
      capabilities: ehrService.getCapabilities?.(),
    };
  }

  /**
   * Generic FHIR CRUD: Create resource
   * POST /ehr/:resourceType
   */
  @Post(':resourceType')
  async createResource(
    @Param('resourceType') resourceType: string,
    @Body() resource: any,
    @TenantContextDecorator() ctx: TenantContext,
  ) {
    const ehrService = await this.ehrFactory.getEHRService(ctx);
    const vendor = ehrService.getVendor();
    this.logger.log(`Creating ${resourceType} in ${vendor} for tenant ${ctx.tenantId}`);

    return await ehrService.createResource(resourceType, resource, ctx);
  }

  /**
   * Generic FHIR CRUD: Fetch resource
   * GET /ehr/:resourceType/:id
   */
  @Get(':resourceType/:id')
  async fetchResource(
    @Param('resourceType') resourceType: string,
    @Param('id') id: string,
    @TenantContextDecorator() ctx: TenantContext,
  ) {
    const ehrService = await this.ehrFactory.getEHRService(ctx);
    const vendor = ehrService.getVendor();
    this.logger.log(`Fetching ${resourceType}/${id} from ${vendor} for tenant ${ctx.tenantId}`);

    return await ehrService.fetchResource(resourceType, id, ctx);
  }

  /**
   * Generic FHIR CRUD: Update resource
   * PUT /ehr/:resourceType/:id
   */
  @Put(':resourceType/:id')
  async updateResource(
    @Param('resourceType') resourceType: string,
    @Param('id') id: string,
    @Body() resource: any,
    @TenantContextDecorator() ctx: TenantContext,
  ) {
    const ehrService = await this.ehrFactory.getEHRService(ctx);
    const vendor = ehrService.getVendor();
    this.logger.log(`Updating ${resourceType}/${id} in ${vendor} for tenant ${ctx.tenantId}`);

    return await ehrService.updateResource(resourceType, id, resource, ctx);
  }

  /**
   * Generic FHIR CRUD: Delete resource
   * DELETE /ehr/:resourceType/:id
   */
  @Delete(':resourceType/:id')
  async deleteResource(
    @Param('resourceType') resourceType: string,
    @Param('id') id: string,
    @TenantContextDecorator() ctx: TenantContext,
  ) {
    const ehrService = await this.ehrFactory.getEHRService(ctx);
    const vendor = ehrService.getVendor();
    this.logger.log(`Deleting ${resourceType}/${id} from ${vendor} for tenant ${ctx.tenantId}`);

    return await ehrService.deleteResource(resourceType, id, ctx);
  }

  /**
   * Generic FHIR search
   * GET /ehr/:resourceType
   */
  @Get(':resourceType')
  async searchResource(
    @Param('resourceType') resourceType: string,
    @Query() query: Record<string, any>,
    @TenantContextDecorator() ctx: TenantContext,
  ) {
    const ehrService = await this.ehrFactory.getEHRService(ctx);
    const vendor = ehrService.getVendor();
    this.logger.log(`Searching ${resourceType} in ${vendor} for tenant ${ctx.tenantId}`);

    return await ehrService.searchResource(resourceType, query, ctx);
  }

  /**
   * Search discharge summaries (convenience endpoint)
   * GET /ehr/discharge-summaries/:patientId
   */
  @Get('discharge-summaries/:patientId')
  async searchDischargeSummaries(
    @Param('patientId') patientId: string,
    @TenantContextDecorator() ctx: TenantContext,
  ) {
    const ehrService = await this.ehrFactory.getEHRService(ctx);
    const vendor = ehrService.getVendor();
    this.logger.log(`Searching discharge summaries for patient ${patientId} in ${vendor}`);

    return await ehrService.searchDischargeSummaries(patientId, ctx);
  }

  /**
   * Fetch binary document
   * GET /ehr/binary/:binaryId
   */
  @Get('binary/:binaryId')
  async fetchBinaryDocument(
    @Param('binaryId') binaryId: string,
    @Query('contentType') contentType: string,
    @TenantContextDecorator() ctx: TenantContext,
  ) {
    const ehrService = await this.ehrFactory.getEHRService(ctx);
    const vendor = ehrService.getVendor();
    this.logger.log(`Fetching binary ${binaryId} from ${vendor}`);

    return await ehrService.fetchBinaryDocument(binaryId, ctx, contentType);
  }

  /**
   * Clear cache for current tenant
   * POST /ehr/cache/clear
   */
  @Post('cache/clear')
  async clearCache(@TenantContextDecorator() ctx: TenantContext) {
    this.ehrFactory.clearCache(ctx.tenantId);
    return {
      success: true,
      message: `Cache cleared for tenant ${ctx.tenantId}`,
    };
  }

  /**
   * Get cache statistics
   * GET /ehr/cache/stats
   */
  @Get('cache/stats')
  async getCacheStats() {
    return this.ehrFactory.getCacheStats();
  }
}
