/**
 * Expert Review API Client
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export type ReviewType = 'simplification' | 'translation';

export interface ExpertFeedback {
  id?: string;
  dischargeSummaryId: string;
  reviewType: ReviewType;
  language?: string;
  reviewerName: string;
  reviewDate: Date;
  overallRating: 1 | 2 | 3 | 4 | 5;
  whatWorksWell: string;
  whatNeedsImprovement: string;
  specificIssues: string;
  hasHallucination: boolean;
  hasMissingInfo: boolean;
  createdAt: Date;
}

export interface ReviewSummary {
  id: string;
  patientName?: string;
  mrn?: string;
  summaryTitle?: string; // New field for discharge summary title
  fileName?: string; // Unique file name for each summary
  language?: string; // Language for translation reviews
  dischargeDate?: Date;
  admissionDate?: Date;
  simplifiedAt?: Date;
  translatedAt?: Date;
  reviewCount: number;
  avgRating?: number;
  latestReviewDate?: Date;
}

export interface ReviewListResponse {
  summaries: ReviewSummary[];
  total: number;
}

export interface SubmitFeedbackRequest {
  dischargeSummaryId: string;
  reviewType: ReviewType;
  language?: string;
  reviewerName: string;
  reviewerHospital?: string;
  overallRating: 1 | 2 | 3 | 4 | 5;
  whatWorksWell: string;
  whatNeedsImprovement: string;
  specificIssues: string;
  hasHallucination: boolean;
  hasMissingInfo: boolean;
}

/**
 * Get list of discharge summaries for review
 */
export async function getReviewList(params?: {
  type?: ReviewType;
  filter?: 'all' | 'no_reviews' | 'low_rating';
  limit?: number;
  offset?: number;
}): Promise<ReviewListResponse> {
  const queryParams = new URLSearchParams();
  if (params?.type) queryParams.append('type', params.type);
  if (params?.filter) queryParams.append('filter', params.filter);
  if (params?.limit) queryParams.append('limit', params.limit.toString());
  if (params?.offset) queryParams.append('offset', params.offset.toString());

  const response = await fetch(
    `${API_BASE_URL}/expert/list?${queryParams.toString()}`
  );

  if (!response.ok) {
    throw new Error('Failed to fetch review list');
  }

  return response.json();
}

/**
 * Submit expert feedback
 */
export async function submitFeedback(
  feedback: SubmitFeedbackRequest
): Promise<{ success: boolean; id: string; message: string }> {
  const response = await fetch(`${API_BASE_URL}/expert/feedback`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(feedback),
  });

  if (!response.ok) {
    throw new Error('Failed to submit feedback');
  }

  return response.json();
}

/**
 * Get feedback for a specific discharge summary
 */
export async function getFeedbackForSummary(
  summaryId: string,
  reviewType?: ReviewType
): Promise<ExpertFeedback[]> {
  const queryParams = new URLSearchParams({ summaryId });
  if (reviewType) queryParams.append('reviewType', reviewType);

  const response = await fetch(
    `${API_BASE_URL}/expert/feedback/${summaryId}?${queryParams.toString()}`
  );

  if (!response.ok) {
    throw new Error('Failed to fetch feedback');
  }

  return response.json();
}
