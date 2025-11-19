import { Controller, Post, Body, Param, HttpException, HttpStatus, Logger, UseGuards } from '@nestjs/common';
import { DischargeUploadService } from './discharge-upload.service';
import { TenantContext } from '../tenant/tenant.decorator';
import type { TenantContext as TenantContextType } from '../tenant/tenant-context';
import { CurrentUser } from '../auth/user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard, TenantGuard } from '../auth/guards';

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
@UseGuards(RolesGuard, TenantGuard)
@Roles('clinician', 'expert', 'tenant_admin', 'system_admin')
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

  /**
   * POST /api/discharge-summary/:compositionId/publish
   * Publish discharge summary to patient with section approvals and clarifications
   * NOTE: This route must be defined before :compositionId/completed to avoid route conflicts
   */
  @Post(':compositionId/publish')
  async publish(
    @Param('compositionId') compositionId: string,
    @Body() body: {
      sectionApprovals?: {
        medications?: { approved: boolean; approvedAt: string; approvedBy: { id: string; name: string } };
        appointments?: { approved: boolean; approvedAt: string; approvedBy: { id: string; name: string } };
        dietActivity?: { approved: boolean; approvedAt: string; approvedBy: { id: string; name: string } };
      };
      additionalClarifications?: string;
      redactionPreferences?: {
        redactRoomNumber?: boolean;
        redactMRN?: boolean;
        redactInsuranceInfo?: boolean;
      };
      clinician?: { id: string; name: string; email: string };
    },
    @TenantContext() ctx: TenantContextType,
    @CurrentUser() user: any,
  ) {
    try {
      this.logger.log(
        `📤 Publishing discharge summary for Composition: ${compositionId} by user: ${user?.username}`,
      );

      // Mark as completed (this updates the Encounter status)
      const result = await this.dischargeUploadService.markDischargeCompleted(compositionId, ctx);

      // TODO: Store section approvals, clarifications, and redaction preferences
      // This could be stored in the Composition meta or in a separate audit/approval collection
      this.logger.log(`✅ Published discharge summary. Composition ID: ${compositionId}`, {
        sectionApprovals: body.sectionApprovals,
        hasClarifications: !!body.additionalClarifications,
        redactionPreferences: body.redactionPreferences,
      });

      return {
        ...result,
        message: 'Discharge summary published successfully',
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(`❌ Failed to publish discharge summary: ${error.message}`);
      throw new HttpException(
        {
          message: 'Failed to publish discharge summary',
          error: error.message,
          compositionId,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * POST /api/discharge-summary/:compositionId/completed
   * Move patient from discharge queue to discharged (mark as completed)
   */
  @Post(':compositionId/completed')
  async markCompleted(
    @Param('compositionId') compositionId: string,
    @TenantContext() ctx: TenantContextType,
    @CurrentUser() user: any,
  ) {
    try {
      this.logger.log(
        `📝 Marking discharge as completed for Composition: ${compositionId} by user: ${user?.username}`,
      );

      const result = await this.dischargeUploadService.markDischargeCompleted(compositionId, ctx);

      this.logger.log(`✅ Successfully marked discharge as completed. Composition ID: ${compositionId}`);
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(`❌ Failed to mark discharge as completed: ${error.message}`);
      throw new HttpException(
        {
          message: 'Failed to mark discharge as completed',
          error: error.message,
          compositionId,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}

