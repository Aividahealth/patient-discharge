import { Injectable, Logger } from '@nestjs/common';
import { CernerService } from '../../cerner/cerner.service';
import { GoogleService } from '../../google/google.service';
import { AuditService } from '../../audit/audit.service';
import { DevConfigService } from '../../config/dev-config.service';
import { TenantContext } from '../../tenant/tenant-context';
import { AuthType } from '../../cerner-auth/types/auth.types';
import { EncounterExportEvent, PubSubService } from '../../pubsub/pubsub.service';
import { DischargeExportService } from './discharge-export.service';

export interface EncounterExportResult {
  success: boolean;
  cernerEncounterId?: string;
  googleEncounterId?: string;
  cernerPatientId?: string;
  googlePatientId?: string;
  documentReferenceIds?: string[];
  medicationRequestIds?: string[];
  appointmentIds?: string[];
  conditionIds?: string[];
  binaryIds?: string[];
  compositionId?: string;
  error?: string;
  metadata?: {
    exportTimestamp: string;
    patientMapping: string;
    duplicateCheck: string;
    resourcesProcessed: number;
  };
}

export interface EncounterBundle {
  encounter: any;
  documentReferences: any[];
  medicationRequests: any[];
  appointments: any[];
  conditions: any[];
  binaries: any[];
}

@Injectable()
export class DischargeSummariesExportService {
  private readonly logger = new Logger(DischargeSummariesExportService.name);

  constructor(
    private readonly cernerService: CernerService,
    private readonly googleService: GoogleService,
    private readonly auditService: AuditService,
    private readonly configService: DevConfigService,
    private readonly pubSubService: PubSubService,
    private readonly dischargeExportService: DischargeExportService,
  ) {}

  /**
   * Main function: Export complete encounter data from Cerner to Google FHIR
   */
  async exportEncounterData(
    ctx: TenantContext,
    patientId: string,
  ): Promise<EncounterExportResult> {
    const exportTimestamp = new Date().toISOString();
    this.logger.log(`🚀 Starting encounter data export for patient: ${patientId}`);

    try {
      // Step 1: Get Cerner patient and map to Google FHIR
      this.logger.log(`👤 Step 1: Getting Cerner patient and mapping to Google FHIR...`);
      const patientMapping = await this.dischargeExportService['mapCernerPatientToGoogle'](patientId, ctx);
      if (!patientMapping.success) {
        return {
          success: false,
          error: `Failed to map patient: ${patientMapping.error}`,
          metadata: { exportTimestamp, patientMapping: 'failed', duplicateCheck: 'skipped', resourcesProcessed: 0 },
        };
      }
      this.logger.log(`✅ Patient mapping successful: ${patientMapping.action} (Google patient: ${patientMapping.googlePatientId})`);

      // Step 2: Get recent encounters from Cerner
      this.logger.log(`🏥 Step 2: Getting recent encounters from Cerner...`);
      const encounters = await this.getRecentEncounters(patientId, ctx);
      if (!encounters || encounters.length === 0) {
        this.logger.warn(`⚠️ No recent encounters found for patient ${patientId}`);
        return {
          success: true,
          cernerPatientId: patientId,
          googlePatientId: patientMapping.googlePatientId,
          metadata: { exportTimestamp, patientMapping: patientMapping.action, duplicateCheck: 'no-encounters', resourcesProcessed: 0 },
        };
      }

      let totalResourcesProcessed = 0;
      const results: EncounterExportResult[] = [];

      // Step 3: Process each encounter
      for (const encounter of encounters) {
        this.logger.log(`🔄 Processing encounter: ${encounter.id}`);
        
        // Check for duplicate
        // const duplicateCheck = await this.checkForDuplicateEncounter(encounter.id, ctx);
        // if (duplicateCheck.isDuplicate) {
        //   this.logger.log(`⚠️ Encounter ${encounter.id} already exported, skipping`);
        //   continue;
        // }

        // Export encounter data
        const encounterResult = await this.exportSingleEncounter(
          encounter,
          patientMapping.googlePatientId!,
          ctx,
          exportTimestamp,
          patientMapping.action
        );

        results.push(encounterResult);
        if (encounterResult.metadata) {
          totalResourcesProcessed += encounterResult.metadata.resourcesProcessed;
        }
      }

      // Step 4: Publish events for successful exports
      for (const result of results) {
        if (result.success) {
          await this.publishEncounterExportEvent(result, ctx);
        }
      }

      this.logger.log(`✅ Encounter export completed: ${results.length} encounters processed, ${totalResourcesProcessed} total resources`);

      return {
        success: true,
        cernerPatientId: patientId,
        googlePatientId: patientMapping.googlePatientId,
        metadata: { exportTimestamp, patientMapping: patientMapping.action, duplicateCheck: 'completed', resourcesProcessed: totalResourcesProcessed },
      };

    } catch (error) {
      this.logger.error(`❌ Error in encounter export: ${error.message}`);
      return {
        success: false,
        error: error.message,
        metadata: { exportTimestamp, patientMapping: 'failed', duplicateCheck: 'failed', resourcesProcessed: 0 },
      };
    }
  }

  /**
   * Get recent encounters from Cerner (last 60 minutes, status=finished)
   */
  private async getRecentEncounters(patientId: string, ctx: TenantContext): Promise<any[]> {
    try {
      const sixtyMinutesAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      
      const query = {
        patient: patientId,
        // `_id`: '97958647',
        // '_id': 97996600,
        // '_id': '97958672',
        // '_id': '97958720',
        // '_id': '97958919',
        // '_id': '97996765',

        // status: 'finished',
        // _lastUpdated: `gt${sixtyMinutesAgo}`,
        _count: 5,
      };

      this.logger.log(`🔍 Searching for encounters with query: ${JSON.stringify(query)}`);
      
      const response = await this.cernerService.searchResource('Encounter', query, ctx, AuthType.SYSTEM);
      
      if (response?.entry) {
        const encounters = response.entry.map((entry: any) => entry.resource);
        this.logger.log(`✅ Found ${encounters.length} recent encounters`);
        return encounters;
      }

      return [];
    } catch (error) {
      this.logger.error(`❌ Error getting encounters: ${error.message}`);
      return [];
    }
  }

  /**
   * Check for duplicate encounter export
   */
  private async checkForDuplicateEncounter(encounterId: string, ctx: TenantContext): Promise<{ isDuplicate: boolean; googleEncounterId?: string }> {
    try {
      const query = {
        _tag: `original-cerner-id-${encounterId}`,
        _count: 1,
      };

      const response = await this.googleService.fhirSearch('Encounter', query, ctx);
      
      if (response?.entry && response.entry.length > 0) {
        const googleEncounterId = response.entry[0].resource.id;
        return { isDuplicate: true, googleEncounterId };
      }

      return { isDuplicate: false };
    } catch (error) {
      this.logger.error(`❌ Error checking for duplicate encounter: ${error.message}`);
      return { isDuplicate: false };
    }
  }

  /**
   * Export single encounter with all related resources
   */
  private async exportSingleEncounter(
    encounter: any,
    googlePatientId: string,
    ctx: TenantContext,
    exportTimestamp: string,
    patientMappingAction: string
  ): Promise<EncounterExportResult> {
    try {
      this.logger.log(`🔄 Exporting encounter ${encounter.id} with all related resources...`);

      // Step 1: Get DocumentReferences for this encounter
      const documentReferences = await this.getDocumentReferencesForEncounter(encounter.id, encounter.subject.reference.split('/')[1], ctx);
      
      // Step 2: Get MedicationRequests for this encounter
      const medicationRequests = await this.getMedicationRequestsForEncounter(encounter.id, encounter.subject.reference.split('/')[1], ctx);
      
      // Step 3: Get Conditions for this encounter
      const conditions = await this.getConditionsForEncounter(encounter.id, encounter.subject.reference.split('/')[1], ctx);
      
      // Step 4: Get follow-up Appointments
      const appointments = await this.getFollowUpAppointments(encounter.subject.reference.split('/')[1], ctx);

      // Step 5: Create encounter bundle (without DocumentReferences and Binaries)
      const { encounterBundle, encounterId } = await this.createEncounterBundle(encounter, [], medicationRequests, appointments, [], googlePatientId, ctx, conditions);

      // Step 6: Store encounter bundle in Google FHIR
      const encounterResult = await this.storeEncounterBundleInGoogle(encounterBundle, encounterId, ctx);
      this.logger.log(`🔍 Debug - encounterResult.conditionIds: ${JSON.stringify(encounterResult.conditionIds)}`);

      // Step 7: Export DocumentReferences individually using existing function
      const documentReferenceIds: string[] = [];
      const binaryIds: string[] = [];

      for (const docRef of documentReferences) {
        try {
          this.logger.log(`📄 Exporting DocumentReference ${docRef.id} using existing function...`);
           const docExportResult = await this.dischargeExportService.exportDischargeSummary(ctx, docRef.id, encounterId);
          if (docExportResult.success && docExportResult.googleDocumentReferenceId) {
            documentReferenceIds.push(docExportResult.googleDocumentReferenceId);
            if (docExportResult.googleBinaryId) {
              binaryIds.push(docExportResult.googleBinaryId);
            }
            this.logger.log(`✅ DocumentReference ${docRef.id} exported successfully`);
          } else {
            this.logger.warn(`⚠️ DocumentReference ${docRef.id} export failed: ${docExportResult.error}`);
          }
        } catch (error) {
          this.logger.error(`❌ Failed to export DocumentReference ${docRef.id}: ${error.message}`);
        }
      }

      // Step 8: Create or update Composition for this encounter
      const compositionResult = await this.createOrUpdateComposition(
        encounter.id,
        encounterResult.encounterId,
        googlePatientId,
        {
          documentReferenceIds,
          medicationRequestIds: encounterResult.medicationRequestIds,
          appointmentIds: encounterResult.appointmentIds,
          conditionIds: encounterResult.conditionIds,
          binaryIds,
        },
        ctx
      );

      // Step 9: Log audit trail
      await this.auditService.logDocumentProcessing(
        encounter.id,
        googlePatientId,
        'stored',
        {
          exportTimestamp,
          patientMapping: patientMappingAction,
          encounterId: encounter.id,
          resourcesExported: {
            encounter: 1,
            documentReferences: documentReferenceIds.length,
            medicationRequests: encounterResult.medicationRequestIds.length,
            appointments: encounterResult.appointmentIds.length,
            conditions: encounterResult.conditionIds.length,
            binaries: binaryIds.length,
            compositions: compositionResult ? 1 : 0,
          },
        }
      );

      const totalResources = 1 + documentReferenceIds.length + encounterResult.medicationRequestIds.length + encounterResult.appointmentIds.length + encounterResult.conditionIds.length + binaryIds.length;

      this.logger.log(`✅ Encounter ${encounter.id} exported successfully: ${totalResources} resources`);

      return {
        success: true,
        cernerEncounterId: encounter.id,
        googleEncounterId: encounterResult.encounterId,
        googlePatientId,
        documentReferenceIds,
        medicationRequestIds: encounterResult.medicationRequestIds,
        appointmentIds: encounterResult.appointmentIds,
        conditionIds: encounterResult.conditionIds,
        binaryIds,
        compositionId: compositionResult?.id,
        metadata: {
          exportTimestamp,
          patientMapping: patientMappingAction,
          duplicateCheck: 'new',
          resourcesProcessed: totalResources,
        },
      };

    } catch (error) {
      this.logger.error(`❌ Error exporting encounter ${encounter.id}: ${error.message}`);
      return {
        success: false,
        cernerEncounterId: encounter.id,
        error: error.message,
        metadata: { exportTimestamp, patientMapping: patientMappingAction, duplicateCheck: 'failed', resourcesProcessed: 0 },
      };
    }
  }

  /**
   * Get DocumentReferences for a specific encounter
   */
  private async getDocumentReferencesForEncounter(encounterId: string, patientId: string, ctx: TenantContext): Promise<any[]> {
    try {
      const query = {
        encounter: encounterId,
        patient: patientId,
        _count: 10,
        _sort: '-_lastUpdated',
      };

      this.logger.log(`📄 Getting DocumentReferences for encounter ${encounterId}`);
      
      const response = await this.cernerService.searchResource('DocumentReference', query, ctx, AuthType.SYSTEM);
      
      if (response?.entry) {
        const documentReferences = response.entry.map((entry: any) => entry.resource);
        this.logger.log(`✅ Found ${documentReferences.length} DocumentReferences`);
        return documentReferences;
      }

      return [];
    } catch (error) {
      this.logger.error(`❌ Error getting DocumentReferences: ${error.message}`);
      return [];
    }
  }


  /**
   * Get MedicationRequests for a specific encounter
   */
  private async getMedicationRequestsForEncounter(encounterId: string, patientId: string, ctx: TenantContext): Promise<any[]> {
    try {
      const query = {
        encounter: encounterId,
        patient: patientId,
        _count: 100,
      };

      this.logger.log(`💊 Getting MedicationRequests for encounter ${encounterId}`);
      
      const response = await this.cernerService.searchResource('MedicationRequest', query, ctx, AuthType.SYSTEM);
      
      if (response?.entry) {
        const medicationRequests = response.entry.map((entry: any) => entry.resource);
        this.logger.log(`✅ Found ${medicationRequests.length} MedicationRequests`);
        return medicationRequests;
      }

      return [];
    } catch (error) {
      this.logger.error(`❌ Error getting MedicationRequests: ${error.message}`);
      return [];
    }
  }

  /**
   * Get Conditions for a specific encounter
   */
  private async getConditionsForEncounter(encounterId: string, patientId: string, ctx: TenantContext): Promise<any[]> {
    try {
      const query = {
        encounter: encounterId,
        patient: patientId,
        _count: 100,
      };

      this.logger.log(`🏥 Getting Conditions for encounter ${encounterId}`);
      
      const response = await this.cernerService.searchResource('Condition', query, ctx, AuthType.SYSTEM);
      
      if (response?.entry) {
        const conditions = response.entry.map((entry: any) => entry.resource);
        this.logger.log(`✅ Found ${conditions.length} Conditions`);
        return conditions;
      }

      return [];
    } catch (error) {
      this.logger.error(`❌ Error getting Conditions: ${error.message}`);
      return [];
    }
  }

  /**
   * Get follow-up Appointments
   */
  private async getFollowUpAppointments(patientId: string, ctx: TenantContext): Promise<any[]> {
    try {
      const currentTime = new Date().toISOString();
      const query = {
        patient: patientId,
        date: `lt${currentTime}`,
        _count: 10,
      };

      this.logger.log(`📅 Getting follow-up Appointments for patient ${patientId}`);
      
      const response = await this.cernerService.searchResource('Appointment', query, ctx, AuthType.SYSTEM);
      
      if (response?.entry) {
        const appointments = response.entry.map((entry: any) => entry.resource);
        this.logger.log(`✅ Found ${appointments.length} follow-up Appointments`);
        return appointments;
      }

      return [];
    } catch (error) {
      this.logger.error(`❌ Error getting Appointments: ${error.message}`);
      return [];
    }
  }

  /**
   * Create bundle with all encounter-related resources
   */
  private async createEncounterBundle(
    encounter: any,
    documentReferences: any[],
    medicationRequests: any[],
    appointments: any[],
    binaries: any[],
    googlePatientId: string,
    ctx: TenantContext,
    conditions: any[] = []
  ): Promise<{ encounterBundle: EncounterBundle; encounterId: string }> {

    // Step 1: Create Encounter first and get its ID
    const transformedEncounter = {
      ...encounter,
      id: undefined, // Let Google FHIR assign new ID
      subject: { reference: `Patient/${googlePatientId}` },
      identifier: [
        ...(encounter.identifier || []),
        { system: 'original-cerner-id', value: encounter.id },
      ],
      meta: {
        ...encounter.meta,
        tag: [{ system: 'original-cerner-id', code: encounter.id }],
      },
      // Remove all reference fields except Patient and Encounter
      serviceProvider: undefined,
      location: undefined,
      reasonReference: undefined,
      diagnosis: undefined,
      account: undefined,
      hospitalization: undefined,
      partOf: undefined,
      appointment: undefined,
      // Remove practitioner references
      participant: undefined,
      reasonCode: undefined,
    };

    // Create encounter and get its Google FHIR ID
    const encounterResult = await this.createEncounter(ctx, transformedEncounter);
    const googleEncounterId = encounterResult?.id;
    
    if (!googleEncounterId) {
      throw new Error('Failed to create encounter in Google FHIR');
    }

    this.logger.log(`✅ Created encounter: ${googleEncounterId}`);

    // Transform DocumentReferences
    // const transformedDocumentReferences = documentReferences.map(docRef => ({
    //   ...docRef,
    //   id: undefined,
    //   subject: { reference: `Patient/${googlePatientId}` },
    //   identifier: [
    //     ...(docRef.identifier || []),
    //     { system: 'original-cerner-id', value: docRef.id },
    //   ],
    //   context: {
    //     ...docRef.context,
    //     encounter: [{ reference: `Encounter/${transformedEncounter.id || 'new'}` }],
    //   },
    //   meta: {
    //     ...docRef.meta,
    //     tag: [{ system: 'original-cerner-id', code: docRef.id }],
    //   },
    //   // Remove all reference fields except Patient and Encounter
    //   author: undefined,
    //   authenticator: undefined,
    //   custodian: undefined,
    //   relatesTo: undefined,
    // }));

    // Transform MedicationRequests
    const transformedMedicationRequests = medicationRequests.map(medReq => ({
      ...medReq,
      id: undefined,
      subject: { reference: `Patient/${googlePatientId}` },
      identifier: [
        ...(medReq.identifier || []),
        { system: 'original-cerner-id', value: medReq.id },
      ],
      encounter: { reference: `Encounter/${googleEncounterId}` },
      meta: {
        ...medReq.meta,
        tag: [{ system: 'original-cerner-id', code: medReq.id }],
      },
      // Remove all reference fields except Patient and Encounter
      requester: undefined,
      performer: undefined,
      recorder: undefined,
      basedOn: undefined,
      priorPrescription: undefined,
      detectedIssue: undefined,
      eventHistory: undefined,
    }));

    // Transform Appointments
    const transformedAppointments = appointments.map(appt => ({
      ...appt,
      id: undefined,
      identifier: [
        ...(appt.identifier || []),
        { system: 'original-cerner-id', value: appt.id },
      ],
      meta: {
        ...appt.meta,
        tag: [{ system: 'original-cerner-id', code: appt.id }],
      },
      // Keep only Patient references, remove all other references
      participant: appt.participant?.map((p: any) => ({
        ...p,
        actor: p.actor?.reference?.includes('Patient/') 
          ? { reference: `Patient/${googlePatientId}` }
          : undefined, // Remove all non-Patient references
      })).filter((p: any) => p.actor), // Remove participants with no actor
      // Remove all reference fields that might contain encounter references
      basedOn: undefined,
      replaces: undefined,
      supportingInformation: undefined,
      extension: undefined,
      partOf: undefined,
      slot: undefined,
    }));

    // Transform Conditions
    const transformedConditions = conditions.map(condition => ({
      ...condition,
      id: undefined,
      subject: { reference: `Patient/${googlePatientId}` },
      encounter: { reference: `Encounter/${googleEncounterId}` },
      identifier: [
        ...(condition.identifier || []),
        { system: 'original-cerner-id', value: condition.id },
      ],
      meta: {
        ...condition.meta,
        tag: [{ system: 'original-cerner-id', code: condition.id }],
      },
      // Remove all reference fields except Patient and Encounter
      recorder: undefined,
      asserter: undefined,
      evidence: undefined,
      appointment: undefined,
    }));

    // Transform Binaries
    // const transformedBinaries = binaries.map(binary => ({
    //   ...binary,
    //   id: undefined,
    //   identifier: [
    //     ...(binary.identifier || []),
    //     { system: 'original-cerner-id', value: binary.id },
    //   ],
    //   meta: {
    //     ...binary.meta,
    //     tag: [{ system: 'original-cerner-id', code: binary.id }],
    //   },
    // }));

    return {
      encounterBundle: {
        encounter: undefined, // Already created, don't include in bundle
        documentReferences: [],
        medicationRequests: transformedMedicationRequests,
        appointments: transformedAppointments,
        conditions: transformedConditions,
        binaries: [],
      },
      encounterId: googleEncounterId,
    };
  }

  /**
   * Store encounter bundle in Google FHIR using conditional create
   */
  private async storeEncounterBundleInGoogle(bundle: EncounterBundle, encounterId: string, ctx: TenantContext): Promise<{
    encounterId: string;
    medicationRequestIds: string[];
    appointmentIds: string[];
    conditionIds: string[];
  }> {
    const result = {
      encounterId: encounterId,
      medicationRequestIds: [] as string[],
      appointmentIds: [] as string[],
      conditionIds: [] as string[],
    };

    try {
      // Create conditional create bundle for remaining resources (encounter already created)
      const conditionalBundle = this.createConditionalCreateBundle(bundle);
      
      this.logger.log(`📦 Creating conditional create bundle with ${conditionalBundle.entry?.length || 0} entries`);
      
      // Execute the bundle
      const bundleResponse = await this.googleService.fhirBundle(conditionalBundle, ctx);
      this.logger.log(`🔍 Debug - bundleResponse: ${bundleResponse?.entry?.length || 0} entries processed`);
      if (bundleResponse && bundleResponse.entry) {
        // Process bundle response to extract created resource IDs
        for (const entry of bundleResponse.entry) {
          if (entry.response && (entry.response.status?.startsWith('201'))) {
            // Extract resource type and ID from location URL
            const location = entry.response.location;
            if (location) {
              // Extract resource type and ID from location URL
              // Example: https://healthcare.googleapis.com/v1/projects/.../fhir/Condition/707e621b-69ed-44d3-9562-70fbb8876308/_history/...
              const match = location.match(/\/fhir\/([^\/]+)\/([^\/]+)\//);
              if (match) {
                const resourceType = match[1];
                const resourceId = match[2];
                
                if (resourceType === 'MedicationRequest') {
                  result.medicationRequestIds.push(resourceId);
                } else if (resourceType === 'Appointment') {
                  result.appointmentIds.push(resourceId);
                } else if (resourceType === 'Condition') {
                  result.conditionIds.push(resourceId);
                }
                
                this.logger.log(`✅ ${resourceType} created/updated: ${resourceId}`);
              }
            }
          }
        }
      }

      this.logger.log(`✅ Encounter bundle processing completed: ${JSON.stringify(result)}`);
      this.logger.log(`🔍 Debug - Condition IDs found: ${result.conditionIds.length} conditions`);
      return result;

    } catch (error) {
      this.logger.error(`❌ Error storing encounter bundle: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create Encounter with conditional create
   */
  private async createEncounter(ctx: TenantContext, encounter: any): Promise<any> {
    const originalId = encounter.identifier?.find((id: any) => id.system === 'original-cerner-id')?.value;
    if (!originalId) {
      throw new Error('Encounter missing original-cerner-id identifier');
    }

    const bundle = {
      resourceType: 'Bundle',
      type: 'batch',
      entry: [{
        request: {
          method: 'POST',
          url: 'Encounter',
          ifNoneExist: `identifier=original-cerner-id|${originalId}`,
        },
        resource: encounter,
      }],
    };
    console.log('bundle', `${bundle.entry?.length || 0} entries`);
    const response = await this.googleService.fhirBundle(bundle, ctx);
    console.log('response', response.status);
    
    if (response?.entry?.[0]?.response?.status?.startsWith('201')) {
      // Extract ID from location URL
      const location = response.entry[0].response.location;
      const idMatch = location?.match(/\/Encounter\/([^\/]+)/);
      const encounterId = idMatch ? idMatch[1] : null;
      
      if (encounterId) {
        return { id: encounterId };
      }
    } else if (response?.entry?.[0]?.response?.status?.startsWith('200')) {
      // Resource already exists, extract ID from location
      const location = response.entry[0].response.location;
      const idMatch = location?.match(/\/Encounter\/([^\/]+)/);
      const encounterId = idMatch ? idMatch[1] : null;
      
      if (encounterId) {
        return { id: encounterId };
      }
    }
    return null;
  }

  /**
   * Create conditional create bundle for encounter resources only
   */
  private createConditionalCreateBundle(bundle: EncounterBundle): any {
    const entries: any[] = [];

    // Add Encounter (only if it exists in the bundle)
    if (bundle.encounter) {
      const encounterOriginalId = bundle.encounter.identifier?.find((id: any) => id.system === 'original-cerner-id')?.value;
      if (encounterOriginalId) {
        entries.push({
          request: {
            method: 'POST',
            url: 'Encounter',
            ifNoneExist: `identifier=original-cerner-id|${encounterOriginalId}`,
          },
          resource: bundle.encounter,
        });
      }
    }

    // Add MedicationRequests
    for (const medReq of bundle.medicationRequests) {
      const originalId = medReq.identifier?.find((id: any) => id.system === 'original-cerner-id')?.value;
      if (originalId) {
        entries.push({
          request: {
            method: 'POST',
            url: 'MedicationRequest',
            ifNoneExist: `identifier=original-cerner-id|${originalId}`,
          },
          resource: medReq,
        });
      }
    }

    // Add Appointments
    for (const appointment of bundle.appointments) {
      const originalId = appointment.identifier?.find((id: any) => id.system === 'original-cerner-id')?.value;
      if (originalId) {
        entries.push({
          request: {
            method: 'POST',
            url: 'Appointment',
            ifNoneExist: `identifier=original-cerner-id|${originalId}`,
          },
          resource: appointment,
        });
      }
    }

    // Add Conditions
    for (const condition of bundle.conditions) {
      const originalId = condition.identifier?.find((id: any) => id.system === 'original-cerner-id')?.value;
      if (originalId) {
        entries.push({
          request: {
            method: 'POST',
            url: 'Condition',
            ifNoneExist: `identifier=original-cerner-id|${originalId}`,
          },
          resource: condition,
        });
      }
    }

    return {
      resourceType: 'Bundle',
      type: 'batch', // Not transaction - individual failures won't rollback others
      entry: entries,
    };
  }



  /**
   * Execute FHIR bundle request
   */
  async executeBundle(bundle: any, ctx: TenantContext): Promise<any> {
    try {
      this.logger.log(`📦 Executing FHIR bundle: type=${bundle.type}, entries=${bundle.entry?.length || 0}`);
      
      const result = await this.googleService.fhirBundle(bundle, ctx);
      
      this.logger.log(`✅ Bundle executed successfully`);
      return result;
    } catch (error) {
      this.logger.error(`❌ Bundle execution failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create or update Composition for encounter resources
   */
  private async createOrUpdateComposition(
    cernerEncounterId: string,
    googleEncounterId: string,
    googlePatientId: string,
    resourceIds: {
      documentReferenceIds: string[];
      medicationRequestIds: string[];
      appointmentIds: string[];
      conditionIds: string[];
      binaryIds: string[];
    },
    ctx: TenantContext
  ): Promise<any | null> {
    try {
      this.logger.log(`📋 Processing composition for encounter ${cernerEncounterId} with ${Object.keys(resourceIds).length} resource types`);
      
      // Check if Composition already exists for this encounter
      const existingComposition = await this.findCompositionByEncounter(cernerEncounterId, ctx);
      
      if (existingComposition) {
        this.logger.log(`📋 Found existing composition ${existingComposition.id} for encounter ${cernerEncounterId}, updating...`);
        // Update existing composition with new resources
        return await this.updateComposition(existingComposition, resourceIds, ctx);
      } else {
        this.logger.log(`📋 No existing composition found for encounter ${cernerEncounterId}, creating new one...`);
        // Create new composition
        return await this.createNewComposition(
          cernerEncounterId,
          googleEncounterId,
          googlePatientId,
          resourceIds,
          ctx
        );
      }
    } catch (error) {
      this.logger.error(`❌ Error creating/updating composition: ${error.message}`);
      return null;
    }
  }

  /**
   * Find existing Composition by encounter ID
   */
  private async findCompositionByEncounter(cernerEncounterId: string, ctx: TenantContext): Promise<any | null> {
    try {
      const query = {
        identifier: `original-cerner-encounter|${cernerEncounterId}`,
      };
      
      const response = await this.googleService.fhirSearch('Composition', query, ctx);
      
      if (response?.entry && response.entry.length > 0) {
        return response.entry[0].resource;
      }
      return null;
    } catch (error) {
      this.logger.error(`❌ Error finding composition: ${error.message}`);
      return null;
    }
  }

  /**
   * Create new Composition
   */
  private async createNewComposition(
    cernerEncounterId: string,
    googleEncounterId: string,
    googlePatientId: string,
    resourceIds: any,
    ctx: TenantContext
  ): Promise<any | null> {
    try {
      const composition = {
        resourceType: 'Composition',
        status: 'final',
        type: {
          coding: [
            {
              system: 'http://loinc.org',
              code: '11488-4',
              display: 'Consult note',
            },
          ],
        },
        subject: { reference: `Patient/${googlePatientId}` },
        encounter: { reference: `Encounter/${googleEncounterId}` },
        date: new Date().toISOString(),
        title: `Encounter Export Composition - ${cernerEncounterId}`,
        author: [
          {
            display: 'Aivida Export System',
          },
        ],
        identifier: {
          system: 'original-cerner-encounter',
          value: cernerEncounterId,
        },
        meta: {
          tag: [
            {
              system: 'original-cerner-encounter',
              code: cernerEncounterId,
            },
          ],
        },
        section: this.createCompositionSections(resourceIds),
      };

      this.logger.log(`📋 Creating new composition with ${composition.section?.length || 0} sections`);
      const result = await this.googleService.fhirCreate('Composition', composition, ctx);
      this.logger.log(`✅ Created new composition for encounter ${cernerEncounterId}: ${result.id}`);
      return result;
    } catch (error) {
      this.logger.error(`❌ Error creating composition: ${error.message}`);
      return null;
    }
  }

  /**
   * Update existing Composition with new resources
   */
  private async updateComposition(existingComposition: any, newResourceIds: any, ctx: TenantContext): Promise<any | null> {
    try {
      // Merge new resources with existing ones
      const updatedSections = this.mergeCompositionSections(existingComposition.section || [], newResourceIds);
      
      const updatedComposition = {
        ...existingComposition,
        section: updatedSections,
        date: new Date().toISOString(), // Update timestamp
      };

      this.logger.log(`📋 Updating composition with ${updatedComposition.section?.length || 0} sections`);
      const result = await this.googleService.fhirUpdate('Composition', existingComposition.id, updatedComposition, ctx);
      this.logger.log(`✅ Updated composition ${existingComposition.id} with new resources`);
      return result;
    } catch (error) {
      this.logger.error(`❌ Error updating composition: ${error.message}`);
      return null;
    }
  }

  /**
   * Create composition sections from resource IDs
   */
  private createCompositionSections(resourceIds: any): any[] {
    const sections: any[] = [];

    // DocumentReferences section
    if (resourceIds.documentReferenceIds.length > 0) {
      sections.push({
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
        entry: resourceIds.documentReferenceIds.map(id => ({ reference: `DocumentReference/${id}` })),
      });
    }

    // Conditions section
    if (resourceIds.conditionIds.length > 0) {
      sections.push({
        title: 'Conditions',
        code: {
          coding: [
            {
              system: 'http://loinc.org',
              code: '11450-4',
              display: 'Problem list',
            },
          ],
        },
        entry: resourceIds.conditionIds.map(id => ({ reference: `Condition/${id}` })),
      });
    }

    // MedicationRequests section
    if (resourceIds.medicationRequestIds.length > 0) {
      sections.push({
        title: 'Medication Requests',
        code: {
          coding: [
            {
              system: 'http://loinc.org',
              code: '10160-0',
              display: 'History of medication use',
            },
          ],
        },
        entry: resourceIds.medicationRequestIds.map(id => ({ reference: `MedicationRequest/${id}` })),
      });
    }

    // Appointments section
    if (resourceIds.appointmentIds.length > 0) {
      sections.push({
        title: 'Appointments',
        code: {
          coding: [
            {
              system: 'http://loinc.org',
              code: '11450-4',
              display: 'Appointment list',
            },
          ],
        },
        entry: resourceIds.appointmentIds.map(id => ({ reference: `Appointment/${id}` })),
      });
    }

    // Binaries section
    if (resourceIds.binaryIds.length > 0) {
      sections.push({
        title: 'Binary Documents',
        code: {
          coding: [
            {
              system: 'http://loinc.org',
              code: '11488-4',
              display: 'Binary documents',
            },
          ],
        },
        entry: resourceIds.binaryIds.map(id => ({ reference: `Binary/${id}` })),
      });
    }

    return sections;
  }

  /**
   * Merge new resources with existing composition sections
   */
  private mergeCompositionSections(existingSections: any[], newResourceIds: any): any[] {
    const mergedSections = [...existingSections];

    // Helper function to find or create section
    const findOrCreateSection = (title: string, code: string, display: string) => {
      let section = mergedSections.find(s => s.title === title);
      if (!section) {
        section = {
          title,
          code: {
            coding: [
              {
                system: 'http://loinc.org',
                code,
                display,
              },
            ],
          },
          entry: [],
        };
        mergedSections.push(section);
      }
      return section;
    };

    // Add new DocumentReferences
    if (newResourceIds.documentReferenceIds.length > 0) {
      const section = findOrCreateSection('Document References', '11488-4', 'Consult note');
      const newEntries = newResourceIds.documentReferenceIds.map(id => ({ reference: `DocumentReference/${id}` }));
      section.entry = [...(section.entry || []), ...newEntries];
    }

    // Add new Conditions
    if (newResourceIds.conditionIds.length > 0) {
      const section = findOrCreateSection('Conditions', '11450-4', 'Problem list');
      const newEntries = newResourceIds.conditionIds.map(id => ({ reference: `Condition/${id}` }));
      section.entry = [...(section.entry || []), ...newEntries];
    }

    // Add new MedicationRequests
    if (newResourceIds.medicationRequestIds.length > 0) {
      const section = findOrCreateSection('Medication Requests', '10160-0', 'History of medication use');
      const newEntries = newResourceIds.medicationRequestIds.map(id => ({ reference: `MedicationRequest/${id}` }));
      section.entry = [...(section.entry || []), ...newEntries];
    }

    // Add new Appointments
    if (newResourceIds.appointmentIds.length > 0) {
      const section = findOrCreateSection('Appointments', '11450-4', 'Appointment list');
      const newEntries = newResourceIds.appointmentIds.map(id => ({ reference: `Appointment/${id}` }));
      section.entry = [...(section.entry || []), ...newEntries];
    }

    // Add new Binaries
    if (newResourceIds.binaryIds.length > 0) {
      const section = findOrCreateSection('Binary Documents', '11488-4', 'Binary documents');
      const newEntries = newResourceIds.binaryIds.map(id => ({ reference: `Binary/${id}` }));
      section.entry = [...(section.entry || []), ...newEntries];
    }

    return mergedSections;
  }

  /**
   * Publish encounter export event to Pub/Sub
   */
  private async publishEncounterExportEvent(result: EncounterExportResult, ctx: TenantContext): Promise<void> {
    try {
      // Calculate total resources (excluding encounter and composition)
      const totalResources = (result.documentReferenceIds?.length || 0) + 
                           (result.medicationRequestIds?.length || 0) + 
                           (result.appointmentIds?.length || 0) + 
                           (result.conditionIds?.length || 0) + 
                           (result.binaryIds?.length || 0);
      
      // Only publish event if there are resources other than just the encounter
      if (totalResources === 0) {
        this.logger.log(`📭 No additional resources found for encounter ${result.cernerEncounterId}, skipping event publication`);
        return;
      }

      // Only publish if composition was created (required by simplification processor)
      if (!result.compositionId) {
        this.logger.log(`📭 No composition created for encounter ${result.cernerEncounterId}, skipping event publication`);
        return;
      }

      this.logger.log(`🔍 Debug - result.conditionIds in event publishing: ${JSON.stringify(result.conditionIds)}`);
      this.logger.log(`📡 Publishing event for encounter ${result.cernerEncounterId} with ${totalResources} additional resources`);
      
      const eventPayload = {
        tenantId: ctx.tenantId,
        patientId: result.cernerPatientId || '',
        exportTimestamp: result.metadata?.exportTimestamp || new Date().toISOString(),
        status: result.success ? 'success' : 'failed',
        error: result.error,
        cernerEncounterId: result.cernerEncounterId || '',
        googleEncounterId: result.googleEncounterId,
        googleCompositionId: result.compositionId,
      };

      await this.pubSubService.publishEncounterExportEvent(eventPayload as EncounterExportEvent);
      
      this.logger.log(`✅ Successfully published encounter export event for encounter ${result.cernerEncounterId}`);
    } catch (error) {
      this.logger.error(`❌ Error publishing encounter export event: ${error.message}`);
    }
  }
}
