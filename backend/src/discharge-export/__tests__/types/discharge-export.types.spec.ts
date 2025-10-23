import { ExportResult, DocumentExportEvent } from '../../types/discharge-export.types';

describe('DischargeExportTypes', () => {
  describe('ExportResult', () => {
    it('should create a successful export result', () => {
      const result: ExportResult = {
        success: true,
        cernerDocumentId: 'doc-123',
        googleBinaryId: 'binary-456',
        googleDocumentReferenceId: 'docref-789',
        googleCompositionId: 'comp-101',
        cernerPatientId: 'patient-1',
        googlePatientId: 'google-patient-1',
        encounterId: 'encounter-1',
        metadata: {
          originalSize: 1024,
          contentType: 'application/pdf',
          exportTimestamp: '2025-01-12T10:00:00Z',
          patientMapping: 'found',
          duplicateCheck: 'new',
        },
      };

      expect(result.success).toBe(true);
      expect(result.cernerDocumentId).toBe('doc-123');
      expect(result.googleBinaryId).toBe('binary-456');
      expect(result.metadata?.originalSize).toBe(1024);
      expect(result.metadata?.patientMapping).toBe('found');
    });

    it('should create a failed export result', () => {
      const result: ExportResult = {
        success: false,
        error: 'Failed to process document',
        metadata: {
          exportTimestamp: '2025-01-12T10:00:00Z',
        },
      };

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to process document');
      expect(result.cernerDocumentId).toBeUndefined();
    });

    it('should handle minimal export result', () => {
      const result: ExportResult = {
        success: true,
        metadata: {
          exportTimestamp: '2025-01-12T10:00:00Z',
        },
      };

      expect(result.success).toBe(true);
      expect(result.metadata?.exportTimestamp).toBe('2025-01-12T10:00:00Z');
    });
  });

  describe('DocumentExportEvent', () => {
    it('should create a successful document export event', () => {
      const event: DocumentExportEvent = {
        documentReferenceId: 'doc-123',
        tenantId: 'tenant-1',
        patientId: 'patient-1',
        exportTimestamp: '2025-01-12T10:00:00Z',
        status: 'success',
        metadata: {
          googleBinaryId: 'binary-456',
          googleDocumentReferenceId: 'docref-789',
          googleCompositionId: 'comp-101',
          originalSize: 1024,
          contentType: 'application/pdf',
        },
      };

      expect(event.documentReferenceId).toBe('doc-123');
      expect(event.tenantId).toBe('tenant-1');
      expect(event.status).toBe('success');
      expect(event.metadata?.googleBinaryId).toBe('binary-456');
      expect(event.error).toBeUndefined();
    });

    it('should create a failed document export event', () => {
      const event: DocumentExportEvent = {
        documentReferenceId: 'doc-123',
        tenantId: 'tenant-1',
        exportTimestamp: '2025-01-12T10:00:00Z',
        status: 'failed',
        error: 'Export failed due to invalid data',
      };

      expect(event.documentReferenceId).toBe('doc-123');
      expect(event.status).toBe('failed');
      expect(event.error).toBe('Export failed due to invalid data');
      expect(event.metadata).toBeUndefined();
    });

    it('should handle minimal document export event', () => {
      const event: DocumentExportEvent = {
        documentReferenceId: 'doc-123',
        tenantId: 'tenant-1',
        exportTimestamp: '2025-01-12T10:00:00Z',
        status: 'success',
      };

      expect(event.documentReferenceId).toBe('doc-123');
      expect(event.tenantId).toBe('tenant-1');
      expect(event.status).toBe('success');
      expect(event.patientId).toBeUndefined();
      expect(event.metadata).toBeUndefined();
    });
  });
});
