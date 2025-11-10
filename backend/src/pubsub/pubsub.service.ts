import { Injectable, Logger } from '@nestjs/common';
import { PubSub } from '@google-cloud/pubsub';
import { DevConfigService } from '../config/dev-config.service';

export interface DocumentExportEvent {
  documentReferenceId: string;
  tenantId: string;
  patientId?: string;
  exportTimestamp: string;
  status: 'success' | 'failed';
  error?: string;
  metadata?: {
    googleBinaryId?: string;
    googleDocumentReferenceId?: string;
    googleCompositionId?: string;
    originalSize?: number;
    contentType?: string;
  };
}

// New, richer event for Encounter exports (V2)
export interface EncounterExportEvent {
  tenantId: string;
  patientId: string;
  exportTimestamp: string;
  status: 'success' | 'failed';
  error?: string;

  cernerEncounterId: string;
  googleEncounterId?: string;
  compositionId?: string; // Google FHIR Composition ID

  cernerDocumentReferenceIds?: string[];
  googleDocumentReferenceIds?: string[];

  cernerMedicationRequestIds?: string[];
  googleMedicationRequestIds?: string[];

  cernerAppointmentIds?: string[];
  googleAppointmentIds?: string[];

  cernerBinaryIds?: string[];
  googleBinaryIds?: string[];

  // Aggregate metrics
  counts?: {
    documentReferences?: number;
    medicationRequests?: number;
    appointments?: number;
    binaries?: number;
    totalResources?: number;
  };
}

@Injectable()
export class PubSubService {
  private readonly logger = new Logger(PubSubService.name);
  private pubsub: PubSub;
  private topicName: string;

  constructor(private readonly configService: DevConfigService) {
    this.logger.log(`📡 PubSubService initializing with NODE_ENV: ${process.env.NODE_ENV || 'undefined'}`);
    // Initialize Pub/Sub client - will be configured per tenant
    const projectId = this.configService.getGcpProjectId();
    this.logger.log(`☁️ GCP Project ID: ${projectId}`);
    
    this.pubsub = new PubSub({
      projectId,
    });
    
    // Default topic name - will be overridden per tenant
    this.topicName = 'discharge-export-events';
    
    this.logger.log(`PubSubService initialized with project: ${projectId}`);
  }

  /**
   * Publish a document export event to Pub/Sub
   */
  async publishDocumentExportEvent(event: DocumentExportEvent): Promise<void> {
    try {
      // Get tenant-specific configuration
      const topicName = await this.configService.getTenantPubSubTopicName(event.tenantId);
      const serviceAccountPath = await this.configService.getTenantPubSubServiceAccountPath(event.tenantId);
      
      // Create tenant-specific Pub/Sub client if needed
      const pubsub = new PubSub({
        projectId: this.configService.getGcpProjectId(),
        keyFilename: serviceAccountPath,
      });
      
      const topic = pubsub.topic(topicName);
      
      // Ensure topic exists
      const [exists] = await topic.exists();
      if (!exists) {
        this.logger.warn(`Topic ${topicName} does not exist. Creating it...`);
        await topic.create();
        this.logger.log(`Created topic: ${topicName}`);
      }

      // Prepare message data
      const messageData = {
        eventType: 'document.exported',
        timestamp: new Date().toISOString(),
        data: event,
      };

      // Publish message
      const messageId = await topic.publishMessage({
        data: Buffer.from(JSON.stringify(messageData)),
        attributes: {
          eventType: 'document.exported',
          tenantId: event.tenantId,
          documentReferenceId: event.documentReferenceId,
          status: event.status,
        },
      });

      this.logger.log(`📤 Published document export event: ${event.documentReferenceId} to topic: ${topicName} (Message ID: ${messageId})`);
      
    } catch (error) {
      this.logger.error(`Failed to publish document export event for ${event.documentReferenceId}: ${error.message}`);
      // Don't throw error to avoid breaking the export process
    }
  }

  /**
   * Publish an encounter export event to Pub/Sub (V2)
   */
  async publishEncounterExportEvent(event: EncounterExportEvent): Promise<void> {
    try {
      const topicName = await this.configService.getTenantPubSubTopicName(event.tenantId);
      const serviceAccountPath = await this.configService.getTenantPubSubServiceAccountPath(event.tenantId);

      const pubsub = new PubSub({
        projectId: this.configService.getGcpProjectId(),
        keyFilename: serviceAccountPath,
      });

      const topic = pubsub.topic(topicName);
      const [exists] = await topic.exists();
      if (!exists) {
        this.logger.warn(`Topic ${topicName} does not exist. Creating it...`);
        await topic.create();
        this.logger.log(`Created topic: ${topicName}`);
      }

      const messageData = {
        eventType: 'encounter.exported',
        timestamp: new Date().toISOString(),
        data: event,
      };

      const messageId = await topic.publishMessage({
        data: Buffer.from(JSON.stringify(messageData)),
        attributes: {
          eventType: 'encounter.exported',
          tenantId: event.tenantId,
          patientId: event.patientId,
          cernerEncounterId: event.cernerEncounterId,
          status: event.status,
        },
      });

      this.logger.log(
        `📤 Published encounter export event: ${event.cernerEncounterId} to topic: ${topicName} (Message ID: ${messageId}) ${JSON.stringify(event)}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to publish encounter export event for ${event.cernerEncounterId}: ${error.message}`,
      );
    }
  }

  /**
   * Publish a batch of document export events
   */
  async publishBatchDocumentExportEvents(events: DocumentExportEvent[]): Promise<void> {
    if (events.length === 0) {
      return;
    }

    try {
      // Group events by tenant
      const eventsByTenant = events.reduce((acc, event) => {
        if (!acc[event.tenantId]) {
          acc[event.tenantId] = [];
        }
        acc[event.tenantId].push(event);
        return acc;
      }, {} as Record<string, DocumentExportEvent[]>);

      // Publish events for each tenant
      for (const [tenantId, tenantEvents] of Object.entries(eventsByTenant)) {
        await this.publishTenantBatchEvents(tenantId, tenantEvents);
      }
      
    } catch (error) {
      this.logger.error(`Failed to publish batch document export events: ${error.message}`);
      // Don't throw error to avoid breaking the export process
    }
  }

  /**
   * Publish batch events for a specific tenant
   */
  private async publishTenantBatchEvents(tenantId: string, events: DocumentExportEvent[]): Promise<void> {
    try {
      // Get tenant-specific configuration
      const topicName = await this.configService.getTenantPubSubTopicName(tenantId);
      const serviceAccountPath = await this.configService.getTenantPubSubServiceAccountPath(tenantId);
      
      // Create tenant-specific Pub/Sub client
      const pubsub = new PubSub({
        projectId: this.configService.getGcpProjectId(),
        keyFilename: serviceAccountPath,
      });
      
      const topic = pubsub.topic(topicName);
      
      // Ensure topic exists
      const [exists] = await topic.exists();
      if (!exists) {
        this.logger.warn(`Topic ${topicName} does not exist. Creating it...`);
        await topic.create();
        this.logger.log(`Created topic: ${topicName}`);
      }

      // Prepare batch messages
      const messages = events.map(event => ({
        data: Buffer.from(JSON.stringify({
          eventType: 'document.exported',
          timestamp: new Date().toISOString(),
          data: event,
        })),
        attributes: {
          eventType: 'document.exported',
          tenantId: event.tenantId,
          documentReferenceId: event.documentReferenceId,
          status: event.status,
        },
      }));

      // Publish batch
      const messageIds = await Promise.all(messages.map(message => topic.publishMessage(message)));
      
      this.logger.log(`📤 Published ${events.length} document export events to topic: ${topicName} (Message IDs: ${messageIds.join(', ')})`);
      
    } catch (error) {
      this.logger.error(`Failed to publish batch document export events for tenant ${tenantId}: ${error.message}`);
      // Don't throw error to avoid breaking the export process
    }
  }

  /**
   * Get topic information for a specific tenant
   */
  async getTopicInfo(tenantId: string): Promise<any> {
    try {
      const topicName = await this.configService.getTenantPubSubTopicName(tenantId);
      const serviceAccountPath = await this.configService.getTenantPubSubServiceAccountPath(tenantId);
      
      const pubsub = new PubSub({
        projectId: this.configService.getGcpProjectId(),
        keyFilename: serviceAccountPath,
      });
      
      const topic = pubsub.topic(topicName);
      const [exists] = await topic.exists();
      
      if (!exists) {
        return { 
          exists: false, 
          name: topicName,
          fullName: `projects/${this.configService.getGcpProjectId()}/topics/${topicName}`,
          tenantId
        };
      }

      const [metadata] = await topic.getMetadata();
      return {
        exists: true,
        name: topicName,
        fullName: `projects/${this.configService.getGcpProjectId()}/topics/${topicName}`,
        tenantId,
        metadata,
      };
    } catch (error) {
      this.logger.error(`Failed to get topic info for tenant ${tenantId}: ${error.message}`);
      const fallbackTopicName = await this.configService.getTenantPubSubTopicName(tenantId);
      return { 
        exists: false, 
        name: fallbackTopicName, 
        fullName: `projects/${this.configService.getGcpProjectId()}/topics/${fallbackTopicName}`,
        tenantId,
        error: error.message 
      };
    }
  }
}
