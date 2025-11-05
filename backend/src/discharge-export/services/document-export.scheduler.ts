import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DischargeExportService } from './discharge-export.service';
import { GoogleService } from '../../google/google.service';
import { CernerService } from '../../cerner/cerner.service';
import { DevConfigService } from '../../config/dev-config.service';
import { SessionService } from '../../cerner-auth/session.service';
import { TenantContext } from '../../tenant/tenant-context';
import { AuthType } from '../../cerner-auth/types/auth.types';
import { PubSubService } from '../../pubsub/pubsub.service';
import { DocumentExportEvent } from '../types/discharge-export.types';

@Injectable()
export class DocumentExportScheduler {
  private readonly logger = new Logger(DocumentExportScheduler.name);

  constructor(
    private readonly dischargeExportService: DischargeExportService,
    private readonly googleService: GoogleService,
    private readonly cernerService: CernerService,
    private readonly configService: DevConfigService,
    private readonly sessionService: SessionService,
    private readonly pubSubService: PubSubService,
  ) {
    this.logger.log(`⏰ DocumentExportScheduler initializing with NODE_ENV: ${process.env.NODE_ENV || 'undefined'}`);
  }

  /**
   * Cron job that runs every 10 minutes to check for new DocumentReference records
   * and trigger export for Consultation Note Generic documents
   */
  // @Cron(CronExpression.EVERY_10_MINUTES)
  // async handleDocumentExportCron() {
  //   this.logger.log(`🔄 Cron job running with NODE_ENV: ${process.env.NODE_ENV || 'undefined'}`);
  //   this.logger.log('🕐 Starting scheduled document export check...');
    
  //   try {
  //     // Get all tenants from config.yaml
  //     const tenantIds = this.configService.getAllTenantIds();
  //     this.logger.log(`🏥 Found ${tenantIds.length} tenants to process: ${tenantIds.join(', ')}`);
      
  //     // Process each tenant
  //     for (const tenantId of tenantIds) {
  //       await this.processTenantDocuments(tenantId);
  //     }
      
  //     this.logger.log('✅ Scheduled document export check completed for all tenants');
  //   } catch (error) {
  //     this.logger.error('💥 Error in scheduled document export check:', error);
  //   }
  // }

  /**
   * Process documents for a specific tenant
   */
  private async processTenantDocuments(tenantId: string) {
    this.logger.log(`🏥 Processing documents for tenant: ${tenantId}`);
    
    try {
      // Get all active provider app sessions for this tenant
      const userSessions = this.sessionService.getActiveSessions(tenantId, AuthType.PROVIDER);
      
      if (userSessions.length > 0) {
        // Process with user sessions (provider app)
        this.logger.log(`👥 Found ${userSessions.length} active user sessions, processing with provider app`);
        for (const session of userSessions) {
          await this.processDocumentsForUser(tenantId, session);
        }
      } else {
        // Fallback to system app
        this.logger.log(`🔧 No active user sessions, falling back to system app`);
        await this.processDocumentsForSystem(tenantId);
      }

    } catch (error) {
      this.logger.error(`💥 Error processing documents for tenant ${tenantId}:`, error);
    }
  }

  /**
   * Process documents using system app authentication
   */
  private async processDocumentsForSystem(tenantId: string) {
    const ctx: TenantContext = {
      tenantId,
      timestamp: new Date(),
      requestId: `scheduler-system-${Date.now()}`,
    };

    // Get the list of patients to process for this tenant
    const patients = await this.configService.getTenantCernerPatients(tenantId);
    
    if (patients.length === 0) {
      this.logger.log(`📭 No patients configured for tenant ${tenantId}, skipping document processing`);
      return;
    }

    this.logger.log(`👥 Processing documents for ${patients.length} patients in tenant ${tenantId}: ${patients.join(', ')}`);

    // Process each patient
    for (const patientId of patients) {
      await this.processPatientDocuments(patientId, ctx, AuthType.SYSTEM);
    }
  }

  /**
   * Process documents for a specific patient
   */
  private async processPatientDocuments(patientId: string, ctx: TenantContext, authType: AuthType) {
    this.logger.log(`🏥 Processing documents for patient: ${patientId} in tenant: ${ctx.tenantId} (${authType})`);

    try {
      // Calculate 30 minutes ago for filtering recent documents
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      
      // Search for DocumentReference records in Cerner for this specific patient
      const searchResult = await this.cernerService.searchResource('DocumentReference', {
        'type': 'https://fhir.cerner.com/ec2458f2-1e24-41c8-b71b-0e701af7583d/codeSet/72|2820510',
        // '_lastUpdated': `ge${thirtyMinutesAgo}`,
        '_count': 5, // Limit to 5 records per patient for testing
        '_sort': '-_lastUpdated',
        'patient': patientId,
      }, ctx, authType);

      this.logger.log(`🔍 Search result for patient ${patientId} (${authType}):`, {
        total: searchResult?.total || 0,
        entries: searchResult?.entry?.length || 0,
      });

      if (!searchResult || !searchResult.entry || searchResult.entry.length === 0) {
        this.logger.log(`📭 No new Consultation Note Generic documents found for patient ${patientId} in tenant ${ctx.tenantId} (${authType})`);
        return;
      }

      this.logger.log(`📄 Found ${searchResult.entry.length} new Consultation Note Generic documents for patient ${patientId} in tenant ${ctx.tenantId} (${authType})`);

      // Process each document
      for (const entry of searchResult.entry) {
        const documentReference = entry.resource;
        if (documentReference && documentReference.resourceType === 'DocumentReference') {
          await this.processDocumentReference(documentReference, ctx);
        }
      }
    } catch (error) {
      this.logger.error(`💥 Error processing documents for patient ${patientId} in tenant ${ctx.tenantId}:`, error);
    }
  }

  /**
   * Process documents using provider app authentication (user sessions)
   */
  private async processDocumentsForUser(tenantId: string, session: any) {
    const ctx: TenantContext = {
      tenantId,
      userId: session.userId,
      timestamp: new Date(),
      requestId: `scheduler-user-${Date.now()}`,
    };

    this.logger.log(`👤 Processing documents for user: ${session.userId} in tenant: ${tenantId}`);

    // Get the list of patients to process for this tenant
    const patients = await this.configService.getTenantCernerPatients(tenantId);
    
    if (patients.length === 0) {
      this.logger.log(`📭 No patients configured for tenant ${tenantId}, skipping document processing for user ${session.userId}`);
      return;
    }

    this.logger.log(`👥 Processing documents for ${patients.length} patients in tenant ${tenantId} for user ${session.userId}: ${patients.join(', ')}`);

    // Process each patient
    for (const patientId of patients) {
      await this.processPatientDocuments(patientId, ctx, AuthType.PROVIDER);
    }
  }

  /**
   * Process a single DocumentReference and trigger export
   */
  private async processDocumentReference(documentReference: any, ctx: TenantContext) {
    const documentId = documentReference.id;
    
    try {
      this.logger.log(`🔄 Processing DocumentReference: ${documentId} for tenant: ${ctx.tenantId}`);

      // Verify this is a Consultation Note Generic document
      if (!this.isConsultationNoteGeneric(documentReference)) {
        this.logger.log(`⏭️ Skipping DocumentReference ${documentId} - not a Consultation Note Generic`);
        return;
      }

      // Check if this document has already been processed
      if (await this.isDocumentAlreadyProcessed(documentId, ctx)) {
        this.logger.log(`⏭️ Skipping DocumentReference ${documentId} - already processed`);
        return;
      }

      // Trigger the export
      this.logger.log(`🚀 Triggering export for DocumentReference: ${documentId}`);
      const result = await this.dischargeExportService.exportDischargeSummary(
        ctx,
        documentId,
      );

      if (result.success) {
        this.logger.log(`✅ Successfully exported DocumentReference: ${documentId}`);
        // Mark as processed (you might want to store this in a database)
        await this.markDocumentAsProcessed(documentId, ctx);
        
        // Publish success event to Pub/Sub
        // await this.publishDocumentExportEvent(documentId, ctx, result, 'success');
      } else {
        this.logger.error(`❌ Failed to export DocumentReference: ${documentId} - ${result.error}`);
        
        // Publish failure event to Pub/Sub
        // await this.publishDocumentExportEvent(documentId, ctx, result, 'failed');
      }

    } catch (error) {
      this.logger.error(`💥 Error processing DocumentReference ${documentId}:`, error);
    }
  }

  /**
   * Check if the DocumentReference is a Consultation Note Generic
   */
  private isConsultationNoteGeneric(documentReference: any): boolean {
    const type = documentReference.type;
    if (!type || !type.coding || !Array.isArray(type.coding)) {
      return false;
    }

    return type.coding.some((coding: any) => 
      coding.system === 'https://fhir.cerner.com/ec2458f2-1e24-41c8-b71b-0e701af7583d/codeSet/72' &&
      coding.code === '2820510'
    );
  }

  /**
   * Check if document has already been processed
   * This checks Google FHIR for existing exports of this Cerner document
   */
  private async isDocumentAlreadyProcessed(documentId: string, ctx: TenantContext): Promise<boolean> {
    try {
      // Search for existing export records in Google FHIR with this Cerner document ID
      const searchResult = await this.googleService.fhirSearch('DocumentReference', {
        '_tag': `original-cerner-id-${documentId}`,
        '_count': 1,
      }, ctx);

      return searchResult && searchResult.total > 0;
    } catch (error) {
      this.logger.error(`Error checking if document ${documentId} is already processed:`, error);
      return false; // If we can't check, assume it's not processed
    }
  }

  /**
   * Mark document as processed
   * This is a placeholder - you might want to store this in a database
   */
  private async markDocumentAsProcessed(documentId: string, ctx: TenantContext): Promise<void> {
    // For now, we'll rely on the duplicate check in the export service
    // In a production environment, you might want to store this in a database
    this.logger.log(`📝 Marking DocumentReference ${documentId} as processed for tenant ${ctx.tenantId}`);
  }

  /**
   * Manual trigger for testing purposes
   */
  async triggerManualCheck(tenantId?: string) {
    this.logger.log('🔧 Manual document export check triggered');
    
    try {
      if (tenantId) {
        await this.processTenantDocuments(tenantId);
      } else {
        // Process all tenants from config
        const tenantIds = this.configService.getAllTenantIds();
        this.logger.log(`🏥 Processing all ${tenantIds.length} tenants: ${tenantIds.join(', ')}`);
        
        for (const id of tenantIds) {
          await this.processTenantDocuments(id);
        }
      }
      
      this.logger.log('✅ Manual document export check completed');
    } catch (error) {
      this.logger.error('💥 Error in manual document export check:', error);
    }
  }

  /**
   * Publish document export event to Pub/Sub
   */
  private async publishDocumentExportEvent(
    documentId: string,
    ctx: TenantContext,
    result: any,
    status: 'success' | 'failed'
  ): Promise<void> {
    try {
      const event: DocumentExportEvent = {
        documentReferenceId: documentId,
        tenantId: ctx.tenantId,
        patientId: result.cernerPatientId,
        exportTimestamp: new Date().toISOString(),
        status,
        error: status === 'failed' ? result.error : undefined,
        metadata: status === 'success' ? {
          googleBinaryId: result.googleBinaryId,
          googleDocumentReferenceId: result.googleDocumentReferenceId,
          googleCompositionId: result.googleCompositionId,
          originalSize: result.metadata?.originalSize,
          contentType: result.metadata?.contentType,
        } : undefined,
      };

      await this.pubSubService.publishDocumentExportEvent(event);
    } catch (error) {
      this.logger.error(`Failed to publish Pub/Sub event for document ${documentId}: ${error.message}`);
      // Don't throw error to avoid breaking the export process
    }
  }
}
