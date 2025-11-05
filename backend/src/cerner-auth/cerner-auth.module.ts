import { Module } from '@nestjs/common';
import { CernerAuthController } from './cerner-auth.controller';
import { CernerAuthService } from './cerner-auth.service';
import { SessionService } from './session.service';
import { ConfigModule } from '../config/config.module';

@Module({
  imports: [ConfigModule],
  controllers: [CernerAuthController],
  providers: [CernerAuthService, SessionService],
  exports: [CernerAuthService, SessionService],
})
export class CernerAuthModule {}

