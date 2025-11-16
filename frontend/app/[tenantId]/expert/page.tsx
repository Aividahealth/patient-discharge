"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2, ClipboardCheck, Star, Stethoscope, Languages, Trash2 } from "lucide-react"
import { getReviewList, ReviewSummary, ReviewType } from "@/lib/expert-api"
import { useTenant } from "@/contexts/tenant-context"
import { getLanguageName } from "@/lib/constants/languages"
import { ErrorBoundary } from "@/components/error-boundary"
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
  const { tenantId, token, isLoading, isAuthenticated } = useTenant()
  const [medicalSummaries, setMedicalSummaries] = useState<ReviewSummary[]>([])
  const [languageSummaries, setLanguageSummaries] = useState<ReviewSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'no_reviews' | 'low_rating'>('all')
  const [activeTab, setActiveTab] = useState<'medical' | 'language'>('medical')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [patientToDelete, setPatientToDelete] = useState<{ id: string; name?: string } | null>(null)
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
      setMedicalSummaries(medicalResponse.summaries)
      setLanguageSummaries(languageResponse.summaries)
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
    setPatientToDelete({ id: summary.id, name: summary.patientName })
    setDeleteDialogOpen(true)
  }

  const handleDeletePatient = async () => {
    if (!patientToDelete || !tenantId || !token) return
    try {
      setDeleting(true)
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || ''
      const resp = await fetch(`${apiUrl}/google/fhir/Patient/${patientToDelete.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Tenant-ID': tenantId,
        },
      })
      if (!resp.ok) {
        const msg = await resp.text().catch(() => resp.statusText)
        throw new Error(`Failed to delete patient: ${resp.status} ${msg}`)
      }
      await loadSummaries()
      setDeleteDialogOpen(false)
      setPatientToDelete(null)
    } catch (e) {
      console.error('[ExpertPortal] Failed to delete patient:', e)
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
      <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
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
                    render: (summary: ReviewSummary) => ColumnRenderers.count(summary.reviewCount || 0)
                  },
                  {
                    key: 'rating',
                    header: 'Rating',
                    render: (summary: ReviewSummary) =>
                      ColumnRenderers.rating(summary.reviewCount || 0, summary.avgRating)
                  },
                  {
                    key: 'status',
                    header: 'Status',
                    render: (summary: ReviewSummary) =>
                      ColumnRenderers.status(summary.reviewCount || 0, summary.avgRating)
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
                    render: (summary: ReviewSummary) => ColumnRenderers.count(summary.reviewCount || 0)
                  },
                  {
                    key: 'rating',
                    header: 'Rating',
                    render: (summary: ReviewSummary) =>
                      ColumnRenderers.rating(summary.reviewCount || 0, summary.avgRating)
                  },
                  {
                    key: 'status',
                    header: 'Status',
                    render: (summary: ReviewSummary) =>
                      ColumnRenderers.status(summary.reviewCount || 0, summary.avgRating)
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
              <AlertDialogTitle>Delete Patient?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete <strong>{patientToDelete?.name || 'this patient'}</strong>?
                <br /><br />
                This will call DELETE /google/fhir/Patient/{patientToDelete?.id} and cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeletePatient}
                disabled={deleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleting ? 'Deleting…' : 'Delete Patient'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
      </div>
    </ErrorBoundary>
  )
}
