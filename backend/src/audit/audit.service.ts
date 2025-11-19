import { Injectable, Logger } from '@nestjs/common';
import { Firestore } from '@google-cloud/firestore';
import { DevConfigService } from '../config/dev-config.service';
import { resolveServiceAccountPath } from '../utils/path.helper';

// Base audit log interface
export interface BaseAuditLog {
  id?: string;
  timestamp: Date;
  tenantId: string;
  userId?: string;
  userName?: string;
  userRole?: string;
}

// Clinician activity audit log
export interface ClinicianActivityLog extends BaseAuditLog {
  type: 'clinician_activity';
  action: 'viewed' | 'edited' | 'published' | 'approved' | 'rejected';
  resourceType: 'discharge_summary' | 'patient_record';
  resourceId: string;
  patientId?: string;
  patientName?: string;
  metadata?: Record<string, any>;
}

// Simplification audit log
export interface SimplificationLog extends BaseAuditLog {
  type: 'simplification';
  action: 'started' | 'completed' | 'failed';
  dischargeSummaryId: string;
  patientId: string;
  patientName?: string;
  originalLength?: number;
  simplifiedLength?: number;
  processingTime?: number; // in milliseconds
  aiModel?: string;
  metadata?: Record<string, any>;
}

// Translation audit log
export interface TranslationLog extends BaseAuditLog {
  type: 'translation';
  action: 'started' | 'completed' | 'failed';
  dischargeSummaryId: string;
  patientId: string;
  patientName?: string;
  sourceLanguage: string;
  targetLanguage: string;
  originalLength?: number;
  translatedLength?: number;
  processingTime?: number; // in milliseconds
  aiModel?: string;
  metadata?: Record<string, any>;
}

// Chatbot audit log
export interface ChatbotLog extends BaseAuditLog {
  type: 'chatbot';
  action: 'message_sent' | 'response_received';
  patientId: string;
  patientName?: string;
  conversationId?: string;
  message: string;
  response?: string;
  processingTime?: number; // in milliseconds
  aiModel?: string;
  metadata?: Record<string, any>;
}

// Union type for all audit logs
export type AuditLog = ClinicianActivityLog | SimplificationLog | TranslationLog | ChatbotLog;

// Legacy interface for backward compatibility
export interface AuditLogEntry {
  timestamp?: string;
  userId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  endpoint: string;
  method: string;
  statusCode?: number;
  error?: string;
  metadata?: Record<string, any>;
}

// Query interface for fetching audit logs
export interface AuditLogQuery {
  tenantId: string;
  type?: 'clinician_activity' | 'simplification' | 'translation' | 'chatbot';
  userId?: string;
  patientId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export interface AuditLogListResponse {
  items: AuditLog[];
  total: number;
  limit: number;
  offset: number;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);
  private firestore: Firestore | null = null;
  private readonly collectionName = 'audit_logs';

  constructor(private configService: DevConfigService) {}

  /**
   * Initialize Firestore client lazily (only when first needed)
   */
  private getFirestore(): Firestore {
    if (!this.firestore) {
      let serviceAccountPath: string | undefined;

      try {
        const config = this.configService.get();
        if (config.service_account_path) {
          const resolved = resolveServiceAccountPath(config.service_account_path);
          const fs = require('fs');
          if (fs.existsSync(resolved)) {
            serviceAccountPath = resolved;
            this.logger.log(`Using Firestore service account for AuditLogs: ${resolved}`);
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

      this.logger.log('Audit Service Firestore initialized');
    }
    return this.firestore;
  }

  /**
   * Log clinician activity
   */
  async logClinicianActivity(log: Omit<ClinicianActivityLog, 'id' | 'timestamp' | 'type'>): Promise<void> {
    const auditLog: ClinicianActivityLog = {
      ...log,
      type: 'clinician_activity',
      timestamp: new Date(),
    };

    await this.saveLog(auditLog);

    this.logger.log(`Clinician Activity: ${log.action} on ${log.resourceType} by ${log.userName || log.userId}`);
  }

  /**
   * Log simplification
   */
  async logSimplification(log: Omit<SimplificationLog, 'id' | 'timestamp' | 'type'>): Promise<void> {
    const auditLog: SimplificationLog = {
      ...log,
      type: 'simplification',
      timestamp: new Date(),
    };

    await this.saveLog(auditLog);

    this.logger.log(`Simplification ${log.action} for patient ${log.patientId}`);
  }

  /**
   * Log translation
   */
  async logTranslation(log: Omit<TranslationLog, 'id' | 'timestamp' | 'type'>): Promise<void> {
    const auditLog: TranslationLog = {
      ...log,
      type: 'translation',
      timestamp: new Date(),
    };

    await this.saveLog(auditLog);

    this.logger.log(`Translation ${log.action}: ${log.sourceLanguage} -> ${log.targetLanguage} for patient ${log.patientId}`);
  }

  /**
   * Log chatbot interaction
   */
  async logChatbot(log: Omit<ChatbotLog, 'id' | 'timestamp' | 'type'>): Promise<void> {
    const auditLog: ChatbotLog = {
      ...log,
      type: 'chatbot',
      timestamp: new Date(),
    };

    await this.saveLog(auditLog);

    this.logger.log(`Chatbot ${log.action} for patient ${log.patientId}`);
  }

  /**
   * Save audit log to Firestore
   */
  private async saveLog(log: AuditLog): Promise<void> {
    try {
      const docRef = this.getFirestore().collection(this.collectionName).doc();
      const data = this.removeUndefined(log);

      await docRef.set(data);

      this.logger.debug(`Saved audit log: ${docRef.id}`);
    } catch (error) {
      this.logger.error(`Failed to save audit log: ${error.message}`, error.stack);
      // Don't throw - audit logging should not break the application
    }
  }

  /**
   * Query audit logs
   */
  async queryLogs(query: AuditLogQuery): Promise<AuditLogListResponse> {
    try {
      let firestoreQuery = this.getFirestore().collection(this.collectionName) as any;

      // Apply tenant filter (required)
      firestoreQuery = firestoreQuery.where('tenantId', '==', query.tenantId);

      // Apply type filter
      if (query.type) {
        firestoreQuery = firestoreQuery.where('type', '==', query.type);
      }

      // Apply user filter
      if (query.userId) {
        firestoreQuery = firestoreQuery.where('userId', '==', query.userId);
      }

      // Apply patient filter
      if (query.patientId) {
        firestoreQuery = firestoreQuery.where('patientId', '==', query.patientId);
      }

      // Apply date range filters
      if (query.startDate) {
        firestoreQuery = firestoreQuery.where('timestamp', '>=', query.startDate);
      }

      if (query.endDate) {
        firestoreQuery = firestoreQuery.where('timestamp', '<=', query.endDate);
      }

      // Order by timestamp descending
      firestoreQuery = firestoreQuery.orderBy('timestamp', 'desc');

      // Get total count
      const countSnapshot = await firestoreQuery.get();
      const total = countSnapshot.size;

      // Apply pagination
      const limit = query.limit || 50;
      const offset = query.offset || 0;
      firestoreQuery = firestoreQuery.limit(limit).offset(offset);

      // Execute query
      const snapshot = await firestoreQuery.get();

      const items: AuditLog[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        items.push(this.documentToAuditLog(doc.id, data));
      });

      return {
        items,
        total,
        limit,
        offset,
      };
    } catch (error) {
      this.logger.error(`Failed to query audit logs: ${error.message}`, error.stack);
      return {
        items: [],
        total: 0,
        limit: query.limit || 50,
        offset: query.offset || 0,
      };
    }
  }

  /**
   * Convert Firestore document to AuditLog
   */
  private documentToAuditLog(id: string, data: any): AuditLog {
    const baseLog = {
      id,
      timestamp: data.timestamp?.toDate ? data.timestamp.toDate() : data.timestamp,
      tenantId: data.tenantId,
      userId: data.userId,
      userName: data.userName,
      userRole: data.userRole,
    };

    switch (data.type) {
      case 'clinician_activity':
        return {
          ...baseLog,
          type: 'clinician_activity',
          action: data.action,
          resourceType: data.resourceType,
          resourceId: data.resourceId,
          patientId: data.patientId,
          patientName: data.patientName,
          metadata: data.metadata,
        } as ClinicianActivityLog;

      case 'simplification':
        return {
          ...baseLog,
          type: 'simplification',
          action: data.action,
          dischargeSummaryId: data.dischargeSummaryId,
          patientId: data.patientId,
          patientName: data.patientName,
          originalLength: data.originalLength,
          simplifiedLength: data.simplifiedLength,
          processingTime: data.processingTime,
          aiModel: data.aiModel,
          metadata: data.metadata,
        } as SimplificationLog;

      case 'translation':
        return {
          ...baseLog,
          type: 'translation',
          action: data.action,
          dischargeSummaryId: data.dischargeSummaryId,
          patientId: data.patientId,
          patientName: data.patientName,
          sourceLanguage: data.sourceLanguage,
          targetLanguage: data.targetLanguage,
          originalLength: data.originalLength,
          translatedLength: data.translatedLength,
          processingTime: data.processingTime,
          aiModel: data.aiModel,
          metadata: data.metadata,
        } as TranslationLog;

      case 'chatbot':
        return {
          ...baseLog,
          type: 'chatbot',
          action: data.action,
          patientId: data.patientId,
          patientName: data.patientName,
          conversationId: data.conversationId,
          message: data.message,
          response: data.response,
          processingTime: data.processingTime,
          aiModel: data.aiModel,
          metadata: data.metadata,
        } as ChatbotLog;

      default:
        throw new Error(`Unknown audit log type: ${data.type}`);
    }
  }

  /**
   * Remove undefined values from object (Firestore doesn't accept them)
   */
  private removeUndefined(obj: any): any {
    const result: any = {};
    for (const key in obj) {
      if (obj[key] !== undefined) {
        if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key]) && !(obj[key] instanceof Date)) {
          result[key] = this.removeUndefined(obj[key]);
        } else {
          result[key] = obj[key];
        }
      }
    }
    return result;
  }

  // Legacy methods for backward compatibility
  logFhirRequest(entry: AuditLogEntry): void {
    const logMessage = {
      type: 'FHIR_REQUEST',
      ...entry,
      timestamp: new Date().toISOString()
    };

    this.logger.log(JSON.stringify(logMessage));
  }

  logDischargeSummaryApproval(
    documentId: string,
    patientId: string,
    clinicianId: string,
    action: 'approved' | 'rejected' | 'modified',
    metadata?: Record<string, any>
  ): void {
    const logMessage = {
      type: 'DISCHARGE_SUMMARY_APPROVAL',
      timestamp: new Date().toISOString(),
      documentId,
      patientId,
      clinicianId,
      action,
      metadata
    };

    this.logger.log(JSON.stringify(logMessage));
  }

  logDocumentProcessing(
    documentId: string,
    patientId: string,
    stage: 'extracted' | 'simplified' | 'translated' | 'stored',
    metadata?: Record<string, any>
  ): void {
    const logMessage = {
      type: 'DOCUMENT_PROCESSING',
      timestamp: new Date().toISOString(),
      documentId,
      patientId,
      stage,
      metadata
    };

    this.logger.log(JSON.stringify(logMessage));
  }
}
