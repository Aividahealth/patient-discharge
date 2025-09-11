"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { MessageSquare, CheckCircle } from "lucide-react"
import { FeedbackModal } from "./feedback-modal"

interface FeedbackButtonProps {
  userType: 'patient' | 'clinician' | 'admin'
  className?: string
}

interface FeedbackData {
  rating: number
  timestamp: Date
  userType: string
}

export function FeedbackButton({ userType, className = "" }: FeedbackButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)

  const handleFeedbackSubmit = (feedback: FeedbackData) => {
    // Store feedback in localStorage for demo purposes
    const existingFeedback = JSON.parse(localStorage.getItem('userFeedback') || '[]')
    existingFeedback.push(feedback)
    localStorage.setItem('userFeedback', JSON.stringify(existingFeedback))
    
    setIsSubmitted(true)
    
    // Reset submitted state after 3 seconds
    setTimeout(() => setIsSubmitted(false), 3000)
  }

  if (isSubmitted) {
    return (
      <Button
        variant="outline"
        size="sm"
        className={`flex items-center gap-2 text-green-600 border-green-200 ${className}`}
        disabled
      >
        <CheckCircle className="h-4 w-4" />
        Feedback Submitted
      </Button>
    )
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsModalOpen(true)}
        className={`flex items-center gap-2 ${className}`}
      >
        <MessageSquare className="h-4 w-4" />
        Share Feedback
      </Button>
      
      <FeedbackModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleFeedbackSubmit}
        userType={userType}
      />
    </>
  )
}
