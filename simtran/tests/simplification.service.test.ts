import { SimplificationService } from '../src/services/simplification.service';

// Mock the config
jest.mock('../src/utils/config', () => ({
  getConfig: jest.fn(() => ({
    projectId: 'test-project',
    location: 'us-central1',
    modelName: 'gemini-3-flash',
    maxOutputTokens: 8192,
    temperature: 0.3,
    topP: 0.95,
    topK: 40,
    maxRetries: 3,
    retryDelayMs: 1000,
  })),
}));

// Mock the logger
jest.mock('../src/utils/logger', () => ({
  createLogger: jest.fn(() => ({
    debug: jest.fn(),
    info: jest.fn(),
    warning: jest.fn(),
    error: jest.fn(),
  })),
}));

// Mock Vertex AI
jest.mock('@google-cloud/vertexai', () => ({
  VertexAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: jest.fn(),
  })),
}));

describe('SimplificationService', () => {
  let simplificationService: SimplificationService;

  beforeEach(() => {
    simplificationService = new SimplificationService();
  });

  describe('validateMedicalContent', () => {
    it('should validate content with sufficient medical keywords', () => {
      const validContent = `
        Discharge Summary

        Patient was admitted to the hospital for treatment.
        Diagnosis: Acute condition requiring medication.
        Follow-up with your doctor in 2 weeks.
        Prescription provided at discharge.
      `;

      const isValid = simplificationService.validateMedicalContent(validContent);
      expect(isValid).toBe(true);
    });

    it('should reject content with insufficient medical keywords', () => {
      const invalidContent = `
        This is a regular document about something.
        It has some text but nothing medical.
        Just random content here.
      `;

      const isValid = simplificationService.validateMedicalContent(invalidContent);
      expect(isValid).toBe(false);
    });

    it('should validate content with mixed case keywords', () => {
      const validContent = `
        DISCHARGE Summary

        PATIENT was ADMITTED to HOSPITAL.
        DIAGNOSIS provided with MEDICATION.
        FOLLOW-UP appointment scheduled.
      `;

      const isValid = simplificationService.validateMedicalContent(validContent);
      expect(isValid).toBe(true);
    });

    it('should handle empty content', () => {
      const emptyContent = '';
      const isValid = simplificationService.validateMedicalContent(emptyContent);
      expect(isValid).toBe(false);
    });
  });
});
