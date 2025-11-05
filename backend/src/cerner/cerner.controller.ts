import { Controller, Get, Post, Put, Delete, Param, Body, Query, HttpException, HttpStatus } from '@nestjs/common';
import { CernerService } from './cerner.service';
import { TenantContext } from '../tenant/tenant.decorator';
import type { TenantContext as TenantContextType } from '../tenant/tenant-context';
import { AuthType } from '../cerner-auth/types/auth.types';

@Controller('cerner')
export class CernerController {
  constructor(private readonly cernerService: CernerService) {}

  // Generic CRUD operations
  @Post(':resourceType')
  async createResource(@Param('resourceType') resourceType: string, @Body() resource: any, @TenantContext() ctx: TenantContextType) {
    try {
      const result = await this.cernerService.createResource(resourceType, resource, ctx);
      if (result === null) {
        throw new HttpException('Failed to create resource', HttpStatus.INTERNAL_SERVER_ERROR);
      }
      // Check if it's an OperationOutcome (error response)
      if (result.resourceType === 'OperationOutcome') {
        throw new HttpException(result, HttpStatus.BAD_REQUEST);
      }
    return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(error.message || 'Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get(':resourceType/:id')
  async fetchResource(@Param('resourceType') resourceType: string, @Param('id') id: string, @TenantContext() ctx: TenantContextType) {
    try {
      const result = await this.cernerService.fetchResource(resourceType, id, ctx);
      if (result === null) {
        throw new HttpException('Resource not found or failed to fetch', HttpStatus.NOT_FOUND);
      }
      // Check if it's an OperationOutcome (error response)
      if (result.resourceType === 'OperationOutcome') {
        throw new HttpException(result, HttpStatus.BAD_REQUEST);
      }
    return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(error.message || 'Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Put(':resourceType/:id')
  async updateResource(
    @Param('resourceType') resourceType: string,
    @Param('id') id: string,
    @Body() resource: any,
    @TenantContext() ctx: TenantContextType,
  ) {
    try {
      const result = await this.cernerService.updateResource(resourceType, id, resource, ctx);
      if (result === null) {
        throw new HttpException('Failed to update resource', HttpStatus.INTERNAL_SERVER_ERROR);
      }
      // Check if it's an OperationOutcome (error response)
      if (result.resourceType === 'OperationOutcome') {
        throw new HttpException(result, HttpStatus.BAD_REQUEST);
      }
    return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(error.message || 'Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Delete(':resourceType/:id')
  async deleteResource(@Param('resourceType') resourceType: string, @Param('id') id: string, @TenantContext() ctx: TenantContextType) {
    try {
      const result = await this.cernerService.deleteResource(resourceType, id, ctx);
      if (result === false) {
        throw new HttpException('Failed to delete resource', HttpStatus.INTERNAL_SERVER_ERROR);
      }
      // Check if it's an OperationOutcome (error response)
      if (result && typeof result === 'object' && (result as any).resourceType === 'OperationOutcome') {
        throw new HttpException(result, HttpStatus.BAD_REQUEST);
      }
      return { success: true, message: 'Resource deleted successfully' };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(error.message || 'Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get(':resourceType')
  async searchResource(
    @Param('resourceType') resourceType: string, 
    @Query() query: any, 
    @Query('authType') authType: AuthType = AuthType.SYSTEM,
    @TenantContext() ctx: TenantContextType
  ) {
    try {
      const result = await this.cernerService.searchResource(resourceType, query, ctx, authType);
      if (result === null) {
        throw new HttpException('Failed to search resources', HttpStatus.INTERNAL_SERVER_ERROR);
      }
      // Check if it's an OperationOutcome (error response)
      if (result.resourceType === 'OperationOutcome') {
        throw new HttpException(result, HttpStatus.BAD_REQUEST);
      }
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(error.message || 'Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // Specialized operations
  @Post('discharge-summary')
  async createDischargeSummary(@Body() body: { patientId: string; encounterId: string; summaryData: any }, @TenantContext() ctx: TenantContextType) {
    try {
      const result = await this.cernerService.createDischargeSummary(body.patientId, body.encounterId, body.summaryData, ctx);
      if (result === null) {
        throw new HttpException('Failed to create discharge summary', HttpStatus.INTERNAL_SERVER_ERROR);
      }
      return result;
    } catch (error) {
      throw new HttpException(error.message || 'Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // Test endpoint to verify token reuse
  @Get('test/token-reuse')
  async testTokenReuse(@TenantContext() ctx: TenantContextType) {
    const results: { attempt: number; hasResult: boolean }[] = [];
    for (let i = 0; i < 3; i++) {
      const result = await this.cernerService.searchResource('Patient', { _count: 1 }, ctx);
      results.push({ attempt: i + 1, hasResult: !!result });
    }
    return { message: 'Token reuse test completed', results };
  }

  // Discharge Summary Operations
  @Get('discharge-summaries/:patientId')
  async searchDischargeSummaries(@Param('patientId') patientId: string, @TenantContext() ctx: TenantContextType) {
    try {
      const result = await this.cernerService.searchDischargeSummaries(patientId, ctx);
      if (result === null) {
        throw new HttpException('Failed to search discharge summaries', HttpStatus.INTERNAL_SERVER_ERROR);
      }
      if (result.resourceType === 'OperationOutcome') {
        throw new HttpException(result, HttpStatus.BAD_REQUEST);
      }
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(error.message || 'Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('binary/:binaryId')
  async fetchBinaryDocument(
    @Param('binaryId') binaryId: string,
    @Query('accept') acceptType: string = 'application/octet-stream',
    @TenantContext() ctx: TenantContextType
  ) {
    try {
      const result = await this.cernerService.fetchBinaryDocument(binaryId, ctx, acceptType);
      if (result === null) {
        throw new HttpException('Failed to fetch binary document', HttpStatus.INTERNAL_SERVER_ERROR);
      }
      if (result.resourceType === 'OperationOutcome') {
        throw new HttpException(result, HttpStatus.BAD_REQUEST);
      }
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(error.message || 'Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('parse-document-reference')
  async parseDocumentReference(@Body() docRef: any) {
    try {
      const result = this.cernerService.parseDocumentReference(docRef);
      if (result === null) {
        throw new HttpException('Invalid DocumentReference format', HttpStatus.BAD_REQUEST);
      }
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(error.message || 'Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Create DocumentReference in Cerner with base64 content
   */
  @Post('document-reference')
  async createDocumentReference(@Body() body: any, @TenantContext() ctx: TenantContextType) {
    try {
      const result = await this.cernerService.createResource('DocumentReference', body, ctx);
      if (result === null) {
        throw new HttpException('Failed to create DocumentReference', HttpStatus.INTERNAL_SERVER_ERROR);
      }
      if (result.resourceType === 'OperationOutcome') {
        throw new HttpException(result, HttpStatus.BAD_REQUEST);
      }
      return {
        success: true,
        result,
        timestamp: new Date().toISOString(),
        tenantId: ctx.tenantId,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(error.message || 'Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // Acceptance Test Endpoint
  @Get('test/discharge-summary-pipeline/:patientId')
  async testDischargeSummaryPipeline(@Param('patientId') patientId: string, @TenantContext() ctx: TenantContextType) {
    try {
      // Step 1: Search for discharge summaries
      const summaries = await this.cernerService.searchDischargeSummaries(patientId, ctx);
      
      if (!summaries || summaries.total === 0) {
        return {
          success: false,
          message: 'No discharge summaries found for patient',
          patientId,
          summaries: null
        };
      }

      // Step 2: Parse the first DocumentReference
      const firstDoc = summaries.entry?.[0]?.resource;
      const parsed = this.cernerService.parseDocumentReference(firstDoc);

      // Step 3: Check if we can fetch binary content
      let binaryContent: any = null;
      if (parsed?.content?.[0]?.url) {
        const binaryId = parsed.content[0].url.split('/').pop();
        if (binaryId) {
          binaryContent = await this.cernerService.fetchBinaryDocument(binaryId, ctx);
        }
      }

      return {
        success: true,
        message: 'Discharge summary pipeline test completed',
        patientId,
        summaries: {
          total: summaries.total,
          parsedDocument: parsed,
          binaryContent: binaryContent ? {
            id: binaryContent.id,
            contentType: binaryContent.contentType,
            size: binaryContent.size,
            hasData: !!binaryContent.data
          } : null
        }
      };
    } catch (error) {
      return {
        success: false,
        message: 'Pipeline test failed',
        patientId,
        error: error.message
      };
    }
  }
}