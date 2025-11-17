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
 * Uses the discharge-queue endpoint
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

  // Add expert-specific query params
  if (params?.type) queryParams.append('reviewType', params.type);
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
    headers['x-tenant-id'] = params.tenantId;
  }

  const response = await fetch(
    `${API_BASE_URL}/api/patients/discharge-queue?${queryParams.toString()}`,
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

  // Transform discharge-queue response to ReviewListResponse
  return {
    summaries: data.patients?.map((patient: any) => ({
      id: patient.id,
      compositionId: patient.compositionId,
      mrn: patient.mrn,
      patientName: patient.name,
      room: patient.room,
      unit: patient.unit,
      dischargeDate: patient.dischargeDate ? new Date(patient.dischargeDate) : undefined,
      status: patient.status,
      attendingPhysician: patient.attendingPhysician,
      avatar: patient.avatar,
      // Review stats - backend should add these
      reviewCount: patient.reviewCount || 0,
      avgRating: patient.avgRating,
      latestReviewDate: patient.latestReviewDate ? new Date(patient.latestReviewDate) : undefined,
      fileName: patient.fileName || `${patient.mrn}-discharge-summary`,
      qualityMetrics: patient.qualityMetrics,
    })) || [],
    total: data.meta?.total || 0,
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
