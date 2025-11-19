export interface ExportResult {
  success: boolean;
  cernerDocumentId?: string;
  googleBinaryId?: string;
  googleDocumentReferenceId?: string;
  googleCompositionId?: string;
  cernerPatientId?: string;
  googlePatientId?: string;
  encounterId?: string;
  error?: string;
  metadata?: {
    originalSize?: number;
    contentType?: string;
    exportTimestamp: string;
    patientMapping?: 'found' | 'created' | 'failed';
    duplicateCheck?: 'new' | 'duplicate' | 'skipped';
    vendor?: string;
  };
}

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
