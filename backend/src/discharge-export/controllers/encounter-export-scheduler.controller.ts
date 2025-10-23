import { Controller, Post, Query } from '@nestjs/common';
import { EncounterExportScheduler } from '../services/encounter-export.scheduler';

@Controller('scheduler/encounter-export')
export class EncounterExportSchedulerController {
  constructor(
    private readonly encounterExportScheduler: EncounterExportScheduler,
  ) {}

  /**
   * Manual trigger for encounter export scheduler
   */
  @Post('trigger')
  async triggerEncounterExport(
    @Query('tenantId') tenantId?: string,
  ): Promise<{ success: boolean; message: string; tenantId?: string }> {
    try {
      await this.encounterExportScheduler.triggerManualEncounterCheck(tenantId);
      
      return {
        success: true,
        message: tenantId 
          ? `Encounter export triggered successfully for tenant: ${tenantId}`
          : 'Encounter export triggered successfully for all tenants',
        tenantId,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to trigger encounter export: ${error.message}`,
        tenantId,
      };
    }
  }
}
