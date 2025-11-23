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
  ehrIntegration?: {
    type: 'Manual' | 'Cerner' | 'EPIC';
    cerner?: {
      base_url: string;
      system_app?: {
        client_id: string;
        client_secret: string;
        token_url: string;
        scopes: string;
      };
      provider_app?: {
        client_id: string;
        client_secret: string;
        authorization_url: string;
        token_url: string;
        redirect_uri: string;
        scopes: string;
      };
      patients?: string[];
    };
    epic?: {
      // EPIC config can be added later
      base_url?: string;
    };
  };
  infrastructure?: {
    buckets: {
      raw: boolean;
      simplified: boolean;
      translated: boolean;
    };
    fhir: {
      dataset: boolean;
      store: boolean;
    };
    lastChecked?: Date;
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
  ehrIntegration?: {
    type: 'Manual' | 'Cerner' | 'EPIC';
    cerner?: {
      base_url: string;
      system_app?: {
        client_id: string;
        client_secret: string;
        token_url: string;
        scopes: string;
      };
      provider_app?: {
        client_id: string;
        client_secret: string;
        authorization_url: string;
        token_url: string;
        redirect_uri: string;
        scopes: string;
      };
      patients?: string[];
    };
    epic?: {
      base_url?: string;
    };
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
  ehrIntegration?: {
    type: 'Manual' | 'Cerner' | 'EPIC';
    cerner?: {
      base_url: string;
      system_app?: {
        client_id: string;
        client_secret: string;
        token_url: string;
        scopes: string;
      };
      provider_app?: {
        client_id: string;
        client_secret: string;
        authorization_url: string;
        token_url: string;
        redirect_uri: string;
        scopes: string;
      };
      patients?: string[];
    };
    epic?: {
      base_url?: string;
    };
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

export interface AggregatedMetrics {
  totalTenants: number;
  totalDischargeSummaries: number;
  totalUsers: number;
  totalExpertFeedback: number;
  averageFeedbackRating: number;
  tenantMetrics: TenantMetrics[];
}
