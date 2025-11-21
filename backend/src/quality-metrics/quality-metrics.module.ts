import { Module } from '@nestjs/common';
import { QualityMetricsService } from './quality-metrics.service';
import { ConfigModule } from '../config/config.module';

@Module({
  imports: [ConfigModule],
  providers: [QualityMetricsService],
  exports: [QualityMetricsService],
})
export class QualityMetricsModule {}
