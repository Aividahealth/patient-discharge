import { Controller, Get, Post, Put, Delete, Param, Body, Query, HttpException, HttpStatus } from '@nestjs/common';
import { CernerService } from './cerner.service';

@Controller('cerner')
export class CernerController {
  constructor(private readonly cernerService: CernerService) {}

  // Generic CRUD operations
  @Post(':resourceType')
  async createResource(@Param('resourceType') resourceType: string, @Body() resource: any) {
    try {
      const result = await this.cernerService.createResource(resourceType, resource);
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
  async fetchResource(@Param('resourceType') resourceType: string, @Param('id') id: string) {
    try {
      const result = await this.cernerService.fetchResource(resourceType, id);
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
  ) {
    try {
      const result = await this.cernerService.updateResource(resourceType, id, resource);
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
  async deleteResource(@Param('resourceType') resourceType: string, @Param('id') id: string) {
    try {
      const result = await this.cernerService.deleteResource(resourceType, id);
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
  async searchResource(@Param('resourceType') resourceType: string, @Query() query: any) {
    try {
      const result = await this.cernerService.searchResource(resourceType, query);
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
  async createDischargeSummary(@Body() body: { patientId: string; encounterId: string; summaryData: any }) {
    try {
      const result = await this.cernerService.createDischargeSummary(body.patientId, body.encounterId, body.summaryData);
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
  async testTokenReuse() {
    const results: { attempt: number; hasResult: boolean }[] = [];
    for (let i = 0; i < 3; i++) {
      const result = await this.cernerService.searchResource('Patient', { _count: 1 });
      results.push({ attempt: i + 1, hasResult: !!result });
    }
    return { message: 'Token reuse test completed', results };
  }

  // Discharge Summary Operations
  @Get('discharge-summaries/:patientId')
  async searchDischargeSummaries(@Param('patientId') patientId: string) {
    try {
      const result = await this.cernerService.searchDischargeSummaries(patientId);
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
    @Query('accept') acceptType: string = 'application/pdf'
  ) {
    try {
      const result = await this.cernerService.fetchBinaryDocument(binaryId, acceptType);
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

  // Acceptance Test Endpoint
  @Get('test/discharge-summary-pipeline/:patientId')
  async testDischargeSummaryPipeline(@Param('patientId') patientId: string) {
    try {
      // Step 1: Search for discharge summaries
      const summaries = await this.cernerService.searchDischargeSummaries(patientId);
      
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
          binaryContent = await this.cernerService.fetchBinaryDocument(binaryId);
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