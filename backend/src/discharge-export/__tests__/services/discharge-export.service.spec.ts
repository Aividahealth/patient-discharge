import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { DischargeExportService } from '../../services/discharge-export.service';
import { CernerService } from '../../../cerner/cerner.service';
import { GoogleService } from '../../../google/google.service';
import { AuditService } from '../../../audit/audit.service';
import { DevConfigService } from '../../../config/dev-config.service';
import { TenantContext } from '../../../tenant/tenant-context';
import { ExportResult } from '../../types/discharge-export.types';

describe('DischargeExportService', () => {
  let service: DischargeExportService;
  let cernerService: jest.Mocked<CernerService>;
  let googleService: jest.Mocked<GoogleService>;
  let auditService: jest.Mocked<AuditService>;
  let configService: jest.Mocked<DevConfigService>;

  const mockTenantContext: TenantContext = {
    tenantId: 'test-tenant',
    userId: 'test-user',
  };

  beforeEach(async () => {
    const mockCernerService = {
      fetchDocumentReference: jest.fn(),
      fetchBinaryDocument: jest.fn(),
    };

    const mockGoogleService = {
      fhirSearch: jest.fn(),
      createBinary: jest.fn(),
      createDocumentReference: jest.fn(),
      createComposition: jest.fn(),
    };

    const mockAuditService = {
      logDocumentProcessing: jest.fn(),
    };

    const mockConfigService = {
      getTenantGoogleConfig: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DischargeExportService,
        {
          provide: CernerService,
          useValue: mockCernerService,
        },
        {
          provide: GoogleService,
          useValue: mockGoogleService,
        },
        {
          provide: AuditService,
          useValue: mockAuditService,
        },
        {
          provide: DevConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<DischargeExportService>(DischargeExportService);
    cernerService = module.get(CernerService);
    googleService = module.get(GoogleService);
    auditService = module.get(AuditService);
    configService = module.get(DevConfigService);

    // Mock logger to avoid console output during tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('exportDischargeSummary', () => {
    it('should successfully export a discharge summary', async () => {
      const documentId = 'doc-123';
      const mockCernerDoc = {
        id: documentId,
        patientId: 'patient-1',
        encounterId: 'encounter-1',
        content: [{
          url: 'https://cerner.com/Binary/binary-123',
        }],
      };

      const mockBinary = {
        id: 'binary-123',
        data: 'base64-data',
        contentType: 'application/pdf',
        size: 1024,
      };

      const mockGoogleBinary = {
        id: 'google-binary-456',
      };

      const mockGoogleDocRef = {
        id: 'google-docref-789',
      };

      const mockGoogleComposition = {
        id: 'google-comp-101',
      };

      const mockPatientMapping = {
        googlePatientId: 'google-patient-1',
        action: 'found' as const,
      };

      // Setup mocks
      cernerService.fetchDocumentReference.mockResolvedValue(mockCernerDoc);
      cernerService.fetchBinaryDocument.mockResolvedValue(mockBinary);
      googleService.createBinary.mockResolvedValue(mockGoogleBinary);
      googleService.createDocumentReference.mockResolvedValue(mockGoogleDocRef);
      googleService.createComposition.mockResolvedValue(mockGoogleComposition);
      
      // Mock private methods
      jest.spyOn(service as any, 'findOrCreateGooglePatient').mockResolvedValue(mockPatientMapping);
      jest.spyOn(service as any, 'isDocumentAlreadyProcessed').mockResolvedValue(false);

      const result = await service.exportDischargeSummary(mockTenantContext, documentId);

      expect(result.success).toBe(true);
      expect(result.cernerDocumentId).toBe(documentId);
      expect(result.googleBinaryId).toBe('google-binary-456');
      expect(result.googleDocumentReferenceId).toBe('google-docref-789');
      expect(result.googleCompositionId).toBe('google-comp-101');
      expect(result.cernerPatientId).toBe('patient-1');
      expect(result.googlePatientId).toBe('google-patient-1');
      expect(result.encounterId).toBe('encounter-1');
      expect(result.metadata?.originalSize).toBe(1024);
      expect(result.metadata?.contentType).toBe('application/pdf');
      expect(result.metadata?.patientMapping).toBe('found');
      expect(result.metadata?.duplicateCheck).toBe('new');
    });

    it('should handle missing document ID', async () => {
      const result = await service.exportDischargeSummary(mockTenantContext);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Document ID is required');
    });

    it('should handle document not found in Cerner', async () => {
      const documentId = 'non-existent-doc';
      
      cernerService.fetchDocumentReference.mockResolvedValue(null);

      const result = await service.exportDischargeSummary(mockTenantContext, documentId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Document not found');
    });

    it('should handle already processed document', async () => {
      const documentId = 'doc-123';
      const mockCernerDoc = {
        id: documentId,
        patientId: 'patient-1',
      };

      cernerService.fetchDocumentReference.mockResolvedValue(mockCernerDoc);
      jest.spyOn(service as any, 'isDocumentAlreadyProcessed').mockResolvedValue(true);

      const result = await service.exportDischargeSummary(mockTenantContext, documentId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('already processed');
    });

    it('should handle binary download failure', async () => {
      const documentId = 'doc-123';
      const mockCernerDoc = {
        id: documentId,
        patientId: 'patient-1',
        content: [{
          url: 'https://cerner.com/Binary/binary-123',
        }],
      };

      cernerService.fetchDocumentReference.mockResolvedValue(mockCernerDoc);
      cernerService.fetchBinaryDocument.mockResolvedValue(null);
      jest.spyOn(service as any, 'isDocumentAlreadyProcessed').mockResolvedValue(false);

      const result = await service.exportDischargeSummary(mockTenantContext, documentId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to download PDF');
    });

    it('should handle Google FHIR creation failure', async () => {
      const documentId = 'doc-123';
      const mockCernerDoc = {
        id: documentId,
        patientId: 'patient-1',
        content: [{
          url: 'https://cerner.com/Binary/binary-123',
        }],
      };

      const mockBinary = {
        id: 'binary-123',
        data: 'base64-data',
        contentType: 'application/pdf',
        size: 1024,
      };

      const mockPatientMapping = {
        googlePatientId: 'google-patient-1',
        action: 'found' as const,
      };

      cernerService.fetchDocumentReference.mockResolvedValue(mockCernerDoc);
      cernerService.fetchBinaryDocument.mockResolvedValue(mockBinary);
      googleService.createBinary.mockRejectedValue(new Error('Google FHIR error'));
      jest.spyOn(service as any, 'isDocumentAlreadyProcessed').mockResolvedValue(false);
      jest.spyOn(service as any, 'findOrCreateGooglePatient').mockResolvedValue(mockPatientMapping);

      const result = await service.exportDischargeSummary(mockTenantContext, documentId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Google FHIR error');
    });
  });

  describe('getBinaryFromDocumentReference', () => {
    it('should get binary from DocumentReference ID', async () => {
      const documentReferenceId = 'docref-123';
      const mockDocRef = {
        id: documentReferenceId,
        content: [{
          url: 'https://cerner.com/Binary/binary-123',
        }],
      };

      const mockBinary = {
        id: 'binary-123',
        data: 'base64-data',
        contentType: 'application/pdf',
        size: 1024,
      };

      cernerService.fetchDocumentReference.mockResolvedValue(mockDocRef);
      cernerService.fetchBinaryDocument.mockResolvedValue(mockBinary);

      const result = await service.getBinaryFromDocumentReference(
        mockTenantContext,
        documentReferenceId
      );

      expect(result.success).toBe(true);
      expect(result.binary).toEqual(mockBinary);
      expect(result.documentReference).toEqual(mockDocRef);
    });

    it('should get binary from Composition ID', async () => {
      const compositionId = 'comp-123';
      const mockComposition = {
        id: compositionId,
        section: [{
          entry: [{
            reference: 'DocumentReference/docref-123',
          }],
        }],
      };

      const mockDocRef = {
        id: 'docref-123',
        content: [{
          url: 'https://cerner.com/Binary/binary-123',
        }],
      };

      const mockBinary = {
        id: 'binary-123',
        data: 'base64-data',
        contentType: 'application/pdf',
        size: 1024,
      };

      googleService.fhirSearch.mockResolvedValue({ entry: [{ resource: mockComposition }] });
      cernerService.fetchDocumentReference.mockResolvedValue(mockDocRef);
      cernerService.fetchBinaryDocument.mockResolvedValue(mockBinary);

      const result = await service.getBinaryFromDocumentReference(
        mockTenantContext,
        undefined,
        compositionId
      );

      expect(result.success).toBe(true);
      expect(result.binary).toEqual(mockBinary);
      expect(result.composition).toEqual(mockComposition);
    });

    it('should handle missing parameters', async () => {
      const result = await service.getBinaryFromDocumentReference(mockTenantContext);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Either documentReferenceId or compositionId must be provided');
    });

    it('should handle DocumentReference not found', async () => {
      const documentReferenceId = 'non-existent-docref';
      
      cernerService.fetchDocumentReference.mockResolvedValue(null);

      const result = await service.getBinaryFromDocumentReference(
        mockTenantContext,
        documentReferenceId
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('DocumentReference not found');
    });
  });
});
