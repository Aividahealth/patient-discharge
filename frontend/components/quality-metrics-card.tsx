"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { BarChart, TrendingDown, BookOpen, FileText, CheckCircle, AlertCircle } from "lucide-react"

export interface QualityMetrics {
  fleschKincaidGradeLevel?: number
  fleschReadingEase?: number
  smogIndex?: number
  compressionRatio?: number
  avgSentenceLength?: number
}

interface QualityMetricsCardProps {
  metrics?: QualityMetrics
  compact?: boolean
  inverted?: boolean // For dark backgrounds (e.g., selected patient in list)
}

/**
 * Get a human-readable interpretation of Flesch-Kincaid Grade Level
 */
function interpretFleschKincaidGrade(grade: number): { text: string; color: string } {
  if (grade <= 5) return { text: 'Elementary', color: 'bg-green-500' }
  if (grade <= 8) return { text: 'Middle School', color: 'bg-green-400' }
  if (grade <= 10) return { text: 'High School', color: 'bg-yellow-500' }
  if (grade <= 12) return { text: 'High School+', color: 'bg-orange-500' }
  if (grade <= 16) return { text: 'College', color: 'bg-red-500' }
  return { text: 'Graduate', color: 'bg-red-600' }
}

/**
 * Get a human-readable interpretation of Flesch Reading Ease
 */
function interpretFleschReadingEase(score: number): { text: string; color: string } {
  if (score >= 90) return { text: 'Very Easy', color: 'bg-green-500' }
  if (score >= 80) return { text: 'Easy', color: 'bg-green-400' }
  if (score >= 70) return { text: 'Fairly Easy', color: 'bg-yellow-400' }
  if (score >= 60) return { text: 'Standard', color: 'bg-yellow-500' }
  if (score >= 50) return { text: 'Fairly Difficult', color: 'bg-orange-500' }
  if (score >= 30) return { text: 'Difficult', color: 'bg-red-500' }
  return { text: 'Very Difficult', color: 'bg-red-600' }
}

/**
 * Check if metrics meet target simplification goals (5th-9th grade)
 */
function meetsSimplificationTarget(metrics: QualityMetrics): boolean {
  const checks = []

  if (metrics.fleschKincaidGradeLevel !== undefined) {
    checks.push(metrics.fleschKincaidGradeLevel <= 9)
  }

  if (metrics.fleschReadingEase !== undefined) {
    checks.push(metrics.fleschReadingEase >= 60)
  }

  if (metrics.smogIndex !== undefined) {
    checks.push(metrics.smogIndex <= 9)
  }

  if (metrics.avgSentenceLength !== undefined) {
    checks.push(metrics.avgSentenceLength <= 20)
  }

  // If we have any checks, return true if all pass
  return checks.length > 0 ? checks.every(c => c) : false
}

export function QualityMetricsCard({ metrics, compact = false, inverted = false }: QualityMetricsCardProps) {
  if (!metrics) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart className="h-5 w-5" />
            Quality Metrics
          </CardTitle>
          <CardDescription>No quality metrics available</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const meetsTarget = meetsSimplificationTarget(metrics)
  const fkGradeInterpretation = metrics.fleschKincaidGradeLevel
    ? interpretFleschKincaidGrade(metrics.fleschKincaidGradeLevel)
    : null
  const freInterpretation = metrics.fleschReadingEase
    ? interpretFleschReadingEase(metrics.fleschReadingEase)
    : null

  if (compact) {
    return (
      <TooltipProvider>
        <div className={`flex items-center gap-2 text-sm ${inverted ? 'text-white' : ''}`}>
          {metrics.fleschKincaidGradeLevel !== undefined && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge 
                  variant="outline" 
                  className={`gap-1 ${inverted ? 'border-white/30 text-white bg-white/10 hover:bg-white/20' : ''}`}
                >
                  <BookOpen className={`h-3 w-3 ${inverted ? 'text-white' : ''}`} />
                  Grade {Math.round(metrics.fleschKincaidGradeLevel)}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <div className="max-w-xs">
                  <p className="font-semibold mb-1">Flesch-Kincaid Grade Level: {Math.round(metrics.fleschKincaidGradeLevel)}</p>
                  <p className="text-xs text-muted-foreground">
                    {fkGradeInterpretation?.text || 'Reading level'} reading level. 
                    Target: ≤9.0 (5th-9th grade). Lower is better for patient comprehension.
                  </p>
                </div>
              </TooltipContent>
            </Tooltip>
          )}
          {metrics.fleschReadingEase !== undefined && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge 
                  variant="outline" 
                  className={`gap-1 ${inverted ? 'border-white/30 text-white bg-white/10 hover:bg-white/20' : ''}`}
                >
                  <FileText className={`h-3 w-3 ${inverted ? 'text-white' : ''}`} />
                  {metrics.fleschReadingEase.toFixed(0)}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <div className="max-w-xs">
                  <p className="font-semibold mb-1">Flesch Reading Ease: {metrics.fleschReadingEase.toFixed(1)}</p>
                  <p className="text-xs text-muted-foreground">
                    {freInterpretation?.text || 'Readability score'}. 
                    Target: ≥60. Higher scores indicate easier reading. Scale: 0-100.
                  </p>
                </div>
              </TooltipContent>
            </Tooltip>
          )}
          {meetsTarget && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <CheckCircle className={`h-4 w-4 ${inverted ? 'text-green-300' : 'text-green-500'}`} />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">Meets simplification targets (5th-9th grade reading level)</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </TooltipProvider>
    )
  }

  return (
    <TooltipProvider>
      <Card className="border-2 border-border bg-card shadow-md mb-6">
        <CardHeader className="bg-muted/30 border-b border-border">
          <CardTitle className="flex items-center gap-2 text-foreground">
            <BarChart className="h-5 w-5 text-primary" />
            Quality Metrics
            {meetsTarget ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="gap-1 bg-green-50 text-green-700 border-green-200 cursor-help">
                    <CheckCircle className="h-3 w-3" />
                    Meets Target
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">All readability metrics meet the target (5th-9th grade reading level)</p>
                </TooltipContent>
              </Tooltip>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="gap-1 bg-amber-50 text-amber-700 border-amber-200 cursor-help">
                    <AlertCircle className="h-3 w-3" />
                    Review Needed
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">Some metrics are above target. Review recommended for patient comprehension.</p>
                </TooltipContent>
              </Tooltip>
            )}
          </CardTitle>
          <CardDescription className="text-foreground/70">
            Automated readability and simplification metrics (Target: 5th-9th grade)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 bg-card">
        {/* Readability Metrics */}
        <div>
          <h4 className="text-sm font-semibold mb-3 text-foreground">Readability</h4>
          <div className="grid gap-3">
            {metrics.fleschKincaidGradeLevel !== undefined && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center justify-between p-2 rounded-md bg-muted/20 cursor-help">
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium text-foreground">Flesch-Kincaid Grade Level</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono font-bold text-foreground">
                        {Math.round(metrics.fleschKincaidGradeLevel)}
                      </span>
                      {fkGradeInterpretation && (
                        <Badge className={`${fkGradeInterpretation.color} text-white text-xs font-semibold`}>
                          {fkGradeInterpretation.text}
                        </Badge>
                      )}
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="max-w-xs">
                    <p className="font-semibold mb-1">Flesch-Kincaid Grade Level: {Math.round(metrics.fleschKincaidGradeLevel)}</p>
                    <p className="text-xs text-muted-foreground mb-2">
                      Indicates the U.S. school grade level needed to understand the text. 
                      {fkGradeInterpretation && ` This content is at ${fkGradeInterpretation.text.toLowerCase()} level.`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      <strong>Target:</strong> ≤9.0 (5th-9th grade). Lower values indicate easier reading for patients.
                    </p>
                  </div>
                </TooltipContent>
              </Tooltip>
            )}

            {metrics.fleschReadingEase !== undefined && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center justify-between p-2 rounded-md bg-muted/20 cursor-help">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium text-foreground">Flesch Reading Ease</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono font-bold text-foreground">
                        {metrics.fleschReadingEase.toFixed(1)}
                      </span>
                      {freInterpretation && (
                        <Badge className={`${freInterpretation.color} text-white text-xs font-semibold`}>
                          {freInterpretation.text}
                        </Badge>
                      )}
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="max-w-xs">
                    <p className="font-semibold mb-1">Flesch Reading Ease: {metrics.fleschReadingEase.toFixed(1)}</p>
                    <p className="text-xs text-muted-foreground mb-2">
                      Measures how easy text is to read on a scale of 0-100. 
                      {freInterpretation && ` This content is ${freInterpretation.text.toLowerCase()}.`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      <strong>Target:</strong> ≥60. Higher scores (90-100 = very easy, 0-30 = very difficult) indicate easier reading.
                    </p>
                  </div>
                </TooltipContent>
              </Tooltip>
            )}

            {metrics.smogIndex !== undefined && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center justify-between p-2 rounded-md bg-muted/20 cursor-help">
                    <div className="flex items-center gap-2">
                      <BarChart className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium text-foreground">SMOG Index</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono font-bold text-foreground">
                        {metrics.smogIndex.toFixed(1)}
                      </span>
                      <Badge
                        className={`text-xs font-semibold ${
                          metrics.smogIndex <= 9
                            ? 'bg-green-500 text-white'
                            : 'bg-orange-500 text-white'
                        }`}
                      >
                        {metrics.smogIndex <= 9 ? 'Target Met' : 'Above Target'}
                      </Badge>
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="max-w-xs">
                    <p className="font-semibold mb-1">SMOG Index: {metrics.smogIndex.toFixed(1)}</p>
                    <p className="text-xs text-muted-foreground mb-2">
                      Simple Measure of Gobbledygook - estimates years of education needed to understand text. 
                      Based on polysyllabic word count.
                    </p>
                    <p className="text-xs text-muted-foreground">
                      <strong>Target:</strong> ≤9.0. Lower values indicate simpler language suitable for patient comprehension.
                    </p>
                  </div>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>

        {/* Simplification Metrics */}
        {(metrics.compressionRatio !== undefined || metrics.avgSentenceLength !== undefined) && (
          <div>
            <h4 className="text-sm font-semibold mb-3 text-foreground">Simplification</h4>
            <div className="grid gap-3">
              {metrics.compressionRatio !== undefined && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center justify-between p-2 rounded-md bg-muted/20 cursor-help">
                      <div className="flex items-center gap-2">
                        <TrendingDown className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium text-foreground">Compression Ratio</span>
                      </div>
                      <span className="text-sm font-mono font-bold text-foreground">
                        {metrics.compressionRatio.toFixed(1)}%
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="max-w-xs">
                      <p className="font-semibold mb-1">Compression Ratio: {metrics.compressionRatio.toFixed(1)}%</p>
                      <p className="text-xs text-muted-foreground">
                        Percentage reduction in word count from original to simplified version. 
                        Higher compression indicates more effective simplification while preserving key information.
                      </p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              )}

              {metrics.avgSentenceLength !== undefined && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center justify-between p-2 rounded-md bg-muted/20 cursor-help">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium text-foreground">Avg. Sentence Length</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono font-bold text-foreground">
                          {metrics.avgSentenceLength.toFixed(1)} words
                        </span>
                        <Badge
                          className={`text-xs font-semibold ${
                            metrics.avgSentenceLength <= 20
                              ? 'bg-green-500 text-white'
                              : 'bg-orange-500 text-white'
                          }`}
                        >
                          {metrics.avgSentenceLength <= 20 ? 'Target Met' : 'Above Target'}
                        </Badge>
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="max-w-xs">
                      <p className="font-semibold mb-1">Average Sentence Length: {metrics.avgSentenceLength.toFixed(1)} words</p>
                      <p className="text-xs text-muted-foreground mb-2">
                        Average number of words per sentence in the simplified text. 
                        Shorter sentences are easier to understand.
                      </p>
                      <p className="text-xs text-muted-foreground">
                        <strong>Target:</strong> ≤20 words. Shorter sentences improve patient comprehension.
                      </p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>
        )}

        {/* Target Information */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="pt-3 border-t-2 border-border bg-muted/10 p-3 rounded-md cursor-help">
              <p className="text-xs text-foreground/80 font-medium">
                <strong className="text-foreground">Targets:</strong> Flesch-Kincaid ≤ 9.0, Flesch Reading Ease ≥ 60,
                SMOG ≤ 9.0, Sentence Length ≤ 20 words
              </p>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <div className="max-w-xs">
              <p className="font-semibold mb-2">Simplification Targets</p>
              <p className="text-xs text-muted-foreground mb-1">
                These targets ensure discharge summaries are written at a 5th-9th grade reading level, 
                making them accessible to most patients regardless of education level.
              </p>
              <p className="text-xs text-muted-foreground">
                Hover over individual metrics above for detailed explanations.
              </p>
            </div>
          </TooltipContent>
        </Tooltip>
      </CardContent>
    </Card>
    </TooltipProvider>
  )
}
