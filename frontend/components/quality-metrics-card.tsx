"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
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

export function QualityMetricsCard({ metrics, compact = false }: QualityMetricsCardProps) {
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
      <div className="flex items-center gap-2 text-sm">
        {metrics.fleschKincaidGradeLevel !== undefined && (
          <Badge variant="outline" className="gap-1">
            <BookOpen className="h-3 w-3" />
            Grade {metrics.fleschKincaidGradeLevel.toFixed(1)}
          </Badge>
        )}
        {metrics.fleschReadingEase !== undefined && (
          <Badge variant="outline" className="gap-1">
            <FileText className="h-3 w-3" />
            {metrics.fleschReadingEase.toFixed(0)}
          </Badge>
        )}
        {meetsTarget && (
          <CheckCircle className="h-4 w-4 text-green-500" />
        )}
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart className="h-5 w-5" />
          Quality Metrics
          {meetsTarget ? (
            <Badge variant="outline" className="gap-1 bg-green-50 text-green-700 border-green-200">
              <CheckCircle className="h-3 w-3" />
              Meets Target
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1 bg-amber-50 text-amber-700 border-amber-200">
              <AlertCircle className="h-3 w-3" />
              Review Needed
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Automated readability and simplification metrics (Target: 5th-9th grade)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Readability Metrics */}
        <div>
          <h4 className="text-sm font-medium mb-3 text-muted-foreground">Readability</h4>
          <div className="grid gap-3">
            {metrics.fleschKincaidGradeLevel !== undefined && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Flesch-Kincaid Grade Level</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono font-semibold">
                    {metrics.fleschKincaidGradeLevel.toFixed(1)}
                  </span>
                  {fkGradeInterpretation && (
                    <Badge className={`${fkGradeInterpretation.color} text-white text-xs`}>
                      {fkGradeInterpretation.text}
                    </Badge>
                  )}
                </div>
              </div>
            )}

            {metrics.fleschReadingEase !== undefined && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Flesch Reading Ease</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono font-semibold">
                    {metrics.fleschReadingEase.toFixed(1)}
                  </span>
                  {freInterpretation && (
                    <Badge className={`${freInterpretation.color} text-white text-xs`}>
                      {freInterpretation.text}
                    </Badge>
                  )}
                </div>
              </div>
            )}

            {metrics.smogIndex !== undefined && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BarChart className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">SMOG Index</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono font-semibold">
                    {metrics.smogIndex.toFixed(1)}
                  </span>
                  <Badge
                    className={`text-xs ${
                      metrics.smogIndex <= 9
                        ? 'bg-green-500 text-white'
                        : 'bg-orange-500 text-white'
                    }`}
                  >
                    {metrics.smogIndex <= 9 ? 'Target Met' : 'Above Target'}
                  </Badge>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Simplification Metrics */}
        {(metrics.compressionRatio !== undefined || metrics.avgSentenceLength !== undefined) && (
          <div>
            <h4 className="text-sm font-medium mb-3 text-muted-foreground">Simplification</h4>
            <div className="grid gap-3">
              {metrics.compressionRatio !== undefined && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingDown className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Compression Ratio</span>
                  </div>
                  <span className="text-sm font-mono font-semibold">
                    {metrics.compressionRatio.toFixed(1)}%
                  </span>
                </div>
              )}

              {metrics.avgSentenceLength !== undefined && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Avg. Sentence Length</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono font-semibold">
                      {metrics.avgSentenceLength.toFixed(1)} words
                    </span>
                    <Badge
                      className={`text-xs ${
                        metrics.avgSentenceLength <= 20
                          ? 'bg-green-500 text-white'
                          : 'bg-orange-500 text-white'
                      }`}
                    >
                      {metrics.avgSentenceLength <= 20 ? 'Target Met' : 'Above Target'}
                    </Badge>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Target Information */}
        <div className="pt-3 border-t border-border">
          <p className="text-xs text-muted-foreground">
            <strong>Targets:</strong> Flesch-Kincaid ≤ 9.0, Flesch Reading Ease ≥ 60,
            SMOG ≤ 9.0, Sentence Length ≤ 20 words
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
