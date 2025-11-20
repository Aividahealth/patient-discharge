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
import { TenantContext } from '../tenant/tenant.decorator';
import { TenantContext as TenantContextType } from '../tenant/tenant-context';

@Controller('discharge-summaries')
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
  async list(
    @Query() query: DischargeSummaryListQuery,
    @TenantContext() ctx: TenantContextType,
  ) {
    this.logger.log(`List discharge summaries: ${JSON.stringify(query)} for tenant: ${ctx.tenantId}`);

    // Parse numeric query parameters
    const parsedQuery: DischargeSummaryListQuery = {
      ...query,
      limit: query.limit ? parseInt(query.limit as any, 10) : undefined,
      offset: query.offset ? parseInt(query.offset as any, 10) : undefined,
    };

    return this.dischargeSummariesService.list(parsedQuery, ctx.tenantId);
  }

  /**
   * Get discharge summary metadata by ID
   * GET /discharge-summaries/:id
   */
  @Get(':id')
  async getById(
    @Param('id') id: string,
    @TenantContext() ctx: TenantContextType,
  ) {
    this.logger.log(`Get discharge summary: ${id} for tenant: ${ctx.tenantId}`);
    return this.dischargeSummariesService.getById(id, ctx.tenantId);
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
    @TenantContext() ctx: TenantContextType,
  ) {
    this.logger.log(
      `Get discharge summary content: ${id}, version: ${version}, language: ${language} for tenant: ${ctx.tenantId}`,
    );

    const query: DischargeSummaryContentQuery = {
      id,
      version,
      language,
    };

    return this.dischargeSummariesService.getWithContent(query, ctx.tenantId);
  }

  /**
   * Get statistics
   * GET /discharge-summaries/stats/overview
   */
  @Get('stats/overview')
  async getStats(@TenantContext() ctx: TenantContextType) {
    this.logger.log(`Get discharge summaries statistics for tenant: ${ctx.tenantId}`);
    return this.dischargeSummariesService.getStats(ctx.tenantId);
  }

  /**
   * Sync all files from GCS to Firestore
   * POST /discharge-summaries/sync/all
   */
  @Post('sync/all')
  @HttpCode(HttpStatus.OK)
  async syncAll(@TenantContext() ctx: TenantContextType) {
    this.logger.log(`Starting full sync from GCS to Firestore for tenant: ${ctx.tenantId}`);
    return this.dischargeSummariesService.syncFromGcs(ctx.tenantId);
  }

  /**
   * Sync single file from GCS to Firestore
   * POST /discharge-summaries/sync/file
   * Body: { bucketName: string, fileName: string }
   */
  @Post('sync/file')
  @HttpCode(HttpStatus.OK)
  async syncFile(
    @Query('bucket') bucketName: string,
    @Query('file') fileName: string,
    @TenantContext() ctx: TenantContextType,
  ) {
    this.logger.log(`Syncing file: ${bucketName}/${fileName} for tenant: ${ctx.tenantId}`);
    return this.dischargeSummariesService.syncSingleFile(bucketName, fileName, ctx.tenantId);
  }

  /**
   * Delete discharge summary and associated files
   * DELETE /discharge-summaries/:id
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async delete(
    @Param('id') id: string,
    @TenantContext() ctx: TenantContextType,
  ) {
    this.logger.log(`Delete discharge summary: ${id} for tenant: ${ctx.tenantId}`);
    return this.dischargeSummariesService.delete(id, ctx.tenantId);
  }
}
