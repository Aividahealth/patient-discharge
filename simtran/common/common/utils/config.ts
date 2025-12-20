import { Config } from '../types';

/**
 * Load and validate configuration from environment variables
 */
export function loadConfig(): Config {
  // Load environment variables (for local development)
  if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
  }

  const config: Config = {
    projectId: process.env.PROJECT_ID || process.env.GCP_PROJECT || '',
    location: process.env.LOCATION || 'us-central1',
    modelName: process.env.MODEL_NAME || 'gemini-3-flash',
    inputBucket: process.env.INPUT_BUCKET || 'discharge-summaries-raw',
    outputBucket: process.env.OUTPUT_BUCKET || 'discharge-summaries-simplified',
    maxOutputTokens: parseInt(process.env.MAX_OUTPUT_TOKENS || '8192', 10),
    temperature: parseFloat(process.env.TEMPERATURE || '0.0'),
    topP: parseFloat(process.env.TOP_P || '0.95'),
    topK: parseInt(process.env.TOP_K || '40', 10),
    maxRetries: parseInt(process.env.MAX_RETRIES || '3', 10),
    retryDelayMs: parseInt(process.env.RETRY_DELAY_MS || '1000', 10),
    maxFileSizeMb: parseInt(process.env.MAX_FILE_SIZE_MB || '5', 10),
    allowedFileExtensions: (process.env.ALLOWED_FILE_EXTENSIONS || '.md,.txt').split(','),
  };

  // Validate required configuration
  if (!config.projectId) {
    throw new Error('PROJECT_ID environment variable is required');
  }

  return config;
}

/**
 * Get configuration singleton
 */
let configInstance: Config | null = null;

export function getConfig(): Config {
  if (!configInstance) {
    configInstance = loadConfig();
  }
  return configInstance;
}
