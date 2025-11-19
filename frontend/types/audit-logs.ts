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

// Query parameters
export interface AuditLogQuery {
  type?: 'clinician_activity' | 'simplification' | 'translation' | 'chatbot';
  userId?: string;
  patientId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

// Response type
export interface AuditLogListResponse {
  items: AuditLog[];
  total: number;
  limit: number;
  offset: number;
}
