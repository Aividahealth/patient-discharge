import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { Storage } from '@google-cloud/storage';
import { v4 as uuidv4 } from 'uuid';
import { GoogleService } from './google.service';
import { DevConfigService } from '../config/dev-config.service';
import { CernerService } from '../cerner/cerner.service';
import { TenantContext } from '../tenant/tenant-context';
import { resolveServiceAccountPath } from '../utils/path.helper';
import { logPipelineEvent } from '../utils/pipeline-logger';

interface SimplifiedContentRequest {
  dischargeSummary?: {
    content?: string;
    gcsPath?: string;
  };
  dischargeInstructions?: {
    content?: string;
    gcsPath?: string;
  };
}

@Injectable()
export class SimplifiedContentService {
  private readonly logger = new Logger(SimplifiedContentService.name);
  private storage: Storage | null = null;

  constructor(
    private readonly googleService: GoogleService,
    private readonly configService: DevConfigService,
    private readonly cernerService: CernerService,
  ) {}

  /**
   * Initialize storage client lazily
   */
  private getStorage(): Storage {
    if (!this.storage) {
      let serviceAccountPath: string | undefined;

      try {
        const config = this.configService.get();
        if (config.service_account_path) {
          // Resolve the path - handles both full paths and filenames
          serviceAccountPath = resolveServiceAccountPath(config.service_account_path);
        }
      } catch (error) {
        this.logger.log('Config not available, using Application Default Credentials');
      }

      this.storage = new Storage(
        serviceAccountPath ? { keyFilename: serviceAccountPath } : {},
      );

      this.logger.log('GCS Storage initialized');
    }
    return this.storage;
  }

  /**
   * Search for existing DocumentReference by gcsPath tag
   */
  private async findDocumentReferenceByGcsPath(
    gcsPath: string,
    documentType: 'discharge-summary' | 'discharge-instructions',
    ctx: TenantContext,
  ): Promise<any | null> {
    try {
      // Create the tag code that matches what we create
      const tagCode = `gcs-path-${Buffer.from(gcsPath).toString('base64url')}`;
      
      // Search by tag - we'll need to search for DocumentReferences with this tag
      // Since FHIR search by tag might not be direct, we'll search by type and then filter
      const typeCode = documentType === 'discharge-summary' ? '18842-5' : '74213-0';
      
      const query = {
        type: `http://loinc.org|${typeCode}`,
        _tag: tagCode,
        _count: 10,
      };

      this.logger.log(`🔍 Searching for existing DocumentReference with gcsPath tag: ${tagCode}`);
      const result = await this.googleService.fhirSearch('DocumentReference', query, ctx);
      
      if (result?.entry && result.entry.length > 0) {
        // Find the one with exact matching tag
        for (const entry of result.entry) {
          const docRef = entry.resource;
          if (docRef.meta?.tag) {
            const matchingTag = docRef.meta.tag.find(
              (tag: any) => tag.code === tagCode && 
                           tag.system === 'http://aivida.com/fhir/tags'
            );
            if (matchingTag) {
              this.logger.log(`✅ Found existing DocumentReference: ${docRef.id}`);
              return docRef;
            }
          }
        }
      }

      return null;
    } catch (error) {
      this.logger.error(`❌ Error searching for DocumentReference by gcsPath: ${error.message}`);
      // Don't throw - return null so we can create a new one
      return null;
    }
  }

  /**
   * Fetch content from GCS path
   */
  private async fetchContentFromGCS(gcsPath: string): Promise<string> {
    try {
      // Parse GCS path: gs://bucket-name/path/to/file.txt
      const match = gcsPath.match(/^gs:\/\/([^\/]+)\/(.+)$/);
      if (!match) {
        throw new Error(`Invalid GCS path format: ${gcsPath}`);
      }

      const bucketName = match[1];
      const fileName = match[2];

      this.logger.log(`📥 Fetching content from GCS: ${bucketName}/${fileName}`);

      const file = this.getStorage().bucket(bucketName).file(fileName);
      const [exists] = await file.exists();
      
      if (!exists) {
        throw new Error(`File not found in GCS: ${gcsPath}`);
      }

      const [content] = await file.download();
      return content.toString('utf8');
    } catch (error) {
      this.logger.error(`❌ Error fetching content from GCS ${gcsPath}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get tags for Binary resource based on document type and content type
   */
  private getBinaryTags(
    documentType: 'discharge-summary' | 'discharge-instructions',
    contentType: 'simplified' | 'translated',
  ): { code: string; display: string }[] {
    const baseTag = documentType === 'discharge-summary' 
      ? `discharge-summary-${contentType}` 
      : `discharge-instructions-${contentType}`;
    const displayTag = documentType === 'discharge-summary'
      ? `Discharge Summary ${contentType === 'simplified' ? 'Simplified' : 'Translated'}`
      : `Discharge Instructions ${contentType === 'simplified' ? 'Simplified' : 'Translated'}`;
    
    return [
      { code: baseTag, display: displayTag },
      { code: `${contentType}-content`, display: `${contentType === 'simplified' ? 'Simplified' : 'Translated'} Content` },
    ];
  }

  /**
   * Create Binary resource in Google FHIR
   */
  private async createBinaryResource(
    content: string,
    contentType: string,
    tags: { code: string; display: string }[],
    ctx: TenantContext,
  ): Promise<any> {
    try {
      // Base64 encode the content
      const base64Content = Buffer.from(content, 'utf8').toString('base64');

      const binaryResource = {
        resourceType: 'Binary',
        contentType: contentType,
        data: base64Content,
        meta: {
          tag: tags.map(tag => ({
            system: 'http://aivida.com/fhir/tags',
            code: tag.code,
            display: tag.display,
          })),
        },
      };

      this.logger.log(`📤 Creating Binary resource (${content.length} bytes, ${contentType})`);
      const result = await this.googleService.fhirCreate('Binary', binaryResource, ctx);
      this.logger.log(`✅ Created Binary resource: ${result.id}`);
      return result;
    } catch (error) {
      this.logger.error(`❌ Error creating Binary resource: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create DocumentReference resource in Google FHIR
   */
  private async createDocumentReference(
    binaryId: string,
    documentType: 'discharge-summary' | 'discharge-instructions',
    patientId: string,
    encounterId: string,
    gcsPath: string | undefined,
    contentType: 'simplified' | 'translated',
    ctx: TenantContext,
  ): Promise<any> {
    try {
      const typeCode = documentType === 'discharge-summary' ? '18842-5' : '74213-0';
      const typeDisplay = documentType === 'discharge-summary' ? 'Discharge summary' : 'Discharge instructions';
      const title = documentType === 'discharge-summary' ? 'Discharge Summary' : 'Discharge Instructions';

      const documentReference = {
        resourceType: 'DocumentReference',
        status: 'current',
        type: {
          coding: [
            {
              system: 'http://loinc.org',
              code: typeCode,
              display: typeDisplay,
            },
          ],
          text: title,
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
          reference: `Patient/${patientId}`,
        },
        date: new Date().toISOString(),
        author: [
          {
            display: 'Aivida Simplified Content System',
          },
        ],
        content: [
          {
            attachment: {
              contentType: 'text/plain',
              url: `Binary/${binaryId}`,
              title: title,
            },
          },
        ],
        context: {
          encounter: [
            {
              reference: `Encounter/${encounterId}`,
            },
          ],
        },
        meta: {
          tag: [
            {
              system: 'http://aivida.com/fhir/tags',
              code: `${contentType}-content`,
              display: `${contentType === 'simplified' ? 'Simplified' : 'Translated'} Content`,
            },
            ...(gcsPath ? [{
              system: 'http://aivida.com/fhir/tags',
              code: `gcs-path-${Buffer.from(gcsPath).toString('base64url')}`,
              display: gcsPath,
            }] : []),
          ],
        },
      };

      this.logger.log(`📤 Creating DocumentReference for ${documentType}`);
      const result = await this.googleService.fhirCreate('DocumentReference', documentReference, ctx);
      this.logger.log(`✅ Created DocumentReference: ${result.id}`);
      return result;
    } catch (error) {
      this.logger.error(`❌ Error creating DocumentReference: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update Composition with new DocumentReference and Binary entries
   */
  private async updateCompositionWithDocumentReferences(
    compositionId: string,
    documentReferenceIds: string[],
    binaryIds: string[],
    ctx: TenantContext,
  ): Promise<any> {
    try {
      // Get existing Composition
      const composition = await this.googleService.fhirRead('Composition', compositionId, ctx);

      if (!composition.section) {
        composition.section = [];
      }

      // Find or create DocumentReferences section
      let docRefSection = composition.section.find(
        (section: any) => section.title === 'Document References'
      );

      if (!docRefSection) {
        docRefSection = {
          title: 'Document References',
          code: {
            coding: [
              {
                system: 'http://loinc.org',
                code: '11488-4',
                display: 'Consult note',
              },
            ],
          },
          entry: [],
        };
        composition.section.push(docRefSection);
      }

      // Add new DocumentReference entries (avoid duplicates)
      const existingDocRefs = new Set(
        (docRefSection.entry || []).map((entry: any) => entry.reference)
      );

      for (const docRefId of documentReferenceIds) {
        const ref = `DocumentReference/${docRefId}`;
        if (!existingDocRefs.has(ref)) {
          docRefSection.entry.push({ reference: ref });
          existingDocRefs.add(ref);
        }
      }

      // Find or create Binaries section
      let binarySection = composition.section.find(
        (section: any) => section.title === 'Binaries'
      );

      if (!binarySection) {
        binarySection = {
          title: 'Binaries',
          code: {
            coding: [
              {
                system: 'http://loinc.org',
                code: '11488-4',
                display: 'Binary documents',
              },
            ],
          },
          entry: [],
        };
        composition.section.push(binarySection);
      }

      // Add new Binary entries (avoid duplicates)
      const existingBinaryRefs = new Set(
        (binarySection.entry || []).map((entry: any) => entry.reference)
      );

      for (const binaryId of binaryIds) {
        const ref = `Binary/${binaryId}`;
        if (!existingBinaryRefs.has(ref)) {
          binarySection.entry.push({ reference: ref });
          existingBinaryRefs.add(ref);
        }
      }

      // Update composition
      composition.date = new Date().toISOString();

      this.logger.log(`📤 Updating Composition with ${documentReferenceIds.length} DocumentReferences and ${binaryIds.length} Binaries`);
      const result = await this.googleService.fhirUpdate('Composition', compositionId, composition, ctx);
      this.logger.log(`✅ Updated Composition: ${result.id}`);
      return result;
    } catch (error) {
      this.logger.error(`❌ Error updating Composition: ${error.message}`);
      throw error;
    }
  }

  /**
   * Main method: Process content (simplified or translated) and add to Composition
   */
  async processContent(
    compositionId: string,
    content: SimplifiedContentRequest,
    contentType: 'simplified' | 'translated',
    ctx: TenantContext,
  ): Promise<{ success: boolean; fhirResourceId?: string; documentReferenceIds?: string[]; timestamp: string }> {
    const startTime = Date.now();
    try {
      this.logger.log(`🚀 Processing ${contentType} content for Composition: ${compositionId}`);

      // Step 1: Get Composition to extract Patient and Encounter references
      const composition = await this.googleService.fhirRead('Composition', compositionId, ctx);
      
      if (!composition) {
        throw new HttpException('Composition not found', HttpStatus.NOT_FOUND);
      }

      const patientRef = composition.subject?.reference;
      const encounterRef = composition.encounter?.reference;

      if (!patientRef || !encounterRef) {
        throw new HttpException('Composition missing Patient or Encounter reference', HttpStatus.BAD_REQUEST);
      }

      const patientId = patientRef.replace('Patient/', '');
      const encounterId = encounterRef.replace('Encounter/', '');

      this.logger.log(`📋 Composition references: Patient/${patientId}, Encounter/${encounterId}`);

      // Step 2: Process each content type
      const documentReferenceIds: string[] = [];
      const binaryIds: string[] = [];
      let shouldUpdateComposition = true;

      // Process Discharge Summary
      if (content.dischargeSummary) {
        let summaryContent = content.dischargeSummary.content;
        const summaryGcsPath = content.dischargeSummary.gcsPath;

        // Check for existing DocumentReference by gcsPath if provided
        let existingDocRef: any | null = null;
        if (summaryGcsPath) {
          existingDocRef = await this.findDocumentReferenceByGcsPath(
            summaryGcsPath,
            'discharge-summary',
            ctx,
          );
        }

        if (existingDocRef && existingDocRef.id) {
          // Update existing DocumentReference with new content
          // Fetch from GCS only if content is not provided but gcsPath is
          if (!summaryContent && summaryGcsPath) {
            summaryContent = await this.fetchContentFromGCS(summaryGcsPath);
          }

          if (summaryContent) {
            // Create new Binary resource with updated content
            const binary = await this.createBinaryResource(
              summaryContent,
              'text/plain',
              this.getBinaryTags('discharge-summary', contentType),
              ctx,
            );

            // Track Binary ID
            binaryIds.push(binary.id);

            // Update existing DocumentReference with new Binary reference
            existingDocRef.content = [
              {
                attachment: {
                  contentType: 'text/plain',
                  url: `Binary/${binary.id}`,
                  title: 'Discharge Summary',
                },
              },
            ];
            existingDocRef.date = new Date().toISOString();

            this.logger.log(`♻️ Updating existing DocumentReference: ${existingDocRef.id}`);
            const updatedDocRef = await this.googleService.fhirUpdate(
              'DocumentReference',
              existingDocRef.id,
              existingDocRef,
              ctx,
            );

            documentReferenceIds.push(updatedDocRef.id);
            shouldUpdateComposition = false; // Skip Composition update since it's already linked
          }
        } else {
          // Create new DocumentReference
          // Fetch from GCS only if content is not provided but gcsPath is
          if (!summaryContent && summaryGcsPath) {
            summaryContent = await this.fetchContentFromGCS(summaryGcsPath);
          }

          // Use content if available (either from body or fetched from GCS)
          if (summaryContent) {
            // Create Binary resource
            const binary = await this.createBinaryResource(
              summaryContent,
              'text/plain',
              this.getBinaryTags('discharge-summary', contentType),
              ctx,
            );

            // Track Binary ID
            binaryIds.push(binary.id);

            // Create DocumentReference with gcsPath tag if available
            const docRef = await this.createDocumentReference(
              binary.id,
              'discharge-summary',
              patientId,
              encounterId,
              summaryGcsPath,
              contentType,
              ctx,
            );

            documentReferenceIds.push(docRef.id);
          }
        }
      }

      // Process Discharge Instructions
      if (content.dischargeInstructions) {
        let instructionsContent = content.dischargeInstructions.content;
        const instructionsGcsPath = content.dischargeInstructions.gcsPath;

        // Check for existing DocumentReference by gcsPath if provided
        let existingDocRef: any | null = null;
        if (instructionsGcsPath) {
          existingDocRef = await this.findDocumentReferenceByGcsPath(
            instructionsGcsPath,
            'discharge-instructions',
            ctx,
          );
        }

        if (existingDocRef && existingDocRef.id) {
          // Update existing DocumentReference with new content
          // Fetch from GCS only if content is not provided but gcsPath is
          if (!instructionsContent && instructionsGcsPath) {
            instructionsContent = await this.fetchContentFromGCS(instructionsGcsPath);
          }

          if (instructionsContent) {
            // Create new Binary resource with updated content
            const binary = await this.createBinaryResource(
              instructionsContent,
              'text/plain',
              this.getBinaryTags('discharge-instructions', contentType),
              ctx,
            );

            // Track Binary ID
            binaryIds.push(binary.id);

            // Update existing DocumentReference with new Binary reference
            existingDocRef.content = [
              {
                attachment: {
                  contentType: 'text/plain',
                  url: `Binary/${binary.id}`,
                  title: 'Discharge Instructions',
                },
              },
            ];
            existingDocRef.date = new Date().toISOString();

            this.logger.log(`♻️ Updating existing DocumentReference: ${existingDocRef.id}`);
            const updatedDocRef = await this.googleService.fhirUpdate(
              'DocumentReference',
              existingDocRef.id,
              existingDocRef,
              ctx,
            );

            documentReferenceIds.push(updatedDocRef.id);
            shouldUpdateComposition = false; // Skip Composition update since it's already linked
          }
        } else {
          // Create new DocumentReference
          // Fetch from GCS only if content is not provided but gcsPath is
          if (!instructionsContent && instructionsGcsPath) {
            instructionsContent = await this.fetchContentFromGCS(instructionsGcsPath);
          }

          // Use content if available (either from body or fetched from GCS)
          if (instructionsContent) {
            // Create Binary resource
            const binary = await this.createBinaryResource(
              instructionsContent,
              'text/plain',
              this.getBinaryTags('discharge-instructions', contentType),
              ctx,
            );

            // Track Binary ID
            binaryIds.push(binary.id);

            // Create DocumentReference with gcsPath tag if available
            const docRef = await this.createDocumentReference(
              binary.id,
              'discharge-instructions',
              patientId,
              encounterId,
              instructionsGcsPath,
              contentType,
              ctx,
            );

            documentReferenceIds.push(docRef.id);
          }
        }
      }

      // Step 3: Update Composition with new DocumentReferences and Binaries (only if new ones were created)
      if ((documentReferenceIds.length > 0 || binaryIds.length > 0) && shouldUpdateComposition) {
        await this.updateCompositionWithDocumentReferences(compositionId, documentReferenceIds, binaryIds, ctx);
      } else if (!shouldUpdateComposition) {
        this.logger.log(`⏭️ Skipping Composition update - existing DocumentReferences were updated`);
        // Still update Composition with new Binary IDs even if DocumentReferences were updated
        if (binaryIds.length > 0) {
          await this.updateCompositionWithDocumentReferences(compositionId, [], binaryIds, ctx);
        }
      }

      const result = {
        success: true,
        fhirResourceId: documentReferenceIds.length > 0 ? `DocumentReference/${documentReferenceIds[0]}` : undefined,
        documentReferenceIds,
        timestamp: new Date().toISOString(),
      };
      // Log pipeline event for storing content in FHIR
      logPipelineEvent({
        tenantId: ctx.tenantId,
        compositionId,
        step: contentType === 'simplified' ? 'store_in_fhir' : 'store_translated_in_fhir',
        status: 'completed',
        durationMs: Date.now() - startTime,
        metadata: {
          patientId,
          encounterId,
          createdDocumentReferences: documentReferenceIds.length,
          createdBinaries: binaryIds.length,
        },
        error: null,
      });

      // Step 4: Write content back to Cerner EHR (if tenant is configured for Cerner)
      // This is done asynchronously after Google FHIR write succeeds
      // Errors in Cerner write-back are logged but don't fail the main operation
      await this.writeToCernerEHR(compositionId, content, contentType, ctx);

      return result;
    } catch (error) {
      this.logger.error(`❌ Error processing ${contentType} content: ${error.message}`);
      // Log failure event
      logPipelineEvent({
        tenantId: ctx.tenantId,
        compositionId,
        step: contentType === 'simplified' ? 'store_in_fhir' : 'store_translated_in_fhir',
        status: 'failed',
        durationMs: Date.now() - startTime,
        metadata: {},
        error: {
          message: error?.message || String(error),
          name: error?.name,
          stack: error?.stack,
        },
      });
      throw error;
    }
  }

  // =============================================================================
  // Cerner EHR Write-back Methods
  // =============================================================================

  /**
   * Check if tenant is configured for Cerner EHR integration
   */
  private async isCernerTenant(tenantId: string): Promise<boolean> {
    try {
      const ehrVendor = await this.configService.getTenantEHRVendor(tenantId);
      return ehrVendor === 'cerner';
    } catch (error) {
      this.logger.warn(`Could not determine EHR vendor for tenant ${tenantId}: ${error.message}`);
      return false;
    }
  }

  /**
   * Extract Cerner encounter ID from Composition's Encounter resource
   * The Encounter is tagged with 'original-cerner-id' when exported from Cerner
   */
  private async extractCernerEncounterId(compositionId: string, ctx: TenantContext): Promise<string | null> {
    try {
      // Step 1: Read Composition from Google FHIR
      this.logger.log(`📋 [CernerWriteback] Reading Composition ${compositionId} to extract encounter reference`);
      const composition = await this.googleService.fhirRead('Composition', compositionId, ctx);
      
      if (!composition || composition.resourceType !== 'Composition') {
        this.logger.warn(`[CernerWriteback] Composition ${compositionId} not found or invalid`);
        return null;
      }

      // Step 2: Extract encounter reference
      const encounterRef = composition.encounter?.reference;
      if (!encounterRef) {
        this.logger.warn(`[CernerWriteback] Composition ${compositionId} does not have an encounter reference`);
        return null;
      }

      // Step 3: Parse encounter ID from reference (remove "Encounter/" prefix)
      const encounterId = encounterRef.replace('Encounter/', '');
      if (!encounterId) {
        this.logger.warn(`[CernerWriteback] Invalid encounter reference format: ${encounterRef}`);
        return null;
      }

      // Step 4: Fetch Encounter from Google FHIR
      this.logger.log(`🏥 [CernerWriteback] Fetching Encounter ${encounterId} to check for Cerner encounter ID`);
      const encounter = await this.googleService.fhirRead('Encounter', encounterId, ctx);
      
      if (!encounter || encounter.resourceType !== 'Encounter') {
        this.logger.warn(`[CernerWriteback] Encounter ${encounterId} not found or invalid`);
        return null;
      }

      // Step 5: Check meta.tag for original-cerner-id
      const tags = encounter.meta?.tag || [];
      const cernerTag = tags.find((tag: any) => tag.system === 'original-cerner-id');
      
      if (cernerTag && cernerTag.code) {
        const cernerEncounterId = cernerTag.code;
        this.logger.log(`✅ [CernerWriteback] Found Cerner encounter ID: ${cernerEncounterId}`);
        return cernerEncounterId;
      }

      this.logger.log(`ℹ️ [CernerWriteback] Encounter ${encounterId} does not have original-cerner-id tag (not from Cerner)`);
      return null;
    } catch (error) {
      this.logger.error(`❌ [CernerWriteback] Error extracting Cerner encounter ID: ${error.message}`);
      return null;
    }
  }

  /**
   * Create DocumentReference in Cerner with simplified/translated content
   */
  private async createCernerDocumentReference(
    cernerEncounterId: string,
    content: string,
    contentType: 'simplified' | 'translated',
    documentType: 'discharge-summary' | 'discharge-instructions',
    ctx: TenantContext,
  ): Promise<{ success: boolean; documentReferenceId?: string }> {
    try {
      // Fetch Encounter from Cerner to get patient reference
      this.logger.log(`📋 [CernerWriteback] Fetching Encounter ${cernerEncounterId} from Cerner to extract patient reference`);
      const encounter = await this.cernerService.fetchResource('Encounter', cernerEncounterId, ctx);
      
      if (!encounter || encounter.resourceType !== 'Encounter') {
        this.logger.warn(`[CernerWriteback] Encounter ${cernerEncounterId} not found or invalid in Cerner`);
        return { success: false };
      }

      // Extract patient reference from encounter
      const patientRef = encounter.subject?.reference;
      if (!patientRef) {
        this.logger.warn(`[CernerWriteback] Encounter ${cernerEncounterId} does not have a patient reference`);
        return { success: false };
      }

      // Extract patient display name if available
      const patientDisplay = encounter.subject?.display || 
        (patientRef.includes('/') ? patientRef.split('/')[1] : patientRef);

      this.logger.log(`✅ [CernerWriteback] Found patient reference: ${patientRef} (display: ${patientDisplay})`);

      // Determine LOINC code and display text based on document type
      const isDischargeInstructions = documentType === 'discharge-instructions';
      const loincCode = isDischargeInstructions ? '74213-0' : '18842-5';
      const loincDisplay = isDischargeInstructions ? 'Discharge instructions' : 'Discharge summary';
      const title = `${isDischargeInstructions ? 'Discharge Instructions' : 'Discharge Summary'} (${contentType === 'simplified' ? 'Simplified' : 'Translated'})`;

      // Build DocumentReference payload
      const documentReference = {
        resourceType: 'DocumentReference',
        identifier: [
          {
            system: 'https://fhir.cerner.com/ceuuid',
            value: `CE${uuidv4().replace(/-/g, '')}`,
          },
        ],
        status: 'current',
        docStatus: 'final',
        type: {
          coding: [
            {
              system: 'http://loinc.org',
              code: loincCode,
              display: loincDisplay,
              userSelected: false,
            },
          ],
          text: title,
        },
        category: [
          {
            coding: [
              {
                system: 'http://hl7.org/fhir/us/core/CodeSystem/us-core-documentreference-category',
                code: 'clinical-note',
                display: 'Clinical Note',
                userSelected: false,
              },
            ],
            text: 'Clinical Note',
          },
          {
            coding: [
              {
                system: 'http://loinc.org',
                code: '11488-4',
                display: 'Consult note',
                userSelected: false,
              },
            ],
          },
        ],
        subject: {
          reference: patientRef,
          display: patientDisplay,
        },
        author: [
          {
            display: `Aivida Health - ${contentType === 'simplified' ? 'Simplification' : 'Translation'} Service`,
          },
        ],
        date: new Date().toISOString(),
        content: [
          {
            attachment: {
              contentType: 'text/plain; charset=UTF-8',
              title: title,
              creation: new Date().toISOString(),
              data: Buffer.from(content, 'utf8').toString('base64'),
            },
            format: {
              system: 'http://ihe.net/fhir/ValueSet/IHE.FormatCode.codesystem',
              code: 'urn:ihe:iti:xds:2017:mimeTypeSufficient',
              display: 'mimeType Sufficient',
            },
          },
        ],
        context: {
          encounter: [
            {
              reference: `Encounter/${cernerEncounterId}`,
            },
          ],
          period: {
            start: new Date().toISOString(),
            end: new Date().toISOString(),
          },
        },
      };

      this.logger.log(`📤 [CernerWriteback] Creating DocumentReference in Cerner for ${documentType} (${contentType})`);
      const result = await this.cernerService.createResource('DocumentReference', documentReference, ctx);
      
      // Extract ID from various possible response formats
      let documentReferenceId: string | undefined;
      
      if (result) {
        if (result.resourceType === 'DocumentReference' && result.id) {
          documentReferenceId = result.id;
        } else if (result.id) {
          documentReferenceId = String(result.id);
        } else if (typeof result === 'string' || typeof result === 'number') {
          documentReferenceId = String(result);
        }
      }
      
      if (documentReferenceId) {
        this.logger.log(`✅ [CernerWriteback] Successfully created DocumentReference in Cerner: ${documentReferenceId}`);
        return { success: true, documentReferenceId };
      } else {
        this.logger.warn(`⚠️ [CernerWriteback] DocumentReference creation returned unexpected result. Could not extract ID.`);
        return { success: false };
      }
    } catch (error) {
      this.logger.error(`❌ [CernerWriteback] Failed to create DocumentReference in Cerner: ${error.message}`);
      return { success: false };
    }
  }

  /**
   * Write simplified/translated content back to Cerner EHR
   * This is called after content is written to Google FHIR
   */
  private async writeToCernerEHR(
    compositionId: string,
    content: SimplifiedContentRequest,
    contentType: 'simplified' | 'translated',
    ctx: TenantContext,
  ): Promise<void> {
    try {
      // Check if tenant is configured for Cerner
      const isCerner = await this.isCernerTenant(ctx.tenantId);
      if (!isCerner) {
        this.logger.log(`ℹ️ [CernerWriteback] Tenant ${ctx.tenantId} is not configured for Cerner - skipping write-back`);
        return;
      }

      // Extract Cerner encounter ID
      const cernerEncounterId = await this.extractCernerEncounterId(compositionId, ctx);
      if (!cernerEncounterId) {
        this.logger.log(`ℹ️ [CernerWriteback] No Cerner encounter ID found for Composition ${compositionId} - skipping write-back`);
        return;
      }

      this.logger.log(`📤 [CernerWriteback] Writing ${contentType} content back to Cerner for encounter ${cernerEncounterId}`);

      // Write discharge summary if provided
      if (content.dischargeSummary) {
        let summaryContent = content.dischargeSummary.content;
        if (!summaryContent && content.dischargeSummary.gcsPath) {
          summaryContent = await this.fetchContentFromGCS(content.dischargeSummary.gcsPath);
        }
        
        if (summaryContent) {
          const result = await this.createCernerDocumentReference(
            cernerEncounterId,
            summaryContent,
            contentType,
            'discharge-summary',
            ctx,
          );
          
          if (result.success) {
            this.logger.log(`✅ [CernerWriteback] Discharge Summary written to Cerner: ${result.documentReferenceId}`);
          } else {
            this.logger.warn(`⚠️ [CernerWriteback] Failed to write Discharge Summary to Cerner`);
          }
        }
      }

      // Write discharge instructions if provided
      if (content.dischargeInstructions) {
        let instructionsContent = content.dischargeInstructions.content;
        if (!instructionsContent && content.dischargeInstructions.gcsPath) {
          instructionsContent = await this.fetchContentFromGCS(content.dischargeInstructions.gcsPath);
        }
        
        if (instructionsContent) {
          const result = await this.createCernerDocumentReference(
            cernerEncounterId,
            instructionsContent,
            contentType,
            'discharge-instructions',
            ctx,
          );
          
          if (result.success) {
            this.logger.log(`✅ [CernerWriteback] Discharge Instructions written to Cerner: ${result.documentReferenceId}`);
          } else {
            this.logger.warn(`⚠️ [CernerWriteback] Failed to write Discharge Instructions to Cerner`);
          }
        }
      }

      this.logger.log(`✅ [CernerWriteback] Completed writing ${contentType} content to Cerner`);
    } catch (error) {
      // Log error but don't fail the main operation - Cerner write-back is non-critical
      this.logger.error(`❌ [CernerWriteback] Error writing to Cerner (non-fatal): ${error.message}`);
    }
  }

  // =============================================================================
  // Wrapper Methods
  // =============================================================================

  /**
   * Wrapper method: Process simplified content
   */
  async processSimplifiedContent(
    compositionId: string,
    simplifiedContent: SimplifiedContentRequest,
    ctx: TenantContext,
  ): Promise<{ success: boolean; fhirResourceId?: string; documentReferenceIds?: string[]; timestamp: string }> {
    return this.processContent(compositionId, simplifiedContent, 'simplified', ctx);
  }

  /**
   * Wrapper method: Process translated content
   */
  async processTranslatedContent(
    compositionId: string,
    translatedContent: SimplifiedContentRequest,
    ctx: TenantContext,
  ): Promise<{ success: boolean; fhirResourceId?: string; documentReferenceIds?: string[]; timestamp: string }> {
    return this.processContent(compositionId, translatedContent, 'translated', ctx);
  }
}

