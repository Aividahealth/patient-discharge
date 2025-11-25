import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DischargeSummariesExportService } from './discharge-summaries-export.service';
import { DevConfigService } from '../../config/dev-config.service';
import { SessionService } from '../../cerner-auth/session.service';
import { TenantContext } from '../../tenant/tenant-context';
import { AuthType } from '../../cerner-auth/types/auth.types';
import { PubSubService } from '../../pubsub/pubsub.service';
import { EHRServiceFactory } from '../../ehr/factories/ehr-service.factory';

@Injectable()
export class EncounterExportScheduler {
  private readonly logger = new Logger(EncounterExportScheduler.name);

  constructor(
    private readonly dischargeSummariesExportService: DischargeSummariesExportService,
    private readonly configService: DevConfigService,
    private readonly sessionService: SessionService,
    private readonly pubSubService: PubSubService,
    private readonly ehrFactory: EHRServiceFactory,
  ) {
    this.logger.log(`⏰ EncounterExportScheduler initializing with NODE_ENV: ${process.env.NODE_ENV || 'undefined'}`);
  }

  /**
   * Cron job that runs every 15 minutes to check for new encounters and export complete data
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async handleEncounterExportCron() {
    this.logger.log(`🔄 Encounter export cron job running with NODE_ENV: ${process.env.NODE_ENV || 'undefined'}`);
    this.logger.log('🕐 Starting scheduled encounter data export check...');
    
    try {
      // Get all tenants from YAML config and Firestore
      const tenantIds = await this.configService.getAllTenantIds();
      this.logger.log(`🏥 Found ${tenantIds.length} tenants to process: ${tenantIds.join(', ')}`);

      for (const tenantId of tenantIds) {
        try {
          await this.processTenantEncounters(tenantId);
        } catch (error) {
          this.logger.error(`❌ Error processing tenant ${tenantId} in scheduler loop: ${error.message}`);
          // Continue with next tenant instead of breaking
        }
      }

      this.logger.log(`✅ Encounter export cron job completed successfully (processed ${tenantIds.length} tenants)`);
    } catch (error) {
      this.logger.error(`❌ Error in encounter export cron job: ${error.message}`);
    }
  }

  /**
   * Process encounters for a specific tenant
   */
  private async processTenantEncounters(tenantId: string): Promise<void> {
    try {
      this.logger.log(`🏥 Processing encounters for tenant: ${tenantId}`);

      // Check if tenant has EHR integration configured (skip Manual tenants)
      try {
        const ehrVendor = await this.configService.getTenantEHRVendor(tenantId);
        if (!ehrVendor) {
          this.logger.log(`⏭️  Skipping tenant ${tenantId} - no EHR integration configured (Manual tenant)`);
          return;
        }
        this.logger.log(`✅ Tenant ${tenantId} has EHR integration: ${ehrVendor}`);
      } catch (error) {
        // If we can't determine EHR vendor, try to proceed (might be a config issue)
        this.logger.warn(`⚠️  Could not determine EHR vendor for tenant ${tenantId}: ${error.message}`);
      }

      // Check for active provider app sessions
      const activeSessions = this.sessionService.getActiveSessions(tenantId, AuthType.PROVIDER);
      
      if (activeSessions.length > 0) {
        this.logger.log(`👤 Found ${activeSessions.length} active provider sessions, using provider app authentication`);
        await this.processEncountersForProvider(tenantId, activeSessions);
      } else {
        this.logger.log(`🔧 No active provider sessions, using system app authentication`);
        await this.processEncountersForSystem(tenantId);
      }

    } catch (error) {
      this.logger.error(`❌ Error processing tenant ${tenantId}: ${error.message}`);
    }
  }

  /**
   * Process encounters using system app authentication
   */
  private async processEncountersForSystem(tenantId: string): Promise<void> {
    try {
      const ctx: TenantContext = {
        tenantId,
        timestamp: new Date(),
      };

      // Discover patients automatically from EHR (hybrid approach)
      let patients: string[] = [];
      try {
        this.logger.log(`🔍 Attempting to discover patients for tenant ${tenantId}...`);
        const ehrService = await this.ehrFactory.getEHRService(ctx);
        this.logger.log(`✅ EHR service obtained for tenant ${tenantId}, starting patient discovery...`);
        patients = await ehrService.discoverPatients(ctx);
        this.logger.log(`👥 Discovered ${patients.length} patients for tenant ${tenantId}`);
      } catch (error) {
        this.logger.error(`❌ Error discovering patients for tenant ${tenantId}: ${error.message}`);
        this.logger.error(`   Error stack: ${error.stack}`);
        // Fallback to manual list if discovery fails
        this.logger.log(`🔄 Falling back to manual patient list for tenant ${tenantId}`);
        try {
          patients = await this.configService.getTenantCernerPatients(tenantId);
          this.logger.log(`📝 Retrieved ${patients.length} patients from manual list for tenant ${tenantId}`);
        } catch (fallbackError) {
          this.logger.error(`❌ Failed to get manual patient list for tenant ${tenantId}: ${fallbackError.message}`);
          patients = [];
        }
      }

      if (patients.length === 0) {
        this.logger.log(`📭 No patients found for tenant ${tenantId}, skipping encounter processing`);
        return;
      }

      for (const patientId of patients) {
        await this.processPatientEncounters(tenantId, patientId, ctx);
      }

    } catch (error) {
      this.logger.error(`❌ Error processing encounters for system app: ${error.message}`);
    }
  }

  /**
   * Process encounters using provider app authentication
   */
  private async processEncountersForProvider(tenantId: string, activeSessions: any[]): Promise<void> {
    try {
      // Use the first active session for this tenant
      const session = activeSessions[0];
      const ctx: TenantContext = {
        tenantId,
        userId: session.userId,
        timestamp: new Date(),
      };

      // Discover patients automatically from EHR (hybrid approach)
      let patients: string[] = [];
      try {
        const ehrService = await this.ehrFactory.getEHRService(ctx);
        patients = await ehrService.discoverPatients(ctx);
        this.logger.log(`👥 Discovered ${patients.length} patients for tenant ${tenantId} with provider app`);
      } catch (error) {
        this.logger.error(`❌ Error discovering patients: ${error.message}`);
        // Fallback to manual list if discovery fails
        this.logger.log('🔄 Falling back to manual patient list');
        patients = await this.configService.getTenantCernerPatients(tenantId);
      }

      if (patients.length === 0) {
        this.logger.log(`📭 No patients found for tenant ${tenantId}, skipping encounter processing`);
        return;
      }

      for (const patientId of patients) {
        await this.processPatientEncounters(tenantId, patientId, ctx);
      }

    } catch (error) {
      this.logger.error(`❌ Error processing encounters for provider app: ${error.message}`);
    }
  }

  /**
   * Process encounters for a specific patient
   */
  private async processPatientEncounters(tenantId: string, patientId: string, ctx: TenantContext): Promise<void> {
    try {
      this.logger.log(`🔄 Processing encounters for patient ${patientId} in tenant ${tenantId}`);

      // Export encounter data for this patient
      const result = await this.dischargeSummariesExportService.exportEncounterData(ctx, patientId);

      if (result.success) {
        this.logger.log(`✅ Successfully exported encounter data for patient ${patientId}: ${result.metadata?.resourcesProcessed || 0} resources processed`);
        // Note: Events are published by the service itself, no need to publish here
      } else {
        this.logger.warn(`⚠️ Failed to export encounter data for patient ${patientId}: ${result.error}`);
        // Note: Events are published by the service itself, no need to publish here
      }

    } catch (error) {
      this.logger.error(`❌ Error processing encounters for patient ${patientId}: ${error.message}`);
      // Note: Events are published by the service itself, no need to publish here
    }
  }

  /**
   * Manual trigger for encounter export
   */
  async triggerManualEncounterCheck(tenantId?: string): Promise<void> {
    this.logger.log(`🔧 Manual encounter export trigger${tenantId ? ` for tenant: ${tenantId}` : ' for all tenants'}`);

    try {
      if (tenantId) {
        await this.processTenantEncounters(tenantId);
      } else {
        // Process all tenants
        const tenantIds = await this.configService.getAllTenantIds();
        for (const tid of tenantIds) {
          await this.processTenantEncounters(tid);
        }
      }

      this.logger.log('✅ Manual encounter export completed successfully');
    } catch (error) {
      this.logger.error(`❌ Error in manual encounter export: ${error.message}`);
      throw error;
    }
  }

}
