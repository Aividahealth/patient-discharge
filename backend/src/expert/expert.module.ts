import { Module } from '@nestjs/common';
import { ExpertController } from './expert.controller';
import { ExpertService } from './expert.service';
import { ConfigModule } from '../config/config.module';
import { GoogleModule } from '../google/google.module';
import { QualityMetricsModule } from '../quality-metrics/quality-metrics.module';
import { DischargeSummariesModule } from '../discharge-summaries/discharge-summaries.module';
import { CernerModule } from '../cerner/cerner.module';
@Module({
  imports: [ConfigModule, GoogleModule, QualityMetricsModule, DischargeSummariesModule, CernerModule],

  controllers: [ExpertController],
  providers: [ExpertService],
  exports: [ExpertService],
})
export class ExpertModule {}
