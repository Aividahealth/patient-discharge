/**
 * API functions for discharge event management
 */

export interface RepublishEventsResponse {
  success: boolean;
  message: string;
  republished: number;
  failed: number;
  total: number;
  errors?: string[];
}

/**
 * Republish discharge export events for recently uploaded compositions
 * @param hoursAgo - How many hours back to look (default: 24)
 * @param limit - Maximum number of compositions to process (default: 10)
 * @param token - Authentication token
 * @param tenantId - Tenant ID
 */
export async function republishDischargeEvents(
  hoursAgo: number = 24,
  limit: number = 10,
  token?: string,
  tenantId?: string
): Promise<RepublishEventsResponse> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
  const url = `${apiUrl}/api/discharge-summary/republish-events?hoursAgo=${hoursAgo}&limit=${limit}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(tenantId ? { 'X-Tenant-ID': tenantId } : {}),
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to republish events' }));
    throw new Error(error.message || `HTTP error! status: ${response.status}`);
  }

  return response.json();
}

