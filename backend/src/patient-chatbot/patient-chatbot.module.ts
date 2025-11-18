import { Module } from '@nestjs/common';
import { PatientChatbotController } from './patient-chatbot.controller';
import { PatientChatbotService } from './patient-chatbot.service';
import { AuthModule } from '../auth/auth.module';
import { TenantModule } from '../tenant/tenant.module';
import { ConfigModule } from '../config/config.module';

@Module({
  imports: [ConfigModule, AuthModule, TenantModule],
  controllers: [PatientChatbotController],
  providers: [PatientChatbotService],
  exports: [PatientChatbotService],
})
export class PatientChatbotModule {}
