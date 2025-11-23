"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2, ClipboardCheck, Star, Stethoscope, Languages, Trash2, BarChart, LogOut } from "lucide-react"
import { getReviewList, getFeedbackStats, ReviewSummary, ReviewType } from "@/lib/expert-api"
import { QualityMetricsCard } from "@/components/quality-metrics-card"
import { useTenant } from "@/contexts/tenant-context"
import { getLanguageName } from "@/lib/constants/languages"
import { ErrorBoundary } from "@/components/error-boundary"
import { CommonHeader } from "@/components/common-header"
import { ReviewTable, ColumnRenderers } from "@/components/review-table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

export default function ExpertPortalPage() {
  const router = useRouter()
  const { tenantId, token, isLoading, isAuthenticated, logout } = useTenant()
  const [medicalSummaries, setMedicalSummaries] = useState<ReviewSummary[]>([])
  const [languageSummaries, setLanguageSummaries] = useState<ReviewSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'no_reviews' | 'low_rating'>('all')
  const [activeTab, setActiveTab] = useState<'medical' | 'language'>('medical')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [patientToDelete, setPatientToDelete] = useState<{ id: string; compositionId: string; name?: string } | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated && tenantId) {
      router.push(`/${tenantId}/login`)
    }
  }, [isLoading, isAuthenticated, tenantId, router])

  useEffect(() => {
    if (tenantId && token) {
      loadSummaries()
    } else {
      setLoading(false)
    }
  }, [filter, activeTab, tenantId, token])

  const loadSummaries = async () => {
    if (!tenantId || !token) {
      console.error('[ExpertPortal] Missing tenant context')
      return
    }

    try {
      setLoading(true)
      const [medicalResponse, languageResponse] = await Promise.all([
        getReviewList({ type: 'simplification', filter, limit: 50, tenantId, token }),
        getReviewList({ type: 'translation', filter, limit: 50, tenantId, token })
      ])

      // Fetch stats for each summary in parallel
      const fetchStatsForSummaries = async (summaries: ReviewSummary[], reviewType: ReviewType) => {
        const statsPromises = summaries.map(async (summary) => {
          try {
            const statsResponse = await getFeedbackStats(
              summary.compositionId,
              { reviewType, includeStats: true, includeFeedback: false },
              { tenantId, token }
            )
            return {
              ...summary,
              stats: statsResponse.stats,
              // Update reviewCount and avgRating from stats if available
              reviewCount: statsResponse.stats?.totalReviews ?? summary.reviewCount ?? 0,
              avgRating: reviewType === 'simplification' 
                ? statsResponse.stats?.simplificationRating ?? summary.avgRating
                : statsResponse.stats?.translationRating ?? summary.avgRating,
              latestReviewDate: statsResponse.stats?.latestReviewDate 
                ? new Date(statsResponse.stats.latestReviewDate) 
                : summary.latestReviewDate,
            }
          } catch (error) {
            console.error(`[ExpertPortal] Failed to fetch stats for ${summary.compositionId}:`, error)
            return summary
          }
        })
        return Promise.all(statsPromises)
      }

      const [medicalWithStats, languageWithStats] = await Promise.all([
        fetchStatsForSummaries(medicalResponse.summaries, 'simplification'),
        fetchStatsForSummaries(languageResponse.summaries, 'translation')
      ])

      setMedicalSummaries(medicalWithStats)
      setLanguageSummaries(languageWithStats)
    } catch (error) {
      console.error('[ExpertPortal] Failed to load summaries:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleReview = (summary: ReviewSummary, reviewType: ReviewType) => {
    // Use compositionId for fetching content
    router.push(`/${tenantId}/expert/review/${summary.compositionId}?type=${reviewType}&patientId=${summary.id}`)
  }

  const confirmDeletePatient = (summary: ReviewSummary) => {
    setPatientToDelete({ 
      id: summary.id, 
      compositionId: summary.compositionId,
      name: summary.patientName 
    })
    setDeleteDialogOpen(true)
  }

  const handleDeletePatient = async (retryCount = 0) => {
    if (!patientToDelete || !tenantId || !token) return
    try {
      setDeleting(true)
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || ''
      
      // Use cascading delete endpoint that handles DocumentReferences, Composition, and Patient
      const deleteResp = await fetch(
        `${apiUrl}/google/fhir/Patient/${patientToDelete.id}/with-dependencies?compositionId=${patientToDelete.compositionId}`,
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'X-Tenant-ID': tenantId,
          },
        }
      )
      
      if (!deleteResp.ok) {
        const errorData = await deleteResp.json().catch(() => ({ message: deleteResp.statusText }))
        const errorMsg = errorData.message || `Failed to delete: ${deleteResp.status} ${deleteResp.statusText}`
        throw new Error(errorMsg)
      }
      
      const result = await deleteResp.json()
      console.log('[ExpertPortal] Delete result:', result)
      
      // Check if deletion was successful
      if (result.success) {
        // Store the IDs to filter out after reload (in case backend still returns deleted patient)
        const deletedPatientId = patientToDelete.id
        const deletedCompositionId = patientToDelete.compositionId
        
        // Optimistically remove the patient from the UI immediately
        // This provides instant feedback while the backend processes the deletion
        setMedicalSummaries(prev => prev.filter(s => 
          s.id !== deletedPatientId && s.compositionId !== deletedCompositionId
        ))
        setLanguageSummaries(prev => prev.filter(s => 
          s.id !== deletedPatientId && s.compositionId !== deletedCompositionId
        ))
        
        // Close dialog and clear selection
        setDeleteDialogOpen(false)
        setPatientToDelete(null)
        
        // Reload summaries to ensure consistency with backend
        // Filter out the deleted patient in case backend still returns it (caching/timing)
        try {
          await loadSummaries()
          // After reload, ensure deleted patient is still filtered out
          setMedicalSummaries(prev => prev.filter(s => 
            s.id !== deletedPatientId && s.compositionId !== deletedCompositionId
          ))
          setLanguageSummaries(prev => prev.filter(s => 
            s.id !== deletedPatientId && s.compositionId !== deletedCompositionId
          ))
        } catch (reloadError) {
          console.error('[ExpertPortal] Failed to reload summaries after delete:', reloadError)
          // Keep the optimistic update even if reload fails
        }
      } else if (result.retryable && retryCount < 2) {
        // Partial deletion - automatically retry once
        console.log('[ExpertPortal] Partial deletion detected, retrying...', result)
        // Wait a moment for resources to be fully cleaned up
        await new Promise(resolve => setTimeout(resolve, 1000))
        // Retry the deletion
        return handleDeletePatient(retryCount + 1)
      } else {
        // Failed and not retryable, or too many retries
        const errorMsg = result.message || 'Failed to delete patient. Some resources may have been partially deleted.'
        throw new Error(errorMsg)
      }
    } catch (e) {
      console.error('[ExpertPortal] Failed to delete:', e)
      alert(e instanceof Error ? e.message : 'Failed to delete. Please try again.')
    } finally {
      setDeleting(false)
    }
  }

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Don't render anything if not authenticated (redirect is happening)
  if (!isAuthenticated) {
    return null
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-background flex flex-col">
      <CommonHeader title="Expert Review Portal" />
      
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <ClipboardCheck className="h-5 w-5" />
              </div>
              <div>
                <h1 className="font-heading text-xl font-semibold text-foreground">
                  Expert Review Portal
                </h1>
                <p className="text-sm text-muted-foreground">
                  Review discharge summaries and provide feedback
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => logout()}
                className="flex items-center gap-2"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(value: any) => setActiveTab(value)} className="mb-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="medical" className="flex items-center gap-2">
              <Stethoscope className="h-4 w-4" />
              Medical Content
            </TabsTrigger>
            <TabsTrigger value="language" className="flex items-center gap-2">
              <Languages className="h-4 w-4" />
              Language
            </TabsTrigger>
          </TabsList>

          {/* Filters */}
          <div className="mt-6 flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Filter:</span>
              <Select value={filter} onValueChange={(value: any) => setFilter(value)}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Summaries</SelectItem>
                  <SelectItem value="no_reviews">No Reviews Yet</SelectItem>
                  <SelectItem value="low_rating">Low Rating (&lt;3.5)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button variant="outline" onClick={loadSummaries} size="sm">
              Refresh
            </Button>
          </div>

          {/* Medical Content Tab */}
          <TabsContent value="medical">
            {/* Loading State */}
            {loading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            )}

            {/* Empty State */}
            {!loading && medicalSummaries.length === 0 && (
              <Card>
                <CardContent className="flex items-center justify-center py-12">
                  <div className="text-center">
                    {!tenantId || !token ? (
                      <>
                        <p className="text-lg font-medium text-foreground mb-1">
                          Authentication Required
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Please log in to view summaries
                        </p>
                      </>
                    ) : (
                      <>
                        <Stethoscope className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                        <p className="text-lg font-medium text-foreground mb-1">
                          No medical summaries found
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Try adjusting your filters or check back later
                        </p>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Medical Summaries List */}
            {!loading && (
              <ReviewTable
                columns={[
                  {
                    key: 'patientName',
                    header: 'Patient',
                    render: (summary: ReviewSummary) => (
                      <div className="flex items-center gap-2">
                        <div className="font-medium text-sm">{summary.patientName}</div>
                        <button
                          type="button"
                          className="inline-flex h-6 w-6 items-center justify-center rounded hover:bg-destructive/10 text-destructive"
                          title="Delete patient (FHIR Patient resource)"
                          onClick={(e) => {
                            e.stopPropagation()
                            confirmDeletePatient(summary)
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                        {summary.unit && (
                          <div className="text-xs text-muted-foreground">{summary.unit}</div>
                        )}
                      </div>
                    )
                  },
                  {
                    key: 'mrn',
                    header: 'MRN',
                    render: (summary: ReviewSummary) => (
                      <div className="text-sm font-mono">{summary.mrn}</div>
                    )
                  },
                  {
                    key: 'dischargeDate',
                    header: 'Discharge Date',
                    render: (summary: ReviewSummary) => ColumnRenderers.date(summary.dischargeDate)
                  },
                  {
                    key: 'reviewCount',
                    header: 'Reviews',
                    render: (summary: ReviewSummary) => {
                      const stats = summary.stats
                      if (stats) {
                        return (
                          <div className="flex flex-col gap-1">
                            <div className="text-sm font-medium">
                              {stats.simplificationReviews} simplification
                            </div>
                            {stats.translationReviews > 0 && (
                              <div className="text-xs text-muted-foreground">
                                {stats.translationReviews} translation
                              </div>
                            )}
                          </div>
                        )
                      }
                      return ColumnRenderers.count(summary.reviewCount || 0)
                    }
                  },
                  {
                    key: 'rating',
                    header: 'Rating',
                    render: (summary: ReviewSummary) => {
                      const stats = summary.stats
                      if (stats) {
                        return (
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1">
                              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                              <span className="text-sm font-medium">
                                {stats.simplificationRating.toFixed(1)}
                              </span>
                            </div>
                            {stats.translationRating > 0 && (
                              <div className="text-xs text-muted-foreground">
                                Trans: {stats.translationRating.toFixed(1)}
                              </div>
                            )}
                          </div>
                        )
                      }
                      return ColumnRenderers.rating(summary.reviewCount || 0, summary.avgRating)
                    }
                  },
                  {
                    key: 'qualityMetrics',
                    header: 'Quality Metrics',
                    render: (summary: ReviewSummary) => (
                      summary.qualityMetrics ? (
                        <QualityMetricsCard metrics={summary.qualityMetrics} compact />
                      ) : (
                        <span className="text-xs text-muted-foreground">No metrics</span>
                      )
                    )
                  },
                  {
                    key: 'status',
                    header: 'Status',
                    render: (summary: ReviewSummary) => {
                      const stats = summary.stats
                      const reviewCount = stats?.totalReviews ?? summary.reviewCount ?? 0
                      const avgRating = stats?.simplificationRating ?? summary.avgRating
                      const hasIssues = stats?.hasHallucination || stats?.hasMissingInfo
                      
                      return (
                        <div className="flex flex-col gap-1">
                          {ColumnRenderers.status(reviewCount, avgRating)}
                          {hasIssues && (
                            <div className="flex gap-1 mt-1">
                              {stats?.hasHallucination && (
                                <Badge variant="destructive" className="text-xs">
                                  Hallucination
                                </Badge>
                              )}
                              {stats?.hasMissingInfo && (
                                <Badge variant="destructive" className="text-xs">
                                  Missing Info
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    }
                  },
                  {
                    key: 'latestReviewDate',
                    header: 'Last Review',
                    render: (summary: ReviewSummary) => (
                      <div className="text-sm text-muted-foreground">
                        {summary.latestReviewDate
                          ? new Date(summary.latestReviewDate).toLocaleDateString()
                          : 'Never'
                        }
                      </div>
                    )
                  }
                ]}
                data={medicalSummaries}
                onAction={(summary) => handleReview(summary, 'simplification')}
                actionLabel="Review →"
                emptyMessage="No medical summaries found. Try adjusting your filters or check back later."
                keyExtractor={(summary) => summary.id}
              />
            )}

            {/* Load More (if needed) */}
            {!loading && medicalSummaries.length > 0 && medicalSummaries.length % 50 === 0 && (
              <div className="mt-6 text-center">
                <Button variant="outline" onClick={loadSummaries}>
                  Load More
                </Button>
              </div>
            )}
          </TabsContent>

          {/* Language Tab */}
          <TabsContent value="language">
            {/* Loading State */}
            {loading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            )}

            {/* Empty State */}
            {!loading && languageSummaries.length === 0 && (
              <Card>
                <CardContent className="flex items-center justify-center py-12">
                  <div className="text-center">
                    {!tenantId || !token ? (
                      <>
                        <p className="text-lg font-medium text-foreground mb-1">
                          Authentication Required
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Please log in to view summaries
                        </p>
                      </>
                    ) : (
                      <>
                        <Languages className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                        <p className="text-lg font-medium text-foreground mb-1">
                          No language summaries found
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Try adjusting your filters or check back later
                        </p>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Language Summaries List */}
            {!loading && (
              <ReviewTable
                columns={[
                  {
                    key: 'patientName',
                    header: 'Patient',
                    render: (summary: ReviewSummary) => (
                      <div>
                        <div className="font-medium text-sm">{summary.patientName}</div>
                        {summary.unit && (
                          <div className="text-xs text-muted-foreground">{summary.unit}</div>
                        )}
                      </div>
                    )
                  },
                  {
                    key: 'mrn',
                    header: 'MRN',
                    render: (summary: ReviewSummary) => (
                      <div className="text-sm font-mono">{summary.mrn}</div>
                    )
                  },
                  {
                    key: 'language',
                    header: 'Language',
                    render: (summary: ReviewSummary) => (
                      <div className="text-sm">
                        {getLanguageName(summary.language || 'en', true)}
                      </div>
                    )
                  },
                  {
                    key: 'dischargeDate',
                    header: 'Discharge Date',
                    render: (summary: ReviewSummary) => ColumnRenderers.date(summary.dischargeDate)
                  },
                  {
                    key: 'reviewCount',
                    header: 'Reviews',
                    render: (summary: ReviewSummary) => {
                      const stats = summary.stats
                      if (stats) {
                        return (
                          <div className="flex flex-col gap-1">
                            <div className="text-sm font-medium">
                              {stats.translationReviews} translation
                            </div>
                            {stats.simplificationReviews > 0 && (
                              <div className="text-xs text-muted-foreground">
                                {stats.simplificationReviews} simplification
                              </div>
                            )}
                          </div>
                        )
                      }
                      return ColumnRenderers.count(summary.reviewCount || 0)
                    }
                  },
                  {
                    key: 'rating',
                    header: 'Rating',
                    render: (summary: ReviewSummary) => {
                      const stats = summary.stats
                      if (stats) {
                        return (
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1">
                              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                              <span className="text-sm font-medium">
                                {stats.translationRating.toFixed(1)}
                              </span>
                            </div>
                            {stats.simplificationRating > 0 && (
                              <div className="text-xs text-muted-foreground">
                                Simpl: {stats.simplificationRating.toFixed(1)}
                              </div>
                            )}
                          </div>
                        )
                      }
                      return ColumnRenderers.rating(summary.reviewCount || 0, summary.avgRating)
                    }
                  },
                  {
                    key: 'status',
                    header: 'Status',
                    render: (summary: ReviewSummary) => {
                      const stats = summary.stats
                      const reviewCount = stats?.totalReviews ?? summary.reviewCount ?? 0
                      const avgRating = stats?.translationRating ?? summary.avgRating
                      const hasIssues = stats?.hasHallucination || stats?.hasMissingInfo
                      
                      return (
                        <div className="flex flex-col gap-1">
                          {ColumnRenderers.status(reviewCount, avgRating)}
                          {hasIssues && (
                            <div className="flex gap-1 mt-1">
                              {stats?.hasHallucination && (
                                <Badge variant="destructive" className="text-xs">
                                  Hallucination
                                </Badge>
                              )}
                              {stats?.hasMissingInfo && (
                                <Badge variant="destructive" className="text-xs">
                                  Missing Info
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    }
                  },
                  {
                    key: 'latestReviewDate',
                    header: 'Last Review',
                    render: (summary: ReviewSummary) => (
                      <div className="text-sm text-muted-foreground">
                        {summary.latestReviewDate
                          ? new Date(summary.latestReviewDate).toLocaleDateString()
                          : 'Never'
                        }
                      </div>
                    )
                  }
                ]}
                data={languageSummaries}
                onAction={(summary) => handleReview(summary, 'translation')}
                actionLabel="Review →"
                emptyMessage="No language summaries found. Try adjusting your filters or check back later."
                keyExtractor={(summary) => summary.id}
              />
            )}

            {/* Load More (if needed) */}
            {!loading && languageSummaries.length > 0 && languageSummaries.length % 50 === 0 && (
              <div className="mt-6 text-center">
                <Button variant="outline" onClick={loadSummaries}>
                  Load More
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
        {/* Delete Patient Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Patient and Discharge Summary?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete <strong>{patientToDelete?.name || 'this patient'}</strong>?
                <br /><br />
                This will delete:
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Composition: {patientToDelete?.compositionId}</li>
                  <li>Patient: {patientToDelete?.id}</li>
                </ul>
                <br />
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeletePatient}
                disabled={deleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleting ? 'Deleting…' : 'Delete Patient & Summary'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
      </div>
    </ErrorBoundary>
  )
}
