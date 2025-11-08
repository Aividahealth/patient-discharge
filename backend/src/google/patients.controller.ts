import { Controller, Get, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { DischargeUploadService } from './discharge-upload.service';
import { TenantContext } from '../tenant/tenant.decorator';
import type { TenantContext as TenantContextType } from '../tenant/tenant-context';
import { CurrentUser } from '../auth/user.decorator';

@Controller('api/patients')
export class PatientsController {
  private readonly logger = new Logger(PatientsController.name);

  constructor(private readonly dischargeUploadService: DischargeUploadService) {}

  /**
   * GET /api/patients/discharge-queue
   * Retrieves list of patients ready for discharge review
   */
  @Get('discharge-queue')
  async getDischargeQueue(
    @TenantContext() ctx: TenantContextType,
    @CurrentUser() user: any,
  ) {
    try {
      this.logger.log(`📋 Retrieving discharge queue for user: ${user?.username} in tenant: ${ctx.tenantId}`);
      const result = await this.dischargeUploadService.getDischargeQueue(ctx);
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

