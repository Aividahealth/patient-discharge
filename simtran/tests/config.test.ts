import { loadConfig } from '../src/utils/config';

describe('Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should load config with all environment variables', () => {
    process.env.PROJECT_ID = 'test-project';
    process.env.LOCATION = 'us-west1';
    process.env.MODEL_NAME = 'gemini-1.5-flash';
    process.env.MAX_OUTPUT_TOKENS = '4096';
    process.env.TEMPERATURE = '0.5';
    process.env.TOP_P = '0.9';
    process.env.TOP_K = '20';
    process.env.MAX_RETRIES = '5';
    process.env.RETRY_DELAY_MS = '2000';
    process.env.MAX_FILE_SIZE_MB = '10';
    process.env.ALLOWED_FILE_EXTENSIONS = '.md,.txt,.doc';

    const config = loadConfig();

    expect(config.projectId).toBe('test-project');
    expect(config.location).toBe('us-west1');
    expect(config.modelName).toBe('gemini-1.5-flash');
    expect(config.maxOutputTokens).toBe(4096);
    expect(config.temperature).toBe(0.5);
    expect(config.topP).toBe(0.9);
    expect(config.topK).toBe(20);
    expect(config.maxRetries).toBe(5);
    expect(config.retryDelayMs).toBe(2000);
    expect(config.maxFileSizeMb).toBe(10);
    expect(config.allowedFileExtensions).toEqual(['.md', '.txt', '.doc']);
  });

  it('should use default values when environment variables are not set', () => {
    process.env.PROJECT_ID = 'test-project';

    const config = loadConfig();

    expect(config.projectId).toBe('test-project');
    expect(config.location).toBe('us-central1');
    expect(config.modelName).toBe('gemini-1.5-pro');
    expect(config.maxOutputTokens).toBe(8192);
    expect(config.temperature).toBe(0.3);
    expect(config.maxRetries).toBe(3);
  });

  it('should throw error when PROJECT_ID is missing', () => {
    const savedProjectId = process.env.PROJECT_ID;
    const savedGcpProject = process.env.GCP_PROJECT;

    process.env.PROJECT_ID = '';
    process.env.GCP_PROJECT = '';

    // Re-import after changing env
    jest.isolateModules(() => {
      const { loadConfig: loadConfigIsolated } = require('../src/utils/config');
      expect(() => loadConfigIsolated()).toThrow('PROJECT_ID environment variable is required');
    });

    // Restore
    process.env.PROJECT_ID = savedProjectId;
    process.env.GCP_PROJECT = savedGcpProject;
  });

  it('should use GCP_PROJECT as fallback for PROJECT_ID', () => {
    const savedProjectId = process.env.PROJECT_ID;

    process.env.PROJECT_ID = '';
    process.env.GCP_PROJECT = 'fallback-project';

    // Re-import after changing env
    jest.isolateModules(() => {
      const { loadConfig: loadConfigIsolated } = require('../src/utils/config');
      const config = loadConfigIsolated();
      expect(config.projectId).toBe('fallback-project');
    });

    // Restore
    process.env.PROJECT_ID = savedProjectId;
  });
});
