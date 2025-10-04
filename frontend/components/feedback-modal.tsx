"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"

interface FeedbackModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (feedback: FeedbackData) => void
  userType: 'patient' | 'clinician' | 'admin'
}

interface FeedbackData {
  rating: number
  timestamp: Date
  userType: string
}

const emojiRatings = [
  { value: 1, emoji: "😢", label: "Very Poor" },
  { value: 2, emoji: "😞", label: "Poor" },
  { value: 3, emoji: "😐", label: "Okay" },
  { value: 4, emoji: "😊", label: "Good" },
  { value: 5, emoji: "😄", label: "Excellent" }
]

export function FeedbackModal({ isOpen, onClose, onSubmit, userType }: FeedbackModalProps) {
  const [rating, setRating] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (rating === 0) return

    setIsSubmitting(true)
    
    const feedbackData: FeedbackData = {
      rating,
      timestamp: new Date(),
      userType
    }

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 500))
    
    onSubmit(feedbackData)
    
    // Reset form
    setRating(0)
    setIsSubmitting(false)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-lg font-semibold">
            How was your experience?
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Emoji Rating */}
          <div className="space-y-4">
            <div className="flex justify-center gap-2">
              {emojiRatings.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setRating(item.value)}
                  className={`p-3 rounded-full text-3xl hover:scale-110 transition-all duration-200 ${
                    rating === item.value
                      ? "bg-primary/10 scale-110"
                      : "hover:bg-muted"
                  }`}
                >
                  {item.emoji}
                </button>
              ))}
            </div>
            {rating > 0 && (
              <div className="text-center">
                <p className="text-sm font-medium text-muted-foreground">
                  {emojiRatings[rating - 1].label}
                </p>
              </div>
            )}
          </div>

          {/* Submit Button */}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={rating === 0 || isSubmitting}
              className="flex-1"
            >
              {isSubmitting ? "Submitting..." : "Submit"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
