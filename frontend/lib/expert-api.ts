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

export interface QualityMetrics {
  fleschKincaidGradeLevel?: number;
  fleschReadingEase?: number;
  smogIndex?: number;
  compressionRatio?: number;
  avgSentenceLength?: number;
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

export interface ReviewSummary {
  id: string;                      // Patient ID
  compositionId: string;           // Composition ID for fetching content
  mrn: string;
  patientName: string;             // From name field
  room?: string;
  unit?: string;
  dischargeDate?: Date;
  status?: 'review' | 'approved' | 'pending';
  attendingPhysician?: {
    name: string;
    id: string;
  };
  avatar?: string | null;
  // Review stats (to be added by backend)
  reviewCount?: number;
  avgRating?: number;
  latestReviewDate?: Date;
  fileName?: string;               // For display purposes
  language?: string;               // Language for translation reviews
  qualityMetrics?: QualityMetrics; // Automated quality metrics
  // Detailed stats from feedback API
  stats?: FeedbackStats;
}

export interface ReviewListResponse {
  summaries: ReviewSummary[];
  total: number;
  meta?: {
    total: number;
    pending: number;
    review: number;
    approved: number;
  };
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
 * Uses the expert/list endpoint which includes preferred language
 */
export async function getReviewList(params?: {
  type?: ReviewType;
  filter?: 'all' | 'no_reviews' | 'low_rating';
  limit?: number;
  offset?: number;
  tenantId?: string;
  token?: string;
}): Promise<ReviewListResponse> {
  const queryParams = new URLSearchParams();

  // Add expert-specific query params (backend expects 'type' not 'reviewType')
  if (params?.type) queryParams.append('type', params.type);
  if (params?.filter) queryParams.append('filter', params.filter);
  if (params?.limit) queryParams.append('limit', params.limit.toString());
  if (params?.offset) queryParams.append('offset', params.offset.toString());

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  // For tenant-specific requests
  if (params?.token) {
    headers['Authorization'] = `Bearer ${params.token}`;
  }
  if (params?.tenantId) {
    headers['X-Tenant-ID'] = params.tenantId;
  }

  // Use the expert/list endpoint which fetches preferred language
  const response = await fetch(
    `${API_BASE_URL}/expert/list?${queryParams.toString()}`,
    { headers }
  );

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    console.error('[ExpertAPI] getReviewList failed:', {
      status: response.status,
      statusText: response.statusText,
      error: errorText
    });
    throw new Error(`Failed to fetch review list: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  // Transform expert/list response to ReviewListResponse
  // The backend already returns the correct format with language field
  return {
    summaries: data.summaries?.map((summary: any) => ({
      id: summary.id,
      compositionId: summary.id, // compositionId is the same as id in expert service
      mrn: summary.mrn || '',
      patientName: summary.patientName || 'Unknown',
      room: undefined,
      unit: undefined,
      dischargeDate: summary.dischargeDate ? new Date(summary.dischargeDate) : undefined,
      status: undefined,
      attendingPhysician: undefined,
      avatar: undefined,
      reviewCount: summary.reviewCount || 0,
      avgRating: summary.avgRating,
      latestReviewDate: summary.latestReviewDate ? new Date(summary.latestReviewDate) : undefined,
      fileName: undefined,
      qualityMetrics: summary.qualityMetrics,
      language: summary.language, // Preferred language from backend
    })) || [],
    total: data.total || 0,
    meta: data.meta
  };
}

/**
 * Submit expert feedback
 */
export async function submitFeedback(
  feedback: SubmitFeedbackRequest,
  auth?: { tenantId?: string; token?: string }
): Promise<{ success: boolean; id: string; message: string }> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (auth?.token) {
    headers['Authorization'] = `Bearer ${auth.token}`;
  }
  if (auth?.tenantId) {
    headers['X-Tenant-ID'] = auth.tenantId;
  }

  const response = await fetch(`${API_BASE_URL}/expert/feedback`, {
    method: 'POST',
    headers,
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
  reviewType?: ReviewType,
  auth?: { tenantId?: string; token?: string }
): Promise<ExpertFeedback[]> {
  const queryParams = new URLSearchParams({ summaryId });
  if (reviewType) queryParams.append('reviewType', reviewType);

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (auth?.token) {
    headers['Authorization'] = `Bearer ${auth.token}`;
  }
  if (auth?.tenantId) {
    headers['X-Tenant-ID'] = auth.tenantId;
  }

  const response = await fetch(
    `${API_BASE_URL}/expert/feedback/${summaryId}?${queryParams.toString()}`,
    { headers }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch feedback');
  }

  return response.json();
}

/**
 * Get feedback statistics for a specific discharge summary
 * Uses the new GET /expert/feedback/summary/:summaryId endpoint
 */
export async function getFeedbackStats(
  summaryId: string,
  options?: {
    reviewType?: ReviewType;
    includeStats?: boolean;
    includeFeedback?: boolean;
    limit?: number;
    offset?: number;
  },
  auth?: { tenantId?: string; token?: string }
): Promise<FeedbackResponse> {
  const queryParams = new URLSearchParams();
  
  if (options?.reviewType) {
    queryParams.append('reviewType', options.reviewType);
  }
  if (options?.includeStats !== undefined) {
    queryParams.append('includeStats', options.includeStats.toString());
  }
  if (options?.includeFeedback !== undefined) {
    queryParams.append('includeFeedback', options.includeFeedback.toString());
  }
  if (options?.limit) {
    queryParams.append('limit', options.limit.toString());
  }
  if (options?.offset) {
    queryParams.append('offset', options.offset.toString());
  }

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (auth?.token) {
    headers['Authorization'] = `Bearer ${auth.token}`;
  }
  if (auth?.tenantId) {
    headers['X-Tenant-ID'] = auth.tenantId;
  }

  const response = await fetch(
    `${API_BASE_URL}/expert/feedback/summary/${summaryId}?${queryParams.toString()}`,
    { headers }
  );

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    console.error('[ExpertAPI] getFeedbackStats failed:', {
      status: response.status,
      statusText: response.statusText,
      error: errorText
    });
    throw new Error(`Failed to fetch feedback stats: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  
  // Transform dates in feedback array
  if (data.feedback && Array.isArray(data.feedback)) {
    data.feedback = data.feedback.map((fb: any) => ({
      ...fb,
      reviewDate: fb.reviewDate ? new Date(fb.reviewDate) : new Date(),
      createdAt: fb.createdAt ? new Date(fb.createdAt) : new Date(),
      updatedAt: fb.updatedAt ? new Date(fb.updatedAt) : undefined,
    }));
  }

  return data;
}
