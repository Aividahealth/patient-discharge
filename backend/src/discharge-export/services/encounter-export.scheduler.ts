import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DischargeSummariesExportService } from './discharge-summaries-export.service';
import { DevConfigService } from '../../config/dev-config.service';
import { SessionService } from '../../auth/session.service';
import { TenantContext } from '../../tenant/tenant-context';
import { AuthType } from '../../auth/types/auth.types';
import { PubSubService } from '../../pubsub/pubsub.service';

@Injectable()
export class EncounterExportScheduler {
  private readonly logger = new Logger(EncounterExportScheduler.name);

  constructor(
    private readonly dischargeSummariesExportService: DischargeSummariesExportService,
    private readonly configService: DevConfigService,
    private readonly sessionService: SessionService,
    private readonly pubSubService: PubSubService,
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
      // Get all tenants from config.yaml
      const tenantIds = this.configService.getAllTenantIds();
      this.logger.log(`🏥 Found ${tenantIds.length} tenants to process: ${tenantIds.join(', ')}`);

      for (const tenantId of tenantIds) {
        await this.processTenantEncounters(tenantId);
      }

      this.logger.log('✅ Encounter export cron job completed successfully');
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

      // Get patient list from config
      const patients = this.configService.getTenantCernerPatients(tenantId);
      this.logger.log(`👥 Processing ${patients.length} patients for tenant ${tenantId}`);

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
      // Get patient list from config
      const patients = this.configService.getTenantCernerPatients(tenantId);
      this.logger.log(`👥 Processing ${patients.length} patients for tenant ${tenantId} with provider app`);

      for (const patientId of patients) {
        // Use the first active session for this tenant
        const session = activeSessions[0];
        const ctx: TenantContext = {
          tenantId,
          userId: session.userId,
          timestamp: new Date(),
        };

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
        const tenantIds = this.configService.getAllTenantIds();
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
