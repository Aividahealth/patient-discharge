import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { message, patientData, conversationHistory } = await request.json()

    // Simple response without AI SDK
    const response = `Thank you for your question: "${message}". For detailed medical advice, please consult with your healthcare provider or call your doctor's office. If you're experiencing urgent symptoms, please call 911 immediately.`

    return NextResponse.json({ message: response })
  } catch (error) {
    console.error("Chat API error:", error)
    return NextResponse.json({ error: "Failed to process chat message" }, { status: 500 })
  }
}
