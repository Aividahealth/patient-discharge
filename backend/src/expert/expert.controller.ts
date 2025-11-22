import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Query,
  Param,
  HttpCode,
  HttpStatus,
  HttpException,
  Logger,
  UseGuards,
} from '@nestjs/common';
import { ExpertService } from './expert.service';
import type { SubmitFeedbackDto, ReviewListQuery, UpdateFeedbackDto } from './expert.types';
import { TenantContext } from '../tenant/tenant.decorator';
import type { TenantContext as TenantContextType } from '../tenant/tenant-context';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard, TenantGuard } from '../auth/guards';

// Expert endpoints require expert, tenant_admin, or system_admin role
@Controller('expert')
@UseGuards(RolesGuard, TenantGuard)
@Roles('expert', 'tenant_admin', 'system_admin')
export class ExpertController {
  private readonly logger = new Logger(ExpertController.name);

  constructor(private readonly expertService: ExpertService) {}

  /**
   * GET /expert/list
   * Get list of discharge summaries for review
   */
  @Get('list')
  async getReviewList(
    @Query() query: ReviewListQuery,
    @TenantContext() ctx: TenantContextType,
  ) {
    this.logger.log(`Getting review list with filters: ${JSON.stringify(query)} for tenant: ${ctx.tenantId}`);
    return this.expertService.getReviewList(query, ctx);
  }

  /**
   * POST /expert/feedback
   * Submit expert feedback
   * Requires authentication - only authenticated experts can submit feedback
   */
  @Post('feedback')
  @HttpCode(HttpStatus.CREATED)
  async submitFeedback(
    @Body() dto: SubmitFeedbackDto,
    @TenantContext() ctx: TenantContextType,
  ) {
    try {
      this.logger.log(`Submitting feedback for summary: ${dto.dischargeSummaryId}`);
      
      // Validate the feedback data
      const validationError = this.expertService.validateFeedback(dto);
      if (validationError) {
        throw new HttpException(
          {
            error: 'Bad Request',
            message: validationError,
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      // Verify composition exists
      const compositionExists = await this.expertService.verifyCompositionExists(dto.dischargeSummaryId, ctx);
      if (!compositionExists) {
        throw new HttpException(
          {
            error: 'Not Found',
            message: `Discharge summary with ID '${dto.dischargeSummaryId}' not found`,
          },
          HttpStatus.NOT_FOUND,
        );
      }

      const feedback = await this.expertService.submitFeedback(dto, ctx.tenantId);
      return {
        success: true,
        id: feedback.id,
        message: 'Expert feedback submitted successfully',
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`Failed to submit feedback: ${error.message}`);
      throw new HttpException(
        {
          error: 'Internal Server Error',
          message: 'Failed to save expert feedback',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /expert/feedback/:id
   * Get feedback by ID
   * Requires authentication
   */
  @Get('feedback/:id')
  async getFeedbackById(
    @Param('id') id: string,
    @TenantContext() ctx: TenantContextType,
  ) {
    try {
      this.logger.log(`Getting feedback by ID: ${id} for tenant: ${ctx.tenantId}`);
      const feedback = await this.expertService.getFeedbackById(id, ctx.tenantId);
      
      if (!feedback) {
        throw new HttpException(
          {
            error: 'Not Found',
            message: `Feedback with ID '${id}' not found`,
          },
          HttpStatus.NOT_FOUND,
        );
      }

      return feedback;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`Failed to get feedback: ${error.message}`);
      throw new HttpException(
        {
          error: 'Internal Server Error',
          message: 'Failed to retrieve feedback',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * PUT /expert/feedback/:id
   * Update existing feedback
   * Requires authentication
   */
  @Put('feedback/:id')
  async updateFeedback(
    @Param('id') id: string,
    @Body() dto: UpdateFeedbackDto,
    @TenantContext() ctx: TenantContextType,
  ) {
    try {
      this.logger.log(`Updating feedback: ${id} for tenant: ${ctx.tenantId}`);

      // Validate the feedback data (only validate provided fields for updates)
      const validationError = this.expertService.validateUpdateFeedback(dto);
      if (validationError) {
        throw new HttpException(
          {
            error: 'Bad Request',
            message: validationError,
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      const feedback = await this.expertService.updateFeedback(id, dto, ctx.tenantId);
      
      if (!feedback) {
        throw new HttpException(
          {
            error: 'Not Found',
            message: `Feedback with ID '${id}' not found`,
          },
          HttpStatus.NOT_FOUND,
        );
      }

      return {
        success: true,
        id: feedback.id,
        message: 'Feedback updated successfully',
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`Failed to update feedback: ${error.message}`);
      throw new HttpException(
        {
          error: 'Internal Server Error',
          message: 'Failed to update feedback',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /expert/feedback/summary/:summaryId
   * Get feedback for a specific discharge summary with aggregated statistics
   * Requires authentication
   */
  @Get('feedback/summary/:summaryId')
  async getFeedbackForSummary(
    @Param('summaryId') summaryId: string,
    @TenantContext() ctx: TenantContextType,
    @Query('reviewType') reviewType?: string,
    @Query('includeStats') includeStats?: string,
    @Query('includeFeedback') includeFeedback?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
  ) {
    try {
      this.logger.log(`Getting feedback for summary: ${summaryId}`);
      
      const options = {
        reviewType: reviewType as 'simplification' | 'translation' | undefined,
        includeStats: includeStats !== 'false',
        includeFeedback: includeFeedback !== 'false',
        limit: limit ? parseInt(limit, 10) : 50,
        offset: offset ? parseInt(offset, 10) : 0,
        sortBy: (sortBy || 'reviewDate') as 'reviewDate' | 'rating' | 'createdAt',
        sortOrder: (sortOrder || 'desc') as 'asc' | 'desc',
      };

      return await this.expertService.getFeedbackForSummary(summaryId, ctx.tenantId, options);
    } catch (error) {
      this.logger.error(`Failed to get feedback for summary ${summaryId}:`, error);
      throw new HttpException(
        {
          error: 'Internal Server Error',
          message: `Failed to retrieve expert feedback: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
