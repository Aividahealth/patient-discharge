/**
 * Discharge Summaries API Client
 *
 * Client library for interacting with the discharge summaries backend API
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export interface DischargeSummaryMetadata {
  id: string;
  patientId?: string;
  patientName?: string;
  mrn?: string;
  encounterId?: string;
  admissionDate?: Date;
  dischargeDate?: Date;
  status: 'raw_only' | 'simplified' | 'translated' | 'processing' | 'error';
  files: {
    raw?: string;
    simplified?: string;
    translated?: Record<string, string>;
  };
  createdAt: Date;
  updatedAt: Date;
  simplifiedAt?: Date;
  translatedAt?: Date;
  metadata?: {
    facility?: string;
    department?: string;
    attendingPhysician?: string;
    diagnosis?: string[];
  };
}

export interface DischargeSummaryContent {
  metadata: DischargeSummaryMetadata;
  content: {
    content: string;
    version: 'raw' | 'simplified' | 'translated';
    language: string;
    fileSize: number;
    lastModified: string;
  };
}

export interface ListDischargeSummariesParams {
  patientId?: string;
  patientName?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
}

export interface ListDischargeSummariesResponse {
  items: DischargeSummaryMetadata[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * List discharge summaries with optional filtering and pagination
 */
export async function listDischargeSummaries(
  params?: ListDischargeSummariesParams
): Promise<ListDischargeSummariesResponse> {
  const queryParams = new URLSearchParams();

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, String(value));
      }
    });
  }

  const url = `${API_BASE_URL}/discharge-summaries${queryParams.toString() ? `?${queryParams}` : ''}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch discharge summaries: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get discharge summary metadata by ID
 */
export async function getDischargeSummaryMetadata(
  id: string
): Promise<DischargeSummaryMetadata> {
  const response = await fetch(`${API_BASE_URL}/discharge-summaries/${id}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch discharge summary metadata: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get discharge summary content (metadata + markdown content)
 */
export async function getDischargeSummaryContent(
  id: string,
  version: 'raw' | 'simplified' | 'translated' = 'simplified',
  language?: string
): Promise<DischargeSummaryContent> {
  const params = new URLSearchParams({ version });
  if (language) {
    params.append('language', language);
  }

  const response = await fetch(
    `${API_BASE_URL}/discharge-summaries/${id}/content?${params}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch discharge summary content: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get discharge summaries statistics
 */
export async function getDischargeSummariesStats(): Promise<{
  firestore: {
    total: number;
    byStatus: Record<string, number>;
  };
  gcs: {
    raw: number;
    simplified: number;
    translated: number;
  };
}> {
  const response = await fetch(`${API_BASE_URL}/discharge-summaries/stats/overview`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch discharge summaries stats: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Manually trigger sync of all GCS files to Firestore
 */
export async function syncAllDischargeSummaries(): Promise<{
  success: boolean;
  synced: number;
  failed: number;
  errors: string[];
}> {
  const response = await fetch(`${API_BASE_URL}/discharge-summaries/sync/all`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to sync discharge summaries: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Manually trigger sync of a single file from GCS to Firestore
 */
export async function syncDischargeSummaryFile(
  bucket: string,
  file: string
): Promise<DischargeSummaryMetadata> {
  const params = new URLSearchParams({ bucket, file });

  const response = await fetch(
    `${API_BASE_URL}/discharge-summaries/sync/file?${params}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to sync discharge summary file: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Delete a discharge summary and its associated files
 */
export async function deleteDischargeSummary(
  id: string
): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${API_BASE_URL}/discharge-summaries/${id}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to delete discharge summary: ${response.statusText}`);
  }

  return response.json();
}
