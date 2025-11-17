import { Controller, Get, Param, Post, Body, Put, Delete, Query, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { GoogleService } from './google.service';
import { TenantContext } from '../tenant/tenant.decorator';
import type { TenantContext as TenantContextType } from '../tenant/tenant-context';

@Controller('google')
export class GoogleController {
  private readonly logger = new Logger(GoogleController.name);

  constructor(private readonly googleService: GoogleService) {}

  @Get('token')
  getToken() {
    return this.googleService.getAccessToken();
  }

  @Post('impersonate/:email')
  impersonate(@Param('email') email: string, @Body() body: any) {
    return this.googleService.impersonate(email, body?.scopes);
  }

  // FHIR CRUD proxied under Google
  @Post('fhir/:resourceType')
  fhirCreate(@Param('resourceType') resourceType: string, @Body() body: unknown, @TenantContext() ctx: TenantContextType) {
    return this.googleService.fhirCreate(resourceType, body, ctx);
  }

  @Get('fhir/:resourceType/:id')
  fhirRead(@Param('resourceType') resourceType: string, @Param('id') id: string, @TenantContext() ctx: TenantContextType) {
    return this.googleService.fhirRead(resourceType, id, ctx);
  }

  @Put('fhir/:resourceType/:id')
  fhirUpdate(
    @Param('resourceType') resourceType: string,
    @Param('id') id: string,
    @Body() body: unknown,
    @TenantContext() ctx: TenantContextType,
  ) {
    return this.googleService.fhirUpdate(resourceType, id, body, ctx);
  }

  /**
   * Delete a Patient and all dependent resources (cascading delete)
   * Deletes DocumentReferences, Composition, and Patient in the correct order
   * NOTE: This route must be defined BEFORE the generic fhir/:resourceType/:id route
   */
  @Delete('fhir/Patient/:patientId/with-dependencies')
  async deletePatientWithDependencies(
    @Param('patientId') patientId: string,
    @Query('compositionId') compositionId: string,
    @TenantContext() ctx: TenantContextType,
  ) {
    if (!compositionId) {
      throw new HttpException(
        {
          message: 'compositionId query parameter is required',
          patientId,
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const result = await this.googleService.deletePatientWithDependencies(patientId, compositionId, ctx);
      
      if (!result.success) {
        throw new HttpException(
          {
            message: 'Failed to delete patient and dependencies',
            patientId,
            compositionId,
            deleted: result.deleted,
            errors: result.errors,
          },
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      return {
        success: true,
        message: 'Patient and all dependencies deleted successfully',
        deleted: result.deleted,
        errors: result.errors.length > 0 ? result.errors : undefined,
      };
    } catch (error) {
      this.logger.error(`Failed to delete patient with dependencies ${patientId} (tenant: ${ctx.tenantId}):`, error);
      
      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        {
          message: error.message || 'Failed to delete patient and dependencies',
          patientId,
          compositionId,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete('fhir/:resourceType/:id')
  async fhirDelete(@Param('resourceType') resourceType: string, @Param('id') id: string, @TenantContext() ctx: TenantContextType) {
    try {
      const result = await this.googleService.fhirDelete(resourceType, id, ctx);
      return { success: true, message: `${resourceType} deleted successfully`, data: result };
    } catch (error) {
      this.logger.error(`Failed to delete ${resourceType}/${id} (tenant: ${ctx.tenantId}):`, error);
      
      // Extract error details from the FHIR API response
      const statusCode = error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR;
      const errorMessage = error.response?.data?.message || 
                          error.response?.data?.issue?.[0]?.details?.text || 
                          error.message || 
                          'Failed to delete resource';
      
      throw new HttpException(
        {
          message: errorMessage,
          resourceType,
          id,
          statusCode,
          details: error.response?.data,
        },
        statusCode,
      );
    }
  }

  @Get('fhir/:resourceType')
  fhirSearch(@Param('resourceType') resourceType: string, @Query() query: any, @TenantContext() ctx: TenantContextType) {
    return this.googleService.fhirSearch(resourceType, query, ctx);
  }

  /**
   * Execute FHIR bundle request
   */
  @Post('fhir')
  async executeBundle(
    @TenantContext() ctx: TenantContextType,
    @Body() bundle: any,
  ): Promise<any> {
    try {
      this.logger.log(`📦 Executing FHIR bundle with ${bundle.entry?.length || 0} entries (tenant: ${ctx.tenantId})`);
      
      const result = await this.googleService.fhirBundle(bundle, ctx);
      
      this.logger.log(`✅ Bundle execution completed successfully`);
      return {
        success: true,
        result,
        timestamp: new Date().toISOString(),
        tenantId: ctx.tenantId,
      };
    } catch (error) {
      this.logger.error(`❌ Bundle execution failed: ${error.message}`);
      throw new HttpException(
        {
          message: 'Bundle execution failed',
          error: error.message,
          tenantId: ctx.tenantId,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Common method to fetch and process Composition binaries with optional tag filtering
   */
  private async fetchCompositionBinaries(
    id: string,
    ctx: TenantContextType,
    tagFilter?: {
      summaryTags: string[];
      instructionsTags: string[];
    },
  ): Promise<any> {
    // Step 1: Get Composition with included entries
    const compositionQuery = {
      _id: id,
      _include: 'Composition:entry',
    };
    
    const compositionResult = await this.googleService.fhirSearch('Composition', compositionQuery, ctx);
    
    if (!compositionResult || !compositionResult.entry || compositionResult.entry.length === 0) {
      throw new HttpException(
        {
          message: 'Composition not found',
          compositionId: id,
          tenantId: ctx.tenantId,
        },
        HttpStatus.NOT_FOUND,
      );
    }

    const composition = compositionResult.entry[0].resource;
    this.logger.log(`✅ Found Composition with ${composition.section?.length || 0} sections`);

    // Step 2: Extract Binary references from all Composition sections
    const binaryReferences: string[] = [];
    
    if (composition.section) {
      // Check all sections for Binary references
      for (const section of composition.section) {
        if (section.entry) {
          for (const entry of section.entry) {
            if (entry.reference) {
              const match = entry.reference.match(/^Binary\/(.+)$/);
              if (match) {
                binaryReferences.push(match[1]);
              }
            }
          }
        }
      }
    }

    this.logger.log(`🔍 Found ${binaryReferences.length} Binary references`);

    // Step 3: Fetch Binary resources and process them
    const dischargeSummaries: any[] = [];
    const dischargeInstructions: any[] = [];

    for (const binaryId of binaryReferences) {
      try {
        const binaryResult = await this.googleService.fhirRead('Binary', binaryId, ctx);
        
        if (binaryResult && binaryResult.contentType === 'text/plain') {
          // Determine category based on tags with optional filtering
          let category = 'unknown';
          let shouldInclude = true;

          if (binaryResult.meta && binaryResult.meta.tag) {
            for (const tag of binaryResult.meta.tag) {
              if (tag.system === 'http://aivida.com/fhir/tags') {
                // If tag filter is provided, check if tag matches the filter
                if (tagFilter) {
                  if (tagFilter.summaryTags.includes(tag.code)) {
                    category = 'discharge-summary';
                    shouldInclude = true;
                    break;
                  } else if (tagFilter.instructionsTags.includes(tag.code)) {
                    category = 'discharge-instructions';
                    shouldInclude = true;
                    break;
                  }
                } else {
                  // No filter - match any tag that starts with discharge-summary or discharge-instructions
                  if (tag.code === 'discharge-summary' || tag.code.startsWith('discharge-summary-')) {
                    category = 'discharge-summary';
                    break;
                  } else if (tag.code === 'discharge-instructions' || tag.code.startsWith('discharge-instructions-')) {
                    category = 'discharge-instructions';
                    break;
                  }
                }
              }
            }
          }

          // Only process if it matches the filter (or no filter is provided)
          if (shouldInclude && (tagFilter ? category !== 'unknown' : true)) {
            // Convert base64 to text
            const textContent = Buffer.from(binaryResult.data, 'base64').toString('utf8');

            const binaryData = {
              id: binaryId,
              contentType: binaryResult.contentType,
              size: binaryResult.size || 0,
              text: textContent,
              category: category,
              tags: binaryResult.meta?.tag || [],
            };

            if (category === 'discharge-summary') {
              dischargeSummaries.push(binaryData);
            } else if (category === 'discharge-instructions') {
              dischargeInstructions.push(binaryData);
            }

            this.logger.log(`✅ Processed Binary ${binaryId} (${category})`);
          } else {
            const filterType = tagFilter ? 'filter' : '';
            this.logger.log(`⏭️ Skipped Binary ${binaryId} (does not match ${filterType} criteria)`);
          }
        } else {
          this.logger.log(`⏭️ Skipped Binary ${binaryId} (not text/plain)`);
        }
      } catch (error) {
        this.logger.warn(`⚠️ Failed to process Binary ${binaryId}: ${error.message}`);
      }
    }

    return {
      success: true,
      compositionId: id,
      dischargeSummaries,
      dischargeInstructions,
      totalBinaries: binaryReferences.length,
      processedBinaries: dischargeSummaries.length + dischargeInstructions.length,
      timestamp: new Date().toISOString(),
      tenantId: ctx.tenantId,
    };
  }

  /**
   * Get Composition binaries with text conversion
   */
  @Get('fhir/Composition/:id/binaries')
  async getCompositionBinaries(
    @Param('id') id: string,
    @TenantContext() ctx: TenantContextType,
  ): Promise<any> {
    try {
      this.logger.log(`📋 Retrieving Composition ${id} binaries (tenant: ${ctx.tenantId})`);
      const result = await this.fetchCompositionBinaries(id, ctx);
      this.logger.log(`✅ Composition binaries processed: ${result.dischargeSummaries.length} summaries, ${result.dischargeInstructions.length} instructions`);
      return result;
    } catch (error) {
      this.logger.error(`❌ Failed to retrieve Composition binaries ${id}: ${error.message}`);
      throw new HttpException(
        {
          message: 'Failed to retrieve Composition binaries',
          error: error.message,
          compositionId: id,
          tenantId: ctx.tenantId,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get Composition simplified binaries (filtered by discharge-summary-simplified and discharge-instructions-simplified tags)
   */
  @Get('fhir/Composition/:id/simplified')
  async getCompositionSimplifiedBinaries(
    @Param('id') id: string,
    @TenantContext() ctx: TenantContextType,
  ): Promise<any> {
    try {
      this.logger.log(`📋 Retrieving simplified binaries for Composition ${id} (tenant: ${ctx.tenantId})`);
      const result = await this.fetchCompositionBinaries(id, ctx, {
        summaryTags: ['discharge-summary-simplified'],
        instructionsTags: ['discharge-instructions-simplified'],
      });
      this.logger.log(`✅ Simplified binaries processed: ${result.dischargeSummaries.length} summaries, ${result.dischargeInstructions.length} instructions`);
      return result;
    } catch (error) {
      this.logger.error(`❌ Failed to retrieve simplified binaries ${id}: ${error.message}`);
      throw new HttpException(
        {
          message: 'Failed to retrieve simplified binaries',
          error: error.message,
          compositionId: id,
          tenantId: ctx.tenantId,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get Composition translated binaries (filtered by discharge-summary-translated and discharge-instructions-translated tags)
   */
  @Get('fhir/Composition/:id/translated')
  async getCompositionTranslatedBinaries(
    @Param('id') id: string,
    @TenantContext() ctx: TenantContextType,
  ): Promise<any> {
    try {
      this.logger.log(`📋 Retrieving translated binaries for Composition ${id} (tenant: ${ctx.tenantId})`);
      const result = await this.fetchCompositionBinaries(id, ctx, {
        summaryTags: ['discharge-summary-translated'],
        instructionsTags: ['discharge-instructions-translated'],
      });
      this.logger.log(`✅ Translated binaries processed: ${result.dischargeSummaries.length} summaries, ${result.dischargeInstructions.length} instructions`);
      return result;
    } catch (error) {
      this.logger.error(`❌ Failed to retrieve translated binaries ${id}: ${error.message}`);
      throw new HttpException(
        {
          message: 'Failed to retrieve translated binaries',
          error: error.message,
          compositionId: id,
          tenantId: ctx.tenantId,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}


