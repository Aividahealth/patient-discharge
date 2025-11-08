/**
 * Discharge Summaries API Client
 *
 * Client library for interacting with the discharge summaries backend API
 */

// Configure API base URL for different environments
const getApiBaseUrl = () => {
  // Production: Use environment variable or default to your Google Cloud backend
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  
  // Fallback to environment variable
  if (process.env.API_URL) {
    return process.env.API_URL;
  }
  
  // Development: Use localhost for backend
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:3000';
  }
  
  // Production fallback: Use your Google Cloud backend URL
  return 'https://patient-discharge-backend-647433528821.us-central1.run.app';
};

const API_BASE_URL = getApiBaseUrl();

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

/**
 * Discharge Queue Patient Interface
 */
export interface DischargeQueuePatient {
  id: string;
  mrn: string;
  name: string;
  room: string;
  unit: string;
  dischargeDate: string;
  compositionId: string;
  status: 'review' | 'approved' | 'pending';
  attendingPhysician: {
    name: string;
    id: string;
  };
  avatar: string | null;
}

export interface DischargeQueueResponse {
  patients: DischargeQueuePatient[];
  meta: {
    total: number;
    pending: number;
    review: number;
    approved: number;
  };
}

/**
 * Get discharge queue - list of patients ready for discharge review
 */
export async function getDischargeQueue(
  token: string,
  tenantId: string
): Promise<DischargeQueueResponse> {
  const response = await fetch(`${API_BASE_URL}/api/patients/discharge-queue`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'x-tenant-id': tenantId,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch discharge queue: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get patient details including original summary and patient-friendly version
 */
export interface PatientDetailsResponse {
  patientId: string;
  compositionId: string;
  rawSummary?: {
    text: string;
    parsedData?: any;
  };
  rawInstructions?: {
    text: string;
    parsedData?: any;
  };
  simplifiedSummary?: {
    text: string;
  };
  simplifiedInstructions?: {
    text: string;
  };
}

export async function getPatientDetails(
  patientId: string,
  compositionId: string,
  token: string,
  tenantId: string
): Promise<PatientDetailsResponse> {
  // Get API URL - use environment variable or fallback
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || API_BASE_URL;
  
  // Fetch composition data - use the same endpoint structure as refreshComposition
  // First get the binaries (raw content)
  const binariesResponse = await fetch(
    `${apiUrl}/google/fhir/Composition/${compositionId}/binaries`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-Tenant-ID': tenantId,
      },
    }
  );

  if (!binariesResponse.ok) {
    throw new Error(`Failed to fetch composition binaries: ${binariesResponse.statusText}`);
  }

  const compositionData = await binariesResponse.json();

  // Find raw and simplified content
  const rawSummary = compositionData.dischargeSummaries?.find((summary: any) =>
    !summary.tags?.some((tag: any) => tag.code === 'simplified-content')
  );
  const rawInstructions = compositionData.dischargeInstructions?.find((instr: any) =>
    !instr.tags?.some((tag: any) => tag.code === 'simplified-content')
  );
  const simplifiedSummary = compositionData.dischargeSummaries?.find((summary: any) =>
    summary.tags?.some((tag: any) => tag.code === 'simplified-content')
  );
  const simplifiedInstructions = compositionData.dischargeInstructions?.find((instr: any) =>
    instr.tags?.some((tag: any) => tag.code === 'simplified-content')
  );

  // Try to fetch AI-simplified content
  let aiSimplifiedSummary = null;
  let aiSimplifiedInstructions = null;

  try {
    const simplifiedResponse = await fetch(
      `${apiUrl}/google/fhir/Composition/${compositionId}/simplified`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Tenant-ID': tenantId,
        },
      }
    );

    if (simplifiedResponse.ok) {
      const simplifiedData = await simplifiedResponse.json();
      aiSimplifiedSummary = simplifiedData.dischargeSummaries?.find((summary: any) =>
        summary.tags?.some((tag: any) => tag.code === 'discharge-summary-simplified')
      );
      aiSimplifiedInstructions = simplifiedData.dischargeInstructions?.find((instr: any) =>
        instr.tags?.some((tag: any) => tag.code === 'discharge-instructions-simplified')
      );
    }
  } catch (error) {
    // Ignore errors fetching simplified content
    console.warn('Failed to fetch AI-simplified content:', error);
  }

  return {
    patientId,
    compositionId,
    rawSummary: rawSummary ? {
      text: rawSummary.text,
      parsedData: rawSummary.parsedData
    } : undefined,
    rawInstructions: rawInstructions ? {
      text: rawInstructions.text,
      parsedData: rawInstructions.parsedData
    } : undefined,
    simplifiedSummary: (aiSimplifiedSummary || simplifiedSummary) ? {
      text: (aiSimplifiedSummary || simplifiedSummary)?.text
    } : undefined,
    simplifiedInstructions: (aiSimplifiedInstructions || simplifiedInstructions) ? {
      text: (aiSimplifiedInstructions || simplifiedInstructions)?.text
    } : undefined,
  };
}
