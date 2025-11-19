import {
  Controller,
  Get,
  Request,
  UseGuards,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard, TenantGuard } from '../auth/guards';
import { Roles } from '../auth/decorators/roles.decorator';
import { SystemAdminService } from '../system-admin/system-admin.service';

/**
 * Controller for tenant-specific operations
 * Allows tenant admins to access their own tenant's data
 */
@Controller('api/tenant')
@UseGuards(AuthGuard, RolesGuard, TenantGuard)
@Roles('tenant_admin', 'system_admin')
export class TenantController {
  private readonly logger = new Logger(TenantController.name);

  constructor(private readonly systemAdminService: SystemAdminService) {}

  /**
   * GET /api/tenant/metrics
   * Get metrics for the authenticated tenant
   * Requires: tenant_admin or system_admin role
   * Protected by: TenantGuard (ensures tenant isolation)
   */
  @Get('metrics')
  async getTenantMetrics(@Request() req) {
    try {
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        throw new HttpException('Tenant ID not found in request', HttpStatus.BAD_REQUEST);
      }

      this.logger.log(`Getting metrics for tenant: ${tenantId}`);
      return await this.systemAdminService.getTenantMetrics(tenantId);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`Error getting tenant metrics: ${error.message}`);
      throw new HttpException(
        { message: 'Failed to get tenant metrics', error: error.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
