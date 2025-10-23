import { Controller, Post, Query, HttpException, HttpStatus } from '@nestjs/common';
import { DocumentExportScheduler } from '../discharge-export/services/document-export.scheduler';

@Controller('scheduler')
export class SchedulerController {
  constructor(
    private readonly documentExportScheduler: DocumentExportScheduler,
  ) {}

  /**
   * Manually trigger the document export check
   * Useful for testing and debugging
   */
  @Post('trigger-document-export')
  async triggerDocumentExport(
    @Query('tenantId') tenantId?: string,
  ): Promise<{ message: string; success: boolean }> {
    try {
      await this.documentExportScheduler.triggerManualCheck(tenantId);
      
      return {
        message: tenantId 
          ? `Document export check triggered for tenant: ${tenantId}`
          : 'Document export check triggered for all tenants',
        success: true,
      };
    } catch (error) {
      throw new HttpException(
        {
          message: 'Failed to trigger document export check',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
