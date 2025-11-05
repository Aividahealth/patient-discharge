'use client'

import { ApiClient } from '../api-client'
import type { AuthData } from '../../contexts/tenant-context'

export interface LoginRequest {
  tenantId: string
  username: string
  password: string
}

export interface LoginResponse {
  success: boolean
  token: string
  expiresIn: number
  user: {
    id: string
    tenantId: string
    username: string
    name: string
    role: 'patient' | 'clinician' | 'admin' | 'expert'
    linkedPatientId?: string
  }
  tenant: {
    id: string
    name: string
    branding: {
      logo: string
      primaryColor: string
      secondaryColor: string
    }
  }
}

export interface TenantConfigResponse {
  success: boolean
  tenant: {
    id: string
    name: string
    status: 'active' | 'inactive' | 'suspended'
    type: string
    branding: {
      logo: string
      favicon: string
      primaryColor: string
      secondaryColor: string
      accentColor: string
    }
    features: {
      aiGeneration: boolean
      multiLanguage: boolean
      supportedLanguages: string[]
      fileUpload: boolean
      expertPortal: boolean
      clinicianPortal: boolean
      adminPortal: boolean
    }
    config: {
      simplificationEnabled: boolean
      translationEnabled: boolean
      defaultLanguage: string
    }
  }
}

/**
 * Login with username and password
 */
export async function login(request: LoginRequest): Promise<AuthData> {
  const client = new ApiClient()

  const response = await client.post<LoginResponse>('/api/auth/login', request)

  if (!response.success) {
    throw new Error('Login failed')
  }

  return {
    token: response.token,
    expiresIn: response.expiresIn,
    user: response.user,
    tenant: {
      id: response.tenant.id,
      name: response.tenant.name,
      status: 'active',
      type: 'demo',
      branding: {
        logo: response.tenant.branding.logo,
        favicon: response.tenant.branding.logo,
        primaryColor: response.tenant.branding.primaryColor,
        secondaryColor: response.tenant.branding.secondaryColor,
        accentColor: response.tenant.branding.primaryColor,
      },
      features: {
        aiGeneration: true,
        multiLanguage: true,
        supportedLanguages: ['en', 'es', 'hi', 'vi', 'fr'],
        fileUpload: true,
        expertPortal: true,
        clinicianPortal: true,
        adminPortal: true,
      },
      config: {
        simplificationEnabled: true,
        translationEnabled: true,
        defaultLanguage: 'en',
      },
    },
  }
}

/**
 * Get tenant configuration
 */
export async function getTenantConfig(tenantId: string, token: string): Promise<TenantConfigResponse> {
  const client = new ApiClient({ tenantId, token })

  const response = await client.get<TenantConfigResponse>('/api/config')

  if (!response.success) {
    throw new Error('Failed to fetch tenant configuration')
  }

  return response
}
