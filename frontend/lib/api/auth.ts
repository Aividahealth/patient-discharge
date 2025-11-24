'use client'

import { ApiClient } from '../api-client'
import type { AuthData } from '../../contexts/tenant-context'

/**
 * Extract filename from logo path and prepend /tenant/
 * Handles various path formats:
 * - "/public/tenant/Rainbow_Healing_logo.png" -> "/tenant/Rainbow_Healing_logo.png"
 * - "Rainbow_Healing_logo.png" -> "/tenant/Rainbow_Healing_logo.png"
 * - "/tenant/Rainbow_Healing_logo.png" -> "/tenant/Rainbow_Healing_logo.png"
 *
 * For favicon, if the path doesn't have a valid image extension, return default
 */
function normalizeTenantLogoPath(logoPath: string, isFavicon: boolean = false): string {
  if (!logoPath) return '/aivida-logo.png';

  // Extract just the filename from the path
  const filename = logoPath.split('/').pop() || logoPath;

  // For favicons, check if it has a valid image extension
  if (isFavicon && !filename.match(/\.(png|jpg|jpeg|ico|svg)$/i)) {
    // If no valid extension, use the logo as favicon
    return '/aivida-logo.png';
  }

  // Return path pointing to /public/tenant/ folder
  return `/tenant/${filename}`;
}

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
    role: 'patient' | 'clinician' | 'admin' | 'expert' | 'system_admin'
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
    ehrIntegration?: {
      type: 'Manual' | 'Cerner' | 'EPIC'
      cerner?: {
        base_url: string
        system_app?: {
          client_id: string
          client_secret: string
          token_url: string
          scopes: string
        }
        provider_app?: {
          client_id: string
          client_secret: string
          authorization_url: string
          token_url: string
          redirect_uri: string
          scopes: string
        }
        patients?: string[]
      }
      epic?: {
        base_url?: string
      }
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
        logo: normalizeTenantLogoPath(response.tenant.branding.logo, false),
        favicon: normalizeTenantLogoPath(response.tenant.branding.logo, true),
        primaryColor: response.tenant.branding.primaryColor,
        secondaryColor: response.tenant.branding.secondaryColor,
        accentColor: response.tenant.branding.primaryColor,
      },
      features: {
        aiGeneration: true,
        multiLanguage: true,
        supportedLanguages: ['en', 'es', 'hi', 'vi', 'fr', 'zh'],
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

  // Normalize logo paths to use /tenant/ folder
  if (response.tenant?.branding) {
    response.tenant.branding.logo = normalizeTenantLogoPath(response.tenant.branding.logo, false);
    response.tenant.branding.favicon = normalizeTenantLogoPath(response.tenant.branding.favicon, true);
  }

  return response
}
