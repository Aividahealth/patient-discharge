import { Controller, Get, Param, Post, Body, Put, Delete, Query, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { GoogleService } from './google.service';
import { TenantContext } from '../tenant/tenant.decorator';
import type { TenantContext as TenantContextType } from '../tenant/tenant-context';

@Controller('google')
export class GoogleController {
  private readonly logger = new Logger(GoogleController.name);

  constructor(private readonly googleService: GoogleService) {}

  @Get('token')
  getToken() {
    return this.googleService.getAccessToken();
  }

  @Post('impersonate/:email')
  impersonate(@Param('email') email: string, @Body() body: any) {
    return this.googleService.impersonate(email, body?.scopes);
  }

  // FHIR CRUD proxied under Google
  @Post('fhir/:resourceType')
  fhirCreate(@Param('resourceType') resourceType: string, @Body() body: unknown, @TenantContext() ctx: TenantContextType) {
    return this.googleService.fhirCreate(resourceType, body, ctx);
  }

  @Get('fhir/:resourceType/:id')
  fhirRead(@Param('resourceType') resourceType: string, @Param('id') id: string, @TenantContext() ctx: TenantContextType) {
    return this.googleService.fhirRead(resourceType, id, ctx);
  }

  @Put('fhir/:resourceType/:id')
  fhirUpdate(
    @Param('resourceType') resourceType: string,
    @Param('id') id: string,
    @Body() body: unknown,
    @TenantContext() ctx: TenantContextType,
  ) {
    return this.googleService.fhirUpdate(resourceType, id, body, ctx);
  }

  @Delete('fhir/:resourceType/:id')
  fhirDelete(@Param('resourceType') resourceType: string, @Param('id') id: string, @TenantContext() ctx: TenantContextType) {
    return this.googleService.fhirDelete(resourceType, id, ctx);
  }

  @Get('fhir/:resourceType')
  fhirSearch(@Param('resourceType') resourceType: string, @Query() query: any, @TenantContext() ctx: TenantContextType) {
    return this.googleService.fhirSearch(resourceType, query, ctx);
  }

  /**
   * Execute FHIR bundle request
   */
  @Post('fhir')
  async executeBundle(
    @TenantContext() ctx: TenantContextType,
    @Body() bundle: any,
  ): Promise<any> {
    try {
      this.logger.log(`📦 Executing FHIR bundle with ${bundle.entry?.length || 0} entries (tenant: ${ctx.tenantId})`);
      
      const result = await this.googleService.fhirBundle(bundle, ctx);
      
      this.logger.log(`✅ Bundle execution completed successfully`);
      return {
        success: true,
        result,
        timestamp: new Date().toISOString(),
        tenantId: ctx.tenantId,
      };
    } catch (error) {
      this.logger.error(`❌ Bundle execution failed: ${error.message}`);
      throw new HttpException(
        {
          message: 'Bundle execution failed',
          error: error.message,
          tenantId: ctx.tenantId,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}


