'use client'

import { createApiClient } from './api-client'

export interface AggregateQualityMetrics {
  totalSummaries: number
  avgCompressionRatio: number
  targetAchievementRate: number
  original: {
    avgGradeLevel: number
    avgReadingEase: number
    avgSmogIndex: number
  }
  simplified: {
    avgGradeLevel: number
    avgReadingEase: number
    avgSmogIndex: number
  }
  improvement: {
    gradeLevel: number
    readingEase: number
    readingEasePercent: number
    smogIndex: number
  }
}

/**
 * Fetch aggregate quality metrics for a tenant
 */
export async function getAggregateQualityMetrics(
  token: string,
  tenantId: string
): Promise<AggregateQualityMetrics> {
  const apiClient = createApiClient({ token, tenantId })
  return apiClient.get<AggregateQualityMetrics>('/api/tenant/quality-metrics/aggregate')
}
