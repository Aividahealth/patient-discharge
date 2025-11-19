import { Module } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { TenantController } from './tenant.controller';
import { SystemAdminModule } from '../system-admin/system-admin.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [SystemAdminModule, AuthModule],
  controllers: [TenantController],
  providers: [TenantService],
  exports: [TenantService],
})
export class TenantModule {}
