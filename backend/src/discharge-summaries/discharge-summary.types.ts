/**
 * Discharge Summary Types and Interfaces
 */

export enum DischargeSummaryVersion {
  RAW = 'raw',
  SIMPLIFIED = 'simplified',
  TRANSLATED = 'translated',
}

export enum DischargeSummaryLanguage {
  EN = 'en',
  ES = 'es',
  FR = 'fr',
  HI = 'hi',
  DE = 'de',
  IT = 'it',
  PT = 'pt',
  RU = 'ru',
  JA = 'ja',
  KO = 'ko',
  ZH = 'zh',
}

export enum DischargeSummaryStatus {
  RAW_ONLY = 'raw_only',
  SIMPLIFIED = 'simplified',
  TRANSLATED = 'translated',
  PROCESSING = 'processing',
  ERROR = 'error',
}

export interface DischargeSummaryFiles {
  raw?: string; // GCS path to raw file
  simplified?: string; // GCS path to simplified file
  translated?: {
    [key in DischargeSummaryLanguage]?: string; // GCS paths to translated files
  };
}

/**
 * Quality metrics for text simplification
 */
export interface QualityMetrics {
  // Readability Metrics
  readability: {
    fleschKincaidGradeLevel: number;
    fleschReadingEase: number;
    smogIndex: number;
    colemanLiauIndex: number;
    automatedReadabilityIndex: number;
  };

  // Simplification Metrics
  simplification: {
    compressionRatio: number; // (original - simplified) / original
    sentenceLengthReduction: number; // average sentence length reduction
    avgSentenceLength: number;
    avgWordLength: number;
  };

  // Lexical Metrics
  lexical: {
    typeTokenRatio: number; // vocabulary diversity
    wordCount: number;
    sentenceCount: number;
    syllableCount: number;
    complexWordCount: number; // words with 3+ syllables
  };

  // Semantic Preservation (placeholder for future BERTScore)
  semantic?: {
    bertScore?: number;
    similarity?: number;
  };

  // Metadata
  metadata: {
    calculatedAt: Date;
    originalWordCount: number;
    simplifiedWordCount: number;
  };
}

export interface DischargeSummaryMetadata {
  id: string; // Unique identifier
  tenantId: string; // Tenant identifier (required for multi-tenant isolation)
  patientId?: string; // Patient identifier
  patientName?: string; // Patient name (if available)
  mrn?: string; // Medical Record Number
  encounterId?: string; // Encounter/admission ID
  admissionDate?: Date; // Admission date
  dischargeDate?: Date; // Discharge date
  status: DischargeSummaryStatus;
  files: DischargeSummaryFiles;
  createdAt: Date;
  updatedAt: Date;
  simplifiedAt?: Date; // When simplified version was created
  translatedAt?: Date; // When translation was created
  qualityMetrics?: QualityMetrics; // Quality metrics for simplified version
  metadata?: {
    // Additional metadata
    facility?: string;
    department?: string;
    attendingPhysician?: string;
    diagnosis?: string[];
  };
}

export interface DischargeSummaryContent {
  content: string; // Markdown content
  version: DischargeSummaryVersion;
  language: DischargeSummaryLanguage;
  fileSize: number; // Size in bytes
  lastModified: Date;
}

export interface DischargeSummaryResponse {
  metadata: DischargeSummaryMetadata;
  content?: DischargeSummaryContent;
}

export interface DischargeSummaryListQuery {
  patientId?: string;
  patientName?: string;
  startDate?: string; // ISO date string
  endDate?: string; // ISO date string
  status?: DischargeSummaryStatus;
  limit?: number;
  offset?: number;
  orderBy?: 'admissionDate' | 'dischargeDate' | 'createdAt' | 'updatedAt';
  orderDirection?: 'asc' | 'desc';
}

export interface DischargeSummaryListResponse {
  items: DischargeSummaryMetadata[];
  total: number;
  limit: number;
  offset: number;
}

export interface DischargeSummaryContentQuery {
  id: string;
  version: DischargeSummaryVersion;
  language?: DischargeSummaryLanguage;
}

export interface SyncResult {
  success: boolean;
  synced: number;
  failed: number;
  errors: string[];
}
