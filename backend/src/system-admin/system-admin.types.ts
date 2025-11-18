export interface TenantConfig {
  id: string;
  name: string;
  branding: {
    logo: string;
    primaryColor: string;
    secondaryColor: string;
  };
  features: {
    patientPortal: boolean;
    clinicianPortal: boolean;
    expertPortal: boolean;
    chatbot: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTenantRequest {
  id: string; // Tenant ID (e.g., 'demo', 'hospital-a')
  name: string;
  branding: {
    logo: string;
    primaryColor: string;
    secondaryColor: string;
  };
  features?: {
    patientPortal?: boolean;
    clinicianPortal?: boolean;
    expertPortal?: boolean;
    chatbot?: boolean;
  };
}

export interface UpdateTenantRequest {
  name?: string;
  branding?: {
    logo?: string;
    primaryColor?: string;
    secondaryColor?: string;
  };
  features?: {
    patientPortal?: boolean;
    clinicianPortal?: boolean;
    expertPortal?: boolean;
    chatbot?: boolean;
  };
}

export interface CreateTenantAdminRequest {
  tenantId: string;
  username: string;
  password: string;
  name: string;
}

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
      admin: number;
    };
  };
  expertFeedback: {
    total: number;
    averageRating: number;
  };
}

export interface AggregatedMetrics {
  totalTenants: number;
  totalDischargeSummaries: number;
  totalUsers: number;
  totalExpertFeedback: number;
  averageFeedbackRating: number;
  tenantMetrics: TenantMetrics[];
}
