import { Module } from '@nestjs/common';
import { CernerController } from './cerner.controller';
import { CernerService } from './cerner.service';
import { ConfigModule } from '../config/config.module';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [ConfigModule, AuditModule, AuthModule],
  controllers: [CernerController],
  providers: [CernerService],
  exports: [CernerService],
})
export class CernerModule {}