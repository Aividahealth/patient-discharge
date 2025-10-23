import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { CernerAuthService } from './cerner-auth.service';
import { SessionService } from './session.service';
import { ConfigModule } from '../config/config.module';

@Module({
  imports: [ConfigModule],
  controllers: [AuthController],
  providers: [CernerAuthService, SessionService],
  exports: [CernerAuthService, SessionService],
})
export class AuthModule {}
