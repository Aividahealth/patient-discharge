import { PubSub } from '@google-cloud/pubsub';
import { createLogger } from './common/utils/logger';
import { SimplifiedFile } from './storage.service';

const logger = createLogger('PubSubPublisherService');

export interface SimplificationCompletedMessage {
  tenantId: string;
  compositionId: string;
  simplifiedFiles: SimplifiedFile[];
  processingTimeMs: number;
  tokensUsed: number;
  timestamp: string;
  patientId?: string;
  preferredLanguage?: string;
}

/**
 * Service for publishing Pub/Sub messages
 */
export class PubSubPublisherService {
  private pubsub: PubSub;
  private topicName: string = 'discharge-simplification-completed';

  constructor() {
    this.pubsub = new PubSub();
    logger.info('PubSubPublisherService initialized', { topicName: this.topicName });
  }

  /**
   * Publish message to discharge-simplification-completed topic
   * This triggers the Translation service
   */
  async publishSimplificationCompleted(message: SimplificationCompletedMessage): Promise<string> {
    logger.info('Publishing simplification completed message', {
      tenantId: message.tenantId,
      compositionId: message.compositionId,
      topic: this.topicName,
      filesCount: message.simplifiedFiles.length,
    });

    try {
      const topic = this.pubsub.topic(this.topicName);
      const messageData = JSON.stringify(message);
      const messageBuffer = Buffer.from(messageData);

      const messageId = await topic.publishMessage({
        data: messageBuffer,
        attributes: {
          tenantId: message.tenantId,
          compositionId: message.compositionId,
        },
      });

      logger.info('Successfully published simplification completed message', {
        tenantId: message.tenantId,
        compositionId: message.compositionId,
        messageId,
      });

      return messageId;
    } catch (error) {
      logger.error('Failed to publish simplification completed message', error as Error, {
        tenantId: message.tenantId,
        compositionId: message.compositionId,
      });
      throw error;
    }
  }

  /**
   * Verify that the topic exists
   */
  async verifyTopic(): Promise<boolean> {
    try {
      const topic = this.pubsub.topic(this.topicName);
      const [exists] = await topic.exists();

      if (!exists) {
        logger.warning('Pub/Sub topic does not exist', { topicName: this.topicName });
      }

      return exists;
    } catch (error) {
      logger.error('Failed to verify topic existence', error as Error, { topicName: this.topicName });
      return false;
    }
  }
}
