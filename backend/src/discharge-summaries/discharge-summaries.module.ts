import { Module } from '@nestjs/common';
import { ConfigModule } from '../config/config.module';
import { QualityMetricsModule } from '../quality-metrics/quality-metrics.module';
import { DischargeSummariesController } from './discharge-summaries.controller';
import { DischargeSummariesService } from './discharge-summaries.service';
import { GcsService } from './gcs.service';
import { FirestoreService } from './firestore.service';

@Module({
  imports: [ConfigModule, QualityMetricsModule],
  controllers: [DischargeSummariesController],
  providers: [DischargeSummariesService, GcsService, FirestoreService],
  exports: [DischargeSummariesService, FirestoreService],
})
export class DischargeSummariesModule {}
