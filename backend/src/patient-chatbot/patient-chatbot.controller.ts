import { Controller, Post, Body, UseGuards, Req, HttpException, HttpStatus } from '@nestjs/common';
import { PatientChatbotService } from './patient-chatbot.service';
import { ChatMessageDto, ChatResponseDto } from './dto/chat-message.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantGuard } from '../tenant/tenant.guard';

@Controller('api/patient-chatbot')
@UseGuards(JwtAuthGuard, TenantGuard)
export class PatientChatbotController {
  constructor(private readonly chatbotService: PatientChatbotService) {}

  @Post('chat')
  async chat(
    @Body() chatMessageDto: ChatMessageDto,
    @Req() request: any
  ): Promise<ChatResponseDto> {
    try {
      // Optional: Add additional authorization checks
      // For example, verify that the authenticated user (patient) can only access their own data
      const userId = request.user?.userId;
      const tenantId = request.user?.tenantId;

      // Log the chat request for audit purposes
      console.log(`[PatientChatbot] Chat request from user ${userId} (tenant: ${tenantId}) for patient ${chatMessageDto.patientId}`);

      // Call the chatbot service
      const response = await this.chatbotService.chat(chatMessageDto);

      return response;
    } catch (error) {
      console.error('[PatientChatbot] Error:', error);
      throw new HttpException(
        'Failed to process chat message',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
