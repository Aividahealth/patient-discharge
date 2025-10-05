
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { GoogleModule } from './google/google.module';
import { ConfigModule } from './config/config.module';
import { CernerModule } from './cerner/cerner.module';
import { AuditModule } from './audit/audit.module';
import { DischargeSummariesModule } from './discharge-summaries/discharge-summaries.module';
import { ExpertModule } from './expert/expert.module';

@Module({
  imports: [
    ConfigModule,
    GoogleModule,
    CernerModule,
    AuditModule,
    DischargeSummariesModule,
    ExpertModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
