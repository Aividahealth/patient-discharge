
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { GoogleModule } from './google/google.module';
import { ConfigModule } from './config/config.module';
import { CernerModule } from './cerner/cerner.module';
import { AuditModule } from './audit/audit.module';

@Module({
  imports: [ConfigModule, GoogleModule, CernerModule, AuditModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
