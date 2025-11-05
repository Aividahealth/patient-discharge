import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { Storage } from '@google-cloud/storage';
import { GoogleService } from './google.service';
import { DevConfigService } from '../config/dev-config.service';
import { TenantContext } from '../tenant/tenant-context';

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
  ) {}

  /**
   * Initialize storage client lazily
   */
  private getStorage(): Storage {
    if (!this.storage) {
      let serviceAccountPath: string | undefined;

      try {
        const config = this.configService.get();
        serviceAccountPath = config.service_account_path;
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

      return {
        success: true,
        fhirResourceId: documentReferenceIds.length > 0 ? `DocumentReference/${documentReferenceIds[0]}` : undefined,
        documentReferenceIds,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`❌ Error processing ${contentType} content: ${error.message}`);
      throw error;
    }
  }

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

