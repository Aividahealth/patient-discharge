/**
 * Tenant metrics types matching the backend API response
 */

export interface TenantMetrics {
  tenantId: string;
  tenantName: string;
  dischargeSummaries: {
    total: number;
    byStatus: {
      raw_only: number;
      simplified: number;
      translated: number;
      processing: number;
      error: number;
    };
  };
  users: {
    total: number;
    byRole: {
      patient: number;
      clinician: number;
      expert: number;
      tenant_admin: number;
    };
  };
  expertFeedback: {
    total: number;
    averageRating: number;
  };
  qualityMetrics?: {
    totalWithMetrics: number;
    averageFleschKincaid: number;
    averageReadingEase: number;
    averageSmog: number;
    gradeDistribution: {
      elementary: number;      // FK ≤ 5
      middleSchool: number;     // FK 6-8
      highSchool: number;       // FK 9-12
      college: number;          // FK > 12
    };
    targetCompliance: {
      meetsTarget: number;      // Summaries meeting 5-9th grade target
      needsReview: number;      // Summaries not meeting target
    };
  };
}

export interface TenantMetricsApiResponse extends TenantMetrics {}
