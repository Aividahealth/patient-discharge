import { Controller, Get, HttpException, HttpStatus, Logger, UseGuards, Query } from '@nestjs/common';
import { DischargeUploadService } from './discharge-upload.service';
import { TenantContext } from '../tenant/tenant.decorator';
import type { TenantContext as TenantContextType } from '../tenant/tenant-context';
import { CurrentUser } from '../auth/user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard, TenantGuard, PatientResourceGuard } from '../auth/guards';

// Patients endpoints allow patient, clinician, expert, tenant_admin, or system_admin role
@Controller('api/patients')
@UseGuards(RolesGuard, TenantGuard)
@Roles('patient', 'clinician', 'expert', 'tenant_admin', 'system_admin')
export class PatientsController {
  private readonly logger = new Logger(PatientsController.name);

  constructor(private readonly dischargeUploadService: DischargeUploadService) {}

  /**
   * GET /api/patients/discharge-queue
   * Retrieves list of patients ready for discharge review
   * Patients can only see their own discharge queue item
   * @param status - Optional query parameter to filter by status (review, approved, all)
   */
  @Get('discharge-queue')
  async getDischargeQueue(
    @TenantContext() ctx: TenantContextType,
    @CurrentUser() user: any,
    @Query('status') status?: string,
  ) {
    try {
      this.logger.log(`📋 Retrieving discharge queue for user: ${user?.username} (role: ${user?.role}) in tenant: ${ctx.tenantId}, status filter: ${status || 'default'}`);
      // For patients, filter by their linkedPatientId
      const patientIdFilter = user?.role === 'patient' ? user?.linkedPatientId : undefined;
      const result = await this.dischargeUploadService.getDischargeQueue(ctx, patientIdFilter, status, user?.role);
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(`❌ Failed to retrieve discharge queue: ${error.message}`);
      throw new HttpException(
        {
          message: 'Failed to retrieve discharge queue',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}

