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
}
