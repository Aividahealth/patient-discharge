import { Module } from '@nestjs/common';
import { DischargeExportController } from './controllers/discharge-export.controller';
import { DischargeExportService } from './services/discharge-export.service';
import { DocumentExportScheduler } from './services/document-export.scheduler';
import { DischargeSummariesExportController } from './controllers/discharge-summaries-export.controller';
import { DischargeSummariesExportService } from './services/discharge-summaries-export.service';
import { EncounterExportScheduler } from './services/encounter-export.scheduler';
import { EncounterExportSchedulerController } from './controllers/encounter-export-scheduler.controller';
import { GoogleModule } from '../google/google.module';
import { CernerModule } from '../cerner/cerner.module';
import { ConfigModule } from '../config/config.module';
import { AuditModule } from '../audit/audit.module';
import { CernerAuthModule } from '../cerner-auth/cerner-auth.module';
import { PubSubModule } from '../pubsub/pubsub.module';

@Module({
  imports: [
    GoogleModule,
    CernerModule,
    ConfigModule,
    AuditModule,
    CernerAuthModule,
    PubSubModule,
  ],
  controllers: [
    DischargeExportController,
    DischargeSummariesExportController,
    EncounterExportSchedulerController,
  ],
  providers: [
    DischargeExportService,
    DocumentExportScheduler,
    DischargeSummariesExportService,
    EncounterExportScheduler,
  ],
  exports: [
    DischargeExportService,
    DocumentExportScheduler,
    DischargeSummariesExportService,
    EncounterExportScheduler,
  ],
})
export class DischargeExportModule {}
