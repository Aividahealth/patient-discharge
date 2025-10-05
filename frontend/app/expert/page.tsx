"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, ClipboardCheck, Star } from "lucide-react"
import { getReviewList, ReviewSummary } from "@/lib/expert-api"

export default function ExpertPortalPage() {
  const router = useRouter()
  const [summaries, setSummaries] = useState<ReviewSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'no_reviews' | 'low_rating'>('all')

  useEffect(() => {
    loadSummaries()
  }, [filter])

  const loadSummaries = async () => {
    try {
      setLoading(true)
      const response = await getReviewList({ filter, limit: 50 })
      setSummaries(response.summaries)
    } catch (error) {
      console.error('Failed to load summaries:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleReview = (summaryId: string) => {
    router.push(`/expert/review/${summaryId}`)
  }

  return (
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
        {/* Filters */}
        <div className="mb-6 flex items-center gap-4">
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

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Empty State */}
        {!loading && summaries.length === 0 && (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <div className="text-center">
                <ClipboardCheck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-lg font-medium text-foreground mb-1">
                  No summaries found
                </p>
                <p className="text-sm text-muted-foreground">
                  Try adjusting your filters or check back later
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Summaries List */}
        {!loading && summaries.length > 0 && (
          <div className="space-y-4">
            {summaries.map((summary) => (
              <Card key={summary.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg">
                        {summary.patientName || 'Unknown Patient'}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {summary.mrn && `MRN: ${summary.mrn}`}
                      </CardDescription>
                    </div>
                    <Button onClick={() => handleReview(summary.id)}>
                      Review →
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-6 text-sm text-muted-foreground">
                    {summary.simplifiedAt && (
                      <div>
                        Simplified: {new Date(summary.simplifiedAt).toLocaleDateString()}
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <span>Reviews: {summary.reviewCount}</span>
                      {summary.reviewCount > 0 && summary.avgRating && (
                        <div className="flex items-center gap-1">
                          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                          <span className="font-medium text-foreground">
                            {summary.avgRating.toFixed(1)}
                          </span>
                        </div>
                      )}
                    </div>

                    {summary.reviewCount === 0 && (
                      <Badge variant="secondary">Needs Review</Badge>
                    )}

                    {summary.avgRating && summary.avgRating < 3.5 && (
                      <Badge variant="destructive">Low Rating</Badge>
                    )}
                  </div>

                  {summary.latestReviewDate && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      Last reviewed: {new Date(summary.latestReviewDate).toLocaleString()}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Load More (if needed) */}
        {!loading && summaries.length > 0 && summaries.length % 50 === 0 && (
          <div className="mt-6 text-center">
            <Button variant="outline" onClick={loadSummaries}>
              Load More
            </Button>
          </div>
        )}
      </main>
    </div>
  )
}
