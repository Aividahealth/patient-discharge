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
  overallRating: 1 | 2 | 3 | 4 | 5;
  whatWorksWell: string;
  whatNeedsImprovement: string;
  specificIssues: string;
  hasHallucination: boolean;
  hasMissingInfo: boolean;
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
