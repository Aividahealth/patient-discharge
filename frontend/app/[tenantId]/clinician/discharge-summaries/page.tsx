"use client"

import { useState } from "react"
import { CommonHeader } from "@/components/common-header"
import { CommonFooter } from "@/components/common-footer"
import { AuthGuard } from "@/components/auth-guard"
import { DischargeSummariesList } from "@/components/discharge-summaries-list"
import { DischargeSummaryViewer } from "@/components/discharge-summary-viewer"
import { DischargeSummaryMetadata } from "@/lib/discharge-summaries"
import { useTenant } from "@/contexts/tenant-context"
import { Stethoscope } from "lucide-react"

export default function DischargeSummariesPage() {
  const { token, tenantId } = useTenant()
  const [selectedSummary, setSelectedSummary] = useState<DischargeSummaryMetadata | null>(null)

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background flex flex-col">
        <CommonHeader title="Clinician Portal - Discharge Summaries" />

        {/* Page Header */}
        <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-40">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                <Stethoscope className="h-5 w-5" />
              </div>
              <div>
                <h1 className="font-heading text-xl font-semibold text-foreground">
                  Discharge Summaries
                </h1>
                <p className="text-sm text-muted-foreground">
                  Review and manage patient discharge summaries
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1">
          <div className="container mx-auto px-4 py-8">
            <div className="grid lg:grid-cols-3 gap-6">
              {/* Left Sidebar - Summaries List */}
              <div className="lg:col-span-1">
                <DischargeSummariesList
                  onSelectSummary={setSelectedSummary}
                  selectedSummaryId={selectedSummary?.id}
                />
              </div>

              {/* Right Content - Summary Viewer */}
              <div className="lg:col-span-2">
                {selectedSummary ? (
                  <DischargeSummaryViewer
                    summaryId={selectedSummary.id}
                    patientName={selectedSummary.patientName}
                    mrn={selectedSummary.mrn}
                    token={token || undefined}
                    tenantId={tenantId || undefined}
                  />
                ) : (
                  <div className="flex items-center justify-center h-96 border-2 border-dashed border-muted rounded-lg">
                    <div className="text-center">
                      <Stethoscope className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-lg font-medium text-foreground mb-1">
                        No summary selected
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Select a discharge summary from the list to view details
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>

        <CommonFooter />
      </div>
    </AuthGuard>
  )
}
