import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { DischargeExportModule } from '../discharge-export.module';
import { DischargeExportController } from '../controllers/discharge-export.controller';
import { DischargeExportService } from '../services/discharge-export.service';
import { DocumentExportScheduler } from '../services/document-export.scheduler';
import { TenantContext } from '../../tenant/tenant-context';
import { ExportResult } from '../types/discharge-export.types';

describe('DischargeExportModule Integration', () => {
  let app: INestApplication;
  let controller: DischargeExportController;
  let service: DischargeExportService;
  let scheduler: DocumentExportScheduler;

  const mockTenantContext: TenantContext = {
    tenantId: 'test-tenant',
    userId: 'test-user',
    timestamp: new Date(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [DischargeExportModule],
    })
      .overrideProvider('CernerService')
      .useValue({
        fetchDocumentReference: jest.fn().mockResolvedValue(null),
        fetchBinaryDocument: jest.fn().mockResolvedValue(null),
        searchResource: jest.fn().mockResolvedValue(null),
        parseDocumentReference: jest.fn(),
      })
      .overrideProvider('GoogleService')
      .useValue({
        fhirSearch: jest.fn().mockResolvedValue(null),
        createBinary: jest.fn().mockResolvedValue(null),
        createDocumentReference: jest.fn().mockResolvedValue(null),
        createComposition: jest.fn().mockResolvedValue(null),
      })
      .overrideProvider('AuditService')
      .useValue({
        logDocumentProcessing: jest.fn().mockResolvedValue(undefined),
      })
      .overrideProvider('DevConfigService')
      .useValue({
        getTenantGoogleConfig: jest.fn().mockReturnValue({}),
        getAllTenantIds: jest.fn().mockReturnValue([]),
        getTenantCernerPatients: jest.fn().mockReturnValue([]),
        getTenantCernerSystemConfig: jest.fn().mockReturnValue({}),
      })
      .overrideProvider('SessionService')
      .useValue({
        getActiveSessions: jest.fn().mockReturnValue([]),
      })
      .overrideProvider('PubSubService')
      .useValue({
        publishDocumentExportEvent: jest.fn().mockResolvedValue(undefined),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    controller = moduleFixture.get<DischargeExportController>(DischargeExportController);
    service = moduleFixture.get<DischargeExportService>(DischargeExportService);
    scheduler = moduleFixture.get<DocumentExportScheduler>(DocumentExportScheduler);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Module Dependencies', () => {
    it('should have all required dependencies injected', () => {
      expect(controller).toBeDefined();
      expect(service).toBeDefined();
      expect(scheduler).toBeDefined();
    });

    it('should have controller with service dependency', () => {
      expect(controller['dischargeExportService']).toBeDefined();
    });

    it('should have scheduler with all required dependencies', () => {
      expect(scheduler['dischargeExportService']).toBeDefined();
      expect(scheduler['googleService']).toBeDefined();
      expect(scheduler['cernerService']).toBeDefined();
      expect(scheduler['configService']).toBeDefined();
      expect(scheduler['sessionService']).toBeDefined();
      expect(scheduler['pubSubService']).toBeDefined();
    });
  });

  describe('End-to-End Flow', () => {
    it('should handle complete export flow', async () => {
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

      // Setup service mocks
      const cernerService = service['cernerService'] as jest.Mocked<any>;
      const googleService = service['googleService'] as jest.Mocked<any>;
      const auditService = service['auditService'] as jest.Mocked<any>;

      cernerService.fetchDocumentReference.mockResolvedValue(mockCernerDoc);
      cernerService.fetchBinaryDocument.mockResolvedValue(mockBinary);
      googleService.createBinary.mockResolvedValue(mockGoogleBinary);
      googleService.createDocumentReference.mockResolvedValue(mockGoogleDocRef);
      googleService.createComposition.mockResolvedValue(mockGoogleComposition);
      auditService.logDocumentProcessing.mockResolvedValue(undefined);

      // Mock private methods
      jest.spyOn(service as any, 'findOrCreateGooglePatient').mockResolvedValue(mockPatientMapping);
      jest.spyOn(service as any, 'isDocumentAlreadyProcessed').mockResolvedValue(false);

      // Execute the flow
      const result = await controller.exportDocumentById(
        documentId,
        mockTenantContext,
        { patientId: 'patient-1' }
      );

      // Verify the result
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

      // Verify service calls
      expect(cernerService.fetchDocumentReference).toHaveBeenCalledWith(documentId, mockTenantContext);
      expect(cernerService.fetchBinaryDocument).toHaveBeenCalledWith('binary-123', mockTenantContext, 'application/pdf');
      expect(googleService.createBinary).toHaveBeenCalled();
      expect(googleService.createDocumentReference).toHaveBeenCalled();
      expect(googleService.createComposition).toHaveBeenCalled();
      expect(auditService.logDocumentProcessing).toHaveBeenCalledWith(
        documentId,
        'patient-1',
        'stored',
        expect.objectContaining({
          googlePatientId: 'google-patient-1',
          googleBinaryId: 'google-binary-456',
          googleDocumentReferenceId: 'google-docref-789',
          googleCompositionId: 'google-comp-101',
        })
      );
    });

    it('should handle scheduler flow with Pub/Sub publishing', async () => {
      const tenantId = 'test-tenant';
      const patientId = 'patient-1';
      const mockDocuments = {
        entry: [
          {
            resource: {
              id: 'doc-1',
              type: {
                coding: [{
                  system: 'https://fhir.cerner.com/ec2458f2-1e24-41c8-b71b-0e701af7583d/codeSet/72',
                  code: '2820510',
                }],
              },
            },
          },
        ],
      };

      const mockExportResult: ExportResult = {
        success: true,
        cernerDocumentId: 'doc-1',
        googleBinaryId: 'binary-1',
        cernerPatientId: patientId,
        metadata: {
          exportTimestamp: '2025-01-12T10:00:00Z',
        },
      };

      // Setup scheduler mocks
      const cernerService = scheduler['cernerService'] as jest.Mocked<any>;
      const configService = scheduler['configService'] as jest.Mocked<any>;
      const sessionService = scheduler['sessionService'] as jest.Mocked<any>;
      const pubSubService = scheduler['pubSubService'] as jest.Mocked<any>;

      configService.getTenantCernerPatients.mockReturnValue([patientId]);
      sessionService.getActiveSessions.mockReturnValue([]);
      cernerService.searchResource.mockResolvedValue(mockDocuments);
      (service as jest.Mocked<any>).exportDischargeSummary.mockResolvedValue(mockExportResult);
      pubSubService.publishDocumentExportEvent.mockResolvedValue(undefined);

      // Mock private methods
      jest.spyOn(scheduler as any, 'isConsultationNoteGeneric').mockReturnValue(true);
      jest.spyOn(scheduler as any, 'isDocumentAlreadyProcessed').mockResolvedValue(false);
      jest.spyOn(scheduler as any, 'markDocumentAsProcessed').mockResolvedValue(undefined);

      // Execute the scheduler flow
      await scheduler.triggerManualCheck(tenantId);

      // Verify Pub/Sub event was published
      expect(pubSubService.publishDocumentExportEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          documentReferenceId: 'doc-1',
          tenantId,
          patientId,
          status: 'success',
          metadata: expect.objectContaining({
            googleBinaryId: 'binary-1',
          }),
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle service errors gracefully', async () => {
      const documentId = 'doc-123';
      const error = new Error('Service error');

      (service['cernerService'] as jest.Mocked<any>).fetchDocumentReference.mockRejectedValue(error);

      await expect(
        controller.exportDocumentById(documentId, mockTenantContext, { patientId: 'patient-1' })
      ).rejects.toThrow(error);
    });

    it('should handle scheduler errors gracefully', async () => {
      const tenantId = 'test-tenant';
      const error = new Error('Scheduler error');

      (scheduler['configService'] as jest.Mocked<any>).getAllTenantIds.mockImplementation(() => {
        throw error;
      });

      await expect(scheduler.triggerManualCheck()).resolves.not.toThrow();
    });
  });
});
