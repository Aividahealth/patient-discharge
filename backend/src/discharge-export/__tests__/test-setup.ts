// Test setup for discharge-export module
import 'reflect-metadata';
import { TenantContext } from '../../tenant/tenant-context';
import { ExportResult, DocumentExportEvent } from '../types/discharge-export.types';

// Mock console methods to reduce noise during tests
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeAll(() => {
  // Suppress console output during tests unless explicitly needed
  console.log = jest.fn();
  console.error = jest.fn();
  console.warn = jest.fn();
});

afterAll(() => {
  // Restore console methods
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

// Global test utilities
export const createMockTenantContext = (overrides: Partial<TenantContext> = {}): TenantContext => ({
  tenantId: 'test-tenant',
  userId: 'test-user',
  timestamp: new Date(),
  ...overrides,
});

export const createMockExportResult = (overrides: Partial<ExportResult> = {}): ExportResult => ({
  success: true,
  cernerDocumentId: 'doc-123',
  googleBinaryId: 'binary-456',
  googleDocumentReferenceId: 'docref-789',
  cernerPatientId: 'patient-1',
  metadata: {
    exportTimestamp: '2025-01-12T10:00:00Z',
  },
  ...overrides,
});

export const createMockDocumentExportEvent = (overrides: Partial<DocumentExportEvent> = {}): DocumentExportEvent => ({
  documentReferenceId: 'doc-123',
  tenantId: 'test-tenant',
  exportTimestamp: '2025-01-12T10:00:00Z',
  status: 'success',
  ...overrides,
});

// Mock data factories
export const mockCernerDocument = {
  id: 'doc-123',
  patientId: 'patient-1',
  encounterId: 'encounter-1',
  content: [{
    url: 'https://cerner.com/Binary/binary-123',
  }],
  type: {
    coding: [{
      system: 'https://fhir.cerner.com/ec2458f2-1e24-41c8-b71b-0e701af7583d/codeSet/72',
      code: '2820510',
    }],
  },
};

export const mockBinaryData = {
  id: 'binary-123',
  data: 'base64-data',
  contentType: 'application/pdf',
  size: 1024,
};

export const mockGoogleResources = {
  binary: { id: 'google-binary-456' },
  documentReference: { id: 'google-docref-789' },
  composition: { id: 'google-comp-101' },
};

export const mockPatientMapping = {
  googlePatientId: 'google-patient-1',
  action: 'found' as const,
};
