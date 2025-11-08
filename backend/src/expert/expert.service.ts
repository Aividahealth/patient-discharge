import { Injectable, Logger } from '@nestjs/common';
import { Firestore } from '@google-cloud/firestore';
import { DevConfigService } from '../config/dev-config.service';
import type {
  ExpertFeedback,
  SubmitFeedbackDto,
  ReviewSummary,
  ReviewListQuery,
  ReviewListResponse,
} from './expert.types';
import { resolveServiceAccountPath } from '../utils/path.helper';

@Injectable()
export class ExpertService {
  private readonly logger = new Logger(ExpertService.name);
  private firestore: Firestore | null = null;
  private readonly feedbackCollection = 'expert_feedback';
  private readonly summariesCollection = 'discharge_summaries';

  constructor(private configService: DevConfigService) {}

  private getFirestore(): Firestore {
    if (!this.firestore) {
      let serviceAccountPath: string | undefined;

      try {
        const config = this.configService.get();
        if (config.service_account_path) {
          // Resolve the path - handles both full paths and filenames
          serviceAccountPath = resolveServiceAccountPath(config.service_account_path);
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
  async getReviewList(query: ReviewListQuery): Promise<ReviewListResponse> {
    const firestore = this.getFirestore();
    const limit = query.limit || 20;
    const offset = query.offset || 0;

    // Get all discharge summaries
    let summariesQuery = firestore
      .collection(this.summariesCollection)
      .orderBy('updatedAt', 'desc') as any;

    // Get summaries
    const summariesSnapshot = await summariesQuery.get();
    const summaries: ReviewSummary[] = [];

    // For each summary, get review stats
    for (const doc of summariesSnapshot.docs) {
      const data = doc.data();

      // Get feedback count and average rating for this summary
      const feedbackSnapshot = await firestore
        .collection(this.feedbackCollection)
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

      const summary: ReviewSummary = {
        id: doc.id,
        patientName: data.patientName,
        mrn: data.mrn,
        simplifiedAt: data.simplifiedAt?.toDate?.() || data.simplifiedAt,
        translatedAt: data.translatedAt?.toDate?.() || data.translatedAt,
        reviewCount,
        avgRating: avgRating ? Math.round(avgRating * 10) / 10 : undefined,
        latestReviewDate,
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
  async submitFeedback(dto: SubmitFeedbackDto): Promise<ExpertFeedback> {
    const firestore = this.getFirestore();
    const now = new Date();

    // Build feedback object, excluding undefined values
    const feedback: any = {
      dischargeSummaryId: dto.dischargeSummaryId,
      reviewType: dto.reviewType,
      reviewerName: dto.reviewerName,
      reviewDate: now,
      overallRating: dto.overallRating,
      whatWorksWell: dto.whatWorksWell,
      whatNeedsImprovement: dto.whatNeedsImprovement,
      specificIssues: dto.specificIssues,
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

    const docRef = await firestore
      .collection(this.feedbackCollection)
      .add(feedback);

    this.logger.log(
      `Expert feedback submitted: ${docRef.id} for summary ${dto.dischargeSummaryId}`,
    );

    return {
      ...feedback,
      id: docRef.id,
    } as ExpertFeedback;
  }

  /**
   * Get feedback for a specific discharge summary
   */
  async getFeedbackForSummary(
    summaryId: string,
    reviewType?: string,
  ): Promise<ExpertFeedback[]> {
    const firestore = this.getFirestore();

    let query = firestore
      .collection(this.feedbackCollection)
      .where('dischargeSummaryId', '==', summaryId) as any;

    if (reviewType) {
      query = query.where('reviewType', '==', reviewType);
    }

    const snapshot = await query.orderBy('reviewDate', 'desc').get();

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      reviewDate: doc.data().reviewDate?.toDate?.() || doc.data().reviewDate,
      createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
    })) as ExpertFeedback[];
  }
}
