'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'

export interface TenantBranding {
  logo: string
  favicon: string
  primaryColor: string
  secondaryColor: string
  accentColor: string
}

export interface TenantFeatures {
  aiGeneration: boolean
  multiLanguage: boolean
  supportedLanguages: string[]
  fileUpload: boolean
  expertPortal: boolean
  clinicianPortal: boolean
  adminPortal: boolean
}

export interface TenantConfig {
  simplificationEnabled: boolean
  translationEnabled: boolean
  defaultLanguage: string
}

export interface Tenant {
  id: string
  name: string
  status: 'active' | 'inactive' | 'suspended'
  type: string
  branding: TenantBranding
  features: TenantFeatures
  config: TenantConfig
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

export interface User {
  id: string
  tenantId: string
  username: string
  name: string
  role: 'patient' | 'clinician' | 'expert' | 'tenant_admin' | 'system_admin'
  linkedPatientId?: string
}

export interface AuthData {
  // SECURITY: Token no longer in response - stored in HttpOnly cookie
  expiresIn: number
  user: User
  tenant: Tenant
}

interface TenantContextType {
  tenantId: string | null
  tenant: Tenant | null
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (authData: AuthData) => void
  logout: () => Promise<void>
  updateTenant: (tenant: Tenant) => void
}

const TenantContext = createContext<TenantContextType | undefined>(undefined)

// SECURITY: Only storing non-sensitive user/tenant info in localStorage
// Auth token is now in HttpOnly cookie (not accessible to JavaScript)
const AUTH_STORAGE_KEY = 'aivida_auth'

interface TenantProviderProps {
  children: ReactNode
}

export function TenantProvider({ children }: TenantProviderProps) {
  const [tenantId, setTenantId] = useState<string | null>(null)
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const pathname = usePathname()
  const router = useRouter()

  // Extract tenant ID from URL path: /:tenantId/...
  useEffect(() => {
    const pathSegments = pathname?.split('/').filter(Boolean) || []
    const extractedTenantId = pathSegments[0] || null

    // Only set tenant ID if it's not a special route (login, marketing, etc.)
    if (extractedTenantId && !['login', 'marketing'].includes(extractedTenantId)) {
      setTenantId(extractedTenantId)
    }
  }, [pathname])

  // Load user/tenant data from localStorage on mount
  // SECURITY: Auth token is in HttpOnly cookie, not localStorage
  useEffect(() => {
    const loadAuthData = async () => {
      try {
        const storedAuth = localStorage.getItem(AUTH_STORAGE_KEY)

        if (!storedAuth) {
          setIsLoading(false)
          return
        }

        const authData: AuthData = JSON.parse(storedAuth)
        setUser(authData.user)
        setTenant(authData.tenant)
        setTenantId(authData.tenant.id)

        // Fetch the latest tenant config from the backend (skip for system_admin users)
        // Cookie will be sent automatically with request
        if (authData.user.role !== 'system_admin') {
          try {
            const { getTenantConfig } = await import('@/lib/api/auth')
            const configResponse = await getTenantConfig(authData.tenant.id)

            if (configResponse.success && configResponse.tenant) {
              console.log('[TenantContext] Loaded tenant config:', configResponse.tenant)
              setTenant(configResponse.tenant)

              // Update stored auth data with full tenant config
              authData.tenant = configResponse.tenant
              localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authData))
            }
          } catch (configError) {
            console.warn('[TenantContext] Failed to load tenant config, using cached data:', configError)
            // Continue with cached tenant data if config fetch fails
          }
        } else {
          console.log('[TenantContext] Skipping tenant config load for system_admin user')
        }
      } catch (error) {
        console.error('Error loading auth data:', error)
        // Clear corrupted data
        localStorage.removeItem(AUTH_STORAGE_KEY)
      } finally {
        setIsLoading(false)
      }
    }

    loadAuthData()
  }, [])

  const login = async (authData: AuthData) => {
    try {
      // SECURITY: Token is already set in HttpOnly cookie by backend
      // Only store non-sensitive user/tenant info in localStorage

      // Set auth data in state
      setUser(authData.user)
      setTenant(authData.tenant)
      setTenantId(authData.tenant.id)

      // Fetch full tenant config from backend (skip for system_admin users)
      // Cookie will be sent automatically with request
      if (authData.user.role !== 'system_admin') {
        try {
          const { getTenantConfig } = await import('@/lib/api/auth')
          const configResponse = await getTenantConfig(authData.tenant.id)

          if (configResponse.success && configResponse.tenant) {
            console.log('[TenantContext] Fetched tenant config:', configResponse.tenant)
            authData.tenant = configResponse.tenant
            setTenant(configResponse.tenant)
          }
        } catch (configError) {
          console.warn('[TenantContext] Failed to fetch tenant config, using login data:', configError)
          // Continue with tenant data from login response
        }
      } else {
        console.log('[TenantContext] Skipping tenant config fetch for system_admin user')
      }

      // Save user/tenant info to localStorage (no token)
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authData))
    } catch (error) {
      console.error('Error saving auth data:', error)
    }
  }

  const logout = async () => {
    try {
      // Call backend to clear HttpOnly cookie
      const { createApiClient } = await import('@/lib/api-client')
      const apiClient = createApiClient({ tenantId })

      try {
        await apiClient.post('/api/auth/logout')
      } catch (error) {
        console.warn('[TenantContext] Logout API call failed, continuing with local cleanup:', error)
        // Continue with local cleanup even if API call fails
      }
    } catch (error) {
      console.error('[TenantContext] Error during logout:', error)
    } finally {
      // Clear local state and storage
      localStorage.removeItem(AUTH_STORAGE_KEY)
      setUser(null)
      setTenant(null)
      setTenantId(null)

      // Redirect to login
      router.push('/login')
    }
  }

  const updateTenant = (updatedTenant: Tenant) => {
    setTenant(updatedTenant)

    // Update stored auth data
    const storedAuth = localStorage.getItem(AUTH_STORAGE_KEY)
    if (storedAuth) {
      try {
        const authData: AuthData = JSON.parse(storedAuth)
        authData.tenant = updatedTenant
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authData))
      } catch (error) {
        console.error('Error updating tenant in storage:', error)
      }
    }
  }

  // SECURITY: Authentication is now based on HttpOnly cookie (checked by backend)
  // Frontend just checks if we have user/tenant info
  const isAuthenticated = !!(user && tenant)

  const value: TenantContextType = {
    tenantId,
    tenant,
    user,
    isLoading,
    isAuthenticated,
    login,
    logout,
    updateTenant,
  }

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>
}

export function useTenant() {
  const context = useContext(TenantContext)
  if (context === undefined) {
    throw new Error('useTenant must be used within a TenantProvider')
  }
  return context
}
