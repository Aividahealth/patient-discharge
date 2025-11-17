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
} from '@nestjs/common';
import { ExpertService } from './expert.service';
import type { SubmitFeedbackDto, ReviewListQuery, UpdateFeedbackDto } from './expert.types';
import { Public } from '../auth/auth.guard';
import { TenantContext } from '../tenant/tenant.decorator';
import type { TenantContext as TenantContextType } from '../tenant/tenant-context';

@Controller('expert')
export class ExpertController {
  private readonly logger = new Logger(ExpertController.name);

  constructor(private readonly expertService: ExpertService) {}

  /**
   * GET /expert/list
   * Get list of discharge summaries for review
   */
  @Get('list')
  async getReviewList(@Query() query: ReviewListQuery) {
    this.logger.log(`Getting review list with filters: ${JSON.stringify(query)}`);
    return this.expertService.getReviewList(query);
  }

  /**
   * POST /expert/feedback
   * Submit expert feedback
   * Supports both generic portal (no auth) and tenant-specific portal (with auth)
   */
  @Public()
  @Post('feedback')
  @HttpCode(HttpStatus.CREATED)
  async submitFeedback(
    @Body() dto: SubmitFeedbackDto,
    @TenantContext() ctx?: TenantContextType,
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

      // Verify composition exists (optional check - skip if no tenant context)
      if (ctx) {
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
      }

      const feedback = await this.expertService.submitFeedback(dto);
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
   */
  @Public()
  @Get('feedback/:id')
  async getFeedbackById(@Param('id') id: string) {
    try {
      this.logger.log(`Getting feedback by ID: ${id}`);
      const feedback = await this.expertService.getFeedbackById(id);
      
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
   */
  @Public()
  @Put('feedback/:id')
  async updateFeedback(
    @Param('id') id: string,
    @Body() dto: UpdateFeedbackDto,
  ) {
    try {
      this.logger.log(`Updating feedback: ${id}`);

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

      const feedback = await this.expertService.updateFeedback(id, dto);
      
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
   */
  @Public()
  @Get('feedback/summary/:summaryId')
  async getFeedbackForSummary(
    @Param('summaryId') summaryId: string,
    @Query('reviewType') reviewType?: string,
    @Query('includeStats') includeStats?: string,
    @Query('includeFeedback') includeFeedback?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
    @TenantContext() ctx?: TenantContextType,
  ) {
    this.logger.log(`Getting feedback for summary: ${summaryId}`);
    
    const options = {
      reviewType: reviewType as 'simplification' | 'translation' | undefined,
      includeStats: includeStats !== 'false',
      includeFeedback: includeFeedback !== 'false',
      limit: limit ? parseInt(limit, 10) : 50,
      offset: offset ? parseInt(offset, 10) : 0,
      sortBy: (sortBy || 'reviewDate') as 'reviewDate' | 'rating' | 'createdAt',
      sortOrder: (sortOrder || 'desc') as 'asc' | 'desc',
      tenantId: ctx?.tenantId,
    };

    return this.expertService.getFeedbackForSummary(summaryId, options);
  }
}
