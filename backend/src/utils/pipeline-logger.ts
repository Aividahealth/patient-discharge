import { Logger } from '@nestjs/common';

type PipelineStep =
  | 'frontend_upload'
  | 'backend_publish_to_topic'
  | 'simplify'
  | 'store_in_fhir'
  | 'publish_simplified'
  | 'translate'
  | 'store_translated_in_fhir';

type PipelineStatus = 'completed' | 'failed' | 'in_progress';

const logger = new Logger('PipelineLogger');

export function logPipelineEvent(params: {
  tenantId: string;
  compositionId: string;
  step: PipelineStep;
  status: PipelineStatus;
  durationMs?: number;
  metadata?: Record<string, unknown>;
  error?: { message: string; name?: string; stack?: string } | null;
}): void {
  const {
    tenantId,
    compositionId,
    step,
    status,
    durationMs,
    metadata,
    error,
  } = params;

  const entry = {
    type: 'pipeline_event',
    tenantId,
    compositionId,
    step,
    status,
    durationMs: durationMs ?? 0,
    metadata: metadata ?? {},
    error: error ?? null,
    timestamp: new Date().toISOString(),
  };

  // Emit as a single JSON line for Cloud Logging
  logger.log(JSON.stringify(entry));
}


