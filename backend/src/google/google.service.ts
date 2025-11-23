import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { getGoogleAccessToken } from './auth';
import { AxiosInstance } from 'axios';
import { createFhirAxiosClient } from './fhirClient.js';
import { DevConfigService } from '../config/dev-config.service';
import { TenantContext } from '../tenant/tenant-context';
import { FirestoreService } from '../discharge-summaries/firestore.service';

@Injectable()
export class GoogleService {
  private clientPromise: Promise<AxiosInstance> | null = null;
  private allowedTypes: Set<string> | null = null;
  private readonly logger = new Logger(GoogleService.name);

  constructor(
    private readonly configService: DevConfigService,
    private readonly firestoreService?: FirestoreService,
  ) {}

  async getAccessToken() {
    const token = await getGoogleAccessToken(['https://www.googleapis.com/auth/cloud-platform']);
    return { access_token: token };
  }

  async impersonate(email: string, scopes?: string[]) {
    // Placeholder for future domain-wide delegation logic
    const token = await getGoogleAccessToken(scopes && scopes.length ? scopes : ['https://www.googleapis.com/auth/cloud-platform']);
    return { subject: email, access_token: token };
  }

  private async getFhirClient(ctx: TenantContext): Promise<AxiosInstance> {
    const cfg = this.configService.get();
    let baseUrl = cfg.fhir_base_url; // Default fallback
    
    // Construct tenant-specific URL
    const tenantDataset = await this.configService.getTenantGoogleDataset(ctx.tenantId);
    const tenantFhirStore = await this.configService.getTenantGoogleFhirStore(ctx.tenantId);
    
    if (cfg.gcp) {
      baseUrl = `https://healthcare.googleapis.com/v1/projects/${cfg.gcp.project_id}/locations/${cfg.gcp.location}/datasets/${tenantDataset}/fhirStores/${tenantFhirStore}/fhir`;
    }
    
    if (!baseUrl) {
      throw new Error('fhir_base_url missing in config.yaml');
    }
    
    // Create new client for each tenant to avoid caching issues
    return createFhirAxiosClient(baseUrl);
  }

  private isAllowedType(resourceType: string): boolean {
    if (!this.allowedTypes) {
      const types = this.configService.get().resource_types;
      if (!types || types.length === 0 || types.includes('*')) {
        this.allowedTypes = new Set(['*']);
      } else {
        this.allowedTypes = new Set(types.map((t) => t.toLowerCase()));
      }
    }
    if (this.allowedTypes.has('*')) return true;
    return this.allowedTypes.has(resourceType.toLowerCase());
  }

  private assertAllowed(resourceType: string) {
    if (!this.isAllowedType(resourceType)) {
      throw new BadRequestException(`Resource type not allowed: ${resourceType}`);
    }
  }

  async fhirCreate(resourceType: string, body: unknown, ctx: TenantContext) {
    this.assertAllowed(resourceType);
    const client = await this.getFhirClient(ctx);
    try {
      const { data } = await client.post(`/${resourceType}`, body);
      return data;
    } catch (error) {
      console.error(`Google FHIR Create Error for ${resourceType} (tenant: ${ctx.tenantId}):`, {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        requestData: JSON.stringify(body)
      });
      throw error;
    }
  }

  async fhirRead(resourceType: string, id: string, ctx: TenantContext) {
    this.assertAllowed(resourceType);
    const client = await this.getFhirClient(ctx);
    const { data } = await client.get(`/${resourceType}/${id}`);
    return data;
  }

  async fhirUpdate(resourceType: string, id: string, body: unknown, ctx: TenantContext) {
    this.assertAllowed(resourceType);
    const client = await this.getFhirClient(ctx);
    try {
      const { data } = await client.put(`/${resourceType}/${id}`, body);
      return data;
    } catch (error) {
      console.error(`Google FHIR Update Error for ${resourceType}/${id} (tenant: ${ctx.tenantId}):`, {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        requestData: JSON.stringify(body)
      });
      throw error;
    }
  }

  async fhirDelete(resourceType: string, id: string, ctx: TenantContext) {
    this.assertAllowed(resourceType);
    const client = await this.getFhirClient(ctx);
    try {
      const { data } = await client.delete(`/${resourceType}/${id}`);
      return data;
    } catch (error: any) {
      const errorDetails = {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message,
      };
      console.error(`Google FHIR Delete Error for ${resourceType}/${id} (tenant: ${ctx.tenantId}):`, errorDetails);
      
      // Re-throw the error with response preserved for controller to handle
      throw error;
    }
  }

  async fhirSearch(resourceType: string, query: Record<string, any>, ctx: TenantContext) {
    this.assertAllowed(resourceType);
    const client = await this.getFhirClient(ctx);
    const { data } = await client.get(`/${resourceType}`, { params: query });
    return data;
  }

  /**
   * Delete a Patient and all dependent resources (cascading delete)
   * Deletes in order: DocumentReferences -> Compositions -> Binaries -> Encounters -> Patient
   */
  async deletePatientWithDependencies(patientId: string, compositionId: string, ctx: TenantContext): Promise<{
    success: boolean;
    deleted: {
      binaries: string[];
      documentReferences: string[];
      encounters: string[];
      composition: string | null;
      patient: string | null;
    };
    errors: Array<{ resourceType: string; id: string; error: string }>;
  }> {
    const deleted = {
      binaries: [] as string[],
      documentReferences: [] as string[],
      encounters: [] as string[],
      composition: null as string | null,
      patient: null as string | null,
    };
    const errors: Array<{ resourceType: string; id: string; error: string }> = [];

    const client = await this.getFhirClient(ctx);

    try {
      // Step 1: Find all DocumentReferences, Compositions, and Encounters for this patient and extract Binary IDs
      const binaryIds = new Set<string>();
      const documentReferenceIds: string[] = [];
      const compositionIds = new Set<string>();
      const encounterIds = new Set<string>();

      // Add the provided compositionId
      compositionIds.add(compositionId);

      try {
        const docRefSearch = await client.get('/DocumentReference', {
          params: { patient: patientId, _count: 100 },
        });

        if (docRefSearch.data?.entry) {
          for (const entry of docRefSearch.data.entry) {
            const docRef = entry.resource;
            if (docRef?.id) {
              documentReferenceIds.push(docRef.id);
              
              // Extract Binary IDs from DocumentReference content
              if (docRef.content && Array.isArray(docRef.content)) {
                for (const contentItem of docRef.content) {
                  if (contentItem.attachment?.url) {
                    const url = contentItem.attachment.url;
                    // Extract Binary ID from URL like "Binary/{id}" or "https://.../Binary/{id}"
                    const binaryMatch = url.match(/Binary\/([^\/\?]+)/);
                    if (binaryMatch && binaryMatch[1]) {
                      binaryIds.add(binaryMatch[1]);
                    }
                  }
                }
              }

              // Extract Encounter IDs from DocumentReference context
              if (docRef.context?.encounter && Array.isArray(docRef.context.encounter)) {
                for (const encounterRef of docRef.context.encounter) {
                  if (encounterRef.reference) {
                    const encounterMatch = encounterRef.reference.match(/^Encounter\/([^\/]+)$/);
                    if (encounterMatch && encounterMatch[1]) {
                      encounterIds.add(encounterMatch[1]);
                    }
                  }
                }
              }
            }
          }
        }
      } catch (error: any) {
        console.error(`❌ Error searching for DocumentReferences:`, error.message);
        // Continue with deletion even if search fails
      }

      // Step 1aa: Find ALL Compositions for this patient (not just the provided one)
      try {
        const compositionSearch = await client.get('/Composition', {
          params: { subject: `Patient/${patientId}`, _count: 100 },
        });

        if (compositionSearch.data?.entry) {
          for (const entry of compositionSearch.data.entry) {
            const comp = entry.resource;
            if (comp?.id) {
              compositionIds.add(comp.id);
            }
          }
        }
      } catch (error: any) {
        console.error(`❌ Error searching for Compositions:`, error.message);
        // Continue with deletion even if search fails
      }

      // Step 1a: Also find Encounters directly by patient
      try {
        const encounterSearch = await client.get('/Encounter', {
          params: { subject: `Patient/${patientId}`, _count: 100 },
        });

        if (encounterSearch.data?.entry) {
          for (const entry of encounterSearch.data.entry) {
            const encounter = entry.resource;
            if (encounter?.id) {
              encounterIds.add(encounter.id);
            }
          }
        }
      } catch (error: any) {
        console.error(`❌ Error searching for Encounters:`, error.message);
        // Continue with deletion even if search fails
      }

      // Step 1b: Extract Binary IDs and Encounter IDs from ALL Compositions
      for (const compId of Array.from(compositionIds)) {
        try {
          const composition = await client.get(`/Composition/${compId}`);
          const compData = composition.data;
          
          // Extract Encounter ID from Composition.encounter
          if (compData?.encounter?.reference) {
            const encounterMatch = compData.encounter.reference.match(/^Encounter\/([^\/]+)$/);
            if (encounterMatch && encounterMatch[1]) {
              encounterIds.add(encounterMatch[1]);
            }
          }
          
          // Extract Binary IDs from Composition sections
          if (compData?.section && Array.isArray(compData.section)) {
            for (const section of compData.section) {
              if (section.entry && Array.isArray(section.entry)) {
                for (const entry of section.entry) {
                  if (entry.reference) {
                    const ref = entry.reference;
                    // Extract Binary ID from reference like "Binary/{id}"
                    const binaryMatch = ref.match(/^Binary\/([^\/]+)$/);
                    if (binaryMatch && binaryMatch[1]) {
                      binaryIds.add(binaryMatch[1]);
                    }
                    // Also check for DocumentReference references
                    const docRefMatch = ref.match(/^DocumentReference\/([^\/]+)$/);
                    if (docRefMatch && docRefMatch[1] && !documentReferenceIds.includes(docRefMatch[1])) {
                      documentReferenceIds.push(docRefMatch[1]);
                    }
                  }
                }
              }
            }
          }
        } catch (error: any) {
          // Handle 410 (Gone) or 404 (Not Found) gracefully - Composition might already be deleted
          const statusCode = error.response?.status;
          if (statusCode === 410 || statusCode === 404) {
            console.log(`ℹ️ Composition ${compId} not found (already deleted or doesn't exist), continuing...`);
          } else {
            console.error(`❌ Error reading Composition ${compId} to extract Binary/Encounter IDs:`, error.message);
          }
          // Continue with other Compositions even if one fails
        }
      }

      // Step 1c: Find ALL Compositions that reference the Encounters we found
      // This ensures we catch all Compositions, even if they don't directly reference the patient
      for (const encounterId of Array.from(encounterIds)) {
        try {
          const encounterCompositionSearch = await client.get('/Composition', {
            params: { encounter: `Encounter/${encounterId}`, _count: 100 },
          });

          if (encounterCompositionSearch.data?.entry) {
            for (const entry of encounterCompositionSearch.data.entry) {
              const comp = entry.resource;
              if (comp?.id) {
                compositionIds.add(comp.id);
                console.log(`📋 Found additional Composition ${comp.id} via Encounter ${encounterId}`);
              }
            }
          }
        } catch (error: any) {
          console.error(`❌ Error searching for Compositions by Encounter ${encounterId}:`, error.message);
          // Continue even if search fails
        }
      }

      // Step 1d: Search for ALL Compositions of discharge summary type and check if they reference our Binaries
      // This catches Compositions that might reference our Binaries but weren't found by patient/encounter search
      // We'll search by type and then check their Binary references
      try {
        const allCompositionSearch = await client.get('/Composition', {
          params: { type: 'http://loinc.org|18842-5', _count: 1000 }, // Search all discharge summaries
        });

        if (allCompositionSearch.data?.entry) {
          for (const entry of allCompositionSearch.data.entry) {
            const comp = entry.resource;
            if (!comp?.id || compositionIds.has(comp.id)) {
              continue; // Skip if already found
            }

            // Check if this Composition references any of our Binaries
            let referencesOurBinary = false;
            if (comp.section && Array.isArray(comp.section)) {
              for (const section of comp.section) {
                if (section.entry && Array.isArray(section.entry)) {
                  for (const entry of section.entry) {
                    if (entry.reference) {
                      const ref = entry.reference;
                      const binaryMatch = ref.match(/^Binary\/([^\/]+)$/);
                      if (binaryMatch && binaryMatch[1] && binaryIds.has(binaryMatch[1])) {
                        referencesOurBinary = true;
                        break;
                      }
                    }
                  }
                }
                if (referencesOurBinary) break;
              }
            }

            // Also check if it references any of our DocumentReferences
            if (!referencesOurBinary && comp.section && Array.isArray(comp.section)) {
              for (const section of comp.section) {
                if (section.entry && Array.isArray(section.entry)) {
                  for (const entry of section.entry) {
                    if (entry.reference) {
                      const ref = entry.reference;
                      const docRefMatch = ref.match(/^DocumentReference\/([^\/]+)$/);
                      if (docRefMatch && docRefMatch[1] && documentReferenceIds.includes(docRefMatch[1])) {
                        referencesOurBinary = true;
                        break;
                      }
                    }
                  }
                }
                if (referencesOurBinary) break;
              }
            }

            if (referencesOurBinary) {
              compositionIds.add(comp.id);
              console.log(`📋 Found additional Composition ${comp.id} via Binary/DocumentReference reference`);
              
              // Extract additional Binary IDs and Encounter IDs from this Composition
              if (comp.encounter?.reference) {
                const encounterMatch = comp.encounter.reference.match(/^Encounter\/([^\/]+)$/);
                if (encounterMatch && encounterMatch[1]) {
                  encounterIds.add(encounterMatch[1]);
                }
              }
              
              if (comp.section && Array.isArray(comp.section)) {
                for (const section of comp.section) {
                  if (section.entry && Array.isArray(section.entry)) {
                    for (const entry of section.entry) {
                      if (entry.reference) {
                        const ref = entry.reference;
                        const binaryMatch = ref.match(/^Binary\/([^\/]+)$/);
                        if (binaryMatch && binaryMatch[1]) {
                          binaryIds.add(binaryMatch[1]);
                        }
                        const docRefMatch = ref.match(/^DocumentReference\/([^\/]+)$/);
                        if (docRefMatch && docRefMatch[1] && !documentReferenceIds.includes(docRefMatch[1])) {
                          documentReferenceIds.push(docRefMatch[1]);
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      } catch (error: any) {
        console.error(`❌ Error searching for all Compositions to find Binary references:`, error.message);
        // Continue even if search fails
      }

      // Step 2: Delete ALL Compositions FIRST (they reference DocumentReference, Patient, and Encounter)
      // Composition must be deleted before DocumentReference, Encounter, and Patient
      for (const compId of Array.from(compositionIds)) {
        try {
          await client.delete(`/Composition/${compId}`);
          if (compId === compositionId) {
            deleted.composition = compId;
          }
          console.log(`✅ Deleted Composition: ${compId}`);
        } catch (error: any) {
          const statusCode = error.response?.status;
          // Handle 410 (Gone) or 404 (Not Found) gracefully - Composition might already be deleted
          if (statusCode === 410 || statusCode === 404) {
            console.log(`ℹ️ Composition ${compId} not found (already deleted or doesn't exist), continuing...`);
            if (compId === compositionId) {
              deleted.composition = compId; // Mark as deleted even though it was already gone
            }
          } else {
            const errorMsg = error.response?.data?.issue?.[0]?.details?.text || error.message;
            const diagnostics = error.response?.data?.issue?.[0]?.diagnostics || '';
            const fullError = diagnostics ? `${errorMsg} (${diagnostics})` : errorMsg;
            errors.push({
              resourceType: 'Composition',
              id: compId,
              error: fullError,
            });
            console.error(`❌ Failed to delete Composition ${compId}: ${fullError}`);
            // Log full error response for debugging
            if (error.response?.data) {
              console.error(`   Full error response:`, JSON.stringify(error.response.data, null, 2));
            }
            // Don't continue to other deletions if main Composition deletion fails (unless it's already gone)
            if (compId === compositionId) {
              throw new Error(`Failed to delete Composition: ${fullError}`);
            }
          }
        }
      }

      // Step 3: Delete all DocumentReferences (they reference Binary and Patient)
      // Now safe to delete since Composition (which references DocumentReference) is deleted
      for (const docRefId of documentReferenceIds) {
        try {
          await client.delete(`/DocumentReference/${docRefId}`);
          deleted.documentReferences.push(docRefId);
          console.log(`✅ Deleted DocumentReference: ${docRefId}`);
        } catch (error: any) {
          const errorMsg = error.response?.data?.issue?.[0]?.details?.text || error.message;
          errors.push({
            resourceType: 'DocumentReference',
            id: docRefId,
            error: errorMsg,
          });
          console.error(`❌ Failed to delete DocumentReference ${docRefId}:`, errorMsg);
          // Continue with other deletions even if one DocumentReference fails
        }
      }

      // Step 4: Delete all Binary resources (they are referenced by DocumentReference)
      // Now safe to delete since DocumentReference (which references Binary) is deleted
      for (const binaryId of Array.from(binaryIds)) {
        try {
          await client.delete(`/Binary/${binaryId}`);
          deleted.binaries.push(binaryId);
          console.log(`✅ Deleted Binary: ${binaryId}`);
        } catch (error: any) {
          const errorMsg = error.response?.data?.issue?.[0]?.details?.text || error.message;
          const diagnostics = error.response?.data?.issue?.[0]?.diagnostics || '';
          const fullError = diagnostics ? `${errorMsg} (${diagnostics})` : errorMsg;
          errors.push({
            resourceType: 'Binary',
            id: binaryId,
            error: fullError,
          });
          console.error(`❌ Failed to delete Binary ${binaryId}: ${fullError}`);
          // Log full error response for debugging
          if (error.response?.data) {
            console.error(`   Full error response:`, JSON.stringify(error.response.data, null, 2));
          }
          // Continue with other deletions even if one Binary fails
        }
      }

      // Step 5: Delete all Encounters (they reference Patient)
      // Now safe to delete since Composition (which references Encounter) is deleted
      for (const encounterId of Array.from(encounterIds)) {
        try {
          await client.delete(`/Encounter/${encounterId}`);
          deleted.encounters.push(encounterId);
          console.log(`✅ Deleted Encounter: ${encounterId}`);
        } catch (error: any) {
          const errorMsg = error.response?.data?.issue?.[0]?.details?.text || error.message;
          errors.push({
            resourceType: 'Encounter',
            id: encounterId,
            error: errorMsg,
          });
          console.error(`❌ Failed to delete Encounter ${encounterId}:`, errorMsg);
          // Continue with other deletions even if one Encounter fails
        }
      }

      // Step 6: Delete Patient LAST (it's referenced by Composition, DocumentReference, and Encounter)
      // Now safe to delete since all resources that reference Patient are deleted
      try {
        await client.delete(`/Patient/${patientId}`);
        deleted.patient = patientId;
        console.log(`✅ Deleted Patient: ${patientId}`);
      } catch (error: any) {
        const errorMsg = error.response?.data?.issue?.[0]?.details?.text || error.message;
        errors.push({
          resourceType: 'Patient',
          id: patientId,
          error: errorMsg,
        });
        console.error(`❌ Failed to delete Patient ${patientId}:`, errorMsg);
        throw error;
      }

      // Step 7: Delete Firestore discharge_summaries document
      // This is critical - the expert portal queries Firestore, so if we don't delete this,
      // the patient will still appear in the list even though all FHIR resources are deleted
      if (this.firestoreService) {
        try {
          // Delete all composition documents (in case there are multiple compositions for this patient)
          for (const compId of Array.from(compositionIds)) {
            try {
              await this.firestoreService.delete(compId, ctx.tenantId);
              this.logger.log(`✅ Deleted Firestore discharge_summaries document: ${compId}`);
            } catch (firestoreError: any) {
              // If document doesn't exist, that's okay - it might not have been created yet
              if (firestoreError.status === 404 || firestoreError.message?.includes('not found')) {
                this.logger.debug(`Firestore document ${compId} not found (may not exist), continuing...`);
              } else {
                const errorMsg = firestoreError.message || 'Unknown error';
                errors.push({
                  resourceType: 'Firestore',
                  id: compId,
                  error: `Failed to delete Firestore document: ${errorMsg}`,
                });
                this.logger.warn(`❌ Failed to delete Firestore document ${compId}: ${errorMsg}`);
                // Don't throw - continue even if Firestore deletion fails
              }
            }
          }
        } catch (error: any) {
          // Log but don't fail the entire operation if Firestore deletion fails
          this.logger.error(`❌ Error during Firestore deletion: ${error.message}`);
          errors.push({
            resourceType: 'Firestore',
            id: compositionId,
            error: error.message,
          });
        }
      } else {
        this.logger.warn('FirestoreService not available - skipping Firestore document deletion');
      }

      return { success: true, deleted, errors };
    } catch (error: any) {
      return { success: false, deleted, errors };
    }
  }

  async fhirBundle(bundle: any, ctx: TenantContext) {
    // For bundles, we need to check if all resource types in the bundle are allowed
    if (bundle.entry && Array.isArray(bundle.entry)) {
      for (const entry of bundle.entry) {
        if (entry.resource && entry.resource.resourceType) {
          this.assertAllowed(entry.resource.resourceType);
        }
      }
    }
    
    const client = await this.getFhirClient(ctx);
    try {
      const { data } = await client.post('/', bundle);
      return data;
    } catch (error) {
      console.error(`Google FHIR Bundle Error (tenant: ${ctx.tenantId}):`, {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        bundleType: bundle.type,
        entryCount: bundle.entry?.length || 0,
        requestData: JSON.stringify(bundle, null, 2)
      });
      throw error;
    }
  }
}


