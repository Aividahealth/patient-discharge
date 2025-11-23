'use client'

// Get API base URL from environment with proper fallbacks
function getApiBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL
  }

  if (process.env.API_URL) {
    return process.env.API_URL
  }

  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:3000'
  }

  // Fallback to dev backend (should be overridden by NEXT_PUBLIC_API_URL)
  return 'https://patient-discharge-backend-dev-647433528821.us-central1.run.app'
}

const API_BASE_URL = getApiBaseUrl()

export interface ApiClientConfig {
  tenantId?: string | null
  token?: string | null
}

export class ApiClient {
  private baseUrl: string
  private tenantId: string | null
  private token: string | null

  constructor(config: ApiClientConfig = {}) {
    this.baseUrl = API_BASE_URL
    this.tenantId = config.tenantId || null
    this.token = config.token || null
  }

  /**
   * Set tenant ID for subsequent requests
   */
  setTenantId(tenantId: string | null) {
    this.tenantId = tenantId
  }

  /**
   * Set auth token for subsequent requests
   */
  setToken(token: string | null) {
    this.token = token
  }

  /**
   * Build headers with tenant ID and authorization
   */
  private getHeaders(customHeaders: HeadersInit = {}): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...customHeaders,
    }

    if (this.tenantId) {
      headers['X-Tenant-ID'] = this.tenantId
    }

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`
    }

    return headers
  }

  /**
   * Build URL with query parameters
   */
  private buildUrl(
    endpoint: string,
    params?: Record<string, string | number | boolean | undefined | null>
  ): string {
    const url = `${this.baseUrl}${endpoint}`

    if (!params) return url

    const queryParams = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, String(value))
      }
    })

    const queryString = queryParams.toString()
    return queryString ? `${url}?${queryString}` : url
  }

  /**
   * Make a GET request
   */
  async get<T>(
    endpoint: string,
    params?: Record<string, string | number | boolean | undefined | null>,
    options: RequestInit = {}
  ): Promise<T> {
    const url = this.buildUrl(endpoint, params)
    const headers = this.getHeaders(options.headers)

    const response = await fetch(url, {
      ...options,
      method: 'GET',
      headers,
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }))
      console.error(`[ApiClient] GET ${endpoint} failed:`, {
        status: response.status,
        statusText: response.statusText,
        error
      })
      throw new Error(error.message || `HTTP ${response.status}: ${response.statusText}`)
    }

    return response.json()
  }

  /**
   * Make a POST request
   */
  async post<T>(endpoint: string, body?: any, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`
    const headers = this.getHeaders(options.headers)

    const response = await fetch(url, {
      ...options,
      method: 'POST',
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }))
      throw new Error(error.message || `HTTP ${response.status}: ${response.statusText}`)
    }

    return response.json()
  }

  /**
   * Make a PUT request
   */
  async put<T>(endpoint: string, body?: any, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`
    const headers = this.getHeaders(options.headers)

    const response = await fetch(url, {
      ...options,
      method: 'PUT',
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }))
      throw new Error(error.message || `HTTP ${response.status}: ${response.statusText}`)
    }

    return response.json()
  }

  /**
   * Make a DELETE request
   */
  async delete<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`
    const headers = this.getHeaders(options.headers)

    const response = await fetch(url, {
      ...options,
      method: 'DELETE',
      headers,
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }))
      throw new Error(error.message || `HTTP ${response.status}: ${response.statusText}`)
    }

    return response.json()
  }

  /**
   * Make a PATCH request
   */
  async patch<T>(endpoint: string, body?: any, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`
    const headers = this.getHeaders(options.headers)

    const response = await fetch(url, {
      ...options,
      method: 'PATCH',
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }))
      throw new Error(error.message || `HTTP ${response.status}: ${response.statusText}`)
    }

    return response.json()
  }
}

// Export a singleton instance
let apiClientInstance: ApiClient | null = null

/**
 * Get or create the API client singleton
 */
export function getApiClient(config?: ApiClientConfig): ApiClient {
  if (!apiClientInstance || config) {
    apiClientInstance = new ApiClient(config)
  }
  return apiClientInstance
}

/**
 * Create a new API client instance (for use in React components with tenant context)
 */
export function createApiClient(config: ApiClientConfig): ApiClient {
  return new ApiClient(config)
}
