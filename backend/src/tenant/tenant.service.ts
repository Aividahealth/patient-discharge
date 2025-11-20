import { Injectable } from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class TenantService {
  /**
   * Extract tenant ID from request headers
   * Supports multiple header formats:
   * - X-Tenant-ID
   * - x-tenant-id
   * - tenant-id
   * Throws error if no tenant ID is provided
   */
  extractTenantId(request: Request): string {
    const headers = request.headers;

    // Debug: Log all headers to see what we're receiving
    const allHeaders = Object.keys(headers).filter(key => 
      key.toLowerCase().includes('tenant')
    );
    if (allHeaders.length > 0) {
      console.log('[TenantService] Tenant-related headers found:', 
        allHeaders.map(key => `${key}=${headers[key]}`).join(', ')
      );
    } else {
      console.log('[TenantService] No tenant-related headers found. All headers:', Object.keys(headers).join(', '));
    }

    // Express normalizes headers to lowercase, so check lowercase first
    const tenantId =
      (headers['x-tenant-id'] as string) ||
      (headers['X-Tenant-ID'] as string) ||
      (headers['tenant-id'] as string);

    if (!tenantId) {
      console.error('[TenantService] No tenant ID header found. Available headers:', Object.keys(headers));
      console.error('[TenantService] Checking specific header keys:', {
        'x-tenant-id': headers['x-tenant-id'],
        'X-Tenant-ID': headers['X-Tenant-ID'],
        'tenant-id': headers['tenant-id'],
      });
      throw new Error('Tenant ID is required. Please provide X-Tenant-ID, x-tenant-id, or tenant-id header.');
    }

    console.log('[TenantService] Extracted tenantId:', tenantId);
    return tenantId;
  }

  /**
   * Extract tenant ID from request headers (optional - returns null if not found)
   */
  extractTenantIdOptional(request: Request): string | null {
    const headers = request.headers;

    // Try different header variations
    const tenantId =
      headers['x-tenant-id'] as string ||
      headers['X-Tenant-ID'] as string ||
      headers['tenant-id'] as string;

    return tenantId || null;
  }

  /**
   * Validate tenant ID format
   */
  isValidTenantId(tenantId: string): boolean {
    // Basic validation - alphanumeric, hyphens, underscores allowed
    return /^[a-zA-Z0-9_-]+$/.test(tenantId) && tenantId.length > 0;
  }
}
