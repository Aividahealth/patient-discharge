import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { DocumentExportScheduler } from '../../services/document-export.scheduler';
import { DischargeExportService } from '../../services/discharge-export.service';
import { GoogleService } from '../../../google/google.service';
import { CernerService } from '../../../cerner/cerner.service';
import { DevConfigService } from '../../../config/dev-config.service';
import { SessionService } from '../../../auth/session.service';
import { PubSubService } from '../../../pubsub/pubsub.service';
import { TenantContext } from '../../../tenant/tenant-context';
import { AuthType } from '../../../auth/types/auth.types';
import { ExportResult, DocumentExportEvent } from '../../types/discharge-export.types';

describe('DocumentExportScheduler', () => {
  let scheduler: DocumentExportScheduler;
  let dischargeExportService: jest.Mocked<DischargeExportService>;
  let googleService: jest.Mocked<GoogleService>;
  let cernerService: jest.Mocked<CernerService>;
  let configService: jest.Mocked<DevConfigService>;
  let sessionService: jest.Mocked<SessionService>;
  let pubSubService: jest.Mocked<PubSubService>;

  const mockTenantContext: TenantContext = {
    tenantId: 'test-tenant',
    userId: 'test-user',
  };

  beforeEach(async () => {
    const mockDischargeExportService = {
      exportDischargeSummary: jest.fn(),
    };

    const mockGoogleService = {
      fhirSearch: jest.fn(),
    };

    const mockCernerService = {
      searchResource: jest.fn(),
    };

    const mockConfigService = {
      getAllTenantIds: jest.fn(),
      getTenantCernerPatients: jest.fn(),
      getTenantCernerSystemConfig: jest.fn(),
    };

    const mockSessionService = {
      getActiveSessions: jest.fn(),
    };

    const mockPubSubService = {
      publishDocumentExportEvent: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentExportScheduler,
        {
          provide: DischargeExportService,
          useValue: mockDischargeExportService,
        },
        {
          provide: GoogleService,
          useValue: mockGoogleService,
        },
        {
          provide: CernerService,
          useValue: mockCernerService,
        },
        {
          provide: DevConfigService,
          useValue: mockConfigService,
        },
        {
          provide: SessionService,
          useValue: mockSessionService,
        },
        {
          provide: PubSubService,
          useValue: mockPubSubService,
        },
      ],
    }).compile();

    scheduler = module.get<DocumentExportScheduler>(DocumentExportScheduler);
    dischargeExportService = module.get(DischargeExportService);
    googleService = module.get(GoogleService);
    cernerService = module.get(CernerService);
    configService = module.get(DevConfigService);
    sessionService = module.get(SessionService);
    pubSubService = module.get(PubSubService);

    // Mock logger to avoid console output during tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handleDocumentExportCron', () => {
    it('should process all tenants successfully', async () => {
      const tenantIds = ['tenant-1', 'tenant-2'];
      configService.getAllTenantIds.mockReturnValue(tenantIds);
      
      // Mock processTenantDocuments to resolve successfully
      jest.spyOn(scheduler as any, 'processTenantDocuments').mockResolvedValue(undefined);

      await scheduler.handleDocumentExportCron();

      expect(configService.getAllTenantIds).toHaveBeenCalled();
      expect((scheduler as any).processTenantDocuments).toHaveBeenCalledTimes(2);
      expect((scheduler as any).processTenantDocuments).toHaveBeenCalledWith('tenant-1');
      expect((scheduler as any).processTenantDocuments).toHaveBeenCalledWith('tenant-2');
    });

    it('should handle errors gracefully', async () => {
      configService.getAllTenantIds.mockReturnValue(['tenant-1']);
      jest.spyOn(scheduler as any, 'processTenantDocuments').mockRejectedValue(new Error('Processing error'));

      await expect(scheduler.handleDocumentExportCron()).resolves.not.toThrow();
    });
  });

  describe('processTenantDocuments', () => {
    it('should process documents for system app when no active sessions', async () => {
      const tenantId = 'test-tenant';
      const patients = ['patient-1', 'patient-2'];
      
      configService.getTenantCernerPatients.mockReturnValue(patients);
      sessionService.getActiveSessions.mockReturnValue([]);
      jest.spyOn(scheduler as any, 'processDocumentsForSystem').mockResolvedValue(undefined);

      await (scheduler as any).processTenantDocuments(tenantId);

      expect(configService.getTenantCernerPatients).toHaveBeenCalledWith(tenantId);
      expect(sessionService.getActiveSessions).toHaveBeenCalledWith(tenantId);
      expect((scheduler as any).processDocumentsForSystem).toHaveBeenCalledWith(tenantId);
    });

    it('should process documents for provider app when active sessions exist', async () => {
      const tenantId = 'test-tenant';
      const patients = ['patient-1'];
      const activeSessions = [{ id: 'session-1', userId: 'user-1' }];
      
      configService.getTenantCernerPatients.mockReturnValue(patients);
      sessionService.getActiveSessions.mockReturnValue(activeSessions);
      jest.spyOn(scheduler as any, 'processDocumentsForUser').mockResolvedValue(undefined);

      await (scheduler as any).processTenantDocuments(tenantId);

      expect((scheduler as any).processDocumentsForUser).toHaveBeenCalledWith(tenantId);
    });
  });

  describe('processDocumentsForSystem', () => {
    it('should process documents for all patients using system app', async () => {
      const tenantId = 'test-tenant';
      const patients = ['patient-1', 'patient-2'];
      
      configService.getTenantCernerPatients.mockReturnValue(patients);
      jest.spyOn(scheduler as any, 'processPatientDocuments').mockResolvedValue(undefined);

      await (scheduler as any).processDocumentsForSystem(tenantId);

      expect((scheduler as any).processPatientDocuments).toHaveBeenCalledTimes(2);
      expect((scheduler as any).processPatientDocuments).toHaveBeenCalledWith(tenantId, 'patient-1', AuthType.SYSTEM);
      expect((scheduler as any).processPatientDocuments).toHaveBeenCalledWith(tenantId, 'patient-2', AuthType.SYSTEM);
    });
  });

  describe('processPatientDocuments', () => {
    it('should process documents for a patient successfully', async () => {
      const tenantId = 'test-tenant';
      const patientId = 'patient-1';
      const authType = AuthType.SYSTEM;
      
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

      cernerService.searchResource.mockResolvedValue(mockDocuments);
      jest.spyOn(scheduler as any, 'isConsultationNoteGeneric').mockReturnValue(true);
      jest.spyOn(scheduler as any, 'isDocumentAlreadyProcessed').mockResolvedValue(false);
      dischargeExportService.exportDischargeSummary.mockResolvedValue(mockExportResult);
      jest.spyOn(scheduler as any, 'markDocumentAsProcessed').mockResolvedValue(undefined);
      jest.spyOn(scheduler as any, 'publishDocumentExportEvent').mockResolvedValue(undefined);

      await (scheduler as any).processPatientDocuments(tenantId, patientId, authType);

      expect(cernerService.searchResource).toHaveBeenCalledWith(
        'DocumentReference',
        expect.objectContaining({
          'type': 'https://fhir.cerner.com/ec2458f2-1e24-41c8-b71b-0e701af7583d/codeSet/72|2820510',
          'patient': patientId,
        }),
        expect.objectContaining({
          tenantId,
          authType,
        })
      );
      expect(dischargeExportService.exportDischargeSummary).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId }),
        'doc-1'
      );
      expect((scheduler as any).publishDocumentExportEvent).toHaveBeenCalledWith(
        'doc-1',
        expect.objectContaining({ tenantId }),
        mockExportResult,
        'success'
      );
    });

    it('should skip non-consultation note documents', async () => {
      const tenantId = 'test-tenant';
      const patientId = 'patient-1';
      const authType = AuthType.SYSTEM;
      
      const mockDocuments = {
        entry: [
          {
            resource: {
              id: 'doc-1',
              type: {
                coding: [{
                  system: 'https://fhir.cerner.com/ec2458f2-1e24-41c8-b71b-0e701af7583d/codeSet/72',
                  code: 'other-code',
                }],
              },
            },
          },
        ],
      };

      cernerService.searchResource.mockResolvedValue(mockDocuments);
      jest.spyOn(scheduler as any, 'isConsultationNoteGeneric').mockReturnValue(false);

      await (scheduler as any).processPatientDocuments(tenantId, patientId, authType);

      expect(dischargeExportService.exportDischargeSummary).not.toHaveBeenCalled();
    });

    it('should skip already processed documents', async () => {
      const tenantId = 'test-tenant';
      const patientId = 'patient-1';
      const authType = AuthType.SYSTEM;
      
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

      cernerService.searchResource.mockResolvedValue(mockDocuments);
      jest.spyOn(scheduler as any, 'isConsultationNoteGeneric').mockReturnValue(true);
      jest.spyOn(scheduler as any, 'isDocumentAlreadyProcessed').mockResolvedValue(true);

      await (scheduler as any).processPatientDocuments(tenantId, patientId, authType);

      expect(dischargeExportService.exportDischargeSummary).not.toHaveBeenCalled();
    });

    it('should handle export failure and publish failure event', async () => {
      const tenantId = 'test-tenant';
      const patientId = 'patient-1';
      const authType = AuthType.SYSTEM;
      
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
        success: false,
        error: 'Export failed',
        metadata: {
          exportTimestamp: '2025-01-12T10:00:00Z',
        },
      };

      cernerService.searchResource.mockResolvedValue(mockDocuments);
      jest.spyOn(scheduler as any, 'isConsultationNoteGeneric').mockReturnValue(true);
      jest.spyOn(scheduler as any, 'isDocumentAlreadyProcessed').mockResolvedValue(false);
      dischargeExportService.exportDischargeSummary.mockResolvedValue(mockExportResult);
      jest.spyOn(scheduler as any, 'publishDocumentExportEvent').mockResolvedValue(undefined);

      await (scheduler as any).processPatientDocuments(tenantId, patientId, authType);

      expect((scheduler as any).publishDocumentExportEvent).toHaveBeenCalledWith(
        'doc-1',
        expect.objectContaining({ tenantId }),
        mockExportResult,
        'failed'
      );
    });
  });

  describe('triggerManualCheck', () => {
    it('should trigger manual check for specific tenant', async () => {
      const tenantId = 'test-tenant';
      jest.spyOn(scheduler as any, 'processTenantDocuments').mockResolvedValue(undefined);

      await scheduler.triggerManualCheck(tenantId);

      expect((scheduler as any).processTenantDocuments).toHaveBeenCalledWith(tenantId);
    });

    it('should trigger manual check for all tenants when no tenant specified', async () => {
      const tenantIds = ['tenant-1', 'tenant-2'];
      configService.getAllTenantIds.mockReturnValue(tenantIds);
      jest.spyOn(scheduler as any, 'processTenantDocuments').mockResolvedValue(undefined);

      await scheduler.triggerManualCheck();

      expect(configService.getAllTenantIds).toHaveBeenCalled();
      expect((scheduler as any).processTenantDocuments).toHaveBeenCalledTimes(2);
    });
  });

  describe('publishDocumentExportEvent', () => {
    it('should publish successful export event', async () => {
      const documentId = 'doc-1';
      const tenantContext = mockTenantContext;
      const exportResult: ExportResult = {
        success: true,
        cernerDocumentId: documentId,
        cernerPatientId: 'patient-1',
        googleBinaryId: 'binary-1',
        metadata: {
          exportTimestamp: '2025-01-12T10:00:00Z',
        },
      };
      const status = 'success';

      await (scheduler as any).publishDocumentExportEvent(documentId, tenantContext, exportResult, status);

      expect(pubSubService.publishDocumentExportEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          documentReferenceId: documentId,
          tenantId: tenantContext.tenantId,
          patientId: 'patient-1',
          status: 'success',
          metadata: expect.objectContaining({
            googleBinaryId: 'binary-1',
          }),
        })
      );
    });

    it('should publish failed export event', async () => {
      const documentId = 'doc-1';
      const tenantContext = mockTenantContext;
      const exportResult: ExportResult = {
        success: false,
        error: 'Export failed',
        metadata: {
          exportTimestamp: '2025-01-12T10:00:00Z',
        },
      };
      const status = 'failed';

      await (scheduler as any).publishDocumentExportEvent(documentId, tenantContext, exportResult, status);

      expect(pubSubService.publishDocumentExportEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          documentReferenceId: documentId,
          tenantId: tenantContext.tenantId,
          status: 'failed',
          error: 'Export failed',
          metadata: undefined,
        })
      );
    });

    it('should handle Pub/Sub publishing errors gracefully', async () => {
      const documentId = 'doc-1';
      const tenantContext = mockTenantContext;
      const exportResult: ExportResult = {
        success: true,
        cernerDocumentId: documentId,
        metadata: {
          exportTimestamp: '2025-01-12T10:00:00Z',
        },
      };
      const status = 'success';

      pubSubService.publishDocumentExportEvent.mockRejectedValue(new Error('Pub/Sub error'));

      await expect(
        (scheduler as any).publishDocumentExportEvent(documentId, tenantContext, exportResult, status)
      ).resolves.not.toThrow();

      expect(pubSubService.publishDocumentExportEvent).toHaveBeenCalled();
    });
  });

  describe('isConsultationNoteGeneric', () => {
    it('should identify consultation note generic documents', () => {
      const documentReference = {
        type: {
          coding: [{
            system: 'https://fhir.cerner.com/ec2458f2-1e24-41c8-b71b-0e701af7583d/codeSet/72',
            code: '2820510',
          }],
        },
      };

      const result = (scheduler as any).isConsultationNoteGeneric(documentReference);
      expect(result).toBe(true);
    });

    it('should reject non-consultation note documents', () => {
      const documentReference = {
        type: {
          coding: [{
            system: 'https://fhir.cerner.com/ec2458f2-1e24-41c8-b71b-0e701af7583d/codeSet/72',
            code: 'other-code',
          }],
        },
      };

      const result = (scheduler as any).isConsultationNoteGeneric(documentReference);
      expect(result).toBe(false);
    });

    it('should handle documents without type coding', () => {
      const documentReference = {
        type: {},
      };

      const result = (scheduler as any).isConsultationNoteGeneric(documentReference);
      expect(result).toBe(false);
    });
  });
});
