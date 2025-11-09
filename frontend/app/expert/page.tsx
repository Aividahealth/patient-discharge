"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2, ClipboardCheck, Star, Stethoscope, Languages } from "lucide-react"
import { getReviewList, ReviewSummary, ReviewType } from "@/lib/expert-api"

export default function ExpertPortalPage() {
  const router = useRouter()
  const [medicalSummaries, setMedicalSummaries] = useState<ReviewSummary[]>([])
  const [languageSummaries, setLanguageSummaries] = useState<ReviewSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'no_reviews' | 'low_rating'>('all')
  const [activeTab, setActiveTab] = useState<'medical' | 'language'>('medical')

  useEffect(() => {
    loadSummaries()
  }, [filter, activeTab])

  const loadSummaries = async () => {
    try {
      setLoading(true)
      // Generic portal does NOT pass tenantId or token - backend will return all summaries
      const [medicalResponse, languageResponse] = await Promise.all([
        getReviewList({ type: 'simplification', filter, limit: 50 }),
        getReviewList({ type: 'translation', filter, limit: 50 })
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
    router.push(`/expert/review/${summary.compositionId}?type=${reviewType}`)
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
                    <Stethoscope className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-lg font-medium text-foreground mb-1">
                      No medical summaries found
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Try adjusting your filters or check back later
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Medical Summaries List */}
            {!loading && medicalSummaries.length > 0 && (
          <div className="border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground">Patient</th>
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground">MRN</th>
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground">Discharge Date</th>
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground">Reviews</th>
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground">Rating</th>
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground">Status</th>
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground">Last Review</th>
                    <th className="text-right p-3 text-sm font-medium text-muted-foreground">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {medicalSummaries.map((summary, index) => (
                    <tr 
                      key={summary.id} 
                      className={`border-b border-border hover:bg-muted/30 transition-colors ${
                        index % 2 === 0 ? 'bg-background' : 'bg-muted/10'
                      }`}
                    >
                      {/* Patient Name */}
                      <td className="p-3">
                        <div className="font-medium text-sm">
                          {summary.patientName}
                        </div>
                        {summary.unit && (
                          <div className="text-xs text-muted-foreground">{summary.unit}</div>
                        )}
                      </td>

                      {/* MRN */}
                      <td className="p-3">
                        <div className="text-sm font-mono">
                          {summary.mrn}
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
                          {summary.reviewCount || 0}
                        </div>
                      </td>
                      
                      {/* Rating */}
                      <td className="p-3">
                        <div className="flex items-center gap-1">
                          {(summary.reviewCount || 0) > 0 && summary.avgRating ? (
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
                          {(summary.reviewCount || 0) === 0 ? (
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
                          onClick={() => handleReview(summary, 'simplification')}
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
                    <Languages className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-lg font-medium text-foreground mb-1">
                      No language summaries found
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Try adjusting your filters or check back later
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Language Summaries List */}
            {!loading && languageSummaries.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left p-3 text-sm font-medium text-muted-foreground">Patient</th>
                        <th className="text-left p-3 text-sm font-medium text-muted-foreground">MRN</th>
                        <th className="text-left p-3 text-sm font-medium text-muted-foreground">Language</th>
                        <th className="text-left p-3 text-sm font-medium text-muted-foreground">Discharge Date</th>
                        <th className="text-left p-3 text-sm font-medium text-muted-foreground">Reviews</th>
                        <th className="text-left p-3 text-sm font-medium text-muted-foreground">Rating</th>
                        <th className="text-left p-3 text-sm font-medium text-muted-foreground">Status</th>
                        <th className="text-left p-3 text-sm font-medium text-muted-foreground">Last Review</th>
                        <th className="text-right p-3 text-sm font-medium text-muted-foreground">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {languageSummaries.map((summary, index) => (
                        <tr 
                          key={summary.id} 
                          className={`border-b border-border hover:bg-muted/30 transition-colors ${
                            index % 2 === 0 ? 'bg-background' : 'bg-muted/10'
                          }`}
                        >
                          {/* Patient Name */}
                          <td className="p-3">
                            <div className="font-medium text-sm">
                              {summary.patientName}
                            </div>
                            {summary.unit && (
                              <div className="text-xs text-muted-foreground">{summary.unit}</div>
                            )}
                          </td>

                          {/* MRN */}
                          <td className="p-3">
                            <div className="text-sm font-mono">
                              {summary.mrn}
                            </div>
                          </td>

                          {/* Language */}
                          <td className="p-3">
                            <div className="text-sm">
                              {summary.language || 'English'}
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
                              {summary.reviewCount || 0}
                            </div>
                          </td>

                          {/* Rating */}
                          <td className="p-3">
                            <div className="flex items-center gap-1">
                              {(summary.reviewCount || 0) > 0 && summary.avgRating ? (
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
                              {(summary.reviewCount || 0) === 0 ? (
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
                              onClick={() => handleReview(summary, 'translation')}
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
            {!loading && languageSummaries.length > 0 && languageSummaries.length % 50 === 0 && (
              <div className="mt-6 text-center">
                <Button variant="outline" onClick={loadSummaries}>
                  Load More
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
