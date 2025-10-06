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

        {/* Summaries List - Compact Grid Layout */}
        {!loading && summaries.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {summaries.map((summary) => (
              <Card key={summary.id} className="hover:shadow-md transition-all duration-200 hover:scale-[1.02]">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base font-medium leading-tight line-clamp-2">
                        {summary.summaryTitle || 
                         (summary.dischargeDate ? 
                           `Discharge Summary - ${new Date(summary.dischargeDate).toLocaleDateString()}` : 
                           'Discharge Summary')}
                      </CardTitle>
                      <CardDescription className="text-xs mt-1">
                        {summary.mrn && `MRN: ${summary.mrn}`}
                        {summary.dischargeDate && (
                          <span className="ml-2">
                            Discharged: {new Date(summary.dischargeDate).toLocaleDateString()}
                          </span>
                        )}
                      </CardDescription>
                    </div>
                    <Button 
                      onClick={() => handleReview(summary.id)}
                      size="sm"
                      className="shrink-0"
                    >
                      Review →
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1">
                        <span>Reviews: {summary.reviewCount}</span>
                        {summary.reviewCount > 0 && summary.avgRating && (
                          <div className="flex items-center gap-1 ml-1">
                            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                            <span className="font-medium text-foreground">
                              {summary.avgRating.toFixed(1)}
                            </span>
                          </div>
                        )}
                      </div>
                      
                      {summary.simplifiedAt && (
                        <div className="text-xs">
                          {new Date(summary.simplifiedAt).toLocaleDateString()}
                        </div>
                      )}
                    </div>

                    <div className="flex gap-1">
                      {summary.reviewCount === 0 && (
                        <Badge variant="secondary" className="text-xs px-2 py-0.5">
                          Needs Review
                        </Badge>
                      )}

                      {summary.avgRating && summary.avgRating < 3.5 && (
                        <Badge variant="destructive" className="text-xs px-2 py-0.5">
                          Low Rating
                        </Badge>
                      )}
                    </div>
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
