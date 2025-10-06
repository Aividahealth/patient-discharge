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

        {/* Summaries List - Compact Table Layout */}
        {!loading && summaries.length > 0 && (
          <div className="border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground">File Name</th>
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground">Discharge Date</th>
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground">Reviews</th>
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground">Rating</th>
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground">Status</th>
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground">Last Review</th>
                    <th className="text-right p-3 text-sm font-medium text-muted-foreground">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {summaries.map((summary, index) => (
                    <tr 
                      key={summary.id} 
                      className={`border-b border-border hover:bg-muted/30 transition-colors ${
                        index % 2 === 0 ? 'bg-background' : 'bg-muted/10'
                      }`}
                    >
                      {/* File Name */}
                      <td className="p-3">
                        <div className="font-medium text-sm">
                          {summary.fileName || summary.summaryTitle || `Summary-${summary.id.slice(-8)}`}
                        </div>
                      </td>
                      
                      {/* Discharge Date */}
                      <td className="p-3">
                        <div className="text-sm">
                          {summary.dischargeDate 
                            ? new Date(summary.dischargeDate).toLocaleDateString()
                            : 'N/A'
                          }
                        </div>
                      </td>
                      
                      {/* Reviews Count */}
                      <td className="p-3">
                        <div className="text-sm font-medium">
                          {summary.reviewCount}
                        </div>
                      </td>
                      
                      {/* Rating */}
                      <td className="p-3">
                        <div className="flex items-center gap-1">
                          {summary.reviewCount > 0 && summary.avgRating ? (
                            <>
                              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                              <span className="text-sm font-medium">
                                {summary.avgRating.toFixed(1)}
                              </span>
                            </>
                          ) : (
                            <span className="text-sm text-muted-foreground">N/A</span>
                          )}
                        </div>
                      </td>
                      
                      {/* Status */}
                      <td className="p-3">
                        <div className="flex gap-1">
                          {summary.reviewCount === 0 ? (
                            <Badge variant="secondary" className="text-xs">
                              Needs Review
                            </Badge>
                          ) : summary.avgRating && summary.avgRating < 3.5 ? (
                            <Badge variant="destructive" className="text-xs">
                              Low Rating
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs">
                              Reviewed
                            </Badge>
                          )}
                        </div>
                      </td>
                      
                      {/* Last Review */}
                      <td className="p-3">
                        <div className="text-sm text-muted-foreground">
                          {summary.latestReviewDate 
                            ? new Date(summary.latestReviewDate).toLocaleDateString()
                            : 'Never'
                          }
                        </div>
                      </td>
                      
                      {/* Action */}
                      <td className="p-3">
                        <Button 
                          onClick={() => handleReview(summary.id)}
                          size="sm"
                          className="w-full"
                        >
                          Review →
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
