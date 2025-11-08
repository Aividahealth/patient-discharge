import { Controller, Post, Body, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { DischargeUploadService } from './discharge-upload.service';
import { TenantContext } from '../tenant/tenant.decorator';
import type { TenantContext as TenantContextType } from '../tenant/tenant-context';
import { CurrentUser } from '../auth/user.decorator';

interface UploadDischargeSummaryRequest {
  id: string;
  mrn: string;
  name: string;
  room: string;
  unit: string;
  dischargeDate: string;
  rawDischargeSummary: string;
  rawDischargeInstructions: string;
  status: string;
  attendingPhysician: {
    name: string;
    id: string;
  };
  avatar?: string;
}

@Controller('api/discharge-summary')
export class DischargeUploadController {
  private readonly logger = new Logger(DischargeUploadController.name);

  constructor(private readonly dischargeUploadService: DischargeUploadService) {}

  /**
   * POST /api/discharge-summary/upload
   * Upload a new discharge summary document for processing
   */
  @Post('upload')
  async upload(
    @Body() body: UploadDischargeSummaryRequest,
    @TenantContext() ctx: TenantContextType,
    @CurrentUser() user: any,
  ) {
    try {
      this.logger.log(`📤 Upload request from user: ${user?.username} in tenant: ${ctx.tenantId}`);

      // Validate required fields
      if (!body.id || !body.mrn || !body.name || !body.rawDischargeSummary || !body.rawDischargeInstructions) {
        throw new HttpException(
          {
            message: 'Missing required fields',
            error: 'id, mrn, name, rawDischargeSummary, and rawDischargeInstructions are required',
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      const result = await this.dischargeUploadService.uploadDischargeSummary(body, ctx);

      this.logger.log(`✅ Upload successful. Composition ID: ${result.compositionId}`);
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(`❌ Upload failed: ${error.message}`);
      throw new HttpException(
        {
          message: 'Failed to upload discharge summary',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}

