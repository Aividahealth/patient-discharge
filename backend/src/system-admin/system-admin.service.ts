import { Injectable, Logger, ConflictException, NotFoundException } from '@nestjs/common';
import { Firestore } from '@google-cloud/firestore';
import { DevConfigService } from '../config/dev-config.service';
import { AuthService } from '../auth/auth.service';
import { UserService } from '../auth/user.service';
import { GcpInfrastructureService } from './gcp-infrastructure.service';
import { QualityMetricsService } from '../quality-metrics/quality-metrics.service';
import { resolveServiceAccountPath } from '../utils/path.helper';
import {
  TenantConfig,
  CreateTenantRequest,
  UpdateTenantRequest,
  CreateTenantAdminRequest,
  TenantMetrics,
  AggregatedMetrics,
} from './system-admin.types';

@Injectable()
export class SystemAdminService {
  private readonly logger = new Logger(SystemAdminService.name);
  private firestore: Firestore | null = null;

  constructor(
    private readonly configService: DevConfigService,
    private readonly authService: AuthService,
    private readonly userService: UserService,
    private readonly gcpInfrastructure: GcpInfrastructureService,
    private readonly qualityMetricsService: QualityMetricsService,
  ) {}

  /**
   * Initialize Firestore client lazily
   */
  private getFirestore(): Firestore {
    if (!this.firestore) {
      let serviceAccountPath: string | undefined;

      try {
        const config = this.configService.get();
        if (config.firestore_service_account_path) {
          const resolved = resolveServiceAccountPath(config.firestore_service_account_path);
          const fs = require('fs');
          if (fs.existsSync(resolved)) {
            serviceAccountPath = resolved;
            this.logger.log(`Using Firestore service account for SystemAdminService: ${resolved}`);
          } else {
            this.logger.log(`Firestore service account not found at ${resolved}, using Application Default Credentials`);
          }
        }
      } catch (error) {
        this.logger.log('Config not available, using Application Default Credentials');
      }

      this.firestore = new Firestore(
        serviceAccountPath ? { keyFilename: serviceAccountPath } : {},
      );

      this.logger.log('Firestore SystemAdmin Service initialized');
    }
    return this.firestore;
  }

  /**
   * Get all tenants
   */
  async getAllTenants(): Promise<TenantConfig[]> {
    try {
      const snapshot = await this.getFirestore()
        .collection('config')
        .get();

      const tenants: TenantConfig[] = [];

      snapshot.forEach(doc => {
        const data = doc.data();

        // Convert Firestore infrastructure data
        let infrastructure: TenantConfig['infrastructure'] | undefined;
        if (data.infrastructure) {
          infrastructure = {
            buckets: data.infrastructure.buckets || {
              raw: false,
              simplified: false,
              translated: false,
            },
            fhir: data.infrastructure.fhir || {
              dataset: false,
              store: false,
            },
            lastChecked: data.infrastructure.lastChecked?.toDate(),
          };
        }

        tenants.push({
          id: doc.id,
          name: data.name || doc.id,
          branding: data.branding || {
            logo: `https://storage.googleapis.com/logos/${doc.id}.png`,
            primaryColor: '#3b82f6',
            secondaryColor: '#60a5fa',
          },
          features: data.features || {
            patientPortal: true,
            clinicianPortal: true,
            expertPortal: true,
            chatbot: true,
          },
          ehrIntegration: data.ehrIntegration,
          infrastructure,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        });
      });

      return tenants;
    } catch (error) {
      this.logger.error(`Error getting tenants: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get a specific tenant by ID
   */
  async getTenant(tenantId: string): Promise<TenantConfig | null> {
    try {
      const doc = await this.getFirestore()
        .collection('config')
        .doc(tenantId)
        .get();

      if (!doc.exists) {
        return null;
      }

      const data = doc.data()!;

      // Convert Firestore infrastructure data
      let infrastructure: TenantConfig['infrastructure'] | undefined;
      if (data.infrastructure) {
        infrastructure = {
          buckets: data.infrastructure.buckets || {
            raw: false,
            simplified: false,
            translated: false,
          },
          fhir: data.infrastructure.fhir || {
            dataset: false,
            store: false,
          },
          lastChecked: data.infrastructure.lastChecked?.toDate(),
        };
      }

      return {
        id: doc.id,
        name: data.name || doc.id,
        branding: data.branding || {
          logo: `https://storage.googleapis.com/logos/${doc.id}.png`,
          primaryColor: '#3b82f6',
          secondaryColor: '#60a5fa',
        },
        features: data.features || {
          patientPortal: true,
          clinicianPortal: true,
          expertPortal: true,
          chatbot: true,
        },
        ehrIntegration: data.ehrIntegration,
        infrastructure,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      };
    } catch (error) {
      this.logger.error(`Error getting tenant ${tenantId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create a new tenant
   */
  async createTenant(request: CreateTenantRequest): Promise<TenantConfig> {
    try {
      // Check if tenant already exists
      const existing = await this.getTenant(request.id);
      if (existing) {
        throw new ConflictException(`Tenant ${request.id} already exists`);
      }

      const now = new Date();
      const tenantData: any = {
        name: request.name,
        branding: request.branding,
        features: request.features || {
          patientPortal: true,
          clinicianPortal: true,
          expertPortal: true,
          chatbot: true,
        },
        ehrIntegration: request.ehrIntegration || { type: 'Manual' },
        createdAt: now,
        updatedAt: now,
      };

      // Provision GCP infrastructure
      this.logger.log(`Provisioning infrastructure for tenant: ${request.id}`);
      const infrastructureResult = await this.gcpInfrastructure.provisionAll(request.id);

      // Store infrastructure status
      const status = await this.gcpInfrastructure.checkInfrastructureStatus(request.id);
      tenantData.infrastructure = {
        buckets: status.buckets,
        fhir: status.fhir,
        lastChecked: now,
      };

      // Log any errors during provisioning
      if (!infrastructureResult.success) {
        const allErrors = [
          ...infrastructureResult.buckets.errors,
          ...infrastructureResult.fhir.errors,
        ];
        this.logger.warn(
          `Infrastructure provisioning completed with errors for tenant ${request.id}: ${allErrors.join(', ')}`
        );
      }

      await this.getFirestore()
        .collection('config')
        .doc(request.id)
        .set(tenantData);

      this.logger.log(`Created tenant: ${request.id}`);

      return {
        id: request.id,
        name: tenantData.name,
        branding: tenantData.branding,
        features: {
          patientPortal: tenantData.features.patientPortal ?? true,
          clinicianPortal: tenantData.features.clinicianPortal ?? true,
          expertPortal: tenantData.features.expertPortal ?? true,
          chatbot: tenantData.features.chatbot ?? true,
        },
        ehrIntegration: tenantData.ehrIntegration,
        infrastructure: tenantData.infrastructure,
        createdAt: tenantData.createdAt,
        updatedAt: tenantData.updatedAt,
      };
    } catch (error) {
      this.logger.error(`Error creating tenant: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update a tenant
   */
  async updateTenant(tenantId: string, request: UpdateTenantRequest): Promise<TenantConfig> {
    try {
      const existing = await this.getTenant(tenantId);
      if (!existing) {
        throw new NotFoundException(`Tenant ${tenantId} not found`);
      }

      const updateData: any = {
        updatedAt: new Date(),
      };

      if (request.name) updateData.name = request.name;
      if (request.branding) {
        updateData.branding = {
          ...existing.branding,
          ...request.branding,
        };
      }
      if (request.features) {
        // Ensure all feature flags are defined (not optional)
        updateData.features = {
          patientPortal: request.features.patientPortal ?? existing.features.patientPortal,
          clinicianPortal: request.features.clinicianPortal ?? existing.features.clinicianPortal,
          expertPortal: request.features.expertPortal ?? existing.features.expertPortal,
          chatbot: request.features.chatbot ?? existing.features.chatbot,
        };
      }
      if (request.ehrIntegration) {
        updateData.ehrIntegration = request.ehrIntegration;
      }

      await this.getFirestore()
        .collection('config')
        .doc(tenantId)
        .update(updateData);

      this.logger.log(`Updated tenant: ${tenantId}`);

      // Get and return updated tenant
      const updated = await this.getTenant(tenantId);
      return updated!;
    } catch (error) {
      this.logger.error(`Error updating tenant ${tenantId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Delete a tenant (and all associated data)
   */
  async deleteTenant(tenantId: string): Promise<void> {
    try {
      const existing = await this.getTenant(tenantId);
      if (!existing) {
        throw new NotFoundException(`Tenant ${tenantId} not found`);
      }

      // Delete GCP infrastructure first
      this.logger.log(`Deleting GCP infrastructure for tenant: ${tenantId}`);
      try {
        const infrastructureResult = await this.gcpInfrastructure.deleteAll(tenantId);

        if (!infrastructureResult.success) {
          const allErrors = [
            ...infrastructureResult.buckets.errors,
            ...infrastructureResult.fhir.errors,
          ];
          this.logger.warn(
            `Infrastructure deletion completed with errors for tenant ${tenantId}: ${allErrors.join(', ')}`
          );
        } else {
          this.logger.log(`Successfully deleted infrastructure for tenant: ${tenantId}`);
        }
      } catch (error) {
        this.logger.error(`Error deleting infrastructure for tenant ${tenantId}: ${error.message}`);
        // Continue with Firestore deletion even if infrastructure deletion fails
      }

      // Delete tenant config
      await this.getFirestore()
        .collection('config')
        .doc(tenantId)
        .delete();

      // Delete all users for this tenant
      const usersSnapshot = await this.getFirestore()
        .collection('users')
        .where('tenantId', '==', tenantId)
        .get();

      const batch = this.getFirestore().batch();
      usersSnapshot.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();

      this.logger.log(`Deleted tenant: ${tenantId} and ${usersSnapshot.size} users`);
    } catch (error) {
      this.logger.error(`Error deleting tenant ${tenantId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create a tenant admin user
   */
  async createTenantAdmin(request: CreateTenantAdminRequest): Promise<any> {
    try {
      // Verify tenant exists
      const tenant = await this.getTenant(request.tenantId);
      if (!tenant) {
        throw new NotFoundException(`Tenant ${request.tenantId} not found`);
      }

      // Hash password
      const passwordHash = await this.authService.hashPassword(request.password);

      // Create user with tenant_admin role
      const user = await this.userService.create({
        tenantId: request.tenantId,
        username: request.username,
        passwordHash,
        name: request.name,
        role: 'tenant_admin',
        isActive: true,
        isLocked: false,
        failedLoginAttempts: 0,
        createdBy: 'system_admin',
      });

      this.logger.log(`Created tenant admin: ${user.username} for tenant: ${request.tenantId}`);

      return {
        id: user.id,
        tenantId: user.tenantId,
        username: user.username,
        name: user.name,
        role: user.role,
      };
    } catch (error) {
      this.logger.error(`Error creating tenant admin: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get metrics for a specific tenant
   */
  async getTenantMetrics(tenantId: string): Promise<TenantMetrics> {
    try {
      const tenant = await this.getTenant(tenantId);
      if (!tenant) {
        throw new NotFoundException(`Tenant ${tenantId} not found`);
      }

      // Get discharge summaries count by status
      const summariesSnapshot = await this.getFirestore()
        .collection('discharge_summaries')
        .where('tenantId', '==', tenantId)
        .get();

      const statusCounts = {
        raw_only: 0,
        simplified: 0,
        translated: 0,
        processing: 0,
        error: 0,
      };

      summariesSnapshot.forEach(doc => {
        const status = doc.data().status;
        if (status in statusCounts) {
          statusCounts[status as keyof typeof statusCounts]++;
        }
      });

      // Calculate quality metrics aggregations
      const qualityMetricsData = {
        totalWithMetrics: 0,
        fleschKincaidSum: 0,
        readingEaseSum: 0,
        smogSum: 0,
        gradeDistribution: {
          elementary: 0,      // FK ≤ 5
          middleSchool: 0,     // FK 6-8
          highSchool: 0,       // FK 9-12
          college: 0,          // FK > 12
        },
        targetCompliance: {
          meetsTarget: 0,
          needsReview: 0,
        },
      };

      // Extract composition IDs from discharge summaries
      const compositionIds: string[] = [];
      summariesSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.id) {
          compositionIds.push(data.id);
        }
      });

      // Fetch quality metrics from separate collection
      if (compositionIds.length > 0) {
        const qualityMetricsMap = await this.qualityMetricsService.getBatchMetrics(compositionIds);

        // Aggregate the metrics
        qualityMetricsMap.forEach((qualityMetrics, compositionId) => {
          if (qualityMetrics) {
            qualityMetricsData.totalWithMetrics++;

            // Sum for averages
            const fk = qualityMetrics.fleschKincaidGradeLevel;
            const re = qualityMetrics.fleschReadingEase;
            const smog = qualityMetrics.smogIndex;

            if (typeof fk === 'number') qualityMetricsData.fleschKincaidSum += fk;
            if (typeof re === 'number') qualityMetricsData.readingEaseSum += re;
            if (typeof smog === 'number') qualityMetricsData.smogSum += smog;

            // Grade distribution buckets
            if (typeof fk === 'number') {
              if (fk <= 5) {
                qualityMetricsData.gradeDistribution.elementary++;
              } else if (fk <= 8) {
                qualityMetricsData.gradeDistribution.middleSchool++;
              } else if (fk <= 12) {
                qualityMetricsData.gradeDistribution.highSchool++;
              } else {
                qualityMetricsData.gradeDistribution.college++;
              }
            }

            // Target compliance: FK ≤ 9, Reading Ease ≥ 60, SMOG ≤ 9, avg sentence ≤ 20
            const avgSentence = qualityMetrics.avgSentenceLength;
            const meetsTarget =
              fk <= 9 &&
              re >= 60 &&
              smog <= 9 &&
              (!avgSentence || avgSentence <= 20);

            if (meetsTarget) {
              qualityMetricsData.targetCompliance.meetsTarget++;
            } else {
              qualityMetricsData.targetCompliance.needsReview++;
            }
          }
        });
      }

      // Get users count by role
      const usersSnapshot = await this.getFirestore()
        .collection('users')
        .where('tenantId', '==', tenantId)
        .get();

      const roleCounts = {
        patient: 0,
        clinician: 0,
        expert: 0,
        tenant_admin: 0,
      };

      usersSnapshot.forEach(doc => {
        const role = doc.data().role;
        if (role in roleCounts) {
          roleCounts[role as keyof typeof roleCounts]++;
        }
      });

      // Get expert feedback stats (filtered by tenantId)
      const feedbackSnapshot = await this.getFirestore()
        .collection('expert_feedback')
        .where('tenantId', '==', tenantId)
        .get();

      let totalFeedback = 0;
      let totalRating = 0;

      feedbackSnapshot.forEach(doc => {
        const data = doc.data();
        totalFeedback++;
        if (data.overallRating) {
          totalRating += data.overallRating;
        }
      });

      return {
        tenantId,
        tenantName: tenant.name,
        dischargeSummaries: {
          total: summariesSnapshot.size,
          byStatus: statusCounts,
        },
        users: {
          total: usersSnapshot.size,
          byRole: roleCounts,
        },
        expertFeedback: {
          total: totalFeedback,
          averageRating: totalFeedback > 0 ? totalRating / totalFeedback : 0,
        },
        qualityMetrics: qualityMetricsData.totalWithMetrics > 0 ? {
          totalWithMetrics: qualityMetricsData.totalWithMetrics,
          averageFleschKincaid: qualityMetricsData.fleschKincaidSum / qualityMetricsData.totalWithMetrics,
          averageReadingEase: qualityMetricsData.readingEaseSum / qualityMetricsData.totalWithMetrics,
          averageSmog: qualityMetricsData.smogSum / qualityMetricsData.totalWithMetrics,
          gradeDistribution: qualityMetricsData.gradeDistribution,
          targetCompliance: qualityMetricsData.targetCompliance,
        } : undefined,
      };
    } catch (error) {
      this.logger.error(`Error getting metrics for tenant ${tenantId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get aggregated metrics across all tenants
   */
  async getAggregatedMetrics(): Promise<AggregatedMetrics> {
    try {
      const tenants = await this.getAllTenants();
      const tenantMetricsPromises = tenants.map(tenant => this.getTenantMetrics(tenant.id));
      const tenantMetrics = await Promise.all(tenantMetricsPromises);

      const aggregated: AggregatedMetrics = {
        totalTenants: tenants.length,
        totalDischargeSummaries: 0,
        totalUsers: 0,
        totalExpertFeedback: 0,
        averageFeedbackRating: 0,
        tenantMetrics,
      };

      let totalRatingSum = 0;
      let totalFeedbackCount = 0;

      tenantMetrics.forEach(metrics => {
        aggregated.totalDischargeSummaries += metrics.dischargeSummaries.total;
        aggregated.totalUsers += metrics.users.total;
        aggregated.totalExpertFeedback += metrics.expertFeedback.total;
        totalRatingSum += metrics.expertFeedback.averageRating * metrics.expertFeedback.total;
        totalFeedbackCount += metrics.expertFeedback.total;
      });

      aggregated.averageFeedbackRating = totalFeedbackCount > 0 ? totalRatingSum / totalFeedbackCount : 0;

      return aggregated;
    } catch (error) {
      this.logger.error(`Error getting aggregated metrics: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check infrastructure status for a tenant
   */
  async checkInfrastructure(tenantId: string): Promise<any> {
    try {
      const tenant = await this.getTenant(tenantId);
      if (!tenant) {
        throw new NotFoundException(`Tenant ${tenantId} not found`);
      }

      const status = await this.gcpInfrastructure.checkInfrastructureStatus(tenantId);

      // Update Firestore with current status
      await this.getFirestore()
        .collection('config')
        .doc(tenantId)
        .update({
          infrastructure: {
            buckets: status.buckets,
            fhir: status.fhir,
            lastChecked: new Date(),
          },
          updatedAt: new Date(),
        });

      this.logger.log(`Checked infrastructure for tenant: ${tenantId}`);

      return {
        tenantId,
        status,
        allReady: Object.values(status.buckets).every(v => v) && Object.values(status.fhir).every(v => v),
      };
    } catch (error) {
      this.logger.error(`Error checking infrastructure for tenant ${tenantId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Provision or repair infrastructure for an existing tenant
   */
  async provisionInfrastructure(tenantId: string): Promise<any> {
    try {
      const tenant = await this.getTenant(tenantId);
      if (!tenant) {
        throw new NotFoundException(`Tenant ${tenantId} not found`);
      }

      this.logger.log(`Provisioning/repairing infrastructure for tenant: ${tenantId}`);

      const result = await this.gcpInfrastructure.provisionAll(tenantId);
      const status = await this.gcpInfrastructure.checkInfrastructureStatus(tenantId);

      // Update Firestore with current status
      await this.getFirestore()
        .collection('config')
        .doc(tenantId)
        .update({
          infrastructure: {
            buckets: status.buckets,
            fhir: status.fhir,
            lastChecked: new Date(),
          },
          updatedAt: new Date(),
        });

      this.logger.log(`Infrastructure provisioning completed for tenant: ${tenantId}`);

      return {
        tenantId,
        success: result.success,
        created: {
          buckets: result.buckets.created,
          fhir: result.fhir.created,
        },
        errors: {
          buckets: result.buckets.errors,
          fhir: result.fhir.errors,
        },
        status,
      };
    } catch (error) {
      this.logger.error(`Error provisioning infrastructure for tenant ${tenantId}: ${error.message}`);
      throw error;
    }
  }
}
