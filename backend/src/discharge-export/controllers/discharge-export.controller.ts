import { Controller, Post, Get, Param, Body, Query, HttpException, HttpStatus } from '@nestjs/common';
import { DischargeExportService } from '../services/discharge-export.service';
import { ExportResult } from '../types/discharge-export.types';
import { TenantContext } from '../../tenant/tenant.decorator';
import type { TenantContext as TenantContextType } from '../../tenant/tenant-context';

@Controller('discharge-export')
export class DischargeExportController {
  constructor(private readonly dischargeExportService: DischargeExportService) {}

  /**
   * Export discharge summary from Cerner to Google FHIR
   */
  @Post('export/:documentId')
  async exportDischargeSummary(
    @Param('documentId') documentId: string,
    @TenantContext() ctx: TenantContextType,
    @Body() body?: { documentId?: string },
  ): Promise<ExportResult> {
    try {
      const result = await this.dischargeExportService.exportDischargeSummary(
        ctx,
        documentId,
      );

      if (!result.success) {
        throw new HttpException(
          {
            message: 'Export failed',
            error: result.error,
            metadata: result.metadata,
          },
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        {
          message: 'Export failed',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Export specific document by ID
   */
  @Post('export-document/:documentId')
  async exportDocumentById(
    @Param('documentId') documentId: string,
    @TenantContext() ctx: TenantContextType,
    @Body() body: { patientId: string },
  ): Promise<ExportResult> {
    try {
      const result = await this.dischargeExportService.exportDischargeSummary(
        ctx,
        documentId,
      );

      if (!result.success) {
        throw new HttpException(
          {
            message: 'Document export failed',
            error: result.error,
            metadata: result.metadata,
          },
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        {
          message: 'Document export failed',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get binary resource from Google FHIR store given a DocumentReference ID or Composition ID
   */
  @Get('binary')
  async getBinaryFromDocumentReference(
    @TenantContext() ctx: TenantContextType,
    @Query('documentReferenceId') documentReferenceId?: string,
    @Query('compositionId') compositionId?: string,
  ): Promise<any> {
    try {
      // Validate that at least one ID is provided
      if (!documentReferenceId && !compositionId) {
        throw new HttpException(
          {
            message: 'Either documentReferenceId or compositionId must be provided',
            error: 'Missing required parameter',
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      const result = await this.dischargeExportService.getBinaryFromDocumentReference(
        ctx,
        documentReferenceId,
        compositionId,
      );

      if (!result.success) {
        throw new HttpException(
          {
            message: 'Failed to get binary resource',
            error: result.error,
            documentReference: result.documentReference,
            composition: result.composition,
          },
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        {
          message: 'Failed to get binary resource',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Test endpoint to validate the export pipeline
   */
  @Get('test/:patientId')
  async testExportPipeline(@Param('patientId') patientId: string, @TenantContext() ctx: TenantContextType): Promise<any> {
    try {
      // Step 1: Check if discharge summaries exist in Cerner
      const cernerSummaries = await this.dischargeExportService['findCernerDischargeSummary'](
        ctx,
        undefined, // No specific documentId for test endpoint
      );

      if (!cernerSummaries) {
        return {
          success: false,
          message: 'No discharge summaries found in Cerner',
          patientId,
          steps: {
            cernerSearch: 'FAILED - No documents found',
            googleConnection: 'NOT_TESTED',
            exportPipeline: 'NOT_TESTED',
          },
        };
      }

      // Step 2: Test Google FHIR connection
      let googleConnectionTest = 'FAILED';
      try {
        await this.dischargeExportService['googleService'].fhirSearch('Patient', { _count: 1 }, ctx);
        googleConnectionTest = 'SUCCESS';
      } catch (error) {
        googleConnectionTest = `FAILED - ${error.message}`;
      }

      return {
        success: true,
        message: 'Export pipeline test completed',
        patientId,
        cernerDocument: {
          id: cernerSummaries.id,
          patientId: cernerSummaries.patientId,
          encounterId: cernerSummaries.encounterId,
          date: cernerSummaries.date,
          hasContent: !!cernerSummaries.content?.[0],
        },
        steps: {
          cernerSearch: 'SUCCESS',
          googleConnection: googleConnectionTest,
          exportPipeline: 'READY',
        },
        recommendation: googleConnectionTest === 'SUCCESS'
          ? 'Pipeline is ready for export'
          : 'Fix Google FHIR connection before exporting',
      };
    } catch (error) {
      return {
        success: false,
        message: 'Export pipeline test failed',
        patientId,
        error: error.message,
        steps: {
          cernerSearch: 'FAILED',
          googleConnection: 'NOT_TESTED',
          exportPipeline: 'NOT_TESTED',
        },
      };
    }
  }
}

