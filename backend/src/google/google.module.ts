import { Module, forwardRef } from '@nestjs/common';
import { GoogleController } from './google.controller';
import { CompositionSimplifiedController } from './composition-simplified.controller';
import { DischargeUploadController } from './discharge-upload.controller';
import { PatientsController } from './patients.controller';
import { GoogleService } from './google.service';
import { SimplifiedContentService } from './simplified-content.service';
import { DischargeUploadService } from './discharge-upload.service';
import { ConfigModule } from '../config/config.module';
import { PubSubModule } from '../pubsub/pubsub.module';
import { AuditModule } from '../audit/audit.module';
import { QualityMetricsModule } from '../quality-metrics/quality-metrics.module';
import { DischargeSummariesModule } from '../discharge-summaries/discharge-summaries.module';
import { CernerModule } from '../cerner/cerner.module';
import { PatientResourceGuard } from '../auth/guards/patient-resource.guard';

@Module({
  imports: [ConfigModule, PubSubModule, AuditModule, QualityMetricsModule, DischargeSummariesModule, CernerModule],
  controllers: [GoogleController, CompositionSimplifiedController, DischargeUploadController, PatientsController],
  providers: [GoogleService, SimplifiedContentService, DischargeUploadService, PatientResourceGuard],
  exports: [GoogleService],
})
export class GoogleModule {}


