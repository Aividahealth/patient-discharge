import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { SystemAdminService } from './system-admin.service';
import {
  CreateTenantRequest,
  UpdateTenantRequest,
  CreateTenantAdminRequest,
} from './system-admin.types';

@Controller('system-admin')
@UseGuards(AuthGuard, RolesGuard)
@Roles('system_admin')
export class SystemAdminController {
  private readonly logger = new Logger(SystemAdminController.name);

  constructor(private readonly systemAdminService: SystemAdminService) {}

  /**
   * Get all tenants
   */
  @Get('tenants')
  async getAllTenants() {
    this.logger.log('Getting all tenants');
    return this.systemAdminService.getAllTenants();
  }

  /**
   * Get a specific tenant
   */
  @Get('tenants/:tenantId')
  async getTenant(@Param('tenantId') tenantId: string) {
    this.logger.log(`Getting tenant: ${tenantId}`);
    return this.systemAdminService.getTenant(tenantId);
  }

  /**
   * Create a new tenant
   */
  @Post('tenants')
  async createTenant(@Body() request: CreateTenantRequest) {
    this.logger.log(`Creating tenant: ${request.id}`);
    return this.systemAdminService.createTenant(request);
  }

  /**
   * Update a tenant
   */
  @Put('tenants/:tenantId')
  async updateTenant(
    @Param('tenantId') tenantId: string,
    @Body() request: UpdateTenantRequest,
  ) {
    this.logger.log(`Updating tenant: ${tenantId}`);
    return this.systemAdminService.updateTenant(tenantId, request);
  }

  /**
   * Delete a tenant
   */
  @Delete('tenants/:tenantId')
  async deleteTenant(@Param('tenantId') tenantId: string) {
    this.logger.log(`Deleting tenant: ${tenantId}`);
    await this.systemAdminService.deleteTenant(tenantId);
    return { success: true, message: `Tenant ${tenantId} deleted` };
  }

  /**
   * Create a tenant admin user
   */
  @Post('tenant-admins')
  async createTenantAdmin(@Body() request: CreateTenantAdminRequest) {
    this.logger.log(`Creating tenant admin for tenant: ${request.tenantId}`);
    return this.systemAdminService.createTenantAdmin(request);
  }

  /**
   * Get metrics for a specific tenant
   */
  @Get('metrics/tenants/:tenantId')
  async getTenantMetrics(@Param('tenantId') tenantId: string) {
    this.logger.log(`Getting metrics for tenant: ${tenantId}`);
    return this.systemAdminService.getTenantMetrics(tenantId);
  }

  /**
   * Get aggregated metrics across all tenants
   */
  @Get('metrics/aggregated')
  async getAggregatedMetrics() {
    this.logger.log('Getting aggregated metrics');
    return this.systemAdminService.getAggregatedMetrics();
  }
}
