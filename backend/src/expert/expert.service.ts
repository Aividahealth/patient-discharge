import { Injectable, Logger } from '@nestjs/common';
import { Firestore } from '@google-cloud/firestore';
import * as fs from 'fs';
import { DevConfigService } from '../config/dev-config.service';
import { GoogleService } from '../google/google.service';
import type {
  ExpertFeedback,
  SubmitFeedbackDto,
  UpdateFeedbackDto,
  ReviewSummary,
  ReviewListQuery,
  ReviewListResponse,
  FeedbackStats,
  FeedbackResponse,
} from './expert.types';
import { resolveServiceAccountPath } from '../utils/path.helper';
import { TenantContext } from '../tenant/tenant-context';

@Injectable()
export class ExpertService {
  private readonly logger = new Logger(ExpertService.name);
  private firestore: Firestore | null = null;
  private readonly feedbackCollection = 'expert_feedback';
  private readonly summariesCollection = 'discharge_summaries';

  constructor(
    private configService: DevConfigService,
    private googleService?: GoogleService,
  ) {}

  private getFirestore(): Firestore {
    if (!this.firestore) {
      let serviceAccountPath: string | undefined;

      try {
        const config = this.configService.get();
        // Use firestore_service_account_path first, fallback to service_account_path
        const configPath = config.firestore_service_account_path || config.service_account_path;
        if (configPath) {
          // Resolve the path - handles both full paths and filenames
          const resolvedPath = resolveServiceAccountPath(configPath);
          // Check if file exists before using it
          if (fs.existsSync(resolvedPath)) {
            serviceAccountPath = resolvedPath;
            this.logger.log(`Using Firestore service account: ${serviceAccountPath}`);
          } else {
            this.logger.log(`Firestore service account file not found at ${resolvedPath}, using Application Default Credentials`);
          }
        }
      } catch (error) {
        // Config not loaded yet or running in Cloud Run with ADC
        this.logger.log('Config not available, using Application Default Credentials');
      }

      this.firestore = new Firestore(
        serviceAccountPath ? { keyFilename: serviceAccountPath } : {},
      );

      this.logger.log('Expert Service initialized with Firestore');
    }
    return this.firestore;
  }

  /**
   * Get list of discharge summaries for expert review
   */
  async getReviewList(query: ReviewListQuery, tenantId: string): Promise<ReviewListResponse> {
    const firestore = this.getFirestore();
    const limit = query.limit || 20;
    const offset = query.offset || 0;

    // Get discharge summaries for this tenant only
    let summariesQuery = firestore
      .collection(this.summariesCollection)
      .where('tenantId', '==', tenantId)
      .orderBy('updatedAt', 'desc') as any;

    // Get summaries
    const summariesSnapshot = await summariesQuery.get();
    const summaries: ReviewSummary[] = [];

    // For each summary, get review stats
    for (const doc of summariesSnapshot.docs) {
      const data = doc.data();

      // Get feedback count and average rating for this summary (filtered by tenantId)
      const feedbackSnapshot = await firestore
        .collection(this.feedbackCollection)
        .where('tenantId', '==', tenantId)
        .where('dischargeSummaryId', '==', doc.id)
        .get();

      const feedbackDocs = feedbackSnapshot.docs;
      const reviewCount = feedbackDocs.length;

      let avgRating: number | undefined;
      let latestReviewDate: Date | undefined;

      if (reviewCount > 0) {
        const ratings = feedbackDocs.map((f) => f.data().overallRating);
        avgRating = ratings.reduce((a, b) => a + b, 0) / ratings.length;

        const reviewDates = feedbackDocs.map((f) => f.data().reviewDate?.toDate?.() || f.data().reviewDate);
        latestReviewDate = reviewDates.sort((a, b) => b.getTime() - a.getTime())[0];
      }

      // Extract quality metrics if available
      const qualityMetrics = data.qualityMetrics ? {
        fleschKincaidGradeLevel: data.qualityMetrics.readability?.fleschKincaidGradeLevel,
        fleschReadingEase: data.qualityMetrics.readability?.fleschReadingEase,
        smogIndex: data.qualityMetrics.readability?.smogIndex,
        compressionRatio: data.qualityMetrics.simplification?.compressionRatio,
        avgSentenceLength: data.qualityMetrics.simplification?.avgSentenceLength,
      } : undefined;

      const summary: ReviewSummary = {
        id: doc.id,
        patientName: data.patientName,
        mrn: data.mrn,
        simplifiedAt: data.simplifiedAt?.toDate?.() || data.simplifiedAt,
        translatedAt: data.translatedAt?.toDate?.() || data.translatedAt,
        reviewCount,
        avgRating: avgRating ? Math.round(avgRating * 10) / 10 : undefined,
        latestReviewDate,
        qualityMetrics,
      };

      // Apply filters
      if (query.filter === 'no_reviews' && reviewCount > 0) continue;
      if (query.filter === 'low_rating' && (!avgRating || avgRating >= 3.5)) continue;

      summaries.push(summary);
    }

    // Apply pagination
    const paginatedSummaries = summaries.slice(offset, offset + limit);

    return {
      summaries: paginatedSummaries,
      total: summaries.length,
    };
  }

  /**
   * Submit expert feedback
   */
  async submitFeedback(dto: SubmitFeedbackDto, tenantId: string): Promise<ExpertFeedback> {
    const firestore = this.getFirestore();
    const now = new Date();

    // Build feedback object, excluding undefined values
    const feedback: any = {
      tenantId, // Store tenantId for multi-tenant isolation
      dischargeSummaryId: dto.dischargeSummaryId,
      reviewType: dto.reviewType,
      reviewerName: dto.reviewerName,
      reviewDate: now,
      overallRating: dto.overallRating,
      hasHallucination: dto.hasHallucination,
      hasMissingInfo: dto.hasMissingInfo,
      createdAt: now,
    };

    // Only add optional fields if they have values
    if (dto.language) {
      feedback.language = dto.language;
    }
    if (dto.reviewerHospital) {
      feedback.reviewerHospital = dto.reviewerHospital;
    }
    if (dto.whatWorksWell) {
      feedback.whatWorksWell = dto.whatWorksWell;
    }
    if (dto.whatNeedsImprovement) {
      feedback.whatNeedsImprovement = dto.whatNeedsImprovement;
    }
    if (dto.specificIssues) {
      feedback.specificIssues = dto.specificIssues;
    }

    const docRef = await firestore
      .collection(this.feedbackCollection)
      .add(feedback);

    this.logger.log(
      `Expert feedback submitted: ${docRef.id} for summary ${dto.dischargeSummaryId} for tenant: ${tenantId}`,
    );

    return {
      ...feedback,
      id: docRef.id,
    } as ExpertFeedback;
  }

  /**
   * Get feedback for a specific discharge summary with aggregated statistics
   */
  async getFeedbackForSummary(
    summaryId: string,
    tenantId: string,
    options: {
      reviewType?: 'simplification' | 'translation';
      includeStats?: boolean;
      includeFeedback?: boolean;
      limit?: number;
      offset?: number;
      sortBy?: 'reviewDate' | 'rating' | 'createdAt';
      sortOrder?: 'asc' | 'desc';
    } = {},
  ): Promise<FeedbackResponse> {
    const {
      reviewType,
      includeStats = true,
      includeFeedback = true,
      limit = 50,
      offset = 0,
      sortBy = 'reviewDate',
      sortOrder = 'desc',
    } = options;

    const firestore = this.getFirestore();

    // Build base query - always filter by tenantId (required for multi-tenant isolation)
    let query = firestore
      .collection(this.feedbackCollection)
      .where('tenantId', '==', tenantId)
      .where('dischargeSummaryId', '==', summaryId) as any;

    // Filter by review type if provided
    if (reviewType) {
      query = query.where('reviewType', '==', reviewType);
    }

    // Get all matching feedback for stats calculation
    const allSnapshot = await query.get();
    const allFeedback = allSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      reviewDate: doc.data().reviewDate?.toDate?.() || doc.data().reviewDate,
      createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
      updatedAt: doc.data().updatedAt?.toDate?.() || doc.data().updatedAt,
    })) as ExpertFeedback[];

    // Calculate statistics
    let stats: FeedbackStats | undefined;
    if (includeStats) {
      stats = this.calculateFeedbackStats(allFeedback);
    }

    // Get paginated and sorted feedback
    let feedback: ExpertFeedback[] = [];
    if (includeFeedback) {
      // Sort feedback
      const sortedFeedback = [...allFeedback].sort((a, b) => {
        let aValue: any;
        let bValue: any;

        switch (sortBy) {
          case 'rating':
            aValue = a.overallRating;
            bValue = b.overallRating;
            break;
          case 'createdAt':
            aValue = a.createdAt;
            bValue = b.createdAt;
            break;
          case 'reviewDate':
          default:
            aValue = a.reviewDate;
            bValue = b.reviewDate;
            break;
        }

        if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });

      // Apply pagination
      feedback = sortedFeedback.slice(offset, offset + limit);
    }

    return {
      success: true,
      summaryId,
      stats,
      feedback,
      pagination: {
        total: allFeedback.length,
        limit,
        offset,
        hasMore: offset + limit < allFeedback.length,
      },
    };
  }

  /**
   * Calculate aggregated statistics from feedback array
   */
  private calculateFeedbackStats(feedback: ExpertFeedback[]): FeedbackStats {
    if (feedback.length === 0) {
      return {
        totalReviews: 0,
        simplificationReviews: 0,
        translationReviews: 0,
        averageRating: 0,
        simplificationRating: 0,
        translationRating: 0,
        latestReviewDate: null,
        latestSimplificationReview: null,
        latestTranslationReview: null,
        hasHallucination: false,
        hasMissingInfo: false,
        ratingDistribution: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
      };
    }

    const simplificationFeedback = feedback.filter((f) => f.reviewType === 'simplification');
    const translationFeedback = feedback.filter((f) => f.reviewType === 'translation');

    // Calculate average ratings
    const totalRating = feedback.reduce((sum, f) => sum + f.overallRating, 0);
    const simplificationRating =
      simplificationFeedback.length > 0
        ? simplificationFeedback.reduce((sum, f) => sum + f.overallRating, 0) /
          simplificationFeedback.length
        : 0;
    const translationRating =
      translationFeedback.length > 0
        ? translationFeedback.reduce((sum, f) => sum + f.overallRating, 0) /
          translationFeedback.length
        : 0;

    // Find latest review dates - handle various date formats safely
    const parseDate = (d: any): Date | null => {
      try {
        if (d instanceof Date) return d;
        if (typeof d === 'string') return new Date(d);
        if (d && typeof d === 'object' && 'toDate' in d) {
          const timestamp = d as { toDate: () => Date };
          if (typeof timestamp.toDate === 'function') {
            return timestamp.toDate();
          }
        }
        return null;
      } catch (e) {
        this.logger.warn(`Invalid date format: ${d}`);
        return null;
      }
    };

    const reviewDates = feedback
      .map((f) => f.reviewDate)
      .filter((d) => d != null)
      .map(parseDate)
      .filter((d): d is Date => d != null && !isNaN(d.getTime()))
      .sort((a, b) => b.getTime() - a.getTime());

    const simplificationDates = simplificationFeedback
      .map((f) => f.reviewDate)
      .filter((d) => d != null)
      .map(parseDate)
      .filter((d): d is Date => d != null && !isNaN(d.getTime()))
      .sort((a, b) => b.getTime() - a.getTime());

    const translationDates = translationFeedback
      .map((f) => f.reviewDate)
      .filter((d) => d != null)
      .map(parseDate)
      .filter((d): d is Date => d != null && !isNaN(d.getTime()))
      .sort((a, b) => b.getTime() - a.getTime());

    // Rating distribution
    const ratingDistribution: { [key: string]: number } = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
    feedback.forEach((f) => {
      ratingDistribution[f.overallRating.toString()]++;
    });

    // Check for flags
    const hasHallucination = feedback.some((f) => f.hasHallucination);
    const hasMissingInfo = feedback.some((f) => f.hasMissingInfo);

    return {
      totalReviews: feedback.length,
      simplificationReviews: simplificationFeedback.length,
      translationReviews: translationFeedback.length,
      averageRating: totalRating / feedback.length,
      simplificationRating,
      translationRating,
      latestReviewDate: reviewDates.length > 0 ? reviewDates[0].toISOString() : null,
      latestSimplificationReview:
        simplificationDates.length > 0 ? simplificationDates[0].toISOString() : null,
      latestTranslationReview:
        translationDates.length > 0 ? translationDates[0].toISOString() : null,
      hasHallucination,
      hasMissingInfo,
      ratingDistribution,
    };
  }

  /**
   * Validate feedback data
   */
  validateFeedback(dto: SubmitFeedbackDto): string | null {
    // Required fields
    if (!dto.dischargeSummaryId || dto.dischargeSummaryId.trim() === '') {
      return 'Missing required field: dischargeSummaryId';
    }

    if (!dto.reviewType) {
      return 'Missing required field: reviewType';
    }

    if (dto.reviewType !== 'simplification' && dto.reviewType !== 'translation') {
      return "reviewType must be 'simplification' or 'translation'";
    }

    // Language is required for translation reviews
    if (dto.reviewType === 'translation' && (!dto.language || dto.language.trim() === '')) {
      return "language is required when reviewType is 'translation'";
    }

    // Validate ISO 639-1 language codes (basic check)
    if (dto.language && dto.language.length !== 2) {
      return 'language must be a valid ISO 639-1 code (2 characters)';
    }

    if (!dto.reviewerName || dto.reviewerName.trim() === '') {
      return 'Missing required field: reviewerName';
    }

    if (dto.reviewerName.length < 2 || dto.reviewerName.length > 100) {
      return 'reviewerName must be between 2 and 100 characters';
    }

    if (dto.reviewerHospital && dto.reviewerHospital.length > 200) {
      return 'reviewerHospital must not exceed 200 characters';
    }

    if (dto.overallRating === undefined || dto.overallRating === null) {
      return 'Missing required field: overallRating';
    }

    if (!Number.isInteger(dto.overallRating) || dto.overallRating < 1 || dto.overallRating > 5) {
      return 'overallRating must be between 1 and 5';
    }

    if (dto.whatWorksWell && dto.whatWorksWell.length > 2000) {
      return 'whatWorksWell must not exceed 2000 characters';
    }

    if (dto.whatNeedsImprovement && dto.whatNeedsImprovement.length > 2000) {
      return 'whatNeedsImprovement must not exceed 2000 characters';
    }

    if (dto.specificIssues && dto.specificIssues.length > 5000) {
      return 'specificIssues must not exceed 5000 characters';
    }

    if (typeof dto.hasHallucination !== 'boolean') {
      return 'Missing required field: hasHallucination (must be boolean)';
    }

    if (typeof dto.hasMissingInfo !== 'boolean') {
      return 'Missing required field: hasMissingInfo (must be boolean)';
    }

    return null; // No validation errors
  }

  /**
   * Validate update feedback data (allows partial updates)
   */
  validateUpdateFeedback(dto: UpdateFeedbackDto): string | null {
    // Validate reviewType if provided
    if (dto.reviewType !== undefined) {
      if (dto.reviewType !== 'simplification' && dto.reviewType !== 'translation') {
        return "reviewType must be 'simplification' or 'translation'";
      }
    }

    // Validate language if provided
    if (dto.language !== undefined && dto.language.length !== 2) {
      return 'language must be a valid ISO 639-1 code (2 characters)';
    }

    // Validate reviewerName if provided
    if (dto.reviewerName !== undefined) {
      if (dto.reviewerName.trim() === '') {
        return 'reviewerName cannot be empty';
      }
      if (dto.reviewerName.length < 2 || dto.reviewerName.length > 100) {
        return 'reviewerName must be between 2 and 100 characters';
      }
    }

    // Validate reviewerHospital if provided
    if (dto.reviewerHospital !== undefined && dto.reviewerHospital.length > 200) {
      return 'reviewerHospital must not exceed 200 characters';
    }

    // Validate overallRating if provided
    if (dto.overallRating !== undefined) {
      if (!Number.isInteger(dto.overallRating) || dto.overallRating < 1 || dto.overallRating > 5) {
        return 'overallRating must be between 1 and 5';
      }
    }

    // Validate text fields if provided
    if (dto.whatWorksWell !== undefined && dto.whatWorksWell.length > 2000) {
      return 'whatWorksWell must not exceed 2000 characters';
    }

    if (dto.whatNeedsImprovement !== undefined && dto.whatNeedsImprovement.length > 2000) {
      return 'whatNeedsImprovement must not exceed 2000 characters';
    }

    if (dto.specificIssues !== undefined && dto.specificIssues.length > 5000) {
      return 'specificIssues must not exceed 5000 characters';
    }

    // Validate boolean fields if provided
    if (dto.hasHallucination !== undefined && typeof dto.hasHallucination !== 'boolean') {
      return 'hasHallucination must be boolean';
    }

    if (dto.hasMissingInfo !== undefined && typeof dto.hasMissingInfo !== 'boolean') {
      return 'hasMissingInfo must be boolean';
    }

    return null; // No validation errors
  }

  /**
   * Verify that a composition exists in Google FHIR store
   */
  async verifyCompositionExists(compositionId: string, ctx?: TenantContext): Promise<boolean> {
    try {
      if (!this.googleService) {
        // If GoogleService is not available, skip verification
        this.logger.warn('GoogleService not available, skipping composition verification');
        return true;
      }

      if (!ctx) {
        // If no tenant context provided, skip verification
        this.logger.warn('No tenant context provided, skipping composition verification');
        return true;
      }

      await this.googleService.fhirRead('Composition', compositionId, ctx);
      return true;
    } catch (error) {
      this.logger.warn(`Composition ${compositionId} not found or error: ${error.message}`);
      return false;
    }
  }

  /**
   * Get feedback by ID
   */
  async getFeedbackById(id: string, tenantId: string): Promise<ExpertFeedback | null> {
    const firestore = this.getFirestore();
    const docRef = firestore.collection(this.feedbackCollection).doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return null;
    }

    const data = doc.data();
    
    // Validate tenantId
    if (data?.tenantId !== tenantId) {
      return null;
    }

    return {
      id: doc.id,
      ...data,
      reviewDate: data?.reviewDate?.toDate?.() || data?.reviewDate,
      createdAt: data?.createdAt?.toDate?.() || data?.createdAt,
      updatedAt: data?.updatedAt?.toDate?.() || data?.updatedAt,
    } as ExpertFeedback;
  }

  /**
   * Update existing feedback
   */
  async updateFeedback(id: string, dto: UpdateFeedbackDto, tenantId: string): Promise<ExpertFeedback | null> {
    const firestore = this.getFirestore();
    const docRef = firestore.collection(this.feedbackCollection).doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return null;
    }

    const docData = doc.data();
    
    // Validate tenantId
    if (docData?.tenantId !== tenantId) {
      return null;
    }

    const now = new Date();
    const updateData: any = {
      updatedAt: now,
    };

    // Only update fields that are provided
    if (dto.reviewType !== undefined) updateData.reviewType = dto.reviewType;
    if (dto.language !== undefined) updateData.language = dto.language;
    if (dto.reviewerName !== undefined) updateData.reviewerName = dto.reviewerName;
    if (dto.reviewerHospital !== undefined) updateData.reviewerHospital = dto.reviewerHospital;
    if (dto.overallRating !== undefined) updateData.overallRating = dto.overallRating;
    if (dto.whatWorksWell !== undefined) updateData.whatWorksWell = dto.whatWorksWell;
    if (dto.whatNeedsImprovement !== undefined) updateData.whatNeedsImprovement = dto.whatNeedsImprovement;
    if (dto.specificIssues !== undefined) updateData.specificIssues = dto.specificIssues;
    if (dto.hasHallucination !== undefined) updateData.hasHallucination = dto.hasHallucination;
    if (dto.hasMissingInfo !== undefined) updateData.hasMissingInfo = dto.hasMissingInfo;

    await docRef.update(updateData);

    this.logger.log(`Expert feedback updated: ${id} for tenant: ${tenantId}`);

    // Return updated feedback
    const updatedDoc = await docRef.get();
    const updatedData = updatedDoc.data();
    return {
      id: updatedDoc.id,
      ...updatedData,
      reviewDate: updatedData?.reviewDate?.toDate?.() || updatedData?.reviewDate,
      createdAt: updatedData?.createdAt?.toDate?.() || updatedData?.createdAt,
      updatedAt: updatedData?.updatedAt?.toDate?.() || updatedData?.updatedAt,
    } as ExpertFeedback;
  }
}
