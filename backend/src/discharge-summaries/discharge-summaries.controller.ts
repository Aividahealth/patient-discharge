import {
  Controller,
  Get,
  Query,
  Param,
  Post,
  Delete,
  HttpCode,
  HttpStatus,
  Logger,
  UseGuards,
} from '@nestjs/common';
import { DischargeSummariesService } from './discharge-summaries.service';
import {
  DischargeSummaryVersion,
  DischargeSummaryLanguage,
} from './discharge-summary.types';
import type {
  DischargeSummaryListQuery,
  DischargeSummaryContentQuery,
} from './discharge-summary.types';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { TenantGuard } from '../auth/guards/tenant.guard';

@Controller('discharge-summaries')
@UseGuards(AuthGuard, RolesGuard, TenantGuard)
@Roles('clinician', 'expert', 'patient', 'tenant_admin', 'system_admin')
export class DischargeSummariesController {
  private readonly logger = new Logger(DischargeSummariesController.name);

  constructor(
    private readonly dischargeSummariesService: DischargeSummariesService,
  ) {}

  /**
   * List discharge summaries with filtering and pagination
   * GET /discharge-summaries?patientName=Smith&status=simplified&limit=20
   */
  @Get()
  async list(@Query() query: DischargeSummaryListQuery) {
    this.logger.log(`List discharge summaries: ${JSON.stringify(query)}`);

    // Parse numeric query parameters
    const parsedQuery: DischargeSummaryListQuery = {
      ...query,
      limit: query.limit ? parseInt(query.limit as any, 10) : undefined,
      offset: query.offset ? parseInt(query.offset as any, 10) : undefined,
    };

    return this.dischargeSummariesService.list(parsedQuery);
  }

  /**
   * Get discharge summary metadata by ID
   * GET /discharge-summaries/:id
   */
  @Get(':id')
  async getById(@Param('id') id: string) {
    this.logger.log(`Get discharge summary: ${id}`);
    return this.dischargeSummariesService.getById(id);
  }

  /**
   * Get discharge summary content
   * GET /discharge-summaries/:id/content?version=simplified&language=es
   */
  @Get(':id/content')
  async getContent(
    @Param('id') id: string,
    @Query('version') version: DischargeSummaryVersion = DischargeSummaryVersion.SIMPLIFIED,
    @Query('language') language?: DischargeSummaryLanguage,
  ) {
    this.logger.log(
      `Get discharge summary content: ${id}, version: ${version}, language: ${language}`,
    );

    const query: DischargeSummaryContentQuery = {
      id,
      version,
      language,
    };

    return this.dischargeSummariesService.getWithContent(query);
  }

  /**
   * Get statistics
   * GET /discharge-summaries/stats/overview
   */
  @Get('stats/overview')
  async getStats() {
    this.logger.log('Get discharge summaries statistics');
    return this.dischargeSummariesService.getStats();
  }

  /**
   * Sync all files from GCS to Firestore
   * POST /discharge-summaries/sync/all
   */
  @Post('sync/all')
  @HttpCode(HttpStatus.OK)
  async syncAll() {
    this.logger.log('Starting full sync from GCS to Firestore');
    return this.dischargeSummariesService.syncFromGcs();
  }

  /**
   * Sync single file from GCS to Firestore
   * POST /discharge-summaries/sync/file
   * Body: { bucketName: string, fileName: string }
   */
  @Post('sync/file')
  @HttpCode(HttpStatus.OK)
  async syncFile(@Query('bucket') bucketName: string, @Query('file') fileName: string) {
    this.logger.log(`Syncing file: ${bucketName}/${fileName}`);
    return this.dischargeSummariesService.syncSingleFile(bucketName, fileName);
  }

  /**
   * Delete discharge summary and associated files
   * DELETE /discharge-summaries/:id
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async delete(@Param('id') id: string) {
    this.logger.log(`Delete discharge summary: ${id}`);
    return this.dischargeSummariesService.delete(id);
  }

  /**
   * HIPAA M-8: Export patient discharge summary data
   * GET /discharge-summaries/:id/export
   * Returns discharge summary in FHIR-compatible JSON format for patient download
   */
  @Get(':id/export')
  async exportPatientData(@Param('id') id: string) {
    this.logger.log(`Export patient data for discharge summary: ${id}`);

    // Get summary metadata
    const metadata = await this.dischargeSummariesService.getById(id);

    // Get content (simplified version if available, otherwise raw)
    const contentQuery = {
      id,
      version: metadata.files.simplified
        ? DischargeSummaryVersion.SIMPLIFIED
        : DischargeSummaryVersion.RAW,
    };
    const summaryWithContent = await this.dischargeSummariesService.getWithContent(contentQuery);

    // Return in export-friendly format
    return {
      exportDate: new Date().toISOString(),
      patientInfo: {
        patientId: metadata.patientId,
        patientName: metadata.patientName,
        mrn: metadata.mrn,
      },
      encounter: {
        encounterId: metadata.encounterId,
        admissionDate: metadata.admissionDate,
        dischargeDate: metadata.dischargeDate,
        facility: metadata.metadata?.facility,
        department: metadata.metadata?.department,
      },
      clinicalInfo: {
        attendingPhysician: metadata.metadata?.attendingPhysician,
        diagnosis: metadata.metadata?.diagnosis || [],
      },
      dischargeSummary: {
        content: summaryWithContent.content?.content,
        version: summaryWithContent.content?.version,
        lastModified: metadata.updatedAt,
      },
      metadata: {
        createdAt: metadata.createdAt,
        status: metadata.status,
        availableVersions: {
          raw: !!metadata.files.raw,
          simplified: !!metadata.files.simplified,
          translated: metadata.files.translated
            ? Object.keys(metadata.files.translated)
            : [],
        },
      },
    };
  }
}
