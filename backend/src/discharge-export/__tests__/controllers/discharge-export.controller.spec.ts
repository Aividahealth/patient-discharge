import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { DischargeExportController } from '../../controllers/discharge-export.controller';
import { DischargeExportService } from '../../services/discharge-export.service';
import { TenantContext } from '../../../tenant/tenant-context';
import { ExportResult } from '../../types/discharge-export.types';

describe('DischargeExportController', () => {
  let controller: DischargeExportController;
  let service: jest.Mocked<DischargeExportService>;

  const mockTenantContext: TenantContext = {
    tenantId: 'test-tenant',
    userId: 'test-user',
  };

  beforeEach(async () => {
    const mockService = {
      exportDischargeSummary: jest.fn(),
      getBinaryFromDocumentReference: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DischargeExportController],
      providers: [
        {
          provide: DischargeExportService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<DischargeExportController>(DischargeExportController);
    service = module.get(DischargeExportService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('exportDocumentById', () => {
    it('should successfully export a document', async () => {
      const documentId = 'doc-123';
      const patientId = 'patient-1';
      const mockResult: ExportResult = {
        success: true,
        cernerDocumentId: documentId,
        googleBinaryId: 'binary-456',
        googleDocumentReferenceId: 'docref-789',
        cernerPatientId: patientId,
        metadata: {
          exportTimestamp: '2025-01-12T10:00:00Z',
        },
      };

      service.exportDischargeSummary.mockResolvedValue(mockResult);

      const result = await controller.exportDocumentById(
        documentId,
        mockTenantContext,
        { patientId }
      );

      expect(service.exportDischargeSummary).toHaveBeenCalledWith(
        mockTenantContext,
        documentId
      );
      expect(result).toEqual(mockResult);
    });

    it('should handle export failure', async () => {
      const documentId = 'doc-123';
      const patientId = 'patient-1';
      const mockResult: ExportResult = {
        success: false,
        error: 'Export failed',
        metadata: {
          exportTimestamp: '2025-01-12T10:00:00Z',
        },
      };

      service.exportDischargeSummary.mockResolvedValue(mockResult);

      const result = await controller.exportDocumentById(
        documentId,
        mockTenantContext,
        { patientId }
      );

      expect(result).toEqual(mockResult);
    });

    it('should handle service errors', async () => {
      const documentId = 'doc-123';
      const patientId = 'patient-1';
      const error = new Error('Service error');

      service.exportDischargeSummary.mockRejectedValue(error);

      await expect(
        controller.exportDocumentById(documentId, mockTenantContext, { patientId })
      ).rejects.toThrow(error);
    });
  });

  describe('getBinaryFromDocumentReference', () => {
    it('should get binary from DocumentReference ID', async () => {
      const documentReferenceId = 'docref-123';
      const mockResult = {
        success: true,
        binary: {
          id: 'binary-123',
          data: 'base64-data',
          contentType: 'application/pdf',
          size: 1024,
        },
        documentReference: {
          id: documentReferenceId,
          content: [{
            url: 'https://cerner.com/Binary/binary-123',
          }],
        },
      };

      service.getBinaryFromDocumentReference.mockResolvedValue(mockResult);

      const result = await controller.getBinaryFromDocumentReference(
        mockTenantContext,
        documentReferenceId
      );

      expect(service.getBinaryFromDocumentReference).toHaveBeenCalledWith(
        mockTenantContext,
        documentReferenceId,
        undefined
      );
      expect(result).toEqual(mockResult);
    });

    it('should get binary from Composition ID', async () => {
      const compositionId = 'comp-123';
      const mockResult = {
        success: true,
        binary: {
          id: 'binary-123',
          data: 'base64-data',
          contentType: 'application/pdf',
          size: 1024,
        },
        composition: {
          id: compositionId,
          section: [{
            entry: [{
              reference: 'DocumentReference/docref-123',
            }],
          }],
        },
      };

      service.getBinaryFromDocumentReference.mockResolvedValue(mockResult);

      const result = await controller.getBinaryFromDocumentReference(
        mockTenantContext,
        undefined,
        compositionId
      );

      expect(service.getBinaryFromDocumentReference).toHaveBeenCalledWith(
        mockTenantContext,
        undefined,
        compositionId
      );
      expect(result).toEqual(mockResult);
    });

    it('should throw error when neither ID is provided', async () => {
      await expect(
        controller.getBinaryFromDocumentReference(mockTenantContext)
      ).rejects.toThrow(HttpException);

      await expect(
        controller.getBinaryFromDocumentReference(mockTenantContext)
      ).rejects.toThrow('Either documentReferenceId or compositionId must be provided');
    });

    it('should throw error when service returns failure', async () => {
      const documentReferenceId = 'docref-123';
      const mockResult = {
        success: false,
        error: 'DocumentReference not found',
      };

      service.getBinaryFromDocumentReference.mockResolvedValue(mockResult);

      await expect(
        controller.getBinaryFromDocumentReference(mockTenantContext, documentReferenceId)
      ).rejects.toThrow(HttpException);

      await expect(
        controller.getBinaryFromDocumentReference(mockTenantContext, documentReferenceId)
      ).rejects.toThrow('Failed to get binary resource');
    });

    it('should handle service errors', async () => {
      const documentReferenceId = 'docref-123';
      const error = new Error('Service error');

      service.getBinaryFromDocumentReference.mockRejectedValue(error);

      await expect(
        controller.getBinaryFromDocumentReference(mockTenantContext, documentReferenceId)
      ).rejects.toThrow(HttpException);

      await expect(
        controller.getBinaryFromDocumentReference(mockTenantContext, documentReferenceId)
      ).rejects.toThrow('Failed to get binary resource');
    });
  });

  describe('testExport', () => {
    it('should test export for a patient', async () => {
      const patientId = 'patient-1';
      const mockResult = {
        success: true,
        message: 'Test completed successfully',
      };

      // Mock the private method call
      jest.spyOn(service as any, 'findCernerDischargeSummary').mockResolvedValue(mockResult);

      const result = await controller.testExport(patientId, mockTenantContext);

      expect(result).toEqual(mockResult);
    });

    it('should handle test export errors', async () => {
      const patientId = 'patient-1';
      const error = new Error('Test failed');

      jest.spyOn(service as any, 'findCernerDischargeSummary').mockRejectedValue(error);

      await expect(
        controller.testExport(patientId, mockTenantContext)
      ).rejects.toThrow(error);
    });
  });
});
