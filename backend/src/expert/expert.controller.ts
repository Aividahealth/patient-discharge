import { Controller, Get, Post, Body, Query, Logger } from '@nestjs/common';
import { ExpertService } from './expert.service';
import type { SubmitFeedbackDto, ReviewListQuery } from './expert.types';

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
   */
  @Post('feedback')
  async submitFeedback(@Body() dto: SubmitFeedbackDto) {
    this.logger.log(`Submitting feedback for summary: ${dto.dischargeSummaryId}`);
    const feedback = await this.expertService.submitFeedback(dto);
    return {
      success: true,
      id: feedback.id,
      message: 'Feedback submitted successfully',
    };
  }

  /**
   * GET /expert/feedback/:summaryId
   * Get feedback for a specific discharge summary
   */
  @Get('feedback/:summaryId')
  async getFeedback(
    @Query('summaryId') summaryId: string,
    @Query('reviewType') reviewType?: string,
  ) {
    this.logger.log(`Getting feedback for summary: ${summaryId}`);
    return this.expertService.getFeedbackForSummary(summaryId, reviewType);
  }
}
