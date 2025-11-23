import type { AuditLogQuery, AuditLogListResponse } from '@/types/audit-logs';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || (process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : 'https://patient-discharge-backend-dev-647433528821.us-central1.run.app');

/**
 * Get audit logs for a tenant
 */
export async function getAuditLogs(
  query: AuditLogQuery,
  tenantId: string,
  token: string
): Promise<AuditLogListResponse> {
  const params = new URLSearchParams();

  if (query.type) params.append('type', query.type);
  if (query.userId) params.append('userId', query.userId);
  if (query.patientId) params.append('patientId', query.patientId);
  if (query.startDate) params.append('startDate', query.startDate.toISOString());
  if (query.endDate) params.append('endDate', query.endDate.toISOString());
  if (query.limit) params.append('limit', query.limit.toString());
  if (query.offset) params.append('offset', query.offset.toString());

  const url = `${API_BASE_URL}/api/audit/logs?${params.toString()}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'X-Tenant-ID': tenantId,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch audit logs: ${response.status} ${errorText}`);
  }

  const data = await response.json();

  // Convert timestamp strings to Date objects
  if (data.items) {
    data.items = data.items.map((item: any) => ({
      ...item,
      timestamp: new Date(item.timestamp),
    }));
  }

  return data;
}
