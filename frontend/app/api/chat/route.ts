import { type NextRequest, NextResponse } from "next/server"
import { generateText } from "ai"
import { openai } from "@ai-sdk/openai"

export async function POST(request: NextRequest) {
  try {
    const { message, patientData, conversationHistory } = await request.json()

    // Create context from patient data
    const patientContext = `
Patient Information:
- Name: ${patientData.name}
- Medications: ${patientData.medications.map((med: any) => `${med.name} ${med.dose} - ${med.instructions}`).join(", ")}
- Upcoming Appointments: ${patientData.appointments.map((apt: any) => `${apt.date} with ${apt.doctor} (${apt.specialty})`).join(", ")}

You are a helpful healthcare assistant for discharge instructions. You can answer questions about:
- Medications (dosage, timing, side effects, interactions)
- Appointments (scheduling, preparation, what to expect)
- Diet and activity restrictions
- Warning signs to watch for
- General recovery guidance

Always be supportive and clear. If asked about urgent symptoms or anything requiring immediate medical attention, direct them to call 911 or their doctor immediately. Do not provide specific medical diagnoses or change prescribed treatments.
`

    const { text } = await generateText({
      model: openai("gpt-4o"),
      system: patientContext,
      prompt: `Patient question: ${message}

Previous conversation context: ${conversationHistory
        .slice(-4)
        .map((msg: any) => `${msg.role}: ${msg.content}`)
        .join("\n")}

Provide a helpful, clear response about their discharge instructions.`,
    })

    return NextResponse.json({ message: text })
  } catch (error) {
    console.error("Chat API error:", error)
    return NextResponse.json({ error: "Failed to process chat message" }, { status: 500 })
  }
}
