import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { GoogleService } from './google.service';
import { TenantContext } from '../tenant/tenant-context';

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
}

@Injectable()
export class DischargeUploadService {
  private readonly logger = new Logger(DischargeUploadService.name);

  constructor(
    private readonly googleService: GoogleService,
  ) {}

  /**
   * Search for or create a Patient resource
   */
  private async findOrCreatePatient(
    patientId: string,
    mrn: string,
    name: string,
    avatar: string | undefined,
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
        return existingPatient.id;
      }

      // Patient not found, create new one
      this.logger.log(`📝 Creating new Patient: ${patientId}`);
      const nameParts = name.split(' ');
      const family = nameParts[nameParts.length - 1] || '';
      const given = nameParts.slice(0, -1);

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
    try {
      this.logger.log(`📤 Uploading discharge summary for patient: ${request.id}`);

      // Step 1: Find or create Patient
      const patientId = await this.findOrCreatePatient(
        request.id,
        request.mrn,
        request.name,
        request.avatar,
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

      return {
        success: true,
        patientId: patientId,
        compositionId: compositionId,
        message: 'Discharge summary uploaded and processing started',
        processingStatus: 'queued',
      };
    } catch (error) {
      this.logger.error(`❌ Failed to upload discharge summary: ${error.message}`);
      throw error;
    }
  }
}

