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
}

export interface TenantMetricsApiResponse extends TenantMetrics {}
