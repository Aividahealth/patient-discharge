import { Injectable, Logger } from '@nestjs/common';

export interface AuditLogEntry {
  timestamp?: string; // Made optional since we set it in the service
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

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  logFhirRequest(entry: AuditLogEntry): void {
    const logMessage = {
      type: 'FHIR_REQUEST',
      ...entry,
      timestamp: new Date().toISOString()
    };

    // Log to console (in production, this would go to a proper audit system)
    this.logger.log(JSON.stringify(logMessage));

    // TODO: In production, send to audit database or external audit service
    // await this.auditDatabase.insert(logMessage);
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
