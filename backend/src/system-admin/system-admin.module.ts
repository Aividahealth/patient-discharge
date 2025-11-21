import { Module } from '@nestjs/common';
import { SystemAdminController } from './system-admin.controller';
import { SystemAdminService } from './system-admin.service';
import { GcpInfrastructureService } from './gcp-infrastructure.service';
import { AuthModule } from '../auth/auth.module';
import { ConfigModule } from '../config/config.module';
import { QualityMetricsModule } from '../quality-metrics/quality-metrics.module';

@Module({
  imports: [AuthModule, ConfigModule, QualityMetricsModule],
  controllers: [SystemAdminController],
  providers: [SystemAdminService, GcpInfrastructureService],
  exports: [SystemAdminService],
})
export class SystemAdminModule {}
