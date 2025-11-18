import { Injectable, Logger } from '@nestjs/common';
import { ChatMessageDto, ChatResponseDto } from './dto/chat-message.dto';
import Anthropic from '@anthropic-ai/sdk';

@Injectable()
export class PatientChatbotService {
  private readonly logger = new Logger(PatientChatbotService.name);
  private readonly anthropic: Anthropic;
  private readonly model = 'claude-3-5-sonnet-20241022';

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      this.logger.warn('ANTHROPIC_API_KEY not set. Chatbot will not function.');
    }
    this.anthropic = new Anthropic({ apiKey });
  }

  /**
   * Generate chat response using Claude AI with strict context restrictions
   */
  async chat(dto: ChatMessageDto): Promise<ChatResponseDto> {
    try {
      const systemPrompt = this.buildSystemPrompt(
        dto.dischargeSummary,
        dto.dischargeInstructions
      );

      // Build conversation history for Claude
      const messages = [
        ...(dto.conversationHistory || []).map((msg) => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        })),
        {
          role: 'user' as const,
          content: dto.message,
        },
      ];

      this.logger.log(`Chatbot request for patient ${dto.patientId}, composition ${dto.compositionId}`);

      const response = await this.anthropic.messages.create({
        model: this.model,
        max_tokens: 1000,
        temperature: 0.3, // Lower temperature for more conservative responses
        system: systemPrompt,
        messages: messages,
      });

      const responseText = response.content[0].type === 'text'
        ? response.content[0].text
        : '';

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
