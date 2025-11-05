import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import axios from 'axios';
import * as qs from 'qs';
import { DevConfigService } from '../config/dev-config.service';
import { AuditService } from '../audit/audit.service';
import { TenantContext } from '../tenant/tenant-context';
import { AuthType } from '../cerner-auth/types/auth.types';

@Injectable()
export class CernerService implements OnModuleInit {
  private readonly logger = new Logger(CernerService.name);
  private accessToken: string | null = null;
  private accessTokenExpiryMs: number | null = null;

  constructor(
    private readonly configService: DevConfigService,
    private readonly auditService: AuditService
  ) {}

  private async getBaseUrl(ctx: TenantContext): Promise<string> {
    const cernerConfig = await this.configService.getTenantCernerConfig(ctx.tenantId);
    if (!cernerConfig?.base_url) {
      throw new Error(`Missing Cerner base_url for tenant: ${ctx.tenantId}`);
    }
    return cernerConfig.base_url;
  }

  async onModuleInit() {
    // Don't authenticate on module init - will authenticate when needed
    // This prevents issues when config is not loaded yet
    // await this.authenticate();
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
    this.logger.log(`Authenticating with system app for tenant: ${ctx.tenantId}`);

    let cernerConfig;
    try {
      cernerConfig = this.configService.getTenantCernerSystemConfig(ctx.tenantId);
    } catch (error) {
      this.logger.warn('Config not loaded yet, skipping authentication');
      return false;
    }
    
    if (!cernerConfig?.client_id || !cernerConfig?.client_secret || !cernerConfig?.token_url || !cernerConfig?.scopes) {
      this.logger.error('Missing Cerner system app configuration in config.yaml');
      return false;
    }

    const credentials = Buffer.from(`${cernerConfig.client_id}:${cernerConfig.client_secret}`).toString('base64');
    const headers = {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    };
    const data = qs.stringify({
      grant_type: 'client_credentials',
      scope: cernerConfig.scopes,
    });
    try {
      const response = await axios.post(cernerConfig.token_url, data, { headers });
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
    this.logger.log(`Authenticating with provider app for tenant: ${ctx.tenantId}, user: ${ctx.userId}`);

    // For provider app, we need to get the user's session token
    // This would typically be injected or retrieved from session service
    // For now, we'll assume the token is passed in the context or retrieved from session
    
    if (!ctx.userId) {
      this.logger.error('User ID required for provider app authentication');
      return false;
    }

    // TODO: Integrate with session service to get user's access token
    // For now, we'll return false to indicate provider app auth is not yet implemented
    this.logger.warn('Provider app authentication not yet fully implemented');
    return false;
  }

  private isTokenValid(): boolean {
    if (!this.accessToken) return false;
    if (!this.accessTokenExpiryMs) return true; // fall back: assume valid until proven otherwise
    return Date.now() < this.accessTokenExpiryMs;
  }

  private async ensureAccessToken(ctx: TenantContext, authType: AuthType = AuthType.SYSTEM): Promise<boolean> {
    if (this.isTokenValid()) {
      this.logger.log('Reusing existing Cerner access token');
      return true;
    }
    this.logger.log('Cerner access token expired or missing, fetching new token');
    return this.authenticate(ctx, authType);
  }

  async createDischargeSummary(patientId: string, encounterId: string, summaryData: any, ctx: TenantContext): Promise<any | null> {
    const ok = await this.ensureAccessToken(ctx);
    if (!ok) return null;
    const documentReference = {
      resourceType: 'DocumentReference',
      status: 'current',
      type: {
        coding: [{
          system: 'http://loinc.org',
          code: '18842-5',
          display: 'Discharge summary',
        }],
      },
      category: [{
        coding: [{
          system: 'http://hl7.org/fhir/us/core/CodeSystem/us-core-documentreference-category',
          code: 'clinical-note',
          display: 'Clinical Note',
        }],
      }],
      subject: {
        reference: `Patient/${patientId}`,
      },
      date: new Date().toISOString(),
      author: [{
        display: summaryData.author || 'System Generated',
      }],
      context: {
        encounter: [{
          reference: `Encounter/${encounterId}`,
        }],
        period: {
          start: summaryData.admission_date,
          end: summaryData.discharge_date || new Date().toISOString(),
        },
      },
      content: [{
        attachment: {
          contentType: 'text/plain',
          data: Buffer.from(this.formatDischargeSummary(summaryData)).toString('base64'),
        },
      }],
    };
    const headers = {
      Authorization: `Bearer ${this.accessToken}`,
      'Content-Type': 'application/fhir+json',
      Accept: 'application/fhir+json',
    };
    try {
      const baseUrl = await this.getBaseUrl(ctx);
      const response = await axios.post(
        `${baseUrl}/DocumentReference`,
        documentReference,
        { headers },
      );
      return response.data;
    } catch (error) {
      this.logger.error('Failed to create discharge summary', error);
      if (error.response) {
        this.logger.error('Response:', error.response.data);
      }
      return null;
    }
  }

  private formatDischargeSummary(data: any): string {
    return `DISCHARGE SUMMARY\nPatient Information:\n- Name: ${data.patient_name || 'N/A'}\n- MRN: ${data.mrn || 'N/A'}\n- DOB: ${data.dob || 'N/A'}\nAdmission Date: ${data.admission_date || 'N/A'}\nDischarge Date: ${data.discharge_date || new Date().toISOString()}\nChief Complaint:\n${data.chief_complaint || 'N/A'}\nHospital Course:\n${data.hospital_course || 'N/A'}\nDischarge Diagnosis:\n${data.discharge_diagnosis || 'N/A'}\nDischarge Medications:\n${data.discharge_medications || 'N/A'}\nFollow-up Instructions:\n${data.followup_instructions || 'N/A'}\nDischarge Condition: ${data.discharge_condition || 'Stable'}\nDischarge Disposition: ${data.discharge_disposition || 'Home'}\nPrepared by: ${data.author || 'System'}\nDate: ${new Date().toISOString()}`;
  }

  /**
   * Create a FHIR resource in Cerner
   */
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
        // Return the OperationOutcome from Cerner
        return error.response.data;
      }
      throw error;
    }
  }

  /**
   * Fetch a FHIR resource from Cerner by resource type and ID
   */
  async fetchResource(resourceType: string, resourceId: string, ctx: TenantContext): Promise<any | null> {
    const ok = await this.ensureAccessToken(ctx);
    if (!ok) return null;
    const baseUrl = await this.getBaseUrl(ctx);
    const url = `${baseUrl}/${resourceType}/${resourceId}`;
    const headers = {
      Authorization: `Bearer ${this.accessToken}`,
      'Accept': 'application/fhir+json',
    };
    try {
      const response = await axios.get(url, { headers });
      this.logger.log(`Fetched ${resourceType}/${resourceId} successfully.`);
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to fetch ${resourceType}/${resourceId}`, error);
      if (error.response) {
        this.logger.error('Response:', error.response.data);
        // Return the OperationOutcome from Cerner
        return error.response.data;
      }
      return null;
    }
  }

  /**
   * Update a FHIR resource in Cerner by resource type and ID
   */
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
        // Return the OperationOutcome from Cerner
        return error.response.data;
      }
      return null;
    }
  }

  /**
   * Delete a FHIR resource in Cerner by resource type and ID
   */
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
        // Return the OperationOutcome from Cerner
        return error.response.data;
      }
      return false;
    }
  }

  /**
   * Search FHIR resources in Cerner by resource type and query parameters
   */
  async searchResource(resourceType: string, query: Record<string, any>, ctx: TenantContext, authType: AuthType = AuthType.SYSTEM): Promise<any | null> {
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
      // console.log('response', response.data);
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to search ${resourceType}`, error);
      if (error.response) {
        this.logger.error('Response:', error.response.data);
        // Return the OperationOutcome from Cerner
        return error.response.data;
      }
      return null;
    }
  }

  /**
   * Search for discharge summaries by patient ID
   * First tries DocumentReference, then falls back to Composition
   */
  async searchDischargeSummaries(patientId: string, ctx: TenantContext): Promise<any | null> {
    this.logger.log(`Searching discharge summaries for patient ${patientId}`);
    
    // Audit log the request
    this.auditService.logFhirRequest({
      action: 'search',
      resourceType: 'DocumentReference',
      resourceId: patientId,
      endpoint: '/cerner/discharge-summaries',
      method: 'GET',
      metadata: { loincCode: '18842-5' }
    });
    
    // Try DocumentReference first
    const docRefQuery = {
      patient: patientId,
      // type: 'http://loinc.org|18842-5' // Discharge Summary LOINC code
    };
    console.log('docRefQuery', docRefQuery);
        let result = await this.searchResource('DocumentReference', docRefQuery, ctx);
    // console.log('result', result.total);
    // If no DocumentReference results, try Composition
    if (!result || (result.total === 0 && result.entry?.length === 0)) {
      this.logger.log('No DocumentReference found, trying Composition');
      
      // Audit log the fallback
      this.auditService.logFhirRequest({
        action: 'search',
        resourceType: 'Composition',
        resourceId: patientId,
        endpoint: '/cerner/discharge-summaries',
        method: 'GET',
        metadata: { loincCode: '18842-5', fallback: true }
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
        { totalFound: result.total }
      );
    }
    
    return result;
  }

  /**
   * Fetch Binary document content
   */
  async fetchBinaryDocument(binaryId: string, ctx: TenantContext, acceptType: string = 'application/octet-stream'): Promise<any | null> {
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
          data: null, // Mark as null to indicate invalid data
          size: 0,
          error: 'Invalid binary data - likely corrupted or test data'
        };
      }
      
      return {
        id: binaryId,
        contentType: response.headers['content-type'] || acceptType,
        data: binaryData,
        size: binaryData.length
      };
    } catch (error) {
      this.logger.error(`Failed to fetch Binary/${binaryId}`);
      if (error.response) {
        // Log concise error info without massive data dumps
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

  /**
   * Parse DocumentReference and extract key fields
   */
  parseDocumentReference(docRef: any): any {
    if (!docRef || docRef.resourceType !== 'DocumentReference') {
      return null;
    }

    const parsed = {
      id: docRef.id,
      status: docRef.status,
      type: docRef.type,
      // type: docRef.type?.coding?.find((c: any) => c.system === 'http://loinc.org' && c.code === '18842-5'),
      patientId: docRef.subject?.reference?.replace('Patient/', ''),
      // encounterId: docRef.context?.encounter?.[0]?.reference?.replace('Encounter/', ''),
      date: docRef.date,
      authors: docRef.author?.map((a: any) => a.display || a.reference),
      content: docRef.content?.map((c: any) => ({
        contentType: c.attachment?.contentType,
        url: c.attachment?.url,
        data: c.attachment?.data,
        title: c.attachment?.title,
        size: c.attachment?.size
      }))
    };

    return parsed;
  }
}
