import { Injectable, Logger } from '@nestjs/common';
import { Storage } from '@google-cloud/storage';
import { getGoogleAccessToken } from '../google/auth';
import { DevConfigService } from '../config/dev-config.service';
import axios from 'axios';

export interface InfrastructureStatus {
  buckets: {
    raw: boolean;
    simplified: boolean;
    translated: boolean;
  };
  fhir: {
    dataset: boolean;
    store: boolean;
  };
}

@Injectable()
export class GcpInfrastructureService {
  private readonly logger = new Logger(GcpInfrastructureService.name);
  private storage: Storage | null = null;
  private projectId: string;
  private location: string;

  constructor(private readonly configService: DevConfigService) {
    const config = this.configService.get();
    this.projectId = config.gcp?.project_id || process.env.GCP_PROJECT_ID || '';
    this.location = config.gcp?.location || process.env.GCP_LOCATION || 'us-central1';

    if (!this.projectId) {
      this.logger.warn('GCP_PROJECT_ID not configured. Infrastructure provisioning will fail.');
    }
  }

  /**
   * Initialize Google Cloud Storage client lazily
   */
  private getStorage(): Storage {
    if (!this.storage) {
      this.storage = new Storage();
      this.logger.log('Google Cloud Storage client initialized');
    }
    return this.storage;
  }

  /**
   * Create all required GCS buckets for a tenant
   */
  async createBuckets(tenantId: string): Promise<{ success: boolean; created: string[]; errors: string[] }> {
    const bucketNames = [
      `discharge-summaries-raw-${tenantId}`,
      `discharge-summaries-simplified-${tenantId}`,
      `discharge-summaries-translated-${tenantId}`,
    ];

    const created: string[] = [];
    const errors: string[] = [];

    for (const bucketName of bucketNames) {
      try {
        const storage = this.getStorage();
        const [bucket] = await storage.bucket(bucketName).get({ autoCreate: false }).catch(() => [null]);

        if (bucket) {
          this.logger.log(`Bucket ${bucketName} already exists, skipping creation`);
          created.push(bucketName);
          continue;
        }

        // Create bucket
        await storage.createBucket(bucketName, {
          location: this.location,
          storageClass: 'STANDARD',
        });

        this.logger.log(`✅ Created GCS bucket: ${bucketName}`);
        created.push(bucketName);
      } catch (error) {
        const errorMsg = `Failed to create bucket ${bucketName}: ${error.message}`;
        this.logger.error(errorMsg);
        errors.push(errorMsg);
      }
    }

    return {
      success: errors.length === 0,
      created,
      errors,
    };
  }

  /**
   * Delete all GCS buckets for a tenant
   */
  async deleteBuckets(tenantId: string): Promise<{ success: boolean; deleted: string[]; errors: string[] }> {
    const bucketNames = [
      `discharge-summaries-raw-${tenantId}`,
      `discharge-summaries-simplified-${tenantId}`,
      `discharge-summaries-translated-${tenantId}`,
    ];

    const deleted: string[] = [];
    const errors: string[] = [];

    for (const bucketName of bucketNames) {
      try {
        const storage = this.getStorage();
        const bucket = storage.bucket(bucketName);

        // Check if bucket exists
        const [exists] = await bucket.exists();
        if (!exists) {
          this.logger.log(`Bucket ${bucketName} does not exist, skipping deletion`);
          continue;
        }

        // Delete all files in the bucket first
        await bucket.deleteFiles({ force: true });

        // Delete the bucket
        await bucket.delete();

        this.logger.log(`✅ Deleted GCS bucket: ${bucketName}`);
        deleted.push(bucketName);
      } catch (error) {
        const errorMsg = `Failed to delete bucket ${bucketName}: ${error.message}`;
        this.logger.error(errorMsg);
        errors.push(errorMsg);
      }
    }

    return {
      success: errors.length === 0,
      deleted,
      errors,
    };
  }

  /**
   * Create FHIR dataset and store for a tenant
   */
  async createFhirResources(tenantId: string): Promise<{ success: boolean; created: string[]; errors: string[] }> {
    const created: string[] = [];
    const errors: string[] = [];

    const datasetId = `${tenantId}-dataset`;
    const fhirStoreId = `${tenantId}-fhir-store`;

    try {
      const token = await getGoogleAccessToken(['https://www.googleapis.com/auth/cloud-platform']);

      // Create dataset
      try {
        const datasetUrl = `https://healthcare.googleapis.com/v1/projects/${this.projectId}/locations/${this.location}/datasets/${datasetId}`;

        // Check if dataset exists
        try {
          await axios.get(datasetUrl, {
            headers: { Authorization: `Bearer ${token}` },
          });
          this.logger.log(`Dataset ${datasetId} already exists, skipping creation`);
          created.push(`dataset:${datasetId}`);
        } catch (error) {
          if (error.response?.status === 404) {
            // Dataset doesn't exist, create it
            await axios.post(
              `https://healthcare.googleapis.com/v1/projects/${this.projectId}/locations/${this.location}/datasets?datasetId=${datasetId}`,
              {},
              {
                headers: { Authorization: `Bearer ${token}` },
              }
            );
            this.logger.log(`✅ Created FHIR dataset: ${datasetId}`);
            created.push(`dataset:${datasetId}`);
          } else {
            throw error;
          }
        }
      } catch (error) {
        const errorMsg = `Failed to create dataset ${datasetId}: ${error.message}`;
        this.logger.error(errorMsg);
        errors.push(errorMsg);
        return { success: false, created, errors };
      }

      // Create FHIR store
      try {
        const fhirStoreUrl = `https://healthcare.googleapis.com/v1/projects/${this.projectId}/locations/${this.location}/datasets/${datasetId}/fhirStores/${fhirStoreId}`;

        // Check if FHIR store exists
        try {
          await axios.get(fhirStoreUrl, {
            headers: { Authorization: `Bearer ${token}` },
          });
          this.logger.log(`FHIR store ${fhirStoreId} already exists, skipping creation`);
          created.push(`fhir-store:${fhirStoreId}`);
        } catch (error) {
          if (error.response?.status === 404) {
            // FHIR store doesn't exist, create it
            await axios.post(
              `https://healthcare.googleapis.com/v1/projects/${this.projectId}/locations/${this.location}/datasets/${datasetId}/fhirStores?fhirStoreId=${fhirStoreId}`,
              {
                version: 'R4',
                enableUpdateCreate: true,
                disableReferentialIntegrity: false,
                disableResourceVersioning: false,
              },
              {
                headers: { Authorization: `Bearer ${token}` },
              }
            );
            this.logger.log(`✅ Created FHIR store: ${fhirStoreId}`);
            created.push(`fhir-store:${fhirStoreId}`);
          } else {
            throw error;
          }
        }
      } catch (error) {
        const errorMsg = `Failed to create FHIR store ${fhirStoreId}: ${error.message}`;
        this.logger.error(errorMsg);
        errors.push(errorMsg);
      }
    } catch (error) {
      const errorMsg = `Failed to get access token: ${error.message}`;
      this.logger.error(errorMsg);
      errors.push(errorMsg);
    }

    return {
      success: errors.length === 0,
      created,
      errors,
    };
  }

  /**
   * Delete FHIR dataset and store for a tenant
   */
  async deleteFhirResources(tenantId: string): Promise<{ success: boolean; deleted: string[]; errors: string[] }> {
    const deleted: string[] = [];
    const errors: string[] = [];

    const datasetId = `${tenantId}-dataset`;

    try {
      const token = await getGoogleAccessToken(['https://www.googleapis.com/auth/cloud-platform']);

      // Delete entire dataset (this will also delete all FHIR stores within it)
      try {
        const datasetUrl = `https://healthcare.googleapis.com/v1/projects/${this.projectId}/locations/${this.location}/datasets/${datasetId}`;

        await axios.delete(datasetUrl, {
          headers: { Authorization: `Bearer ${token}` },
        });

        this.logger.log(`✅ Deleted FHIR dataset: ${datasetId} (includes all FHIR stores)`);
        deleted.push(`dataset:${datasetId}`);
      } catch (error) {
        if (error.response?.status === 404) {
          this.logger.log(`Dataset ${datasetId} does not exist, skipping deletion`);
        } else {
          const errorMsg = `Failed to delete dataset ${datasetId}: ${error.message}`;
          this.logger.error(errorMsg);
          errors.push(errorMsg);
        }
      }
    } catch (error) {
      const errorMsg = `Failed to get access token: ${error.message}`;
      this.logger.error(errorMsg);
      errors.push(errorMsg);
    }

    return {
      success: errors.length === 0,
      deleted,
      errors,
    };
  }

  /**
   * Check the status of all infrastructure resources for a tenant
   */
  async checkInfrastructureStatus(tenantId: string): Promise<InfrastructureStatus> {
    const status: InfrastructureStatus = {
      buckets: {
        raw: false,
        simplified: false,
        translated: false,
      },
      fhir: {
        dataset: false,
        store: false,
      },
    };

    // Check buckets
    try {
      const storage = this.getStorage();
      const bucketNames = {
        raw: `discharge-summaries-raw-${tenantId}`,
        simplified: `discharge-summaries-simplified-${tenantId}`,
        translated: `discharge-summaries-translated-${tenantId}`,
      };

      for (const [key, bucketName] of Object.entries(bucketNames)) {
        try {
          const [exists] = await storage.bucket(bucketName).exists();
          status.buckets[key as keyof typeof status.buckets] = exists;
        } catch (error) {
          this.logger.error(`Error checking bucket ${bucketName}: ${error.message}`);
        }
      }
    } catch (error) {
      this.logger.error(`Error checking buckets: ${error.message}`);
    }

    // Check FHIR resources
    try {
      const token = await getGoogleAccessToken(['https://www.googleapis.com/auth/cloud-platform']);
      const datasetId = `${tenantId}-dataset`;
      const fhirStoreId = `${tenantId}-fhir-store`;

      // Check dataset
      try {
        await axios.get(
          `https://healthcare.googleapis.com/v1/projects/${this.projectId}/locations/${this.location}/datasets/${datasetId}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        status.fhir.dataset = true;
      } catch (error) {
        if (error.response?.status !== 404) {
          this.logger.error(`Error checking dataset ${datasetId}: ${error.message}`);
        }
      }

      // Check FHIR store (only if dataset exists)
      if (status.fhir.dataset) {
        try {
          await axios.get(
            `https://healthcare.googleapis.com/v1/projects/${this.projectId}/locations/${this.location}/datasets/${datasetId}/fhirStores/${fhirStoreId}`,
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          );
          status.fhir.store = true;
        } catch (error) {
          if (error.response?.status !== 404) {
            this.logger.error(`Error checking FHIR store ${fhirStoreId}: ${error.message}`);
          }
        }
      }
    } catch (error) {
      this.logger.error(`Error checking FHIR resources: ${error.message}`);
    }

    return status;
  }

  /**
   * Provision all infrastructure for a tenant (buckets + FHIR)
   */
  async provisionAll(tenantId: string): Promise<{
    success: boolean;
    buckets: { success: boolean; created: string[]; errors: string[] };
    fhir: { success: boolean; created: string[]; errors: string[] };
  }> {
    this.logger.log(`🚀 Provisioning infrastructure for tenant: ${tenantId}`);

    const buckets = await this.createBuckets(tenantId);
    const fhir = await this.createFhirResources(tenantId);

    const success = buckets.success && fhir.success;

    this.logger.log(
      `${success ? '✅' : '❌'} Infrastructure provisioning ${success ? 'completed' : 'completed with errors'} for tenant: ${tenantId}`
    );

    return { success, buckets, fhir };
  }

  /**
   * Delete all infrastructure for a tenant (buckets + FHIR)
   */
  async deleteAll(tenantId: string): Promise<{
    success: boolean;
    buckets: { success: boolean; deleted: string[]; errors: string[] };
    fhir: { success: boolean; deleted: string[]; errors: string[] };
  }> {
    this.logger.log(`🗑️  Deleting infrastructure for tenant: ${tenantId}`);

    const buckets = await this.deleteBuckets(tenantId);
    const fhir = await this.deleteFhirResources(tenantId);

    const success = buckets.success && fhir.success;

    this.logger.log(
      `${success ? '✅' : '❌'} Infrastructure deletion ${success ? 'completed' : 'completed with errors'} for tenant: ${tenantId}`
    );

    return { success, buckets, fhir };
  }
}
