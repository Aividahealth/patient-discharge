import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as qs from 'qs';
import { IEHRService, EHRVendor, EHRCapabilities, BinaryDocument } from '../interfaces/ehr-service.interface';
import { DevConfigService } from '../../config/dev-config.service';
import { AuditService } from '../../audit/audit.service';
import { TenantContext } from '../../tenant/tenant-context';
import { AuthType } from '../../cerner-auth/types/auth.types';

/**
 * Cerner EHR adapter implementing IEHRService
 * Handles all Cerner-specific FHIR operations and authentication
 */
@Injectable()
export class CernerAdapter implements IEHRService {
  private readonly logger = new Logger(CernerAdapter.name);
  private accessToken: string | null = null;
  private accessTokenExpiryMs: number | null = null;

  constructor(
    private readonly configService: DevConfigService,
    private readonly auditService: AuditService,
  ) {}

  getVendor(): EHRVendor {
    return EHRVendor.CERNER;
  }

  getCapabilities(): EHRCapabilities {
    return {
      supportsFHIRR4: true,
      supportsSMARTonFHIR: true,
      supportsPatientAccess: true,
      supportsProviderAccess: true,
      supportedResourceTypes: [
        'Patient',
        'Encounter',
        'DocumentReference',
        'Composition',
        'Binary',
        'Observation',
        'Condition',
        'Medication',
        'MedicationRequest',
        'Procedure',
        'AllergyIntolerance',
        'Immunization',
      ],
      supportsDelete: true,
      supportsUpdate: true,
      maxSearchCount: undefined, // Unlimited
    };
  }

  private async getBaseUrl(ctx: TenantContext): Promise<string> {
    const ehrConfig = await this.configService.getTenantEHRConfig(ctx.tenantId);
    if (!ehrConfig?.base_url) {
      throw new Error(`Missing EHR base_url for tenant: ${ctx.tenantId}`);
    }
    return ehrConfig.base_url;
  }

  async authenticate(ctx: TenantContext, authType: AuthType = AuthType.SYSTEM): Promise<boolean> {
    if (!this.configService.isLoaded()) {
      this.logger.warn('Config not loaded yet, skipping authentication');
      return false;
    }

    if (authType === AuthType.SYSTEM) {
      return this.authenticateSystemApp(ctx);
    } else {
      return this.authenticateProviderApp(ctx);
    }
  }

  private async authenticateSystemApp(ctx: TenantContext): Promise<boolean> {
    this.logger.log(`Authenticating with Cerner system app for tenant: ${ctx.tenantId}`);

    let ehrConfig;
    try {
      ehrConfig = await this.configService.getTenantEHRSystemConfig(ctx.tenantId);
    } catch (error) {
      this.logger.warn('Config not loaded yet, skipping authentication');
      return false;
    }

    if (!ehrConfig?.client_id || !ehrConfig?.client_secret || !ehrConfig?.token_url || !ehrConfig?.scopes) {
      this.logger.error('Missing Cerner system app configuration');
      return false;
    }

    const credentials = Buffer.from(`${ehrConfig.client_id}:${ehrConfig.client_secret}`).toString('base64');
    const headers = {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    };
    const data = qs.stringify({
      grant_type: 'client_credentials',
      scope: ehrConfig.scopes,
    });

    try {
      const response = await axios.post(ehrConfig.token_url, data, { headers });
      this.accessToken = response.data.access_token;
      const expiresInSec: number | undefined = response.data.expires_in;
      // Refresh one minute before actual expiry
      const refreshBufferMs = 60 * 1000;
      if (expiresInSec && Number.isFinite(expiresInSec)) {
        this.accessTokenExpiryMs = Date.now() + Math.max(0, (expiresInSec * 1000) - refreshBufferMs);
      } else {
        // Default to 45 minutes if expires_in is missing
        this.accessTokenExpiryMs = Date.now() + (45 * 60 * 1000);
      }
      this.logger.log('Cerner system app authentication successful');
      return true;
    } catch (error) {
      this.logger.error('Cerner system app authentication failed', error);
      return false;
    }
  }

  private async authenticateProviderApp(ctx: TenantContext): Promise<boolean> {
    this.logger.log(`Authenticating with Cerner provider app for tenant: ${ctx.tenantId}, user: ${ctx.userId}`);

    if (!ctx.userId) {
      this.logger.error('User ID required for provider app authentication');
      return false;
    }

    // TODO: Integrate with session service to get user's access token
    this.logger.warn('Provider app authentication not yet fully implemented');
    return false;
  }

  private isTokenValid(): boolean {
    if (!this.accessToken) return false;
    if (!this.accessTokenExpiryMs) return true;
    return Date.now() < this.accessTokenExpiryMs;
  }

  isAuthenticated(): boolean {
    return this.isTokenValid();
  }

  private async ensureAccessToken(ctx: TenantContext, authType: AuthType = AuthType.SYSTEM): Promise<boolean> {
    if (this.isTokenValid()) {
      this.logger.log('Reusing existing Cerner access token');
      return true;
    }
    this.logger.log('Cerner access token expired or missing, fetching new token');
    return this.authenticate(ctx, authType);
  }

  async createResource(resourceType: string, resource: any, ctx: TenantContext): Promise<any | null> {
    const ok = await this.ensureAccessToken(ctx);
    if (!ok) {
      this.logger.error('Authentication failed. Cannot create resource.');
      return null;
    }

    const baseUrl = await this.getBaseUrl(ctx);
    const url = `${baseUrl}/${resourceType}`;
    const headers = {
      Authorization: `Bearer ${this.accessToken}`,
      'Content-Type': 'application/fhir+json',
      Accept: 'application/fhir+json',
    };

    try {
      const response = await axios.post(url, resource, { headers });
      this.logger.log(`Created ${resourceType} successfully.`);
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to create ${resourceType}`, error);
      if (error.response) {
        this.logger.error('Response:', error.response.data);
        return error.response.data;
      }
      throw error;
    }
  }

  async fetchResource(resourceType: string, resourceId: string, ctx: TenantContext): Promise<any | null> {
    const ok = await this.ensureAccessToken(ctx);
    if (!ok) return null;

    const baseUrl = await this.getBaseUrl(ctx);
    const url = `${baseUrl}/${resourceType}/${resourceId}`;
    const headers = {
      Authorization: `Bearer ${this.accessToken}`,
      Accept: 'application/fhir+json',
    };

    try {
      const response = await axios.get(url, { headers });
      this.logger.log(`Fetched ${resourceType}/${resourceId} successfully.`);
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to fetch ${resourceType}/${resourceId}`, error);
      if (error.response) {
        this.logger.error('Response:', error.response.data);
        return error.response.data;
      }
      return null;
    }
  }

  async updateResource(resourceType: string, resourceId: string, resource: any, ctx: TenantContext): Promise<any | null> {
    const ok = await this.ensureAccessToken(ctx);
    if (!ok) return null;

    const baseUrl = await this.getBaseUrl(ctx);
    const url = `${baseUrl}/${resourceType}/${resourceId}`;
    const headers = {
      Authorization: `Bearer ${this.accessToken}`,
      'Content-Type': 'application/fhir+json',
      Accept: 'application/fhir+json',
    };

    try {
      const response = await axios.put(url, resource, { headers });
      this.logger.log(`Updated ${resourceType}/${resourceId} successfully.`);
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to update ${resourceType}/${resourceId}`, error);
      if (error.response) {
        this.logger.error('Response:', error.response.data);
        return error.response.data;
      }
      return null;
    }
  }

  async deleteResource(resourceType: string, resourceId: string, ctx: TenantContext): Promise<boolean> {
    const ok = await this.ensureAccessToken(ctx);
    if (!ok) return false;

    const baseUrl = await this.getBaseUrl(ctx);
    const url = `${baseUrl}/${resourceType}/${resourceId}`;
    const headers = {
      Authorization: `Bearer ${this.accessToken}`,
      Accept: 'application/fhir+json',
    };

    try {
      await axios.delete(url, { headers });
      this.logger.log(`Deleted ${resourceType}/${resourceId} successfully.`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to delete ${resourceType}/${resourceId}`, error);
      if (error.response) {
        this.logger.error('Response:', error.response.data);
        return error.response.data;
      }
      return false;
    }
  }

  async searchResource(
    resourceType: string,
    query: Record<string, any>,
    ctx: TenantContext,
    authType: AuthType = AuthType.SYSTEM,
  ): Promise<any | null> {
    const ok = await this.ensureAccessToken(ctx, authType);
    if (!ok) return null;

    const baseUrl = await this.getBaseUrl(ctx);
    const url = `${baseUrl}/${resourceType}`;
    const headers = {
      Authorization: `Bearer ${this.accessToken}`,
      Accept: 'application/fhir+json',
    };

    try {
      const response = await axios.get(url, { headers, params: query });
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to search ${resourceType}`, error);
      if (error.response) {
        this.logger.error('Response:', error.response.data);
        return error.response.data;
      }
      return null;
    }
  }

  async searchDischargeSummaries(patientId: string, ctx: TenantContext): Promise<any | null> {
    this.logger.log(`Searching discharge summaries for patient ${patientId}`);

    // Audit log the request
    this.auditService.logFhirRequest({
      action: 'search',
      resourceType: 'DocumentReference',
      resourceId: patientId,
      endpoint: '/ehr/discharge-summaries',
      method: 'GET',
      metadata: { loincCode: '18842-5', vendor: 'cerner' },
    });

    // Try DocumentReference first
    const docRefQuery = {
      patient: patientId,
      // type: 'http://loinc.org|18842-5' // Discharge Summary LOINC code
    };

    let result = await this.searchResource('DocumentReference', docRefQuery, ctx);

    // If no DocumentReference results, try Composition
    if (!result || (result.total === 0 && result.entry?.length === 0)) {
      this.logger.log('No DocumentReference found, trying Composition');

      // Audit log the fallback
      this.auditService.logFhirRequest({
        action: 'search',
        resourceType: 'Composition',
        resourceId: patientId,
        endpoint: '/ehr/discharge-summaries',
        method: 'GET',
        metadata: { loincCode: '18842-5', fallback: true, vendor: 'cerner' },
      });

      const compQuery = {
        patient: patientId,
        // type: 'http://loinc.org|18842-5'
      };

      result = await this.searchResource('Composition', compQuery, ctx);
    }

    // Log processing stage
    if (result && result.total > 0) {
      this.auditService.logDocumentProcessing(
        result.entry?.[0]?.resource?.id || 'unknown',
        patientId,
        'extracted',
        { totalFound: result.total, vendor: 'cerner' },
      );
    }

    return result;
  }

  async fetchBinaryDocument(binaryId: string, ctx: TenantContext, acceptType: string = 'application/octet-stream'): Promise<BinaryDocument | null> {
    const ok = await this.ensureAccessToken(ctx);
    if (!ok) return null;

    const baseUrl = await this.getBaseUrl(ctx);
    const url = `${baseUrl}/Binary/${binaryId}`;
    const headers = {
      Authorization: `Bearer ${this.accessToken}`,
      Accept: acceptType,
    };

    try {
      const response = await axios.get(url, { headers });
      this.logger.log(`Fetched Binary/${binaryId} successfully.`);

      // Validate binary data
      const binaryData = response.data;
      if (typeof binaryData === 'string' && binaryData.length < 10) {
        this.logger.warn(`⚠️ Binary/${binaryId} contains invalid data: "${binaryData}" - likely corrupted or test data`);
        return {
          id: binaryId,
          contentType: response.headers['content-type'] || acceptType,
          data: null,
          size: 0,
          error: 'Invalid binary data - likely corrupted or test data',
        };
      }

      return {
        id: binaryId,
        contentType: response.headers['content-type'] || acceptType,
        data: binaryData,
        size: binaryData.length,
      };
    } catch (error) {
      this.logger.error(`Failed to fetch Binary/${binaryId}`);
      if (error.response) {
        const errorData = error.response.data;
        if (errorData?.issue?.[0]?.diagnostics) {
          this.logger.error(`Error: ${errorData.issue[0].diagnostics.substring(0, 200)}...`);
        } else {
          this.logger.error(`HTTP ${error.response.status}: ${error.response.statusText}`);
        }
        return error.response.data;
      }
      return null;
    }
  }

  parseDocumentReference(docRef: any): any {
    if (!docRef || docRef.resourceType !== 'DocumentReference') {
      return null;
    }

    const parsed = {
      id: docRef.id,
      status: docRef.status,
      type: docRef.type,
      patientId: docRef.subject?.reference?.replace('Patient/', ''),
      date: docRef.date,
      authors: docRef.author?.map((a: any) => a.display || a.reference),
      content: docRef.content?.map((c: any) => ({
        contentType: c.attachment?.contentType,
        url: c.attachment?.url,
        data: c.attachment?.data,
        title: c.attachment?.title,
        size: c.attachment?.size,
      })),
    };

    return parsed;
  }

  /**
   * Get patient IDs from tenant-based Firestore collection
   * Collection: tenant_patients
   * Document ID: {tenantId}
   * Structure: { patientIds: string[], updatedAt: timestamp }
   */
  private async getPatientIdsFromFirestore(tenantId: string): Promise<string[]> {
    try {
      return await this.configService.getTenantPatientIdsFromCollection(tenantId);
    } catch (error) {
      this.logger.warn(`   ⚠️  Error getting patient IDs from Firestore: ${error.message}`);
      return [];
    }
  }

  /**
   * Discover patients automatically from Cerner using hybrid approach:
   * 1. Get patient IDs from Firestore collection (tenant-based)
   * 2. Search for recent Encounters for each patient (with patient filter)
   * 3. Search for recent DocumentReferences (secondary)
   * 4. Include manual patient list from config (optional)
   * 
   * Lookback period: 1 hour (hardcoded)
   */
  async discoverPatients(ctx: TenantContext): Promise<string[]> {
    const patientIds = new Set<string>();
    const lookbackHours = 1; // Hardcoded to 1 hour
    const oneHourAgo = new Date(Date.now() - lookbackHours * 60 * 60 * 1000).toISOString();

    this.logger.log(`🔍 Discovering patients from Cerner for tenant: ${ctx.tenantId} (lookback: ${lookbackHours} hour)`);

    try {
      // Ensure authenticated
      if (!(await this.authenticate(ctx, AuthType.SYSTEM))) {
        this.logger.error('❌ Failed to authenticate with Cerner for patient discovery');
        // Fallback to manual list
        return await this.getManualPatientList(ctx);
      }

      // Step 0: Get patient IDs from Firestore collection
      this.logger.log('📋 Step 0: Getting patient IDs from Firestore collection...');
      const firestorePatientIds = await this.getPatientIdsFromFirestore(ctx.tenantId);
      
      if (firestorePatientIds.length === 0) {
        this.logger.log('   ⚠️  No patient IDs in Firestore collection, skipping Encounter search');
      } else {
        // Step 1: Search for recent Encounters for each patient (with patient filter)
        this.logger.log(`📋 Step 1: Searching for recent Encounters for ${firestorePatientIds.length} patients...`);
        let totalEncounters = 0;
        let patientsWithEncounters = 0;

        for (const patientId of firestorePatientIds) {
          try {
            const encounters = await this.searchResource('Encounter', {
              patient: patientId,
              status: 'finished',
              _lastUpdated: `ge${oneHourAgo}`,
              _count: 100,
              _sort: '-_lastUpdated',
            }, ctx, AuthType.SYSTEM);

            if (encounters?.entry && encounters.entry.length > 0) {
              patientIds.add(patientId);
              totalEncounters += encounters.entry.length;
              patientsWithEncounters++;
            }
          } catch (error) {
            this.logger.warn(`   ⚠️  Error searching Encounters for patient ${patientId}: ${error.message}`);
          }
        }

        if (patientsWithEncounters > 0) {
          this.logger.log(`   ✅ Found encounters for ${patientsWithEncounters}/${firestorePatientIds.length} patients (${totalEncounters} total encounters)`);
        } else {
          this.logger.log(`   ⚠️  No recent encounters found for any of the ${firestorePatientIds.length} patients`);
        }
      }

      // Step 2: Search for recent DocumentReferences (secondary method)
      this.logger.log('📄 Step 2: Searching for recent DocumentReferences...');
      try {
        const documents = await this.searchResource('DocumentReference', {
          type: 'http://loinc.org|18842-5', // Discharge summary
          _lastUpdated: `ge${oneHourAgo}`,
          _count: 100,
          _sort: '-_lastUpdated',
        }, ctx, AuthType.SYSTEM);

        if (documents?.entry) {
          const beforeDocCount = patientIds.size;
          for (const entry of documents.entry) {
            const patientRef = entry.resource.subject?.reference;
            if (patientRef?.startsWith('Patient/')) {
              const patientId = patientRef.replace('Patient/', '');
              patientIds.add(patientId);
            }
          }
          const newPatients = patientIds.size - beforeDocCount;
          this.logger.log(`   ✅ Found ${documents.entry.length} documents, added ${newPatients} new patient IDs`);
        } else {
          this.logger.log('   ⚠️  No recent DocumentReferences found');
        }
      } catch (error) {
        this.logger.warn(`   ⚠️  Error searching for DocumentReferences: ${error.message}`);
      }

      // Step 3: Include manual patient list from config (optional fallback)
      this.logger.log('📝 Step 3: Including manual patient list from config...');
      const manualPatients = await this.getManualPatientList(ctx);
      if (manualPatients.length > 0) {
        const beforeManualCount = patientIds.size;
        manualPatients.forEach(id => patientIds.add(id));
        const addedManual = patientIds.size - beforeManualCount;
        this.logger.log(`   ✅ Added ${addedManual} patients from manual list (${manualPatients.length} total in config)`);
      } else {
        this.logger.log('   ℹ️  No manual patient list configured');
      }

      const finalPatientList = Array.from(patientIds);
      this.logger.log(`✅ Patient discovery complete: ${finalPatientList.length} total patients discovered`);
      if (finalPatientList.length > 0) {
        this.logger.log(`   Patient IDs: ${finalPatientList.slice(0, 10).join(', ')}${finalPatientList.length > 10 ? '...' : ''}`);
      }

      return finalPatientList;
    } catch (error) {
      this.logger.error(`❌ Error during patient discovery: ${error.message}`);
      // Fallback to manual list on error
      this.logger.log('🔄 Falling back to manual patient list');
      return await this.getManualPatientList(ctx);
    }
  }

  /**
   * Get manual patient list from configuration (fallback)
   */
  private async getManualPatientList(ctx: TenantContext): Promise<string[]> {
    try {
      const ehrConfig = await this.configService.getTenantEHRConfig(ctx.tenantId);
      return ehrConfig?.patients || [];
    } catch (error) {
      this.logger.warn(`Could not retrieve manual patient list: ${error.message}`);
      return [];
    }
  }
}
