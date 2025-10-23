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
    
    // Try different header variations
    const tenantId = 
      headers['x-tenant-id'] as string ||
      headers['X-Tenant-ID'] as string ||
      headers['tenant-id'] as string;
    
    if (!tenantId) {
      throw new Error('Tenant ID is required. Please provide X-Tenant-ID, x-tenant-id, or tenant-id header.');
    }
    
    return tenantId;
  }

  /**
   * Validate tenant ID format
   */
  isValidTenantId(tenantId: string): boolean {
    // Basic validation - alphanumeric, hyphens, underscores allowed
    return /^[a-zA-Z0-9_-]+$/.test(tenantId) && tenantId.length > 0;
  }
}
