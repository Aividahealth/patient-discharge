import { Controller, Get, Query, Request, UseGuards, Logger } from '@nestjs/common';
import { AuditService, AuditLogListResponse } from './audit.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { TenantGuard } from '../auth/guards/tenant.guard';

@Controller('api/audit')
@UseGuards(AuthGuard, RolesGuard, TenantGuard)
@Roles('tenant_admin', 'system_admin')
export class AuditController {
  private readonly logger = new Logger(AuditController.name);

  constructor(private readonly auditService: AuditService) {}

  /**
   * Get audit logs for a tenant
   */
  @Get('logs')
  async getLogs(
    @Request() req,
    @Query('type') type?: 'clinician_activity' | 'simplification' | 'translation' | 'chatbot',
    @Query('userId') userId?: string,
    @Query('patientId') patientId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<AuditLogListResponse> {
    const tenantId = req.headers['x-tenant-id'] || req.user?.tenantId;

    if (!tenantId) {
      this.logger.error('Tenant ID not found in request');
      return {
        items: [],
        total: 0,
        limit: 50,
        offset: 0,
      };
    }

    this.logger.log(`Fetching audit logs for tenant: ${tenantId}`);

    const query = {
      tenantId,
      type,
      userId,
      patientId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      limit: limit ? parseInt(limit, 10) : 50,
      offset: offset ? parseInt(offset, 10) : 0,
    };

    return this.auditService.queryLogs(query);
  }
}
