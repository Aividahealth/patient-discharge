import { Injectable, Logger } from '@nestjs/common';
import { ChatMessageDto, ChatResponseDto } from './dto/chat-message.dto';
import { VertexAI } from '@google-cloud/vertexai';

@Injectable()
export class PatientChatbotService {
  private readonly logger = new Logger(PatientChatbotService.name);
  private readonly vertexAI: VertexAI;
  private readonly model = 'gemini-3-flash';
  private readonly projectId: string;
  private readonly location: string;

  constructor() {
    this.projectId = process.env.GCP_PROJECT || 'simtran-474018';
    this.location = process.env.LOCATION || 'us-central1';

    this.vertexAI = new VertexAI({
      project: this.projectId,
      location: this.location,
    });

    this.logger.log(`Patient Chatbot Service initialized with Gemini (project: ${this.projectId}, location: ${this.location})`);
  }

  /**
   * Generate chat response using Gemini AI with strict context restrictions
   */
  async chat(dto: ChatMessageDto): Promise<ChatResponseDto> {
    try {
      const systemPrompt = this.buildSystemPrompt(
        dto.dischargeSummary,
        dto.dischargeInstructions
      );

      this.logger.log(`Chatbot request for patient ${dto.patientId}, composition ${dto.compositionId}`);

      // Get the generative model with system instruction
      const generativeModel = this.vertexAI.getGenerativeModel({
        model: this.model,
        generationConfig: {
          maxOutputTokens: 1000,
          temperature: 0.3, // Lower temperature for more conservative responses
          topP: 0.95,
        },
        systemInstruction: {
          role: 'system',
          parts: [{ text: systemPrompt }],
        },
      });

      // Build conversation history for Gemini
      const history = (dto.conversationHistory || []).map((msg) => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }],
      }));

      // Start chat with history
      const chat = generativeModel.startChat({
        history: history,
      });

      // Send the user's message
      const result = await chat.sendMessage(dto.message);
      const response = result.response;

      if (!response.candidates || response.candidates.length === 0) {
        throw new Error('No response generated from Gemini');
      }

      const candidate = response.candidates[0];

      // Check for safety blocks
      if (candidate.finishReason === 'SAFETY') {
        this.logger.warn('Content blocked by safety filters', {
          patientId: dto.patientId,
          safetyRatings: candidate.safetyRatings,
        });
        throw new Error('Content was blocked by safety filters');
      }

      const responseText = candidate.content.parts
        .map((part: any) => part.text)
        .join('');

      this.logger.log(`Chatbot response generated for patient ${dto.patientId}`);

      return {
        response: responseText,
        disclaimer: 'This information is from your discharge summary. For medical questions or emergencies, contact your healthcare provider immediately.',
      };
    } catch (error) {
      this.logger.error(`Chatbot error for patient ${dto.patientId}:`, error);
      throw new Error('Failed to generate chat response');
    }
  }

  /**
   * Build system prompt with strict guardrails
   */
  private buildSystemPrompt(
    dischargeSummary: string,
    dischargeInstructions: string
  ): string {
    return `You are a helpful patient discharge assistant. Your role is to help patients understand their discharge information.

**CRITICAL RESTRICTIONS:**
1. ONLY answer questions using information found in the discharge summary and discharge instructions provided below
2. If the answer is not in the discharge documents, say "I don't see that information in your discharge summary. Please contact your healthcare provider."
3. DO NOT provide general medical advice beyond what's in the discharge documents
4. DO NOT diagnose new symptoms or conditions
5. DO NOT recommend medication changes or dosages not mentioned in the discharge documents
6. For medication dosages, procedures, or critical information, quote the exact text from the discharge documents
7. You CAN explain medical acronyms and provide simple explanations of medical terms mentioned in the discharge documents
8. You CAN provide basic context for conditions mentioned in the discharge summary

**DISCHARGE SUMMARY:**
---
${dischargeSummary}
---

**DISCHARGE INSTRUCTIONS:**
---
${dischargeInstructions}
---

**When answering:**
- Be clear and patient-friendly
- Use simple language and avoid unnecessary medical jargon
- If medical terms from the discharge documents need explanation, provide brief, simple explanations
- Always remind patients to contact their healthcare provider for new symptoms, concerns, or questions that cannot be answered from the discharge documents
- For urgent symptoms (severe pain, difficulty breathing, chest pain, etc.), immediately advise calling 911 or going to the emergency room

**If asked about topics outside the discharge documents:**
- Politely decline and suggest contacting their healthcare team
- Example: "I can only discuss information from your discharge summary. For questions about [topic], please contact your healthcare provider."

Remember: You are an information assistant, not a medical advisor. Your job is to help patients understand what's already in their discharge documents.`;
  }
}
