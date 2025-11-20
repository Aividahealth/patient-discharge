import { Controller, Post, Body, Param, Query, HttpException, HttpStatus, Logger, UseGuards, Inject } from '@nestjs/common';
import { DischargeUploadService } from './discharge-upload.service';
import { TenantContext } from '../tenant/tenant.decorator';
import type { TenantContext as TenantContextType } from '../tenant/tenant-context';
import { CurrentUser } from '../auth/user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard, TenantGuard } from '../auth/guards';
import { AuditService } from '../audit/audit.service';
import { GoogleService } from './google.service';
import { PubSubService } from '../pubsub/pubsub.service';

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

  constructor(
    private readonly dischargeUploadService: DischargeUploadService,
    private readonly auditService: AuditService,
    private readonly googleService: GoogleService,
    private readonly pubSubService: PubSubService,
  ) {}

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

      // Step 1: Add clarifications to discharge instructions if provided
      if (body.additionalClarifications && body.additionalClarifications.trim()) {
        try {
          await this.dischargeUploadService.addClarificationsToInstructions(
            compositionId,
            body.additionalClarifications,
            ctx,
          );
          this.logger.log(`✅ Added clarifications to discharge instructions`);
        } catch (clarificationError) {
          this.logger.warn(`⚠️ Failed to add clarifications: ${clarificationError.message}`);
          // Continue with publish even if clarifications fail
        }
      }

      // Step 2: Mark as completed (this updates the Encounter status)
      const result = await this.dischargeUploadService.markDischargeCompleted(compositionId, ctx);

      // Step 3: Get patient info for audit logging
      // Extract from result if available, or fetch from composition
      let patientId: string | undefined;
      let patientName: string | undefined;
      
      // Try to get patient info from the discharge queue or composition
      // For now, we'll log without patient info if not easily available
      // The compositionId and encounterId in the result can be used to trace back

      // Step 4: Log audit activity
      try {
        await this.auditService.logClinicianActivity({
          tenantId: ctx.tenantId,
          userId: user?.id || user?.username,
          userName: user?.name || user?.username,
          userRole: user?.role,
          action: 'published',
          resourceType: 'discharge_summary',
          resourceId: compositionId,
          patientId,
          patientName,
          metadata: {
            sectionApprovals: body.sectionApprovals,
            hasClarifications: !!body.additionalClarifications,
            redactionPreferences: body.redactionPreferences,
            clinician: body.clinician,
            publishedAt: new Date().toISOString(),
          },
        });
        this.logger.log(`✅ Logged audit activity for publish`);
      } catch (auditError) {
        this.logger.warn(`⚠️ Failed to log audit activity: ${auditError.message}`);
        // Continue even if audit logging fails
      }

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

  /**
   * POST /api/discharge-summary/republish-events
   * Republish discharge export events for recently uploaded compositions
   * Query params: hoursAgo (default: 24), limit (default: 10)
   */
  @Post('republish-events')
  @Roles('tenant_admin', 'system_admin')
  async republishEvents(
    @Query('hoursAgo') hoursAgoStr: string,
    @Query('limit') limitStr: string,
    @TenantContext() ctx: TenantContextType,
    @CurrentUser() user: any,
  ) {
    try {
      const hoursAgo = parseInt(hoursAgoStr || '24', 10);
      const limit = parseInt(limitStr || '10', 10);

      this.logger.log(
        `🔄 Republishing events for tenant: ${ctx.tenantId}, last ${hoursAgo} hours, limit: ${limit}`,
      );

      // Calculate date threshold
      const dateThreshold = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
      const dateThresholdISO = dateThreshold.toISOString().split('.')[0]; // Remove milliseconds

      // Search for recent compositions
      const searchParams: any = {
        _sort: '-_lastUpdated',
        _count: limit,
        _lastUpdated: `ge${dateThresholdISO}`,
      };

      const searchResult = await this.googleService.fhirSearch('Composition', searchParams, ctx);

      if (!searchResult?.entry || searchResult.entry.length === 0) {
        return {
          success: true,
          message: `No compositions found in the last ${hoursAgo} hours`,
          republished: 0,
          failed: 0,
          total: 0,
        };
      }

      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      // Process each composition
      for (const entry of searchResult.entry) {
        const composition = entry.resource;

        if (!composition || composition.resourceType !== 'Composition') {
          continue;
        }

        const compositionId = composition.id;
        const patientRef = composition.subject?.reference;
        const encounterRef = composition.encounter?.reference;

        if (!patientRef) {
          this.logger.warn(`⚠️  Skipping composition ${compositionId}: no patient reference`);
          continue;
        }

        // Extract patient ID from reference (format: "Patient/patient-id")
        const patientId = patientRef.replace('Patient/', '');
        const googleEncounterId = encounterRef?.replace('Encounter/', '') || '';

        try {
          // Create encounter export event
          const event = {
            tenantId: ctx.tenantId,
            patientId,
            googleCompositionId: compositionId,
            googleEncounterId,
            cernerEncounterId: '',
            exportTimestamp: composition.date || new Date().toISOString(),
            status: 'success' as const,
          };

          // Publish event
          await this.pubSubService.publishEncounterExportEvent(event);
          this.logger.log(`✅ Published event for composition ${compositionId}`);
          successCount++;
        } catch (error) {
          this.logger.error(`❌ Failed to publish event for composition ${compositionId}: ${error.message}`);
          errors.push(`${compositionId}: ${error.message}`);
          errorCount++;
        }
      }

      return {
        success: true,
        message: `Republished ${successCount} events, ${errorCount} failed`,
        republished: successCount,
        failed: errorCount,
        total: searchResult.entry.length,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(`❌ Failed to republish events: ${error.message}`);
      throw new HttpException(
        {
          message: 'Failed to republish events',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}

