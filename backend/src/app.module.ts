
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { GoogleModule } from './google/google.module';
import { ConfigModule } from './config/config.module';
import { CernerModule } from './cerner/cerner.module';
import { AuditModule } from './audit/audit.module';
import { DischargeSummariesModule } from './discharge-summaries/discharge-summaries.module';
import { DischargeExportModule } from './discharge-export/discharge-export.module';
import { ExpertModule } from './expert/expert.module';
import { TenantModule } from './tenant/tenant.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { CernerAuthModule } from './cerner-auth/cerner-auth.module';
import { PubSubModule } from './pubsub/pubsub.module';
import { AuthModule } from './auth/auth.module';
import { MonitoringModule } from './monitoring/monitoring.module';

@Module({
  imports: [
    MonitoringModule, // Add monitoring module first (global)
    ConfigModule,
    GoogleModule,
    CernerModule,
    AuditModule,
    DischargeSummariesModule,
    DischargeExportModule,
    ExpertModule,
    TenantModule,
    SchedulerModule,
    CernerAuthModule,
    PubSubModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
