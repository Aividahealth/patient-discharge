import { Injectable, Logger, HttpException, HttpStatus, Inject } from '@nestjs/common';
import { GoogleService } from './google.service';
import { PubSubService, EncounterExportEvent } from '../pubsub/pubsub.service';
import { TenantContext } from '../tenant/tenant-context';
import { logPipelineEvent } from '../utils/pipeline-logger';
import { AuditService } from '../audit/audit.service';

interface UploadDischargeSummaryRequest {
  id: string; // patientId
  mrn: string;
  name: string;
  room: string;
  unit: string;
  dischargeDate: string;
  rawDischargeSummary: string;
  rawDischargeInstructions: string;
  status: string;
  attendingPhysician: {
    name: string;
    id: string;
  };
  avatar?: string;
  preferredLanguage?: string; // ISO 639-1 code e.g., es, vi, fr, hi, zh
}

@Injectable()
export class DischargeUploadService {
  private readonly logger = new Logger(DischargeUploadService.name);

  constructor(
    private readonly googleService: GoogleService,
    private readonly pubSubService: PubSubService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Search for or create a Patient resource
   */
  private async findOrCreatePatient(
    patientId: string,
    mrn: string,
    name: string,
    avatar: string | undefined,
    preferredLanguage: string | undefined,
    ctx: TenantContext,
  ): Promise<string> {
    try {
      // Search for patient by identifier (MRN)
      const searchResult = await this.googleService.fhirSearch(
        'Patient',
        {
          identifier: `MRN|${mrn}`,
        },
        ctx,
      );

      if (searchResult?.entry && searchResult.entry.length > 0) {
        const existingPatient = searchResult.entry[0].resource;
        this.logger.log(`✅ Found existing Patient: ${existingPatient.id}`);
        // If preferredLanguage provided and not set on patient, update communication
        if (preferredLanguage) {
          const hasPreferred =
            existingPatient.communication?.some(
              (c: any) =>
                c.preferred === true &&
                c.language?.coding?.some((cd: any) => cd.code === preferredLanguage),
            ) || false;
          if (!hasPreferred) {
            existingPatient.communication = [
              ...(existingPatient.communication || []),
              {
                language: {
                  coding: [
                    { system: 'urn:ietf:bcp:47', code: preferredLanguage },
                  ],
                },
                preferred: true,
              },
            ];
            await this.googleService.fhirUpdate('Patient', existingPatient.id, existingPatient, ctx);
            this.logger.log(`🗣️ Updated Patient ${existingPatient.id} communication preferred language: ${preferredLanguage}`);
          }
        }
        return existingPatient.id;
      }

      // Patient not found, create new one
      this.logger.log(`📝 Creating new Patient: ${patientId}`);
      const nameParts = name.split(' ');
      const family = nameParts[nameParts.length - 1] || '';
      const given = nameParts.slice(0, -1);

      // Default to Spanish if no preferred language provided (for manual EHR integration)
      const finalPreferredLanguage = preferredLanguage || 'es';

      const patient = {
        resourceType: 'Patient',
        id: patientId,
        identifier: [
          {
            use: 'usual',
            type: {
              coding: [
                {
                  system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
                  code: 'MR',
                  display: 'Medical Record Number',
                },
              ],
            },
            value: mrn,
          },
        ],
        name: [
          {
            use: 'official',
            family: family,
            given: given,
            text: name,
          },
        ],
        communication: [
          {
            language: {
              coding: [{ system: 'urn:ietf:bcp:47', code: finalPreferredLanguage }],
            },
            preferred: true,
          },
        ],
        ...(avatar ? {
          photo: [
            {
              url: avatar,
            },
          ],
        } : {}),
      };

      const result = await this.googleService.fhirCreate('Patient', patient, ctx);
      this.logger.log(`✅ Created Patient: ${result.id}`);
      return result.id;
    } catch (error) {
      this.logger.error(`❌ Error finding/creating Patient: ${error.message}`);
      throw new HttpException(
        {
          message: 'Failed to find or create patient',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Create an Encounter resource
   */
  private async createEncounter(
    patientId: string,
    dischargeDate: string,
    room: string,
    unit: string,
    attendingPhysician: { name: string; id: string },
    ctx: TenantContext,
  ): Promise<string> {
    try {
      const encounter = {
        resourceType: 'Encounter',
        status: 'in-progress',
        class: {
          system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
          code: 'IMP',
          display: 'inpatient encounter',
        },

        subject: {
          reference: `Patient/${patientId}`,
        },
        period: {
          end: dischargeDate,
        },
        location: [
          {
            location: {
              display: `${unit} - Room ${room}`,
            },
          },
        ],
        participant: [
          {
            individual: {
              display: `${ attendingPhysician ? attendingPhysician?.name : 'Unknown' } - ${attendingPhysician ? attendingPhysician?.id : 'Unknown'}`,
            },
          },
        ]
      };

      const result = await this.googleService.fhirCreate('Encounter', encounter, ctx);
      this.logger.log(`✅ Created Encounter: ${result.id}`);
      return result.id;
    } catch (error) {
      this.logger.error(`❌ Error creating Encounter: ${error.message}`);
      throw new HttpException(
        {
          message: 'Failed to create encounter',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Create a Binary resource
   */
  private async createBinary(
    content: string,
    tag: string,
    ctx: TenantContext,
  ): Promise<string> {
    try {
      const base64Content = Buffer.from(content, 'utf8').toString('base64');

      const binary = {
        resourceType: 'Binary',
        contentType: 'text/plain',
        data: base64Content,
        meta: {
          tag: [
            {
              system: 'http://aivida.com/fhir/tags',
              code: tag,
              display: tag === 'discharge-summary' ? 'Discharge Summary' : 'Discharge Instructions',
            },
          ],
        },
      };

      const result = await this.googleService.fhirCreate('Binary', binary, ctx);
      this.logger.log(`✅ Created Binary: ${result.id} with tag: ${tag}`);
      return result.id;
    } catch (error) {
      this.logger.error(`❌ Error creating Binary: ${error.message}`);
      throw new HttpException(
        {
          message: 'Failed to create binary resource',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Create a DocumentReference resource
   */
  private async createDocumentReference(
    binaryId: string,
    documentType: 'discharge-summary' | 'discharge-instructions',
    patientId: string,
    encounterId: string,
    ctx: TenantContext,
  ): Promise<string> {
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
            display: 'Patient Upload',
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
              code: documentType,
              display: title,
            },
          ],
        },
      };

      const result = await this.googleService.fhirCreate('DocumentReference', documentReference, ctx);
      this.logger.log(`✅ Created DocumentReference: ${result.id} for ${documentType}`);
      return result.id;
    } catch (error) {
      this.logger.error(`❌ Error creating DocumentReference: ${error.message}`);
      throw new HttpException(
        {
          message: 'Failed to create document reference',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Create a Composition resource linking all resources
   */
  private async createComposition(
    patientId: string,
    encounterId: string,
    dischargeSummaryDocRefId: string,
    dischargeInstructionsDocRefId: string,
    dischargeSummaryBinaryId: string,
    dischargeInstructionsBinaryId: string,
    ctx: TenantContext,
  ): Promise<string> {
    try {
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
        subject: {
          reference: `Patient/${patientId}`,
        },
        encounter: {
          reference: `Encounter/${encounterId}`,
        },
        date: new Date().toISOString(),
        author: [
          {
            display: 'Patient Upload',
          },
        ],
        title: 'Discharge Summary and Instructions',
        section: [
          {
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
            entry: [
              {
                reference: `DocumentReference/${dischargeSummaryDocRefId}`,
              },
              {
                reference: `DocumentReference/${dischargeInstructionsDocRefId}`,
              },
            ],
          },
          {
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
            entry: [
              {
                reference: `Binary/${dischargeSummaryBinaryId}`,
              },
              {
                reference: `Binary/${dischargeInstructionsBinaryId}`,
              },
            ],
          },
        ],
      };

      const result = await this.googleService.fhirCreate('Composition', composition, ctx);
      this.logger.log(`✅ Created Composition: ${result.id}`);
      return result.id;
    } catch (error) {
      this.logger.error(`❌ Error creating Composition: ${error.message}`);
      throw new HttpException(
        {
          message: 'Failed to create composition',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Upload discharge summary and instructions
   */
  async uploadDischargeSummary(
    request: UploadDischargeSummaryRequest,
    ctx: TenantContext,
  ): Promise<{
    success: boolean;
    patientId: string;
    compositionId: string;
    message: string;
    processingStatus: string;
  }> {
    const uploadStartTime = Date.now();
    try {
      this.logger.log(`📤 Uploading discharge summary for patient: ${request.id}`);

      // Step 1: Find or create Patient
      const patientId = await this.findOrCreatePatient(
        request.id,
        request.mrn,
        request.name,
        request.avatar,
        request.preferredLanguage,
        ctx,
      );

      // Step 2: Create Encounter
      const encounterId = await this.createEncounter(
        patientId,
        request.dischargeDate,
        request.room,
        request.unit,
        request.attendingPhysician,
        ctx,
      );

      // Step 3: Create Binary resources
      const dischargeSummaryBinaryId = await this.createBinary(
        request.rawDischargeSummary,
        'discharge-summary',
        ctx,
      );

      const dischargeInstructionsBinaryId = await this.createBinary(
        request.rawDischargeInstructions,
        'discharge-instructions',
        ctx,
      );

      // Step 4: Create DocumentReference resources
      const dischargeSummaryDocRefId = await this.createDocumentReference(
        dischargeSummaryBinaryId,
        'discharge-summary',
        patientId,
        encounterId,
        ctx,
      );

      const dischargeInstructionsDocRefId = await this.createDocumentReference(
        dischargeInstructionsBinaryId,
        'discharge-instructions',
        patientId,
        encounterId,
        ctx,
      );

      // Step 5: Create Composition linking everything
      const compositionId = await this.createComposition(
        patientId,
        encounterId,
        dischargeSummaryDocRefId,
        dischargeInstructionsDocRefId,
        dischargeSummaryBinaryId,
        dischargeInstructionsBinaryId,
        ctx,
      );

      this.logger.log(`✅ Successfully uploaded discharge summary. Composition ID: ${compositionId}`);
      // Log frontend_upload completion
      logPipelineEvent({
        tenantId: ctx.tenantId,
        compositionId,
        step: 'frontend_upload',
        status: 'completed',
        durationMs: Date.now() - uploadStartTime,
        metadata: {
          patientId,
          encounterId,
        },
        error: null,
      });

      // Publish Pub/Sub event
      try {
        const pubsubStartTime = Date.now();
        const event: EncounterExportEvent = {
          tenantId: ctx.tenantId,
          patientId: patientId,
          googleCompositionId: compositionId,
          cernerEncounterId: '', // Empty for patient uploads (no Cerner encounter)
          googleEncounterId: encounterId,
          exportTimestamp: new Date().toISOString(),
          status: 'success',
          // Include preferredLanguage to help downstream services
          // (simtran will also verify via FHIR Patient if needed)
          ...(request.preferredLanguage ? { preferredLanguage: request.preferredLanguage } : {}),
        };

        await this.pubSubService.publishEncounterExportEvent(event);
        this.logger.log(`📤 Published Pub/Sub event for composition: ${compositionId}`);
        // Log backend_publish_to_topic completion
        logPipelineEvent({
          tenantId: ctx.tenantId,
          compositionId,
          step: 'backend_publish_to_topic',
          status: 'completed',
          durationMs: Date.now() - pubsubStartTime,
          metadata: {
            patientId,
            encounterId,
          },
          error: null,
        });
      } catch (pubSubError) {
        // Log error but don't fail the upload
        this.logger.error(`❌ Failed to publish Pub/Sub event: ${pubSubError.message}`);
        // Log backend_publish_to_topic failure
        logPipelineEvent({
          tenantId: ctx.tenantId,
          compositionId,
          step: 'backend_publish_to_topic',
          status: 'failed',
          durationMs: Date.now() - uploadStartTime,
          metadata: {
            patientId,
          },
          error: {
            message: pubSubError?.message || String(pubSubError),
            name: pubSubError?.name,
            stack: pubSubError?.stack,
          },
        });
      }

      return {
        success: true,
        patientId: patientId,
        compositionId: compositionId,
        message: 'Discharge summary uploaded and processing started',
        processingStatus: 'queued',
      };
    } catch (error) {
      this.logger.error(`❌ Failed to upload discharge summary: ${error.message}`);
      // Best effort: if compositionId is available later, it won't be here.
      logPipelineEvent({
        tenantId: ctx.tenantId,
        compositionId: 'unknown',
        step: 'frontend_upload',
        status: 'failed',
        durationMs: Date.now() - uploadStartTime,
        metadata: {
          patientId: request.id,
        },
        error: {
          message: error?.message || String(error),
          name: error?.name,
          stack: error?.stack,
        },
      });
      throw error;
    }
  }

  /**
   * Get discharge queue - list of patients ready for discharge review
   */
  async getDischargeQueue(ctx: TenantContext): Promise<{
    patients: Array<{
      id: string;
      mrn: string;
      name: string;
      room: string;
      unit: string;
      dischargeDate: string;
      compositionId: string;
      status: string;
      attendingPhysician: {
        name: string;
        id: string;
      };
      avatar: string | null;
    }>;
    meta: {
      total: number;
      pending: number;
      review: number;
      approved: number;
    };
  }> {
    try {
      this.logger.log(`📋 Retrieving discharge queue for tenant: ${ctx.tenantId}`);

      // Search for Composition resources with discharge summary type
      const compositionsResult = await this.googleService.fhirSearch(
        'Composition',
        {
          type: 'http://loinc.org|18842-5',
          _count: 100,
        },
        ctx,
      );

      if (!compositionsResult?.entry || compositionsResult.entry.length === 0) {
        return {
          patients: [],
          meta: {
            total: 0,
            pending: 0,
            review: 0,
            approved: 0,
          },
        };
      }

      const patients: Array<{
        id: string;
        mrn: string;
        name: string;
        room: string;
        unit: string;
        dischargeDate: string;
        compositionId: string;
        status: string;
        attendingPhysician: {
          name: string;
          id: string;
        };
        avatar: string | null;
      }> = [];
      const statusCounts = { pending: 0, review: 0, approved: 0 };

      // Process each Composition
      for (const entry of compositionsResult.entry) {
        try {
          const composition = entry.resource;
          const compositionId = composition.id;

          // Extract Patient and Encounter references
          const patientRef = composition.subject?.reference; // Patient/patient-id
          const encounterRef = composition.encounter?.reference; // Encounter/encounter-id

          if (!patientRef || !encounterRef) {
            this.logger.warn(`Composition ${compositionId} missing Patient or Encounter reference`);
            continue;
          }

          const patientId = patientRef.replace('Patient/', '');
          const encounterId = encounterRef.replace('Encounter/', '');

          // Fetch Patient resource
          const patient = await this.googleService.fhirRead('Patient', patientId, ctx);
          const mrn = patient.identifier?.find(
            (id: any) => id.type?.coding?.[0]?.code === 'MR'
          )?.value || '';
          const name = patient.name?.[0]?.text || 
            `${patient.name?.[0]?.given?.join(' ') || ''} ${patient.name?.[0]?.family || ''}`.trim() || 'Unknown';
          const avatar = patient.photo?.[0]?.url || null;

          // Fetch Encounter resource
          const encounter = await this.googleService.fhirRead('Encounter', encounterId, ctx);
          
          // Extract room and unit from location.display format: "Cardiology Unit - Room 302"
          const locationDisplay = encounter.location?.[0]?.location?.display || '';
          let unit = '';
          let room = '';
          if (locationDisplay) {
            const parts = locationDisplay.split(' - Room ');
            unit = parts[0] || '';
            room = parts[1] || '';
          }

          const dischargeDate = encounter.period?.end || '';

          // Map Encounter status to discharge status
          // in-progress -> review, finished/completed -> approved
          let status = 'review'; // default
          const encounterStatus = encounter.status?.trim(); // Handle any whitespace
          if (encounterStatus === 'in-progress') {
            status = 'review';
          } else if (encounterStatus === 'finished' || encounterStatus === 'completed') {
            status = 'approved';
          } else if (encounterStatus === 'planned') {
            status = 'pending';
          }

          // Extract attending physician from Encounter.participant.individual.display
          // Format: "Dr. Sarah Johnson, MD - physician-uuid-1"
          let physicianName = 'Unknown';
          let physicianId = '';
          if (encounter.participant?.[0]?.individual?.display) {
            const physicianDisplay = encounter.participant[0].individual.display;
            const parts = physicianDisplay.split(' - ');
            physicianName = parts[0] || 'Unknown';
            physicianId = parts[1] || '';
          }

          // Only add to queue if not approved (approved discharges should not appear in queue)
          if (status !== 'approved') {
            patients.push({
              id: patientId,
              mrn,
              name,
              room,
              unit,
              dischargeDate,
              compositionId,
              status,
              attendingPhysician: {
                name: physicianName,
                id: physicianId,
              },
              avatar,
            });
          }

          // Count statuses (still count approved for meta, but don't include in queue)
          if (status === 'pending') statusCounts.pending++;
          else if (status === 'review') statusCounts.review++;
          else if (status === 'approved') statusCounts.approved++;

        } catch (error) {
          this.logger.error(`❌ Error processing Composition entry: ${error.message}`);
          // Continue with next entry
          continue;
        }
      }

      this.logger.log(`✅ Retrieved ${patients.length} patients from discharge queue`);

      return {
        patients,
        meta: {
          total: patients.length,
          ...statusCounts,
        },
      };
    } catch (error) {
      this.logger.error(`❌ Error retrieving discharge queue: ${error.message}`);
      throw new HttpException(
        {
          message: 'Failed to retrieve discharge queue',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Mark discharge as completed by updating Encounter status
   */
  async markDischargeCompleted(
    compositionId: string,
    ctx: TenantContext,
  ): Promise<{
    success: boolean;
    message: string;
    compositionId: string;
    encounterId: string;
  }> {
    try {
      this.logger.log(`📝 Marking discharge as completed for Composition: ${compositionId}`);

      // Step 1: Get Composition to extract Encounter reference
      const composition = await this.googleService.fhirRead('Composition', compositionId, ctx);

      if (!composition) {
        throw new HttpException(
          {
            message: 'Composition not found',
            error: `Composition ${compositionId} does not exist`,
            compositionId,
          },
          HttpStatus.NOT_FOUND,
        );
      }

      const encounterRef = composition.encounter?.reference;

      if (!encounterRef) {
        throw new HttpException(
          {
            message: 'Encounter reference not found',
            error: 'Composition does not have an Encounter reference',
            compositionId,
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      const encounterId = encounterRef.replace('Encounter/', '');

      // Step 2: Get current Encounter
      const encounter = await this.googleService.fhirRead('Encounter', encounterId, ctx);

      if (!encounter) {
        throw new HttpException(
          {
            message: 'Encounter not found',
            error: `Encounter ${encounterId} does not exist`,
            encounterId,
          },
          HttpStatus.NOT_FOUND,
        );
      }

      // Step 3: Update Encounter status to "finished"
      encounter.status = 'finished';

      try {
        const updatedEncounter = await this.googleService.fhirUpdate(
          'Encounter',
          encounterId,
          encounter,
          ctx,
        );

        this.logger.log(`✅ Successfully marked discharge as completed. Encounter ID: ${encounterId}`);

        return {
          success: true,
          message: 'Discharge marked as completed',
          compositionId,
          encounterId,
        };
      } catch (updateError: any) {
        this.logger.error(`❌ Failed to update Encounter: ${updateError.message}`);
        this.logger.error(`Update error details:`, {
          status: updateError.response?.status,
          statusText: updateError.response?.statusText,
          data: updateError.response?.data,
        });

        // Check if it's a specific HTTP error
        if (updateError.response?.status === 404) {
          throw new HttpException(
            {
              message: 'Encounter not found',
              error: `Encounter ${encounterId} does not exist or was deleted`,
              encounterId,
            },
            HttpStatus.NOT_FOUND,
          );
        } else if (updateError.response?.status === 400) {
          throw new HttpException(
            {
              message: 'Invalid Encounter update request',
              error: updateError.response?.data?.message || updateError.message,
              encounterId,
            },
            HttpStatus.BAD_REQUEST,
          );
        } else if (updateError.response?.status === 403) {
          throw new HttpException(
            {
              message: 'Permission denied',
              error: 'Insufficient permissions to update Encounter',
              encounterId,
            },
            HttpStatus.FORBIDDEN,
          );
        }

        // Generic error
        throw new HttpException(
          {
            message: 'Failed to update Encounter',
            error: updateError.response?.data?.message || updateError.message,
            encounterId,
            status: updateError.response?.status,
          },
          updateError.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    } catch (error) {
      this.logger.error(`❌ Failed to mark discharge as completed: ${error.message}`);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        {
          message: 'Failed to mark discharge as completed',
          error: error.message,
          compositionId,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Add additional clarifications to discharge instructions
   */
  async addClarificationsToInstructions(
    compositionId: string,
    clarifications: string,
    ctx: TenantContext,
  ): Promise<{ success: boolean; binaryId?: string }> {
    try {
      this.logger.log(`📝 Adding clarifications to discharge instructions for Composition: ${compositionId}`);

      // Step 1: Get Composition to find Binary references
      const composition = await this.googleService.fhirRead('Composition', compositionId, ctx);
      if (!composition || !composition.section) {
        throw new HttpException(
          {
            message: 'Composition not found or has no sections',
            compositionId,
          },
          HttpStatus.NOT_FOUND,
        );
      }

      // Step 2: Find discharge instructions Binary
      let instructionsBinaryId: string | null = null;
      for (const section of composition.section) {
        if (section.entry) {
          for (const entry of section.entry) {
            if (entry.reference?.startsWith('Binary/')) {
              const binaryId = entry.reference.replace('Binary/', '');
              const binary = await this.googleService.fhirRead('Binary', binaryId, ctx);
              
              // Check if this is a discharge-instructions binary
              if (binary?.meta?.tag) {
                for (const tag of binary.meta.tag) {
                  if (tag.system === 'http://aivida.com/fhir/tags' && 
                      (tag.code === 'discharge-instructions' || tag.code.startsWith('discharge-instructions-'))) {
                    instructionsBinaryId = binaryId;
                    break;
                  }
                }
              }
              if (instructionsBinaryId) break;
            }
          }
        }
        if (instructionsBinaryId) break;
      }

      if (!instructionsBinaryId) {
        // Try to find simplified instructions
        for (const section of composition.section) {
          if (section.entry) {
            for (const entry of section.entry) {
              if (entry.reference?.startsWith('Binary/')) {
                const binaryId = entry.reference.replace('Binary/', '');
                const binary = await this.googleService.fhirRead('Binary', binaryId, ctx);
                
                if (binary?.meta?.tag) {
                  for (const tag of binary.meta.tag) {
                    if (tag.system === 'http://aivida.com/fhir/tags' && 
                        (tag.code === 'discharge-instructions-simplified' || tag.code === 'discharge-instructions-translated')) {
                      instructionsBinaryId = binaryId;
                      break;
                    }
                  }
                }
                if (instructionsBinaryId) break;
              }
            }
          }
          if (instructionsBinaryId) break;
        }
      }

      if (!instructionsBinaryId) {
        this.logger.warn(`⚠️ No discharge instructions Binary found for Composition: ${compositionId}`);
        return { success: false };
      }

      // Step 3: Get current instructions content
      const currentBinary = await this.googleService.fhirRead('Binary', instructionsBinaryId, ctx);
      if (!currentBinary || !currentBinary.data) {
        throw new HttpException(
          {
            message: 'Binary resource not found or has no data',
            binaryId: instructionsBinaryId,
          },
          HttpStatus.NOT_FOUND,
        );
      }

      // Decode current content
      const currentContent = Buffer.from(currentBinary.data, 'base64').toString('utf8');

      // Step 4: Append clarifications section
      const clarificationsSection = `\n\n## Additional Clarifications\n\n${clarifications.trim()}\n`;
      const updatedContent = currentContent + clarificationsSection;

      // Step 5: Create new Binary with updated content
      const newBinary = {
        resourceType: 'Binary',
        contentType: 'text/plain',
        data: Buffer.from(updatedContent, 'utf8').toString('base64'),
        meta: currentBinary.meta || {
          tag: [],
        },
      };

      // Preserve tags
      if (!newBinary.meta.tag) {
        newBinary.meta.tag = [];
      }

      const result = await this.googleService.fhirCreate('Binary', newBinary, ctx);
      this.logger.log(`✅ Created new Binary with clarifications: ${result.id}`);

      // Step 6: Update DocumentReference to point to new Binary
      // Find DocumentReference that references the old Binary
      const docRefQuery = {
        'content.attachment.url': `Binary/${instructionsBinaryId}`,
      };
      const docRefResult = await this.googleService.fhirSearch('DocumentReference', docRefQuery, ctx);
      
      if (docRefResult?.entry && docRefResult.entry.length > 0) {
        const docRef = docRefResult.entry[0].resource;
        docRef.content = [
          {
            attachment: {
              contentType: 'text/plain',
              url: `Binary/${result.id}`,
              title: docRef.content?.[0]?.attachment?.title || 'Discharge Instructions',
            },
          },
        ];
        docRef.date = new Date().toISOString();
        
        await this.googleService.fhirUpdate('DocumentReference', docRef.id, docRef, ctx);
        this.logger.log(`✅ Updated DocumentReference: ${docRef.id}`);
      }

      return {
        success: true,
        binaryId: result.id,
      };
    } catch (error) {
      this.logger.error(`❌ Failed to add clarifications: ${error.message}`);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        {
          message: 'Failed to add clarifications to discharge instructions',
          error: error.message,
          compositionId,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}

