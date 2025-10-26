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

  @Delete('fhir/:resourceType/:id')
  fhirDelete(@Param('resourceType') resourceType: string, @Param('id') id: string, @TenantContext() ctx: TenantContextType) {
    return this.googleService.fhirDelete(resourceType, id, ctx);
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
   * Get Composition binaries with text conversion
   */
  @Get('fhir/Composition/:id/binaries')
  async getCompositionBinaries(
    @Param('id') id: string,
    @TenantContext() ctx: TenantContextType,
  ): Promise<any> {
    try {
      this.logger.log(`📋 Retrieving Composition ${id} binaries (tenant: ${ctx.tenantId})`);
      
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
      this.logger.log(`✅ Found Composition with ${composition.entry?.length || 0} entries`);

      // Step 2: Extract Binary references from Composition sections
      const binaryReferences: string[] = [];
      
      // Log the composition structure for debugging
      this.logger.log(`🔍 Composition structure: ${composition.section?.length || 0} sections, ${composition.entry?.length || 0} entries`);
      
      if (composition.section) {
        for (const section of composition.section) {
          if (section.entry) {
            for (const entry of section.entry) {
              if (entry.reference) {
                // Check if this is a Binary reference
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
            // Convert base64 to text
            const textContent = Buffer.from(binaryResult.data, 'base64').toString('utf8');
            
            // Determine category based on tags
            let category = 'unknown';
            if (binaryResult.meta && binaryResult.meta.tag) {
              for (const tag of binaryResult.meta.tag) {
                if (tag.system === 'http://aivida.com/fhir/tags') {
                  if (tag.code === 'discharge-summary') {
                    category = 'discharge-summary';
                  } else if (tag.code === 'discharge-instructions') {
                    category = 'discharge-instructions';
                  }
                  break;
                }
              }
            }

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
            this.logger.log(`⏭️ Skipped Binary ${binaryId} (not text/plain)`);
          }
        } catch (error) {
          this.logger.warn(`⚠️ Failed to process Binary ${binaryId}: ${error.message}`);
        }
      }

      this.logger.log(`✅ Composition binaries processed: ${dischargeSummaries.length} summaries, ${dischargeInstructions.length} instructions`);

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
}


