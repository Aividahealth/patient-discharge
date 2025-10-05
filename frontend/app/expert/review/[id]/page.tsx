"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { ArrowLeft, Loader2, Star, CheckCircle } from "lucide-react"
import { getDischargeSummaryContent } from "@/lib/discharge-summaries"
import { submitFeedback } from "@/lib/expert-api"
import { useToast } from "@/hooks/use-toast"

export default function ExpertReviewPage() {
  const router = useRouter()
  const params = useParams()
  const { toast } = useToast()
  const summaryId = params.id as string

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [rawContent, setRawContent] = useState<string>("")
  const [simplifiedContent, setSimplifiedContent] = useState<string>("")
  const [patientName, setPatientName] = useState<string>("")
  const [mrn, setMrn] = useState<string>("")

  // Form state
  const [reviewerName, setReviewerName] = useState("")
  const [reviewType, setReviewType] = useState<'simplification' | 'translation'>('simplification')
  const [language, setLanguage] = useState("")
  const [overallRating, setOverallRating] = useState<number>(0)
  const [whatWorksWell, setWhatWorksWell] = useState("")
  const [whatNeedsImprovement, setWhatNeedsImprovement] = useState("")
  const [specificIssues, setSpecificIssues] = useState("")
  const [hasHallucination, setHasHallucination] = useState(false)
  const [hasMissingInfo, setHasMissingInfo] = useState(false)

  useEffect(() => {
    loadContent()
  }, [summaryId])

  const loadContent = async () => {
    try {
      setLoading(true)

      // Load raw and simplified content
      const [raw, simplified] = await Promise.all([
        getDischargeSummaryContent(summaryId, 'raw').catch(() => null),
        getDischargeSummaryContent(summaryId, 'simplified').catch(() => null),
      ])

      if (raw?.content?.content) {
        setRawContent(raw.content.content)
      }
      if (simplified?.content?.content) {
        setSimplifiedContent(simplified.content.content)
      }
      if (simplified?.metadata?.patientName) {
        setPatientName(simplified.metadata.patientName)
      }
      if (simplified?.metadata?.mrn) {
        setMrn(simplified.metadata.mrn)
      }
    } catch (error) {
      console.error('Failed to load content:', error)
      toast({
        title: "Error",
        description: "Failed to load discharge summary content",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!reviewerName.trim()) {
      toast({
        title: "Error",
        description: "Please enter your name",
        variant: "destructive",
      })
      return
    }

    if (overallRating === 0) {
      toast({
        title: "Error",
        description: "Please select an overall rating",
        variant: "destructive",
      })
      return
    }

    try {
      setSubmitting(true)

      await submitFeedback({
        dischargeSummaryId: summaryId,
        reviewType,
        language: reviewType === 'translation' ? language : undefined,
        reviewerName: reviewerName.trim(),
        overallRating: overallRating as 1 | 2 | 3 | 4 | 5,
        whatWorksWell,
        whatNeedsImprovement,
        specificIssues,
        hasHallucination,
        hasMissingInfo,
      })

      toast({
        title: "Success",
        description: "Feedback submitted successfully!",
      })

      // Navigate back to list
      router.push('/expert')
    } catch (error) {
      console.error('Failed to submit feedback:', error)
      toast({
        title: "Error",
        description: "Failed to submit feedback. Please try again.",
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  const StarRating = ({ value, onChange }: { value: number; onChange: (v: number) => void }) => (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          className="focus:outline-none transition-transform hover:scale-110"
        >
          <Star
            className={`h-8 w-8 ${
              star <= value
                ? 'fill-yellow-400 text-yellow-400'
                : 'fill-none text-gray-300'
            }`}
          />
        </button>
      ))}
      {value > 0 && (
        <span className="ml-2 text-sm text-muted-foreground">({value}/5)</span>
      )}
    </div>
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => router.push('/expert')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to List
            </Button>
            <div className="flex-1">
              <h1 className="font-heading text-xl font-semibold text-foreground">
                Review: {patientName || 'Unknown Patient'}
              </h1>
              {mrn && (
                <p className="text-sm text-muted-foreground">MRN: {mrn}</p>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Side-by-side content */}
        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          {/* Original */}
          <Card className="flex flex-col">
            <CardHeader>
              <CardTitle>Original (Raw)</CardTitle>
              <CardDescription>
                Original medical documentation as written by clinical team
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
              <div className="bg-muted/30 p-4 rounded-lg max-h-[500px] overflow-y-auto">
                <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                  {rawContent || 'Raw content not available'}
                </pre>
              </div>
            </CardContent>
          </Card>

          {/* Simplified */}
          <Card className="flex flex-col">
            <CardHeader>
              <CardTitle>Simplified</CardTitle>
              <CardDescription>
                Simplified to high school reading level for patients
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
              <div className="bg-muted/30 p-4 rounded-lg max-h-[500px] overflow-y-auto">
                <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                  {simplifiedContent || 'Simplified content not available'}
                </pre>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Feedback Form */}
        <Card>
          <CardHeader>
            <CardTitle>Feedback Form</CardTitle>
            <CardDescription>
              Please provide your expert review of the simplified version
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Reviewer Name */}
              <div className="space-y-2">
                <Label htmlFor="reviewerName">Your Name *</Label>
                <Input
                  id="reviewerName"
                  placeholder="Enter your name"
                  value={reviewerName}
                  onChange={(e) => setReviewerName(e.target.value)}
                  required
                />
              </div>

              {/* Review Type */}
              <div className="space-y-2">
                <Label>Review Type</Label>
                <RadioGroup value={reviewType} onValueChange={(v: any) => setReviewType(v)}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="simplification" id="simplification" />
                    <Label htmlFor="simplification">Simplification</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="translation" id="translation" />
                    <Label htmlFor="translation">Translation</Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Language (if translation) */}
              {reviewType === 'translation' && (
                <div className="space-y-2">
                  <Label htmlFor="language">Language</Label>
                  <Input
                    id="language"
                    placeholder="e.g., Spanish, French, Hindi"
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                  />
                </div>
              )}

              {/* Overall Rating */}
              <div className="space-y-2">
                <Label>Overall Rating *</Label>
                <StarRating value={overallRating} onChange={setOverallRating} />
              </div>

              {/* What Works Well */}
              <div className="space-y-2">
                <Label htmlFor="whatWorksWell">What works well in this simplified version?</Label>
                <Textarea
                  id="whatWorksWell"
                  placeholder="Describe what's good about the simplification..."
                  value={whatWorksWell}
                  onChange={(e) => setWhatWorksWell(e.target.value)}
                  rows={3}
                />
              </div>

              {/* What Needs Improvement */}
              <div className="space-y-2">
                <Label htmlFor="whatNeedsImprovement">What needs improvement?</Label>
                <Textarea
                  id="whatNeedsImprovement"
                  placeholder="Describe what could be better..."
                  value={whatNeedsImprovement}
                  onChange={(e) => setWhatNeedsImprovement(e.target.value)}
                  rows={3}
                />
              </div>

              {/* Specific Issues */}
              <div className="space-y-2">
                <Label htmlFor="specificIssues">Specific issues (copy/paste problematic text)</Label>
                <Textarea
                  id="specificIssues"
                  placeholder="Copy and paste any specific text that has issues, along with your suggested fix..."
                  value={specificIssues}
                  onChange={(e) => setSpecificIssues(e.target.value)}
                  rows={4}
                />
              </div>

              {/* Quick Checks */}
              <div className="space-y-3">
                <Label>Quick Checks</Label>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="hasHallucination"
                    checked={hasHallucination}
                    onCheckedChange={(checked) => setHasHallucination(checked as boolean)}
                  />
                  <Label htmlFor="hasHallucination" className="font-normal cursor-pointer">
                    I found hallucinated information (made-up details)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="hasMissingInfo"
                    checked={hasMissingInfo}
                    onCheckedChange={(checked) => setHasMissingInfo(checked as boolean)}
                  />
                  <Label htmlFor="hasMissingInfo" className="font-normal cursor-pointer">
                    Critical information is missing
                  </Label>
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex items-center gap-4 pt-4">
                <Button type="submit" disabled={submitting} className="min-w-[150px]">
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Submit Review
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push('/expert')}
                  disabled={submitting}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
