"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { TenantBadge } from "@/components/tenant-badge"
import { FileText, User, RefreshCw, Download, Loader2 } from "lucide-react"
import {
  getDischargeSummaryContent,
  DischargeSummaryContent,
} from "@/lib/discharge-summaries"
import { QualityMetricsCard } from "@/components/quality-metrics-card"

interface DischargeSummaryViewerProps {
  summaryId: string
  patientName?: string
  mrn?: string
  token?: string
  tenantId?: string
}

export function DischargeSummaryViewer({
  summaryId,
  patientName,
  mrn,
  token,
  tenantId,
}: DischargeSummaryViewerProps) {
  const [rawContent, setRawContent] = useState<DischargeSummaryContent | null>(null)
  const [simplifiedContent, setSimplifiedContent] = useState<DischargeSummaryContent | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadContent = async () => {
    try {
      setLoading(true)
      setError(null)

      // Load both versions in parallel
      const [raw, simplified] = await Promise.all([
        getDischargeSummaryContent(summaryId, 'raw', undefined, token, tenantId).catch(err => {
          console.error('Failed to load raw version:', err)
          return null
        }),
        getDischargeSummaryContent(summaryId, 'simplified', undefined, token, tenantId).catch(err => {
          console.error('Failed to load simplified version:', err)
          return null
        }),
      ])

      setRawContent(raw)
      setSimplifiedContent(simplified)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load discharge summary')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (summaryId) {
      loadContent()
    }
  }, [summaryId])

  const handleRefresh = () => {
    loadContent()
  }

  const handleDownload = () => {
    // Download the simplified version if available, otherwise raw
    const content = simplifiedContent?.content?.content ? simplifiedContent : rawContent
    if (!content?.content?.content) return

    const version = content === simplifiedContent ? 'simplified' : 'raw'
    const blob = new Blob([content.content.content], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `discharge-summary-${version}-${summaryId}.md`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Loading discharge summary...</p>
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
            <Button variant="outline" onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!rawContent && !simplifiedContent) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <p className="text-sm text-muted-foreground">No discharge summary available</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="font-heading text-xl">
                {patientName || 'Discharge Summary'}
              </CardTitle>
              {mrn && (
                <CardDescription className="text-base">
                  MRN: {mrn}
                </CardDescription>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleRefresh}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                disabled={!rawContent?.content?.content && !simplifiedContent?.content?.content}
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Side-by-Side Content */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Raw/Original Version */}
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="font-heading text-lg flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Original Version
              <Badge variant="outline">Raw</Badge>
            </CardTitle>
            <CardDescription>
              Original medical documentation as written by the clinical team
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            {rawContent?.content?.content ? (
              <>
                <div className="bg-muted/30 p-4 rounded-lg max-h-[600px] overflow-y-auto">
                  <div className="prose prose-sm max-w-none">
                    <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                      {rawContent.content.content}
                    </pre>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
                  <span>File Size: {(rawContent.content.fileSize / 1024).toFixed(2)} KB</span>
                  <span>•</span>
                  <span>Last Modified: {new Date(rawContent.content.lastModified).toLocaleString()}</span>
                </div>
              </>
            ) : (
              <div className="py-12 text-center">
                <p className="text-muted-foreground">Raw version not available</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Simplified Version */}
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="font-heading text-lg flex items-center gap-2">
              <User className="h-5 w-5" />
              Patient-Friendly Version
              <Badge variant="secondary">Simplified</Badge>
            </CardTitle>
            <CardDescription>
              Simplified to a high school reading level for better patient understanding
            </CardDescription>
            <div className="flex items-center gap-2 mt-2">
              <TenantBadge tenantVariant="light">
                AI Generated
              </TenantBadge>
              <span className="text-xs text-muted-foreground">
                This content has been simplified using artificial intelligence
              </span>
            </div>
          </CardHeader>
          <CardContent className="flex-1">
            {simplifiedContent?.content?.content ? (
              <>
                <div className="bg-muted/30 p-4 rounded-lg max-h-[600px] overflow-y-auto">
                  <div className="prose prose-sm max-w-none">
                    <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                      {simplifiedContent.content.content}
                    </pre>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
                  <span>File Size: {(simplifiedContent.content.fileSize / 1024).toFixed(2)} KB</span>
                  <span>•</span>
                  <span>Last Modified: {new Date(simplifiedContent.content.lastModified).toLocaleString()}</span>
                </div>
              </>
            ) : (
              <div className="py-12 text-center">
                <p className="text-muted-foreground">Simplified version not available</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quality Metrics */}
      {simplifiedContent?.metadata?.qualityMetrics && (
        <QualityMetricsCard metrics={simplifiedContent.metadata.qualityMetrics} />
      )}
    </div>
  )
}
