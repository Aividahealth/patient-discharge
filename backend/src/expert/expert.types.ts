/**
 * Expert Review Types
 */

export type ReviewType = 'simplification' | 'translation';

export interface ExpertFeedback {
  id?: string;

  // What's being reviewed
  dischargeSummaryId: string;
  reviewType: ReviewType;
  language?: string; // Only for translation reviews

  // Who reviewed
  reviewerName: string;
  reviewerHospital?: string;
  reviewDate: Date;

  // The feedback
  overallRating: 1 | 2 | 3 | 4 | 5;
  whatWorksWell: string;
  whatNeedsImprovement: string;
  specificIssues: string;

  // Quick flags
  hasHallucination: boolean;
  hasMissingInfo: boolean;

  // Metadata
  createdAt: Date;
  updatedAt?: Date;
}

export interface SubmitFeedbackDto {
  dischargeSummaryId: string;
  reviewType: ReviewType;
  language?: string;
  reviewerName: string;
  reviewerHospital?: string;
  overallRating: 1 | 2 | 3 | 4 | 5;
  whatWorksWell?: string;
  whatNeedsImprovement?: string;
  specificIssues?: string;
  hasHallucination: boolean;
  hasMissingInfo: boolean;
}

export interface UpdateFeedbackDto {
  reviewType?: ReviewType;
  language?: string;
  reviewerName?: string;
  reviewerHospital?: string;
  overallRating?: 1 | 2 | 3 | 4 | 5;
  whatWorksWell?: string;
  whatNeedsImprovement?: string;
  specificIssues?: string;
  hasHallucination?: boolean;
  hasMissingInfo?: boolean;
}

/**
 * Quality metrics for text simplification (subset for review summary)
 */
export interface ReviewQualityMetrics {
  fleschKincaidGradeLevel?: number;
  fleschReadingEase?: number;
  smogIndex?: number;
  compressionRatio?: number;
  avgSentenceLength?: number;
}

export interface ReviewSummary {
  id: string;
  patientName?: string;
  mrn?: string;
  simplifiedAt?: Date;
  translatedAt?: Date;
  reviewCount: number;
  avgRating?: number;
  latestReviewDate?: Date;
  qualityMetrics?: ReviewQualityMetrics;
}

export interface ReviewListQuery {
  type?: ReviewType;
  filter?: 'all' | 'no_reviews' | 'low_rating';
  limit?: number;
  offset?: number;
}

export interface ReviewListResponse {
  summaries: ReviewSummary[];
  total: number;
}

export interface FeedbackStats {
  totalReviews: number;
  simplificationReviews: number;
  translationReviews: number;
  averageRating: number;
  simplificationRating: number;
  translationRating: number;
  latestReviewDate: string | null;
  latestSimplificationReview: string | null;
  latestTranslationReview: string | null;
  hasHallucination: boolean;
  hasMissingInfo: boolean;
  ratingDistribution: {
    [key: string]: number;
  };
}

export interface FeedbackResponse {
  success: boolean;
  summaryId: string;
  stats?: FeedbackStats;
  feedback: ExpertFeedback[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}
