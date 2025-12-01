import { Module } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { TenantController } from './tenant.controller';
import { SystemAdminModule } from '../system-admin/system-admin.module';
import { AuthModule } from '../auth/auth.module';
import { ConfigModule } from '../config/config.module';
import { QualityMetricsModule } from '../quality-metrics/quality-metrics.module';

@Module({
  imports: [SystemAdminModule, AuthModule, ConfigModule, QualityMetricsModule],
  controllers: [TenantController],
  providers: [TenantService],
  exports: [TenantService],
})
export class TenantModule {}
