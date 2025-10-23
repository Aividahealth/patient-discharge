import { Injectable, Logger } from '@nestjs/common';
import { CernerService } from '../../cerner/cerner.service';
import { GoogleService } from '../../google/google.service';
import { AuditService } from '../../audit/audit.service';
import { DevConfigService } from '../../config/dev-config.service';
import { TenantContext } from '../../tenant/tenant-context';
import { ExportResult } from '../types/discharge-export.types';

@Injectable()
export class DischargeExportService {
  private readonly logger = new Logger(DischargeExportService.name);

  constructor(
    private readonly cernerService: CernerService,
    private readonly googleService: GoogleService,
    private readonly auditService: AuditService,
    private readonly configService: DevConfigService,
  ) {}

  /**
   * Complete pipeline: Export discharge summary from Cerner to Google FHIR
   */
  async exportDischargeSummary(
    ctx: TenantContext,
    documentId?: string,
    encounterId?: string,
  ): Promise<ExportResult> {
    const exportTimestamp = new Date().toISOString();
    this.logger.log(`🚀 Starting discharge summary export for ${documentId ? ` (document: ${documentId})` : ''}`);

    let cernerPatientId: string | undefined;

    try {
      // Step 1: Find discharge summary metadata in Cerner
      this.logger.log(`📋 Step 1: Searching for discharge summary metadata in Cerner...`);
      const cernerDoc = await this.findCernerDischargeSummary(ctx, documentId);
      if (!cernerDoc) {
        this.logger.warn(`❌ No discharge summary found in Cerner for document ${documentId || 'unknown'}`);
        return {
          success: false,
          error: 'No discharge summary found in Cerner',
          metadata: { exportTimestamp },
        };
      }
      this.logger.log(`✅ Found Cerner document: ${cernerDoc.id} (encounter: ${cernerDoc.encounterId})`);

      // Extract patient ID from the document
      cernerPatientId = cernerDoc.patientId;
      if (!cernerPatientId) {
        this.logger.error(`❌ No patient ID found in Cerner document ${cernerDoc.id}`);
        return {
          success: false,
          error: 'No patient ID found in Cerner document',
          metadata: { exportTimestamp },
        };
      }
      this.logger.log(`✅ Extracted patient ID from document: ${cernerPatientId}`);

      // Step 2: Check for duplicate export
      this.logger.log(`🔍 Step 2: Checking for duplicate export...`);
      const duplicateCheck = await this.checkForDuplicateExport(cernerDoc.id, ctx);
      if (duplicateCheck.isDuplicate) {
        this.logger.log(`⚠️ Document ${cernerDoc.id} already exported to Google FHIR, skipping`);
        return {
          success: true,
          cernerDocumentId: cernerDoc.id,
          cernerPatientId,
          googlePatientId: duplicateCheck.googlePatientId,
          encounterId: cernerDoc.encounterId,
          metadata: {
            exportTimestamp,
            duplicateCheck: 'duplicate',
            patientMapping: 'found',
          },
        };
      }
      this.logger.log(`✅ No duplicate found, proceeding with export`);

      // Step 3: Map Cerner patient to Google FHIR patient
      this.logger.log(`👤 Step 3: Mapping Cerner patient to Google FHIR patient...`);
      const patientMapping = await this.mapCernerPatientToGoogle(cernerPatientId, ctx);
      if (!patientMapping.success) {
        this.logger.error(`❌ Failed to map patient: ${patientMapping.error}`);
        return {
          success: false,
          error: `Failed to map patient: ${patientMapping.error}`,
          metadata: { exportTimestamp, patientMapping: 'failed' },
        };
      }
      this.logger.log(`✅ Patient mapping successful: ${patientMapping.action} (Google patient: ${patientMapping.googlePatientId})`);

      // Step 4: Download PDF from Cerner Binary
      this.logger.log(`📥 Step 4: Downloading PDF from Cerner Binary...`);
      const pdfData = await this.downloadCernerPDF(cernerDoc, ctx);
      if (!pdfData) {
        this.logger.error(`❌ Failed to download PDF from Cerner`);
        return {
          success: false,
          error: 'Failed to download PDF from Cerner',
          metadata: { exportTimestamp, patientMapping: patientMapping.action },
        };
      }
      this.logger.log(`✅ PDF downloaded successfully (${pdfData.size} bytes, ${pdfData.contentType})`);

      // Step 5: Transform and prepare for Google FHIR
      this.logger.log(`🔄 Step 5: Transforming data for Google FHIR...`);
      const transformedData = this.transformForGoogleFHIR(cernerDoc, pdfData);
      this.logger.log(`✅ Data transformation completed`);

      // Step 6: Store PDF in Google FHIR Binary
      this.logger.log(`💾 Step 6: Storing PDF in Google FHIR Binary...`);
      const googleBinary = await this.storeInGoogleBinary(transformedData, ctx);
      if (!googleBinary) {
        this.logger.error(`❌ Failed to store PDF in Google FHIR Binary`);
        return {
          success: false,
          error: 'Failed to store PDF in Google FHIR Binary',
          metadata: { exportTimestamp, patientMapping: patientMapping.action },
        };
      }
      this.logger.log(`✅ PDF stored in Google FHIR Binary: ${googleBinary.id}`);

      // Step 7: Create DocumentReference in Google FHIR
      this.logger.log(`📄 Step 7: Creating DocumentReference in Google FHIR...`);
      const googleDocRef = await this.createGoogleDocumentReference(
        cernerDoc,
        googleBinary,
        patientMapping.googlePatientId!,
        ctx,
        encounterId,
      );
      if (!googleDocRef) {
        this.logger.error(`❌ Failed to create DocumentReference in Google FHIR`);
        return {
          success: false,
          error: 'Failed to create DocumentReference in Google FHIR',
          metadata: { exportTimestamp, patientMapping: patientMapping.action },
        };
      }
      this.logger.log(`✅ DocumentReference created: ${googleDocRef.id}`);

      // Step 8: Create Composition (optional structured summary)
      this.logger.log(`📝 Step 8: Creating Composition in Google FHIR...`);
      const googleComposition = await this.createGoogleComposition(
        cernerDoc,
        googleDocRef,
        patientMapping.googlePatientId!,
        ctx,
      );
      if (googleComposition) {
        this.logger.log(`✅ Composition created: ${googleComposition.id}`);
      } else {
        this.logger.warn(`⚠️ Composition creation failed (optional step)`);
      }

      const result: ExportResult = {
        success: true,
        cernerDocumentId: cernerDoc.id,
        googleBinaryId: googleBinary.id,
        googleDocumentReferenceId: googleDocRef.id,
        googleCompositionId: googleComposition?.id,
        cernerPatientId,
        googlePatientId: patientMapping.googlePatientId,
        encounterId: cernerDoc.encounterId,
        metadata: {
          originalSize: pdfData.size,
          contentType: pdfData.contentType,
          exportTimestamp,
          patientMapping: patientMapping.action,
          duplicateCheck: 'new',
        },
      };

      // Audit log the successful export
      this.auditService.logDocumentProcessing(
        cernerDoc.id,
        cernerPatientId,
        'stored',
        {
          googlePatientId: patientMapping.googlePatientId,
          googleBinaryId: googleBinary.id,
          googleDocumentReferenceId: googleDocRef.id,
          googleCompositionId: googleComposition?.id,
        },
      );

      this.logger.log(`🎉 Export completed successfully!`);
      this.logger.log(`📊 Export Summary:`);
      this.logger.log(`   • Cerner Patient: ${cernerPatientId} → Google Patient: ${patientMapping.googlePatientId}`);
      this.logger.log(`   • Cerner Document: ${cernerDoc.id} → Google DocumentReference: ${googleDocRef.id}`);
      this.logger.log(`   • Google Binary: ${googleBinary.id} (${pdfData.size} bytes)`);
      this.logger.log(`   • Google Composition: ${googleComposition?.id || 'N/A'}`);
      this.logger.log(`   • Patient Mapping: ${patientMapping.action}`);
      this.logger.log(`   • Export Time: ${exportTimestamp}`);
      
      return result;
    } catch (error) {
      this.logger.error(`💥 Export failed for patient ${cernerPatientId}: ${error.message}`);
      return {
        success: false,
        error: error.message,
        metadata: { exportTimestamp },
      };
    }
  }

  /**
   * Get binary resource from Google FHIR store given a DocumentReference ID or Composition ID
   */
  async getBinaryFromDocumentReference(
    ctx: TenantContext,
    documentReferenceId?: string,
    compositionId?: string,
  ): Promise<{
    success: boolean;
    binaryData?: any;
    documentReference?: any;
    composition?: any;
    error?: string;
  }> {
    this.logger.log(`🔍 Getting binary resource for ${documentReferenceId ? `DocumentReference: ${documentReferenceId}` : `Composition: ${compositionId}`}`);

    try {
      let binaryId: string | undefined;
      let documentReference: any = null;
      let composition: any = null;

      if (documentReferenceId) {
        // Step 1: Fetch DocumentReference from Google FHIR
        this.logger.log(`📄 Step 1: Fetching DocumentReference from Google FHIR...`);
        documentReference = await this.googleService.fhirRead('DocumentReference', documentReferenceId, ctx);
        
        if (!documentReference || documentReference.resourceType !== 'DocumentReference') {
          this.logger.error(`❌ DocumentReference ${documentReferenceId} not found or invalid`);
          return {
            success: false,
            error: 'DocumentReference not found or invalid',
          };
        }
        this.logger.log(`✅ Found DocumentReference: ${documentReference.id}`);

        // Step 2: Extract Binary resource reference from DocumentReference
        this.logger.log(`🔗 Step 2: Extracting Binary resource reference from DocumentReference...`);
        const content = documentReference.content;
        if (!content || !Array.isArray(content) || content.length === 0) {
          this.logger.error(`❌ No content found in DocumentReference ${documentReferenceId}`);
          return {
            success: false,
            error: 'No content found in DocumentReference',
            documentReference,
          };
        }

        const attachment = content[0]?.attachment;
        if (!attachment || !attachment.url) {
          this.logger.error(`❌ No attachment URL found in DocumentReference ${documentReferenceId}`);
          return {
            success: false,
            error: 'No attachment URL found in DocumentReference',
            documentReference,
          };
        }

        // Extract Binary ID from URL (format: "Binary/{binaryId}")
        const binaryUrl = attachment.url;
        binaryId = binaryUrl.replace('Binary/', '');
        
        if (!binaryId) {
          this.logger.error(`❌ Invalid Binary URL format: ${binaryUrl}`);
          return {
            success: false,
            error: 'Invalid Binary URL format',
            documentReference,
          };
        }
        this.logger.log(`✅ Extracted Binary ID from DocumentReference: ${binaryId}`);

      } else if (compositionId) {
        // Step 1: Fetch Composition from Google FHIR
        this.logger.log(`📝 Step 1: Fetching Composition from Google FHIR...`);
        composition = await this.googleService.fhirRead('Composition', compositionId, ctx);
        
        if (!composition || composition.resourceType !== 'Composition') {
          this.logger.error(`❌ Composition ${compositionId} not found or invalid`);
          return {
            success: false,
            error: 'Composition not found or invalid',
          };
        }
        this.logger.log(`✅ Found Composition: ${composition.id}`);

        // Step 2: Extract Binary resource reference from Composition
        this.logger.log(`🔗 Step 2: Extracting Binary resource reference from Composition...`);
        const section = composition.section;
        if (!section || !Array.isArray(section) || section.length === 0) {
          this.logger.error(`❌ No sections found in Composition ${compositionId}`);
          return {
            success: false,
            error: 'No sections found in Composition',
            composition,
          };
        }

        // Look for attachment in the first section
        const firstSection = section[0];
        const entry = firstSection?.entry;
        if (!entry || !Array.isArray(entry) || entry.length === 0) {
          this.logger.error(`❌ No entries found in Composition section ${compositionId}`);
          return {
            success: false,
            error: 'No entries found in Composition section',
            composition,
          };
        }

        // Get the first entry (should be DocumentReference)
        const entryRef = entry[0]?.reference;
        if (!entryRef || !entryRef.startsWith('DocumentReference/')) {
          this.logger.error(`❌ No DocumentReference found in Composition entry ${compositionId}`);
          return {
            success: false,
            error: 'No DocumentReference found in Composition entry',
            composition,
          };
        }

        // Extract DocumentReference ID and fetch it
        const docRefId = entryRef.replace('DocumentReference/', '');
        this.logger.log(`📄 Step 3: Fetching referenced DocumentReference: ${docRefId}`);
        documentReference = await this.googleService.fhirRead('DocumentReference', docRefId, ctx);
        
        if (!documentReference || documentReference.resourceType !== 'DocumentReference') {
          this.logger.error(`❌ Referenced DocumentReference ${docRefId} not found or invalid`);
          return {
            success: false,
            error: 'Referenced DocumentReference not found or invalid',
            composition,
          };
        }

        // Extract Binary ID from the referenced DocumentReference
        const content = documentReference.content;
        if (!content || !Array.isArray(content) || content.length === 0) {
          this.logger.error(`❌ No content found in referenced DocumentReference ${docRefId}`);
          return {
            success: false,
            error: 'No content found in referenced DocumentReference',
            composition,
            documentReference,
          };
        }

        const attachment = content[0]?.attachment;
        if (!attachment || !attachment.url) {
          this.logger.error(`❌ No attachment URL found in referenced DocumentReference ${docRefId}`);
          return {
            success: false,
            error: 'No attachment URL found in referenced DocumentReference',
            composition,
            documentReference,
          };
        }

        const binaryUrl = attachment.url;
        binaryId = binaryUrl.replace('Binary/', '');
        
        if (!binaryId) {
          this.logger.error(`❌ Invalid Binary URL format: ${binaryUrl}`);
          return {
            success: false,
            error: 'Invalid Binary URL format',
            composition,
            documentReference,
          };
        }
        this.logger.log(`✅ Extracted Binary ID from Composition: ${binaryId}`);
      }

      // Validate that we have a binaryId
      if (!binaryId) {
        this.logger.error(`❌ No Binary ID found`);
        return {
          success: false,
          error: 'No Binary ID found',
          documentReference,
          composition,
        };
      }

      // Step 3: Fetch Binary resource from Google FHIR
      this.logger.log(`📥 Step 3: Fetching Binary resource from Google FHIR...`);
      const binaryData = await this.googleService.fhirRead('Binary', binaryId, ctx);
      
      if (!binaryData || binaryData.resourceType !== 'Binary') {
        this.logger.error(`❌ Binary resource ${binaryId} not found or invalid`);
        return {
          success: false,
          error: 'Binary resource not found or invalid',
          documentReference,
          composition,
        };
      }
      this.logger.log(`✅ Successfully fetched Binary resource: ${binaryData.id}`);

      const result: any = {
        success: true,
        binaryData: {
          id: binaryData.id,
          contentType: binaryData.contentType,
          data: binaryData.data,
          size: binaryData.data?.length || 0,
          meta: binaryData.meta,
        },
      };

      if (documentReference) {
        result.documentReference = {
          id: documentReference.id,
          status: documentReference.status,
          type: documentReference.type,
          subject: documentReference.subject,
          date: documentReference.date,
          author: documentReference.author,
          content: documentReference.content,
        };
      }

      if (composition) {
        result.composition = {
          id: composition.id,
          status: composition.status,
          type: composition.type,
          subject: composition.subject,
          date: composition.date,
          author: composition.author,
          section: composition.section,
        };
      }

      return result;

    } catch (error) {
      this.logger.error(`💥 Failed to get binary from ${documentReferenceId ? `DocumentReference ${documentReferenceId}` : `Composition ${compositionId}`}: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Step 1: Find discharge summary metadata in Cerner
   */
  private async findCernerDischargeSummary(
    ctx: TenantContext,
    documentId?: string,
  ): Promise<any | null> {
    if (documentId) {
      // Fetch specific document
      this.logger.log(`Searching for specific document in Cerner: ${documentId}`);
      const doc = await this.cernerService.fetchResource('DocumentReference', documentId, ctx);
      if (doc && doc.resourceType === 'DocumentReference') {
        return this.cernerService.parseDocumentReference(doc);
      }
    } else {
      this.logger.error(`❌ No documentId provided - cannot search without patient ID`);
      return null;
    }

    return null;
  }

  /**
   * Step 2: Check for duplicate export by searching for existing DocumentReference
   */
  private async checkForDuplicateExport(cernerDocumentId: string, ctx: TenantContext): Promise<{
    isDuplicate: boolean;
    googlePatientId?: string;
  }> {
    this.logger.log(`🔍 Checking for duplicate export of Cerner document ${cernerDocumentId}`);

    try {
      // Search for DocumentReference with original Cerner ID tag
      this.logger.log(`   Searching Google FHIR for DocumentReference with meta-tag: original-cerner-id|${cernerDocumentId}`);
      const searchResult = await this.googleService.fhirSearch('DocumentReference', {
        '_tag': `original-cerner-id-${cernerDocumentId}`,
        _count: 1,
      }, ctx);

      if (searchResult && searchResult.total > 0 && searchResult.entry?.length > 0) {
        const existingDoc = searchResult.entry[0].resource;
        const patientRef = existingDoc.subject?.reference;
        const googlePatientId = patientRef?.replace('Patient/', '');
        
        this.logger.log(`   ✅ Found duplicate export: Google DocumentReference ${existingDoc.id} for patient ${googlePatientId}`);
        return {
          isDuplicate: true,
          googlePatientId,
        };
      }

      this.logger.log(`   ✅ No duplicate found - document ${cernerDocumentId} has not been exported yet`);
      return { isDuplicate: false };
    } catch (error) {
      this.logger.warn(`   ⚠️ Error checking for duplicate export: ${error.message}`);
      return { isDuplicate: false };
    }
  }

  /**
   * Step 3: Map Cerner patient to Google FHIR patient
   */
  private async mapCernerPatientToGoogle(cernerPatientId: string, ctx: TenantContext): Promise<{
    success: boolean;
    googlePatientId?: string;
    action: 'found' | 'created' | 'failed';
    error?: string;
  }> {
    this.logger.log(`👤 Mapping Cerner patient ${cernerPatientId} to Google FHIR`);

    try {
      // First, get Cerner patient details
      this.logger.log(`   📥 Fetching Cerner patient details...`);
      const cernerPatient = await this.cernerService.fetchResource('Patient', cernerPatientId, ctx);
      if (!cernerPatient || cernerPatient.resourceType !== 'Patient') {
        this.logger.error(`   ❌ Cerner patient ${cernerPatientId} not found`);
        return {
          success: false,
          action: 'failed',
          error: 'Cerner patient not found',
        };
      }
      this.logger.log(`   ✅ Cerner patient found: ${cernerPatient.name?.[0]?.family || 'Unknown'}, ${cernerPatient.name?.[0]?.given?.[0] || 'Unknown'}`);

      // Search for existing Google patient by Cerner identifier
      this.logger.log(`   🔍 Searching for existing Google patient by Cerner identifier...`);
      const existingGooglePatient = await this.findGooglePatientByCernerId(cernerPatientId, ctx);
      if (existingGooglePatient) {
        this.logger.log(`   ✅ Found existing Google patient ${existingGooglePatient.id} for Cerner patient ${cernerPatientId}`);
        return {
          success: true,
          googlePatientId: existingGooglePatient.id,
          action: 'found',
        };
      }

      // Create new Google patient
      this.logger.log(`   🆕 Creating new Google patient from Cerner data...`);
      const newGooglePatient = await this.createGooglePatientFromCerner(cernerPatient, cernerPatientId, ctx);
      if (newGooglePatient) {
        this.logger.log(`   ✅ Created new Google patient ${newGooglePatient.id} for Cerner patient ${cernerPatientId}`);
        return {
          success: true,
          googlePatientId: newGooglePatient.id,
          action: 'created',
        };
      }

      this.logger.error(`   ❌ Failed to create Google patient`);
      return {
        success: false,
        action: 'failed',
        error: 'Failed to create Google patient',
      };
    } catch (error) {
      this.logger.error(`Error mapping Cerner patient ${cernerPatientId} to Google: ${error.message}`);
      return {
        success: false,
        action: 'failed',
        error: error.message,
      };
    }
  }

  /**
   * Find Google patient by Cerner identifier
   */
  private async findGooglePatientByCernerId(cernerPatientId: string, ctx: TenantContext): Promise<any | null> {
    try {
      const searchResult = await this.googleService.fhirSearch('Patient', {
        identifier: `urn:oid:2.16.840.1.113883.3.787.0.0|${cernerPatientId}`,
        _count: 1,
      }, ctx);

      if (searchResult && searchResult.total > 0 && searchResult.entry?.length > 0) {
        return searchResult.entry[0].resource;
      }

      return null;
    } catch (error) {
      this.logger.warn(`Error searching for Google patient by Cerner ID: ${error.message}`);
      return null;
    }
  }

  /**
   * Clean null characters (U+0000) from all string fields in an object
   */
  private cleanNullCharacters(obj: any): any {
    if (obj === null || obj === undefined) {
      return obj;
    }
    
    if (typeof obj === 'string') {
      // Remove null characters and trim whitespace
      return obj.replace(/\0/g, '').trim();
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.cleanNullCharacters(item));
    }
    
    if (typeof obj === 'object') {
      const cleaned: any = {};
      for (const [key, value] of Object.entries(obj)) {
        cleaned[key] = this.cleanNullCharacters(value);
      }
      return cleaned;
    }
    
    return obj;
  }

  /**
   * Create Google patient from Cerner patient data
   */
  private async createGooglePatientFromCerner(cernerPatient: any, cernerPatientId: string, ctx: TenantContext): Promise<any | null> {
    try {
      this.logger.log(`   🆕 Creating Google patient from Cerner data...`);
      this.logger.log(`   📋 Cerner patient data:`, JSON.stringify(cernerPatient, null, 2));

      // Clean null characters from all string fields
      const cleanPatientData = this.cleanNullCharacters(cernerPatient);
      this.logger.log(`   🧹 Cleaned patient data:`, JSON.stringify(cleanPatientData, null, 2));
      
      // Validate and clean the patient data
      const cleanName = cleanPatientData.name?.filter((n: any) => n && (n.family || n.given)) || [];
      const cleanGender = cleanPatientData.gender && ['male', 'female', 'other', 'unknown'].includes(cleanPatientData.gender) 
        ? cleanPatientData.gender 
        : 'unknown';
      const cleanBirthDate = cleanPatientData.birthDate && /^\d{4}-\d{2}-\d{2}$/.test(cleanPatientData.birthDate) 
        ? cleanPatientData.birthDate 
        : undefined;

      const googlePatient = {
        resourceType: 'Patient',
        identifier: [
          {
            use: 'usual',
            type: {
              coding: [
                {
                  system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
                  code: 'MR',
                  display: 'Medical record number',
                },
              ],
            },
            system: 'urn:oid:2.16.840.1.113883.3.787.0.0',
            value: cernerPatientId,
          },
        ],
        active: cernerPatient.active !== false, // Default to true if not explicitly false
        ...(cleanName.length > 0 && { name: cleanName }),
        ...(cleanGender && { gender: cleanGender }),
        ...(cleanBirthDate && { birthDate: cleanBirthDate }),
        meta: {
          tag: [
            {
              system: 'http://aivida.com/fhir/tags',
              code: 'imported-from-cerner',
              display: 'Imported from Cerner',
            },
            {
              system: 'http://aivida.com/fhir/tags',
              code: `original-cerner-id-${cernerPatientId}`,
              display: `Original Cerner ID: ${cernerPatientId}`,
            },
          ],
        },
      };

      this.logger.log(`   🔍 Data validation:`);
      this.logger.log(`      • Names found: ${cleanName.length}`);
      this.logger.log(`      • Gender: ${cleanGender}`);
      this.logger.log(`      • Birth Date: ${cleanBirthDate || 'N/A'}`);
      this.logger.log(`      • Active: ${googlePatient.active}`);

      this.logger.log(`   📤 Google patient data to be created:`, JSON.stringify(googlePatient, null, 2));

      const result = await this.googleService.fhirCreate('Patient', googlePatient, ctx);
      return result;
    } catch (error) {
      this.logger.error(`   ❌ Error creating Google patient from Cerner data:`);
      this.logger.error(`   Error message: ${error.message}`);
      this.logger.error(`   Error response:`, error.response?.data);
      this.logger.error(`   Error status: ${error.response?.status}`);
      this.logger.error(`   Full error: ${error.message}`);
      return null;
    }
  }

  /**
   * Step 2: Download PDF from Cerner Binary
   */
  private async downloadCernerPDF(cernerDoc: any, ctx: TenantContext): Promise<any | null> {
    this.logger.log(`📥 Downloading PDF for document ${cernerDoc.id}`);

    const content = cernerDoc.content?.[0];
    if (!content) {
      this.logger.error(`   ❌ No content found in Cerner document ${cernerDoc.id}`);
      return null;
    }

    if (content.data) {
      // Inline base64 data
      this.logger.log(`   ✅ Found inline base64 data (${content.size || 0} bytes, ${content.contentType || 'application/pdf'})`);
      return {
        data: content.data,
        contentType: content.contentType || 'application/pdf',
        size: content.size || 0,
      };
    } else if (content.url) {
      // URL to Binary resource
      this.logger.log(`   🔗 Found Binary URL: ${content.url}`);
      const binaryId = content.url.split('/').pop();
      if (binaryId) {
        this.logger.log(`   📥 Fetching Binary resource: ${binaryId}`);
        const binary = await this.cernerService.fetchBinaryDocument(binaryId, ctx, 'application/pdf');
        if (binary && binary.data) {
          this.logger.log(`   ✅ Binary downloaded successfully (${binary.size || 0} bytes, ${binary.contentType || 'application/pdf'})`);
          return {
            data: binary.data,
            contentType: binary.contentType || 'application/pdf',
            size: binary.size || 0,
          };
        } else if (binary && binary.error) {
          this.logger.warn(`   ⚠️ Binary resource ${binaryId} has invalid data: ${binary.error}`);
          return null; // Skip this document
        } else {
          this.logger.error(`   ❌ Failed to download Binary resource ${binaryId}`);
        }
      } else {
        this.logger.error(`   ❌ Could not extract Binary ID from URL: ${content.url}`);
      }
    }

    this.logger.error(`   ❌ No PDF data found in Cerner document ${cernerDoc.id}`);
    return null;
  }

  /**
   * Step 3: Transform and prepare for Google FHIR
   */
  private transformForGoogleFHIR(cernerDoc: any, pdfData: any): any {
    this.logger.log(`🔄 Transforming document ${cernerDoc.id} for Google FHIR`);

    // Add identifiers and metadata
    const transformedData = {
      originalCernerId: cernerDoc.id,
      originalPatientId: cernerDoc.patientId,
      originalEncounterId: cernerDoc.encounterId,
      originalDate: cernerDoc.date,
      originalAuthors: cernerDoc.authors,
      pdfData: pdfData.data,
      contentType: pdfData.contentType,
      size: pdfData.size,
      exportTimestamp: new Date().toISOString(),
    };

    this.logger.log(`   ✅ Transformation completed:`);
    this.logger.log(`      • Original Cerner ID: ${cernerDoc.id}`);
    this.logger.log(`      • Patient ID: ${cernerDoc.patientId}`);
    this.logger.log(`      • Encounter ID: ${cernerDoc.encounterId || 'N/A'}`);
    this.logger.log(`      • PDF Size: ${pdfData.size} bytes`);
    this.logger.log(`      • Content Type: ${pdfData.contentType}`);
    this.logger.log(`      • Authors: ${cernerDoc.authors?.length || 0} found`);

    return transformedData;
  }

  /**
   * Step 4: Store PDF in Google FHIR Binary
   */
  private async storeInGoogleBinary(transformedData: any, ctx: TenantContext): Promise<any | null> {
    this.logger.log(`💾 Storing PDF in Google FHIR Binary (${transformedData.size} bytes, ${transformedData.contentType})`);

    const binaryResource = {
      resourceType: 'Binary',
      contentType: transformedData.contentType,
      data: transformedData.pdfData,
      meta: {
        tag: [
          {
            system: 'http://aivida.com/fhir/tags',
            code: 'discharge-summary',
            display: 'Discharge Summary',
          },
          {
            system: 'http://aivida.com/fhir/tags',
            code: 'exported-from-cerner',
            display: 'Exported from Cerner',
          },
        ],
      },
    };

    try {
      this.logger.log(`   📤 Creating Binary resource in Google FHIR...`);
      const result = await this.googleService.fhirCreate('Binary', binaryResource, ctx);
      this.logger.log(`   ✅ Successfully stored PDF in Google FHIR Binary: ${result.id}`);
      return result;
    } catch (error) {
      this.logger.error(`   ❌ Failed to store PDF in Google FHIR Binary: ${error.message}`);
      return null;
    }
  }

  /**
   * Step 7: Create DocumentReference in Google FHIR
   */
  private async createGoogleDocumentReference(
    cernerDoc: any,
    googleBinary: any,
    googlePatientId: string,
    ctx: TenantContext,
    encounterId?: string,
  ): Promise<any | null> {
    this.logger.log(`📄 Creating DocumentReference in Google FHIR for patient ${googlePatientId}`);

    const documentReference = {
      resourceType: 'DocumentReference',
      status: 'current',
      type: {
        coding: [
          {
            system: 'http://loinc.org',
            code: '18842-5',
            display: 'Discharge summary',
          },
        ],
      },
      category: [
        {
          coding: [
            {
              system: 'http://hl7.org/fhir/us/core/CodeSystem/us-core-documentreference-category',
              code: 'clinical-note',
              display: 'Clinical Note',
            },
          ],
        },
      ],
      subject: {
        reference: `Patient/${googlePatientId}`,
      },
      date: cernerDoc.date || new Date().toISOString(),
      author: cernerDoc.authors?.map((author: string) => ({
        display: author,
      })) || [{ display: 'System' }],
      content: [
        {
          attachment: {
            contentType: googleBinary.contentType,
            url: `Binary/${googleBinary.id}`,
            title: 'Discharge Summary',
            size: googleBinary.data?.length || 0,
          },
        },
      ],
      context: (encounterId)
        ? {
            encounter: [
              {
                reference: `Encounter/${encounterId}`,
              },
            ],
          }
        : undefined,
      meta: {
        tag: [
          {
            system: 'http://aivida.com/fhir/tags',
            code: 'exported-from-cerner',
            display: 'Exported from Cerner',
          },
          {
            system: 'http://aivida.com/fhir/tags',
            code: `original-cerner-id-${cernerDoc.id}`	,
            display: `Original Cerner ID: ${cernerDoc.id}`,
          },
        ],
      },
    };

    try {
      this.logger.log(`   📤 Creating DocumentReference resource in Google FHIR...`);
      this.logger.log(`      • Patient: Patient/${googlePatientId}`);
      this.logger.log(`      • Binary: Binary/${googleBinary.id}`);
      this.logger.log(`      • Encounter: ${cernerDoc.encounterId ? `Encounter/${cernerDoc.encounterId}` : 'N/A'}`);
      this.logger.log(`      • Authors: ${cernerDoc.authors?.length || 0} found`);
      
      const result = await this.googleService.fhirCreate('DocumentReference', documentReference, ctx);
      this.logger.log(`   ✅ Successfully created DocumentReference in Google FHIR: ${result.id}`);
      return result;
    } catch (error) {
      this.logger.error(`   ❌ Failed to create DocumentReference in Google FHIR: ${error.message}`);
      return null;
    }
  }

  /**
   * Step 8: Create Composition (optional structured summary)
   */
  private async createGoogleComposition(
    cernerDoc: any,
    googleDocRef: any,
    googlePatientId: string,
    ctx: TenantContext,
  ): Promise<any | null> {
    this.logger.log(`📝 Creating Composition in Google FHIR for patient ${googlePatientId}`);

    const composition = {
      resourceType: 'Composition',
      status: 'final',
      type: {
        coding: [
          {
            system: 'http://loinc.org',
            code: '18842-5',
            display: 'Discharge summary',
          },
        ],
      },
      category: [
        {
          coding: [
            {
              system: 'http://hl7.org/fhir/us/core/CodeSystem/us-core-documentreference-category',
              code: 'clinical-note',
              display: 'Clinical Note',
            },
          ],
        },
      ],
      subject: {
        reference: `Patient/${googlePatientId}`,
      },
      date: cernerDoc.date || new Date().toISOString(),
      author: cernerDoc.authors?.map((author: string) => ({
        display: author,
      })) || [{ display: 'System' }],
      title: 'Discharge Summary',
      section: [
        {
          title: 'Document Reference',
          code: {
            coding: [
              {
                system: 'http://loinc.org',
                code: '11488-4',
                display: 'Consult note',
              },
            ],
          },
          entry: [
            {
              reference: `DocumentReference/${googleDocRef.id}`,
            },
          ],
        },
      ],
      meta: {
        tag: [
          {
            system: 'http://aivida.com/fhir/tags',
            code: 'exported-from-cerner',
            display: 'Exported from Cerner',
          },
          {
            system: 'http://aivida.com/fhir/tags',
            code: `original-cerner-id-${cernerDoc.id}`,
            display: `Original Cerner ID: ${cernerDoc.id}`,
          },
        ],
      },
    };

    try {
      this.logger.log(`   📤 Creating Composition resource in Google FHIR...`);
      this.logger.log(`      • Patient: Patient/${googlePatientId}`);
      this.logger.log(`      • DocumentReference: DocumentReference/${googleDocRef.id}`);
      this.logger.log(`      • Title: Discharge Summary`);
      this.logger.log(`      • Authors: ${cernerDoc.authors?.length || 0} found`);
      
      const result = await this.googleService.fhirCreate('Composition', composition, ctx);
      this.logger.log(`   ✅ Successfully created Composition in Google FHIR: ${result.id}`);
      return result;
    } catch (error) {
      this.logger.error(`   ❌ Failed to create Composition in Google FHIR: ${error.message}`);
      return null;
    }
  }
}

