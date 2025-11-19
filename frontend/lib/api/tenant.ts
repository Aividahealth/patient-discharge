import type { TenantMetrics } from '@/types/tenant-metrics'

/**
 * Fetch metrics for the current tenant
 * @param tenantId - The tenant ID
 * @param token - Authentication token
 * @returns Promise with tenant metrics
 */
export async function getTenantMetrics(
  tenantId: string,
  token: string
): Promise<TenantMetrics> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

  const response = await fetch(`${baseUrl}/api/tenant/metrics`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'X-Tenant-ID': tenantId,
    },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to fetch tenant metrics' }))
    throw new Error(error.message || `Failed to fetch tenant metrics: ${response.statusText}`)
  }

  return response.json()
}
