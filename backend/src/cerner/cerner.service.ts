import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import axios from 'axios';
import * as qs from 'qs';
import { DevConfigService } from '../config/dev-config.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class CernerService implements OnModuleInit {
  private readonly logger = new Logger(CernerService.name);
  private accessToken: string | null = null;
  private accessTokenExpiryMs: number | null = null;

  constructor(
    private readonly configService: DevConfigService,
    private readonly auditService: AuditService
  ) {}

  private getBaseUrl(): string {
    const config = this.configService.get();
    if (!config.cerner?.base_url) {
      throw new Error('Missing Cerner base_url in config.yaml');
    }
    return config.cerner.base_url;
  }

  async onModuleInit() {
    await this.authenticate();
  }

  async authenticate(): Promise<boolean> {
    const config = this.configService.get();
    const cernerConfig = config.cerner;
    
    if (!cernerConfig?.client_id || !cernerConfig?.client_secret || !cernerConfig?.token_url || !cernerConfig?.scopes) {
      this.logger.error('Missing Cerner configuration in config.yaml');
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
      this.logger.log('Cerner authentication successful');
      return true;
    } catch (error) {
      this.logger.error('Cerner authentication failed', error);
      return false;
    }
  }

  private isTokenValid(): boolean {
    if (!this.accessToken) return false;
    if (!this.accessTokenExpiryMs) return true; // fall back: assume valid until proven otherwise
    return Date.now() < this.accessTokenExpiryMs;
  }

  private async ensureAccessToken(): Promise<boolean> {
    if (this.isTokenValid()) {
      this.logger.log('Reusing existing Cerner access token');
      return true;
    }
    this.logger.log('Cerner access token expired or missing, fetching new token');
    return this.authenticate();
  }

  async createDischargeSummary(patientId: string, encounterId: string, summaryData: any): Promise<any | null> {
    const ok = await this.ensureAccessToken();
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
      const response = await axios.post(
        `${this.getBaseUrl()}/DocumentReference`,
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
  async createResource(resourceType: string, resource: any): Promise<any | null> {
    const ok = await this.ensureAccessToken();
    if (!ok) {
      this.logger.error('Authentication failed. Cannot create resource.');
      return null;
    }
    
    const url = `${this.getBaseUrl()}/${resourceType}`;
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
  async fetchResource(resourceType: string, resourceId: string): Promise<any | null> {
    const ok = await this.ensureAccessToken();
    if (!ok) return null;
    const url = `${this.getBaseUrl()}/${resourceType}/${resourceId}`;
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
  async updateResource(resourceType: string, resourceId: string, resource: any): Promise<any | null> {
    const ok = await this.ensureAccessToken();
    if (!ok) return null;
    const url = `${this.getBaseUrl()}/${resourceType}/${resourceId}`;
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
  async deleteResource(resourceType: string, resourceId: string): Promise<boolean> {
    const ok = await this.ensureAccessToken();
    if (!ok) return false;
    const url = `${this.getBaseUrl()}/${resourceType}/${resourceId}`;
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
  async searchResource(resourceType: string, query: Record<string, any>): Promise<any | null> {
    const ok = await this.ensureAccessToken();
    if (!ok) return null;
    
    const url = `${this.getBaseUrl()}/${resourceType}`;
    const headers = {
      Authorization: `Bearer ${this.accessToken}`,
      Accept: 'application/fhir+json',
    };
    try {
      const response = await axios.get(url, { headers, params: query });
      this.logger.log(`Searched ${resourceType} successfully.`);
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
  async searchDischargeSummaries(patientId: string): Promise<any | null> {
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
      type: 'http://loinc.org|18842-5' // Discharge Summary LOINC code
    };
    
    let result = await this.searchResource('DocumentReference', docRefQuery);
    
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
        type: 'http://loinc.org|18842-5'
      };
      result = await this.searchResource('Composition', compQuery);
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
  async fetchBinaryDocument(binaryId: string, acceptType: string = 'application/pdf'): Promise<any | null> {
    const ok = await this.ensureAccessToken();
    if (!ok) return null;
    
    const url = `${this.getBaseUrl()}/Binary/${binaryId}`;
    const headers = {
      Authorization: `Bearer ${this.accessToken}`,
      Accept: acceptType,
    };
    
    try {
      const response = await axios.get(url, { headers });
      this.logger.log(`Fetched Binary/${binaryId} successfully.`);
      return {
        id: binaryId,
        contentType: response.headers['content-type'] || acceptType,
        data: response.data,
        size: response.data.length
      };
    } catch (error) {
      this.logger.error(`Failed to fetch Binary/${binaryId}`, error);
      if (error.response) {
        this.logger.error('Response:', error.response.data);
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
      type: docRef.type?.coding?.find((c: any) => c.system === 'http://loinc.org' && c.code === '18842-5'),
      patientId: docRef.subject?.reference?.replace('Patient/', ''),
      encounterId: docRef.context?.encounter?.[0]?.reference?.replace('Encounter/', ''),
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
