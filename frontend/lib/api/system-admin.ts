import { ApiClient } from '../api-client'

export interface TenantConfig {
  id: string
  name: string
  branding: {
    logo: string
    primaryColor: string
    secondaryColor: string
  }
  features: {
    patientPortal: boolean
    clinicianPortal: boolean
    expertPortal: boolean
    chatbot: boolean
  }
  createdAt: string
  updatedAt: string
}

export interface CreateTenantRequest {
  id: string
  name: string
  branding: {
    logo: string
    primaryColor: string
    secondaryColor: string
  }
  features?: {
    patientPortal?: boolean
    clinicianPortal?: boolean
    expertPortal?: boolean
    chatbot?: boolean
  }
}

export interface UpdateTenantRequest {
  name?: string
  branding?: {
    logo?: string
    primaryColor?: string
    secondaryColor?: string
  }
  features?: {
    patientPortal?: boolean
    clinicianPortal?: boolean
    expertPortal?: boolean
    chatbot?: boolean
  }
}

export interface CreateTenantAdminRequest {
  tenantId: string
  username: string
  password: string
  name: string
}

export interface TenantMetrics {
  tenantId: string
  tenantName: string
  dischargeSummaries: {
    total: number
    byStatus: {
      raw_only: number
      simplified: number
      translated: number
      processing: number
      error: number
    }
  }
  users: {
    total: number
    byRole: {
      patient: number
      clinician: number
      expert: number
      tenant_admin: number
    }
  }
  expertFeedback: {
    total: number
    averageRating: number
  }
}

export interface AggregatedMetrics {
  totalTenants: number
  totalDischargeSummaries: number
  totalUsers: number
  totalExpertFeedback: number
  averageFeedbackRating: number
  tenantMetrics: TenantMetrics[]
}

/**
 * System Admin API client
 */
export class SystemAdminApi {
  private client: ApiClient

  constructor(token: string) {
    // System admin uses 'system' as tenantId
    this.client = new ApiClient({ token, tenantId: 'system' })
  }

  /**
   * Get all tenants
   */
  async getAllTenants(): Promise<TenantConfig[]> {
    return this.client.get('/system-admin/tenants')
  }

  /**
   * Get a specific tenant
   */
  async getTenant(tenantId: string): Promise<TenantConfig> {
    return this.client.get(`/system-admin/tenants/${tenantId}`)
  }

  /**
   * Create a new tenant
   */
  async createTenant(request: CreateTenantRequest): Promise<TenantConfig> {
    return this.client.post('/system-admin/tenants', request)
  }

  /**
   * Update a tenant
   */
  async updateTenant(tenantId: string, request: UpdateTenantRequest): Promise<TenantConfig> {
    return this.client.put(`/system-admin/tenants/${tenantId}`, request)
  }

  /**
   * Delete a tenant
   */
  async deleteTenant(tenantId: string): Promise<{ success: boolean; message: string }> {
    return this.client.delete(`/system-admin/tenants/${tenantId}`)
  }

  /**
   * Create a tenant admin user
   */
  async createTenantAdmin(request: CreateTenantAdminRequest): Promise<any> {
    return this.client.post('/system-admin/tenant-admins', request)
  }

  /**
   * Get metrics for a specific tenant
   */
  async getTenantMetrics(tenantId: string): Promise<TenantMetrics> {
    return this.client.get(`/system-admin/metrics/tenants/${tenantId}`)
  }

  /**
   * Get aggregated metrics across all tenants
   */
  async getAggregatedMetrics(): Promise<AggregatedMetrics> {
    return this.client.get('/system-admin/metrics/aggregated')
  }
}
