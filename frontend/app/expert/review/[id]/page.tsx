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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, Loader2, Star, CheckCircle } from "lucide-react"
import { getDischargeSummaryContent, DischargeSummaryContent } from "@/lib/discharge-summaries"
import { submitFeedback } from "@/lib/expert-api"
import { useToast } from "@/hooks/use-toast"

export default function ExpertReviewPage() {
  const router = useRouter()
  const params = useParams()
  const { toast } = useToast()
  const summaryId = params.id as string

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [rawContent, setRawContent] = useState<DischargeSummaryContent | null>(null)
  const [simplifiedContent, setSimplifiedContent] = useState<DischargeSummaryContent | null>(null)
  const [translatedContent, setTranslatedContent] = useState<DischargeSummaryContent | null>(null)
  const [patientName, setPatientName] = useState<string>("")
  const [mrn, setMrn] = useState<string>("")

  // Form state
  const [reviewerName, setReviewerName] = useState("")
  const [reviewerHospital, setReviewerHospital] = useState("")
  const [reviewType, setReviewType] = useState<'simplification' | 'translation'>('simplification')
  const [language, setLanguage] = useState("es")
  const [overallRating, setOverallRating] = useState<number>(0)
  const [whatWorksWell, setWhatWorksWell] = useState("")
  const [whatNeedsImprovement, setWhatNeedsImprovement] = useState("")
  const [specificIssues, setSpecificIssues] = useState("")
  const [hasHallucination, setHasHallucination] = useState(false)
  const [hasMissingInfo, setHasMissingInfo] = useState(false)

  useEffect(() => {
    loadContent()
  }, [summaryId])

  useEffect(() => {
    // Reload translated content when language changes
    if (reviewType === 'translation' && language) {
      loadTranslatedContent()
    }
  }, [reviewType, language])

  const loadContent = async () => {
    try {
      setLoading(true)

      // Load raw and simplified content - same approach as DischargeSummaryViewer
      const [raw, simplified] = await Promise.all([
        getDischargeSummaryContent(summaryId, 'raw').catch((err) => {
          console.error('Failed to load raw version:', err)
          return null
        }),
        getDischargeSummaryContent(summaryId, 'simplified').catch((err) => {
          console.error('Failed to load simplified version:', err)
          return null
        }),
      ])

      // Direct assignment like DischargeSummaryViewer
      setRawContent(raw)
      setSimplifiedContent(simplified)

      // Try to get metadata
      const metadata = simplified?.metadata || raw?.metadata
      if (metadata) {
        if (metadata.patientName) setPatientName(metadata.patientName)
        if (metadata.mrn) setMrn(metadata.mrn)
      }
    } catch (error) {
      console.error('Failed to load content:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadTranslatedContent = async () => {
    if (!language) return

    try {
      const translated = await getDischargeSummaryContent(summaryId, 'translated', language).catch((err) => {
        console.error('Failed to load translated version:', err)
        return null
      })

      setTranslatedContent(translated)
    } catch (error) {
      console.error('Failed to load translated content:', error)
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
        reviewerHospital: reviewerHospital.trim() || undefined,
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
          {/* Left side - always shows simplified (English) */}
          <Card className="flex flex-col">
            <CardHeader>
              <CardTitle>Simplified (English)</CardTitle>
              <CardDescription>
                Simplified to high school reading level for patients
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
              <div className="bg-muted/30 p-4 rounded-lg max-h-[500px] overflow-y-auto">
                {simplifiedContent?.content?.content ? (
                  <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                    {simplifiedContent.content.content}
                  </pre>
                ) : (
                  <p className="text-sm text-muted-foreground">Simplified version not available</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Right side - shows original for content review or translated for translation review */}
          <Card className="flex flex-col">
            <CardHeader>
              <CardTitle>
                {reviewType === 'simplification' ? 'Original (Raw)' : `Translated (${language.toUpperCase()})`}
              </CardTitle>
              <CardDescription>
                {reviewType === 'simplification'
                  ? 'Original medical documentation as written by clinical team'
                  : `Translation of simplified version to ${language.toUpperCase()}`
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
              <div className="bg-muted/30 p-4 rounded-lg max-h-[500px] overflow-y-auto">
                {reviewType === 'simplification' ? (
                  rawContent?.content?.content ? (
                    <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                      {rawContent.content.content}
                    </pre>
                  ) : (
                    <p className="text-sm text-muted-foreground">Raw version not available</p>
                  )
                ) : (
                  translatedContent?.content?.content ? (
                    <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                      {translatedContent.content.content}
                    </pre>
                  ) : (
                    <p className="text-sm text-muted-foreground">Translated version not available for {language.toUpperCase()}</p>
                  )
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Feedback Form */}
        <Card>
          <CardHeader>
            <CardTitle>Feedback Form</CardTitle>
            <CardDescription>
              {reviewType === 'simplification'
                ? 'Content Expert: Review the simplified version for accuracy and clarity'
                : 'Translation Expert: Review the translated version for accuracy and cultural appropriateness'
              }
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

              {/* Reviewer Hospital */}
              <div className="space-y-2">
                <Label htmlFor="reviewerHospital">Your Hospital</Label>
                <Input
                  id="reviewerHospital"
                  placeholder="Enter your hospital or organization"
                  value={reviewerHospital}
                  onChange={(e) => setReviewerHospital(e.target.value)}
                />
              </div>

              {/* Review Type */}
              <div className="space-y-2">
                <Label>Review Type</Label>
                <RadioGroup value={reviewType} onValueChange={(v: any) => setReviewType(v)}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="simplification" id="simplification" />
                    <Label htmlFor="simplification" className="font-normal cursor-pointer">
                      Content Expert (Review simplification quality)
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="translation" id="translation" />
                    <Label htmlFor="translation" className="font-normal cursor-pointer">
                      Translation Expert (Review translation quality)
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Language (if translation) */}
              {reviewType === 'translation' && (
                <div className="space-y-2">
                  <Label htmlFor="language">Target Language *</Label>
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select language" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="es">Spanish (Español)</SelectItem>
                      <SelectItem value="zh">Chinese (中文)</SelectItem>
                      <SelectItem value="hi">Hindi (हिन्दी)</SelectItem>
                      <SelectItem value="ar">Arabic (العربية)</SelectItem>
                      <SelectItem value="pt">Portuguese (Português)</SelectItem>
                      <SelectItem value="bn">Bengali (বাংলা)</SelectItem>
                      <SelectItem value="ru">Russian (Русский)</SelectItem>
                      <SelectItem value="ja">Japanese (日本語)</SelectItem>
                      <SelectItem value="pa">Punjabi (ਪੰਜਾਬੀ)</SelectItem>
                      <SelectItem value="de">German (Deutsch)</SelectItem>
                      <SelectItem value="jv">Javanese (Basa Jawa)</SelectItem>
                      <SelectItem value="ko">Korean (한국어)</SelectItem>
                      <SelectItem value="fr">French (Français)</SelectItem>
                      <SelectItem value="te">Telugu (తెలుగు)</SelectItem>
                      <SelectItem value="mr">Marathi (मराठी)</SelectItem>
                      <SelectItem value="tr">Turkish (Türkçe)</SelectItem>
                      <SelectItem value="ta">Tamil (தமிழ்)</SelectItem>
                      <SelectItem value="vi">Vietnamese (Tiếng Việt)</SelectItem>
                      <SelectItem value="ur">Urdu (اردو)</SelectItem>
                      <SelectItem value="it">Italian (Italiano)</SelectItem>
                    </SelectContent>
                  </Select>
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
                <div className="flex items-start space-x-3">
                  <Checkbox
                    id="hasHallucination"
                    checked={hasHallucination}
                    onCheckedChange={(checked) => setHasHallucination(checked as boolean)}
                    className="mt-1 h-5 w-5 border-2 border-gray-400 bg-white"
                  />
                  <Label htmlFor="hasHallucination" className="font-normal cursor-pointer flex-1 leading-normal">
                    I found hallucinated information (made-up details)
                  </Label>
                </div>
                <div className="flex items-start space-x-3">
                  <Checkbox
                    id="hasMissingInfo"
                    checked={hasMissingInfo}
                    onCheckedChange={(checked) => setHasMissingInfo(checked as boolean)}
                    className="mt-1 h-5 w-5 border-2 border-gray-400 bg-white"
                  />
                  <Label htmlFor="hasMissingInfo" className="font-normal cursor-pointer flex-1 leading-normal">
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
