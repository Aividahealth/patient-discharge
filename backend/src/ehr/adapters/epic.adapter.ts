import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as jwt from 'jsonwebtoken';
import * as fs from 'fs';
import { IEHRService, EHRVendor, EHRCapabilities, BinaryDocument } from '../interfaces/ehr-service.interface';
import { DevConfigService } from '../../config/dev-config.service';
import { AuditService } from '../../audit/audit.service';
import { TenantContext } from '../../tenant/tenant-context';
import { AuthType } from '../../cerner-auth/types/auth.types';

/**
 * EPIC EHR adapter implementing IEHRService
 * Handles all EPIC-specific FHIR operations and JWT-based authentication
 *
 * EPIC Authentication Notes:
 * - Uses JWT assertion (RS384) instead of Basic Auth
 * - Requires RSA private key for signing JWT
 * - Requires public key to be registered with EPIC
 * - Must include Epic-Client-ID header in all requests
 *
 * Documentation: https://fhir.epic.com/Documentation?docId=oauth2&section=BackendOAuth2Guide
 */
@Injectable()
export class EPICAdapter implements IEHRService {
  private readonly logger = new Logger(EPICAdapter.name);
  private accessToken: string | null = null;
  private accessTokenExpiryMs: number | null = null;

  constructor(
    private readonly configService: DevConfigService,
    private readonly auditService: AuditService,
  ) {}

  getVendor(): EHRVendor {
    return EHRVendor.EPIC;
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
        'Binary',
        'Observation',
        'Condition',
        'MedicationRequest',
        'Procedure',
        'AllergyIntolerance',
        'Immunization',
        'DiagnosticReport',
        'CarePlan',
      ],
      supportsDelete: false, // Most resources are read-only in EPIC
      supportsUpdate: false, // Limited update support
      maxSearchCount: 100, // EPIC default: 10, max: 100
    };
  }

  private async getBaseUrl(ctx: TenantContext): Promise<string> {
    const ehrConfig = await this.configService.getTenantEHRConfig(ctx.tenantId);
    if (!ehrConfig?.base_url) {
      throw new Error(`Missing EPIC base_url for tenant: ${ctx.tenantId}`);
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

  /**
   * Authenticate using EPIC Backend Client Credentials (JWT assertion)
   * See: https://fhir.epic.com/Documentation?docId=oauth2&section=BackendOAuth2Guide
   */
  private async authenticateSystemApp(ctx: TenantContext): Promise<boolean> {
    this.logger.log(`Authenticating with EPIC system app for tenant: ${ctx.tenantId}`);

    let ehrConfig;
    try {
      ehrConfig = await this.configService.getTenantEHRSystemConfig(ctx.tenantId);
    } catch (error) {
      this.logger.warn('Config not loaded yet, skipping authentication');
      return false;
    }

    if (!ehrConfig?.client_id || !ehrConfig?.token_url || !ehrConfig?.scopes) {
      this.logger.error('Missing EPIC system app configuration');
      return false;
    }

    if (!ehrConfig.private_key_path || !ehrConfig.key_id) {
      this.logger.error('EPIC requires private_key_path and key_id for JWT authentication');
      return false;
    }

    try {
      // Create JWT assertion
      const jwtAssertion = await this.createJWTAssertion(ehrConfig);

      // Request access token using JWT assertion
      const response = await axios.post(
        ehrConfig.token_url,
        new URLSearchParams({
          grant_type: 'client_credentials',
          client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
          client_assertion: jwtAssertion,
          scope: ehrConfig.scopes,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      );

      this.accessToken = response.data.access_token;
      const expiresInSec: number = response.data.expires_in || 3600;
      const refreshBufferMs = 60 * 1000; // Refresh 1 minute before expiry
      this.accessTokenExpiryMs = Date.now() + Math.max(0, (expiresInSec * 1000) - refreshBufferMs);

      this.logger.log('EPIC system app authentication successful');
      return true;
    } catch (error) {
      this.logger.error('EPIC system app authentication failed', error);
      if (error.response?.data) {
        this.logger.error('EPIC error response:', error.response.data);
      }
      return false;
    }
  }

  /**
   * Create JWT assertion for EPIC authentication
   * EPIC requires RS384 algorithm and specific claims
   */
  private async createJWTAssertion(config: any): Promise<string> {
    try {
      // Load private key from file
      const privateKey = fs.readFileSync(config.private_key_path, 'utf8');

      // JWT claims required by EPIC
      const claims = {
        iss: config.client_id,  // Your app's client ID
        sub: config.client_id,  // Same as iss for backend apps
        aud: config.token_url,  // EPIC's token endpoint
        jti: this.generateJTI(), // Unique JWT ID (prevents replay attacks)
        exp: Math.floor(Date.now() / 1000) + 300, // 5 minutes from now
      };

      // Sign JWT with RS384 algorithm
      return jwt.sign(claims, privateKey, {
        algorithm: 'RS384',
        keyid: config.key_id, // Your public key ID registered with EPIC
      });
    } catch (error) {
      this.logger.error('Failed to create JWT assertion', error);
      throw new Error(`Failed to create JWT assertion: ${error.message}`);
    }
  }

  /**
   * Generate unique JWT ID (jti claim)
   */
  private generateJTI(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }

  private async authenticateProviderApp(ctx: TenantContext): Promise<boolean> {
    this.logger.log(`Authenticating with EPIC provider app for tenant: ${ctx.tenantId}, user: ${ctx.userId}`);

    if (!ctx.userId) {
      this.logger.error('User ID required for provider app authentication');
      return false;
    }

    // TODO: Integrate with session service for user OAuth2 flow
    this.logger.warn('EPIC provider app authentication not yet fully implemented');
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
      this.logger.log('Reusing existing EPIC access token');
      return true;
    }
    this.logger.log('EPIC access token expired or missing, fetching new token');
    return this.authenticate(ctx, authType);
  }

  /**
   * Get EPIC-specific headers
   * EPIC requires Epic-Client-ID header in addition to Authorization
   */
  private async getEPICHeaders(ctx: TenantContext): Promise<Record<string, string>> {
    const ehrConfig = await this.configService.getTenantEHRSystemConfig(ctx.tenantId);
    return {
      Authorization: `Bearer ${this.accessToken}`,
      'Epic-Client-ID': ehrConfig?.client_id || '',
    };
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
      ...(await this.getEPICHeaders(ctx)),
      'Content-Type': 'application/fhir+json',
      Accept: 'application/fhir+json',
    };

    try {
      const response = await axios.post(url, resource, { headers });
      this.logger.log(`Created ${resourceType} in EPIC successfully.`);
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to create ${resourceType} in EPIC`, error);
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
      ...(await this.getEPICHeaders(ctx)),
      Accept: 'application/fhir+json',
    };

    try {
      const response = await axios.get(url, { headers });
      this.logger.log(`Fetched ${resourceType}/${resourceId} from EPIC successfully.`);
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to fetch ${resourceType}/${resourceId} from EPIC`, error);
      if (error.response) {
        this.logger.error('Response:', error.response.data);
        return error.response.data;
      }
      return null;
    }
  }

  async updateResource(resourceType: string, resourceId: string, resource: any, ctx: TenantContext): Promise<any | null> {
    // Note: EPIC has limited update support
    this.logger.warn('EPIC has limited UPDATE support for most resource types');

    const ok = await this.ensureAccessToken(ctx);
    if (!ok) return null;

    const baseUrl = await this.getBaseUrl(ctx);
    const url = `${baseUrl}/${resourceType}/${resourceId}`;
    const headers = {
      ...(await this.getEPICHeaders(ctx)),
      'Content-Type': 'application/fhir+json',
      Accept: 'application/fhir+json',
    };

    try {
      const response = await axios.put(url, resource, { headers });
      this.logger.log(`Updated ${resourceType}/${resourceId} in EPIC successfully.`);
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to update ${resourceType}/${resourceId} in EPIC`, error);
      if (error.response) {
        this.logger.error('Response:', error.response.data);
        return error.response.data;
      }
      return null;
    }
  }

  async deleteResource(resourceType: string, resourceId: string, ctx: TenantContext): Promise<boolean> {
    // EPIC does not support DELETE for most resource types
    this.logger.warn('DELETE operations are not supported by EPIC for most resource types');
    return false;
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
      ...(await this.getEPICHeaders(ctx)),
      Accept: 'application/fhir+json',
    };

    // EPIC-specific: Add _count parameter if not specified (default is 10, max is 100)
    const searchParams = {
      ...query,
      _count: query._count || 100, // Use max count by default
    };

    try {
      const response = await axios.get(url, { headers, params: searchParams });
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to search ${resourceType} in EPIC`, error);
      if (error.response) {
        this.logger.error('Response:', error.response.data);
        return error.response.data;
      }
      return null;
    }
  }

  async searchDischargeSummaries(patientId: string, ctx: TenantContext): Promise<any | null> {
    this.logger.log(`Searching discharge summaries for patient ${patientId} in EPIC`);

    // Audit log the request
    this.auditService.logFhirRequest({
      action: 'search',
      resourceType: 'DocumentReference',
      resourceId: patientId,
      endpoint: '/ehr/discharge-summaries',
      method: 'GET',
      metadata: { loincCode: '18842-5', vendor: 'epic' },
    });

    // EPIC uses DocumentReference for discharge summaries
    const query = {
      patient: patientId,
      type: 'http://loinc.org|18842-5', // Discharge Summary LOINC code
      _count: 100, // EPIC max count
    };

    const result = await this.searchResource('DocumentReference', query, ctx);

    if (result && result.total > 0) {
      this.auditService.logDocumentProcessing(
        result.entry?.[0]?.resource?.id || 'unknown',
        patientId,
        'extracted',
        { totalFound: result.total, vendor: 'epic' },
      );
    }

    return result;
  }

  async fetchBinaryDocument(binaryId: string, ctx: TenantContext, acceptType: string = 'application/pdf'): Promise<BinaryDocument | null> {
    const ok = await this.ensureAccessToken(ctx);
    if (!ok) return null;

    const baseUrl = await this.getBaseUrl(ctx);
    const url = `${baseUrl}/Binary/${binaryId}`;
    const headers = {
      ...(await this.getEPICHeaders(ctx)),
      Accept: acceptType,
    };

    try {
      const response = await axios.get(url, {
        headers,
        responseType: 'arraybuffer', // For binary data
      });

      this.logger.log(`Fetched Binary/${binaryId} from EPIC successfully.`);

      const binaryData = response.data;

      return {
        id: binaryId,
        contentType: response.headers['content-type'] || acceptType,
        data: binaryData,
        size: binaryData.length,
      };
    } catch (error) {
      this.logger.error(`Failed to fetch Binary/${binaryId} from EPIC`);
      if (error.response) {
        this.logger.error(`HTTP ${error.response.status}: ${error.response.statusText}`);
        return error.response.data;
      }
      return null;
    }
  }

  parseDocumentReference(docRef: any): any {
    if (!docRef || docRef.resourceType !== 'DocumentReference') {
      return null;
    }

    // Same parsing logic as Cerner (FHIR standard)
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
   * Discover patients automatically from EPIC using hybrid approach:
   * 1. Search for recent Encounters (primary)
   * 2. Search for recent DocumentReferences (secondary)
   * 3. Include manual patient list from config (optional)
   * 
   * Lookback period: 1 hour (hardcoded)
   */
  async discoverPatients(ctx: TenantContext): Promise<string[]> {
    const patientIds = new Set<string>();
    const lookbackHours = 1; // Hardcoded to 1 hour
    const oneHourAgo = new Date(Date.now() - lookbackHours * 60 * 60 * 1000).toISOString();

    this.logger.log(`🔍 Discovering patients from EPIC for tenant: ${ctx.tenantId} (lookback: ${lookbackHours} hour)`);

    try {
      // Ensure authenticated
      if (!(await this.authenticate(ctx, AuthType.SYSTEM))) {
        this.logger.error('❌ Failed to authenticate with EPIC for patient discovery');
        // Fallback to manual list
        return await this.getManualPatientList(ctx);
      }

      // Step 1: Search for recent Encounters (primary method)
      this.logger.log('📋 Step 1: Searching for recent Encounters...');
      try {
        const encounters = await this.searchResource('Encounter', {
          status: 'finished',
          _lastUpdated: `ge${oneHourAgo}`,
          _count: 100,
          _sort: '-_lastUpdated',
        }, ctx, AuthType.SYSTEM);

        if (encounters?.entry) {
          for (const entry of encounters.entry) {
            const patientRef = entry.resource.subject?.reference;
            if (patientRef?.startsWith('Patient/')) {
              const patientId = patientRef.replace('Patient/', '');
              patientIds.add(patientId);
            }
          }
          this.logger.log(`   ✅ Found ${encounters.entry.length} encounters, extracted ${patientIds.size} unique patient IDs`);
        } else {
          this.logger.log('   ⚠️  No recent encounters found');
        }
      } catch (error) {
        this.logger.warn(`   ⚠️  Error searching for Encounters: ${error.message}`);
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
