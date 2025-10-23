import { Controller, Post, Get, Param, Query, Body } from '@nestjs/common';
import { DischargeSummariesExportService, EncounterExportResult } from '../services/discharge-summaries-export.service';
import { TenantContext } from '../../tenant/tenant.decorator';
import type { TenantContext as TenantContextType } from '../../tenant/tenant-context';

export interface ExportEncounterRequest {
  patientId: string;
  encounterId?: string; // Optional: export specific encounter
}

@Controller('discharge-summaries-v2')
export class DischargeSummariesExportController {
  constructor(
    private readonly dischargeSummariesExportService: DischargeSummariesExportService,
  ) {}

  /**
   * Export complete encounter data for a patient
   */
  @Post('export-encounter-data/:patientId')
  async exportEncounterData(
    @Param('patientId') patientId: string,
    @TenantContext() ctx: TenantContextType,
  ): Promise<EncounterExportResult> {
    return await this.dischargeSummariesExportService.exportEncounterData(ctx, patientId);
  }

  /**
   * Export encounter data via POST body
   */
  @Post('export-encounter-data')
  async exportEncounterDataPost(
    @Body() request: ExportEncounterRequest,
    @TenantContext() ctx: TenantContextType,
  ): Promise<EncounterExportResult> {
    return await this.dischargeSummariesExportService.exportEncounterData(ctx, request.patientId);
  }

  /**
   * Get export status for a patient
   */
  @Get('export-status/:patientId')
  async getExportStatus(
    @Param('patientId') patientId: string,
    @TenantContext() ctx: TenantContextType,
  ): Promise<{ patientId: string; lastExport?: string; status: string }> {
    // This would check the last export status for the patient
    // Implementation would depend on your audit/logging system
    return {
      patientId,
      status: 'unknown',
    };
  }

  /**
   * Test endpoint to check service health
   */
  @Get('health')
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
    };
  }
}
