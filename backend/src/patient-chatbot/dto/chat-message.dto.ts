import { IsString, IsArray, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class ConversationMessage {
  @IsString()
  role: 'user' | 'assistant';

  @IsString()
  content: string;
}

export class ChatMessageDto {
  @IsString()
  message: string;

  @IsString()
  patientId: string;

  @IsString()
  compositionId: string;

  @IsString()
  dischargeSummary: string;

  @IsString()
  dischargeInstructions: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConversationMessage)
  @IsOptional()
  conversationHistory?: ConversationMessage[];
}

export class ChatResponseDto {
  response: string;
  confidence?: string;
  disclaimer?: string;
}
