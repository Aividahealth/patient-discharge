'use client'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'

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
   * Make a GET request
   */
  async get<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`
    const headers = this.getHeaders(options.headers)

    const response = await fetch(url, {
      ...options,
      method: 'GET',
      headers,
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }))
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
