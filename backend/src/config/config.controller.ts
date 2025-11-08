import { Controller, Get, Headers, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ConfigService } from './config.service';
import { TenantContext } from '../tenant/tenant.decorator';
import type { TenantContext as TenantContextType } from '../tenant/tenant-context';

@Controller('api/config')
export class ConfigController {
  private readonly logger = new Logger(ConfigController.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * GET /api/config
   * Get tenant configuration and branding for the tenant specified in X-Tenant-ID header
   */
  @Get()
  async getConfig(
    @TenantContext() ctx: TenantContextType,
    @Headers('x-tenant-id') tenantIdHeader?: string,
  ) {
    try {
      const tenantId = tenantIdHeader || ctx.tenantId;
      
      if (!tenantId) {
        throw new HttpException(
          {
            message: 'Tenant ID is required',
            error: 'X-Tenant-ID header is required',
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      this.logger.log(`📋 Retrieving config for tenant: ${tenantId}`);

      const tenantConfig = await this.configService.getTenantConfig(tenantId);

      if (!tenantConfig) {
        throw new HttpException(
          {
            message: 'Tenant configuration not found',
            error: `No configuration found for tenant: ${tenantId}`,
            tenantId,
          },
          HttpStatus.NOT_FOUND,
        );
      }

      this.logger.log(`✅ Retrieved config for tenant: ${tenantId}`);

      return {
        success: true,
        tenant: tenantConfig,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(`❌ Failed to retrieve config: ${error.message}`);
      throw new HttpException(
        {
          message: 'Failed to retrieve tenant configuration',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}

