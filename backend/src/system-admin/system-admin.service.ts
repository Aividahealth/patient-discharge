import { Injectable, Logger, ConflictException, NotFoundException } from '@nestjs/common';
import { Firestore } from '@google-cloud/firestore';
import { DevConfigService } from '../config/dev-config.service';
import { AuthService } from '../auth/auth.service';
import { UserService } from '../auth/user.service';
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
      const tenantData = {
        name: request.name,
        branding: request.branding,
        features: request.features || {
          patientPortal: true,
          clinicianPortal: true,
          expertPortal: true,
          chatbot: true,
        },
        createdAt: now,
        updatedAt: now,
      };

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

      // Create user with admin role
      const user = await this.userService.create({
        tenantId: request.tenantId,
        username: request.username,
        passwordHash,
        name: request.name,
        role: 'admin',
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

      // Get users count by role
      const usersSnapshot = await this.getFirestore()
        .collection('users')
        .where('tenantId', '==', tenantId)
        .get();

      const roleCounts = {
        patient: 0,
        clinician: 0,
        expert: 0,
        admin: 0,
      };

      usersSnapshot.forEach(doc => {
        const role = doc.data().role;
        if (role in roleCounts) {
          roleCounts[role as keyof typeof roleCounts]++;
        }
      });

      // Get expert feedback stats
      const feedbackSnapshot = await this.getFirestore()
        .collection('expert_feedback')
        .get();

      let totalFeedback = 0;
      let totalRating = 0;

      // Filter feedback by tenantId from related discharge summaries
      const summaryIds = summariesSnapshot.docs.map(doc => doc.id);
      feedbackSnapshot.forEach(doc => {
        const data = doc.data();
        if (summaryIds.includes(data.dischargeSummaryId)) {
          totalFeedback++;
          if (data.rating) {
            totalRating += data.rating;
          }
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
}
