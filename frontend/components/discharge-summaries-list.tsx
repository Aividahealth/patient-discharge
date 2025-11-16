"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
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
import { Loader2, Search, FileText, Calendar, User, Trash2 } from "lucide-react"
import { useTenant } from "@/contexts/tenant-context"
import {
  listDischargeSummaries,
  deleteDischargeSummary,
  DischargeSummaryMetadata,
  ListDischargeSummariesParams,
} from "@/lib/discharge-summaries"

interface DischargeSummariesListProps {
  onSelectSummary?: (summary: DischargeSummaryMetadata) => void
  selectedSummaryId?: string | null
}

export function DischargeSummariesList({
  onSelectSummary,
  selectedSummaryId,
}: DischargeSummariesListProps) {
  const { tenantId, token } = useTenant()
  const [summaries, setSummaries] = useState<DischargeSummaryMetadata[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [total, setTotal] = useState(0)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [summaryToDelete, setSummaryToDelete] = useState<DischargeSummaryMetadata | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deletePatientDialogOpen, setDeletePatientDialogOpen] = useState(false)
  const [patientToDelete, setPatientToDelete] = useState<{ id: string; name: string } | null>(null)
  const [deletingPatient, setDeletingPatient] = useState(false)

  const loadSummaries = async (params?: ListDischargeSummariesParams) => {
    try {
      setLoading(true)
      setError(null)

      const response = await listDischargeSummaries({
        limit: 50,
        orderBy: 'updatedAt',
        orderDirection: 'desc',
        ...params,
      })

      setSummaries(response.items)
      setTotal(response.total)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load discharge summaries')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSummaries()
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery) {
        loadSummaries({ patientName: searchQuery })
      } else {
        loadSummaries()
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery])

  const getStatusBadge = (status: DischargeSummaryMetadata['status']) => {
    const variants: Record<typeof status, { variant: "default" | "secondary" | "destructive" | "outline", label: string }> = {
      'raw_only': { variant: 'outline', label: 'Raw Only' },
      'simplified': { variant: 'secondary', label: 'Simplified' },
      'translated': { variant: 'default', label: 'Translated' },
      'processing': { variant: 'outline', label: 'Processing' },
      'error': { variant: 'destructive', label: 'Error' },
    }

    const config = variants[status]
    return <Badge variant={config.variant}>{config.label}</Badge>
  }

  const handleDeleteClick = (summary: DischargeSummaryMetadata, e: React.MouseEvent) => {
    e.stopPropagation()
    setSummaryToDelete(summary)
    setDeleteDialogOpen(true)
  }

  const handleDeletePatientClick = (summary: DischargeSummaryMetadata, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!summary.patientId) {
      setError('Missing patientId for this summary')
      return
    }
    setPatientToDelete({
      id: summary.patientId,
      name: summary.patientName || 'this patient',
    })
    setDeletePatientDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!summaryToDelete) return

    try {
      setDeleting(true)
      await deleteDischargeSummary(summaryToDelete.id)

      // Remove from list
      setSummaries(prev => prev.filter(s => s.id !== summaryToDelete.id))
      setTotal(prev => prev - 1)

      // Clear selection if deleted summary was selected
      if (selectedSummaryId === summaryToDelete.id) {
        onSelectSummary?.(null as any)
      }

      setDeleteDialogOpen(false)
      setSummaryToDelete(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete summary')
    } finally {
      setDeleting(false)
    }
  }

  const handleDeletePatientConfirm = async () => {
    if (!patientToDelete || !tenantId || !token) {
      setError('Missing authentication to delete patient')
      return
    }

    try {
      setDeletingPatient(true)
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

      // Remove all summaries belonging to this patient from the list
      setSummaries(prev => prev.filter(s => s.patientId !== patientToDelete.id))
      setTotal(prev => prev - prev /* not precise; leave recalculation to reload if needed */)

      // Clear selection if current selection belongs to this patient
      if (selectedSummaryId) {
        const selected = summaries.find(s => s.id === selectedSummaryId)
        if (selected && selected.patientId === patientToDelete.id) {
          onSelectSummary?.(null as any)
        }
      }

      setDeletePatientDialogOpen(false)
      setPatientToDelete(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete patient')
    } finally {
      setDeletingPatient(false)
    }
  }

  if (loading && summaries.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Loading discharge summaries...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center">
            <p className="text-sm text-destructive mb-4">{error}</p>
            <Button variant="outline" onClick={() => loadSummaries()}>
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Search and Stats Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="font-heading text-xl">Discharge Summaries</CardTitle>
              <CardDescription>
                {total} total discharge {total === 1 ? 'summary' : 'summaries'}
              </CardDescription>
            </div>
          </div>
          <div className="mt-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by patient name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Summaries List */}
      <div className="space-y-2">
        {summaries.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                {searchQuery ? 'No discharge summaries found matching your search' : 'No discharge summaries available'}
              </p>
            </CardContent>
          </Card>
        ) : (
          summaries.map((summary) => (
            <Card
              key={summary.id}
              className={`cursor-pointer transition-colors hover:bg-accent ${
                selectedSummaryId === summary.id ? 'border-primary bg-accent' : ''
              }`}
              onClick={() => onSelectSummary?.(summary)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <CardTitle className="font-heading text-base">
                        {summary.patientName || 'Unnamed Patient'}
                      </CardTitle>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      {summary.mrn && (
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          MRN: {summary.mrn}
                        </span>
                      )}
                      {summary.dischargeDate && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(summary.dischargeDate).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    {summary.metadata?.diagnosis && summary.metadata.diagnosis.length > 0 && (
                      <p className="mt-2 text-sm text-muted-foreground">
                        {summary.metadata.diagnosis.join(', ')}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2 ml-4">
                    <div className="flex items-center gap-2">
                      {getStatusBadge(summary.status)}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={(e) => handleDeleteClick(summary, e)}
                        title="Delete discharge summary"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={(e) => handleDeletePatientClick(summary, e)}
                        title="Delete patient (FHIR Patient resource)"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(summary.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))
        )}
      </div>

      {loading && summaries.length > 0 && (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Discharge Summary?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the discharge summary for{" "}
              <strong>{summaryToDelete?.patientName || 'this patient'}</strong>?
              <br /><br />
              This will permanently delete:
              <ul className="list-disc list-inside mt-2 space-y-1">
                {summaryToDelete?.files.raw && <li>Raw discharge summary</li>}
                {summaryToDelete?.files.simplified && <li>Simplified version</li>}
                {summaryToDelete?.files.translated && Object.keys(summaryToDelete.files.translated).length > 0 && (
                  <li>Translated versions ({Object.keys(summaryToDelete.files.translated).length})</li>
                )}
              </ul>
              <br />
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Patient Confirmation Dialog */}
      <AlertDialog open={deletePatientDialogOpen} onOpenChange={setDeletePatientDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Patient?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{patientToDelete?.name}</strong> (FHIR Patient)?
              <br /><br />
              This will call DELETE /google/fhir/Patient/{patientToDelete?.id} and cannot be undone.
              <br />
              Any associated discharge summaries may reference a deleted patient record.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingPatient}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePatientConfirm}
              disabled={deletingPatient}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingPatient ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete Patient'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
