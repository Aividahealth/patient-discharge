import { Controller, Post, Param, Body, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { SimplifiedContentService } from './simplified-content.service';
import { TenantContext } from '../tenant/tenant.decorator';
import type { TenantContext as TenantContextType } from '../tenant/tenant-context';

@Controller('api/fhir/composition')
export class CompositionSimplifiedController {
  private readonly logger = new Logger(CompositionSimplifiedController.name);

  constructor(private readonly simplifiedContentService: SimplifiedContentService) {}

  /**
   * POST /api/fhir/composition/:compositionId/simplified
   * Write simplified content back to FHIR store
   */
  @Post(':compositionId/simplified')
  async postSimplifiedContent(
    @Param('compositionId') compositionId: string,
    @Body() body: {
      tenantId: string;
      simplifiedContent: {
        dischargeSummary?: {
          content?: string;
          gcsPath?: string;
        };
        dischargeInstructions?: {
          content?: string;
          gcsPath?: string;
        };
      };
    },
    @TenantContext() ctx: TenantContextType,
  ): Promise<{
    success: boolean;
    fhirResourceId?: string;
    documentReferenceIds?: string[];
    timestamp: string;
  }> {
    try {
      this.logger.log(`📝 Processing simplified content for Composition: ${compositionId}`);

      const result = await this.simplifiedContentService.processSimplifiedContent(
        compositionId,
        body.simplifiedContent,
        ctx,
      );

      return {
        success: result.success,
        fhirResourceId: result.fhirResourceId,
        documentReferenceIds: result.documentReferenceIds,
        timestamp: result.timestamp,
      };
    } catch (error) {
      this.logger.error(`❌ Failed to process simplified content: ${error.message}`);
      throw new HttpException(
        {
          message: 'Failed to process simplified content',
          error: error.message,
          compositionId,
          tenantId: ctx.tenantId,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * POST /api/fhir/composition/:compositionId/translated
   * Write translated content back to FHIR store
   */
  @Post(':compositionId/translated')
  async postTranslatedContent(
    @Param('compositionId') compositionId: string,
    @Body() body: {
      tenantId: string;
      translatedContent: {
        dischargeSummary?: {
          content?: string;
          gcsPath?: string;
        };
        dischargeInstructions?: {
          content?: string;
          gcsPath?: string;
        };
      };
    },
    @TenantContext() ctx: TenantContextType,
  ): Promise<{
    success: boolean;
    fhirResourceId?: string;
    documentReferenceIds?: string[];
    timestamp: string;
  }> {
    try {
      this.logger.log(`📝 Processing translated content for Composition: ${compositionId}`);

      const result = await this.simplifiedContentService.processTranslatedContent(
        compositionId,
        body.translatedContent,
        ctx,
      );

      return {
        success: result.success,
        fhirResourceId: result.fhirResourceId,
        documentReferenceIds: result.documentReferenceIds,
        timestamp: result.timestamp,
      };
    } catch (error) {
      this.logger.error(`❌ Failed to process translated content: ${error.message}`);
      throw new HttpException(
        {
          message: 'Failed to process translated content',
          error: error.message,
          compositionId,
          tenantId: ctx.tenantId,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}

