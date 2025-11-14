import { Controller, Get, Headers, HttpException, HttpStatus, Logger, Param } from '@nestjs/common';
import { ConfigService } from './config.service';
import { Public } from '../auth/auth.guard';
import { TenantContext } from '../tenant/tenant.decorator';
import type { TenantContext as TenantContextType } from '../tenant/tenant-context';

@Controller('api')
export class ConfigController {
  private readonly logger = new Logger(ConfigController.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * GET /api/tenants/:tenantId/config
   * Get tenant configuration for discharge-export-processor
   * This endpoint is designed for service-to-service communication
   * Authentication is handled via Cloud Run IAM (invoker permissions)
   */
  @Public()
  @Get('tenants/:tenantId/config')
  async getTenantConfigForProcessor(@Param('tenantId') tenantId: string) {
    try {
      this.logger.log(`📋 Retrieving processor config for tenant: ${tenantId}`);

      const tenantConfig = await this.configService.getTenantConfig(tenantId);

      // Return structure expected by discharge-export-processor
      const processorConfig = {
        tenantId: tenantId,
        name: tenantConfig?.name || `${tenantId} Hospital`,
        status: tenantConfig?.status || 'active',
        buckets: {
          rawBucket: `discharge-summaries-raw-${tenantId}`,
          simplifiedBucket: `discharge-summaries-simplified-${tenantId}`,
          translatedBucket: `discharge-summaries-translated-${tenantId}`,
        },
        simplificationConfig: {
          modelName: process.env.MODEL_NAME || 'gemini-2.5-pro',
          location: process.env.LOCATION || 'us-central1',
          temperature: 0.7,
          enabled: tenantConfig?.config?.simplificationEnabled ?? true,
        },
        translationConfig: {
          enabled: tenantConfig?.config?.translationEnabled ?? true,
          targetLanguages: tenantConfig?.features?.supportedLanguages || ['en', 'es', 'zh'],
        },
      };

      this.logger.log(`✅ Retrieved processor config for tenant: ${tenantId}`);

      return processorConfig;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(`❌ Failed to retrieve processor config: ${error.message}`);
      throw new HttpException(
        {
          message: 'Failed to retrieve tenant configuration for processor',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /api/config
   * Get tenant configuration and branding for the tenant specified in X-Tenant-ID header
   */
  @Get('config')
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

