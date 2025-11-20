import { TenantContext } from '../../tenant/tenant-context';
import { AuthType } from '../../cerner-auth/types/auth.types';

/**
 * Supported EHR vendors
 */
export enum EHRVendor {
  CERNER = 'cerner',
  EPIC = 'epic',
  ALLSCRIPTS = 'allscripts',
  MEDITECH = 'meditech',
}

/**
 * EHR system capabilities
 */
export interface EHRCapabilities {
  supportsFHIRR4: boolean;
  supportsSMARTonFHIR: boolean;
  supportsPatientAccess: boolean;
  supportsProviderAccess: boolean;
  supportedResourceTypes: string[];
  supportsDelete?: boolean;
  supportsUpdate?: boolean;
  maxSearchCount?: number;
}

/**
 * Binary document response
 */
export interface BinaryDocument {
  id: string;
  contentType: string;
  data: any;
  size: number;
  error?: string;
}

/**
 * Base interface for all EHR service adapters
 * Each vendor-specific adapter must implement this interface
 */
export interface IEHRService {
  /**
   * Get vendor name (cerner, epic, etc.)
   */
  getVendor(): EHRVendor;

  /**
   * Authenticate with the EHR system
   * @param ctx - Tenant context
   * @param authType - Type of authentication (SYSTEM or PROVIDER)
   * @returns true if authentication successful
   */
  authenticate(ctx: TenantContext, authType?: AuthType): Promise<boolean>;

  /**
   * Check if currently authenticated
   * @returns true if valid authentication token exists
   */
  isAuthenticated(): boolean;

  /**
   * Create a FHIR resource
   * @param resourceType - FHIR resource type (e.g., 'Patient', 'DocumentReference')
   * @param resource - FHIR resource object
   * @param ctx - Tenant context
   * @returns Created resource or null if failed
   */
  createResource(resourceType: string, resource: any, ctx: TenantContext): Promise<any | null>;

  /**
   * Fetch a FHIR resource by type and ID
   * @param resourceType - FHIR resource type
   * @param resourceId - Resource ID
   * @param ctx - Tenant context
   * @returns Resource object or null if not found
   */
  fetchResource(resourceType: string, resourceId: string, ctx: TenantContext): Promise<any | null>;

  /**
   * Update a FHIR resource
   * @param resourceType - FHIR resource type
   * @param resourceId - Resource ID
   * @param resource - Updated resource object
   * @param ctx - Tenant context
   * @returns Updated resource or null if failed
   */
  updateResource(resourceType: string, resourceId: string, resource: any, ctx: TenantContext): Promise<any | null>;

  /**
   * Delete a FHIR resource
   * @param resourceType - FHIR resource type
   * @param resourceId - Resource ID
   * @param ctx - Tenant context
   * @returns true if deleted successfully
   */
  deleteResource(resourceType: string, resourceId: string, ctx: TenantContext): Promise<boolean>;

  /**
   * Search FHIR resources with query parameters
   * @param resourceType - FHIR resource type
   * @param query - Search query parameters
   * @param ctx - Tenant context
   * @param authType - Optional auth type (defaults to SYSTEM)
   * @returns Search bundle or null if failed
   */
  searchResource(resourceType: string, query: Record<string, any>, ctx: TenantContext, authType?: AuthType): Promise<any | null>;

  /**
   * Search discharge summaries for a patient
   * @param patientId - Patient ID
   * @param ctx - Tenant context
   * @returns Search bundle containing discharge summaries
   */
  searchDischargeSummaries(patientId: string, ctx: TenantContext): Promise<any | null>;

  /**
   * Fetch binary document content (PDF, images, etc.)
   * @param binaryId - Binary resource ID
   * @param ctx - Tenant context
   * @param acceptType - Content type to accept (e.g., 'application/pdf')
   * @returns Binary document object
   */
  fetchBinaryDocument(binaryId: string, ctx: TenantContext, acceptType?: string): Promise<BinaryDocument | null>;

  /**
   * Parse DocumentReference and extract key fields
   * @param docRef - DocumentReference resource
   * @returns Parsed document reference object
   */
  parseDocumentReference(docRef: any): any;

  /**
   * Get EHR-specific capabilities (optional)
   * @returns Capabilities object describing what this EHR supports
   */
  getCapabilities?(): EHRCapabilities;
}
