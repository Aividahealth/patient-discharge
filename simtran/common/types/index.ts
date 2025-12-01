/**
 * Cloud Function Event Types
 */
export interface StorageObjectData {
  bucket: string;
  name: string;
  metageneration: string;
  timeCreated: string;
  updated: string;
  contentType?: string;
  size?: string;
}

export interface CloudEvent {
  id: string;
  source: string;
  specversion: string;
  type: string;
  data: StorageObjectData;
  time: string;
}

/**
 * Configuration Types
 */
export interface Config {
  projectId: string;
  location: string;
  modelName: string;
  inputBucket: string;
  outputBucket: string;
  maxOutputTokens: number;
  temperature: number;
  topP: number;
  topK: number;
  maxRetries: number;
  retryDelayMs: number;
  maxFileSizeMb: number;
  allowedFileExtensions: string[];
}

/**
 * Service Response Types
 */
export interface SimplificationResult {
  success: boolean;
  originalFileName: string;
  simplifiedFileName: string;
  originalSize: number;
  simplifiedSize: number;
  processingTimeMs: number;
  error?: string;
}

export interface GCSFileMetadata {
  name: string;
  bucket: string;
  size: number;
  contentType: string;
  timeCreated: Date;
  updated: Date;
}

/**
 * Error Types
 */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class GCSError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GCSError';
  }
}

export class VertexAIError extends Error {
  constructor(message: string, public readonly retryable: boolean = false) {
    super(message);
    this.name = 'VertexAIError';
  }
}

/**
 * Vertex AI Types
 */
export interface GenerationConfig {
  maxOutputTokens: number;
  temperature: number;
  topP: number;
  topK: number;
}

export interface SimplificationRequest {
  content: string;
  fileName: string;
}

export interface SimplificationResponse {
  simplifiedContent: string;
  tokensUsed?: number;
}

/**
 * Translation Types
 */
export interface TranslationRequest {
  content: string;
  fileName: string;
  targetLanguage: string;
}

export interface TranslationResponse {
  translatedContent: string;
  sourceLanguage: string;
  targetLanguage: string;
  qualityMetrics?: {
    translatedWordCount: number;
    processingTimeMs: number;
    detectedSourceLanguage?: string;
  };
}

export class TranslationError extends Error {
  constructor(message: string, public readonly retryable: boolean = false) {
    super(message);
    this.name = 'TranslationError';
  }
}

/**
 * Pub/Sub Message Types
 */
export interface DischargeExportEvent {
  tenantId: string;
  patientId: string;
  exportTimestamp: string;
  status: string;
  cernerEncounterId: string;
  googleEncounterId: string;
  googleCompositionId: string;
  preferredLanguage?: string;
}

/**
 * Simplified File Types
 */
export interface SimplifiedFile {
  type: 'discharge-summary' | 'discharge-instructions';
  originalPath: string;
  simplifiedPath: string;
  language: string;
}

export interface SimplificationCompletedEvent {
  tenantId: string;
  compositionId: string;
  simplifiedFiles: SimplifiedFile[];
  processingTimeMs: number;
  tokensUsed: number;
  timestamp: string;
  patientId?: string;
  preferredLanguage?: string;
}

/**
 * Tenant Configuration Types
 */
export interface TenantConfig {
  tenantId: string;
  buckets: {
    rawBucket: string;
    simplifiedBucket: string;
    translatedBucket: string;
  };
  translationConfig: {
    enabled: boolean;
    supportedLanguages: string[];
  };
}

/**
 * FHIR API Response Types
 */
export interface BinaryTag {
  code: string;
  display: string;
  system: string;
}

export interface Binary {
  id: string;
  contentType: string;
  size: number;
  text: string;
  category: string;
  tags: BinaryTag[];
}

export interface FHIRBinariesResponse {
  success: boolean;
  compositionId: string;
  dischargeSummaries: Binary[];
  dischargeInstructions: Binary[];
  totalBinaries: number;
  processedBinaries: number;
  timestamp: string;
  tenantId: string;
}

export class FHIRAPIError extends Error {
  constructor(message: string, public readonly retryable: boolean = false) {
    super(message);
    this.name = 'FHIRAPIError';
  }
}
