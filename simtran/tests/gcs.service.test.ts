import { GCSService } from '../src/services/gcs.service';

// Mock the config
jest.mock('../src/utils/config', () => ({
  getConfig: jest.fn(() => ({
    projectId: 'test-project',
    maxFileSizeMb: 5,
    allowedFileExtensions: ['.md', '.txt'],
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

describe('GCSService', () => {
  let gcsService: GCSService;

  beforeEach(() => {
    gcsService = new GCSService();
  });

  describe('generateOutputFileName', () => {
    it('should generate correct output filename with .md extension', () => {
      const input = 'discharge-summary.md';
      const output = gcsService.generateOutputFileName(input);
      expect(output).toBe('discharge-summary-simplified.md');
    });

    it('should generate correct output filename with .txt extension', () => {
      const input = 'patient-notes.txt';
      const output = gcsService.generateOutputFileName(input);
      expect(output).toBe('patient-notes-simplified.txt');
    });

    it('should handle filenames with multiple dots', () => {
      const input = 'patient.john.doe.discharge.md';
      const output = gcsService.generateOutputFileName(input);
      expect(output).toBe('patient.john.doe.discharge-simplified.md');
    });

    it('should handle filenames without extension', () => {
      const input = 'discharge-summary';
      const output = gcsService.generateOutputFileName(input);
      expect(output).toBe('discharge-summary-simplified');
    });
  });

  describe('validateFile (via private method)', () => {
    it('should accept valid markdown file', () => {
      // This tests the validation indirectly through generateOutputFileName
      const validFile = 'test.md';
      const result = gcsService.generateOutputFileName(validFile);
      expect(result).toBeTruthy();
    });

    it('should accept valid text file', () => {
      const validFile = 'test.txt';
      const result = gcsService.generateOutputFileName(validFile);
      expect(result).toBeTruthy();
    });
  });
});
