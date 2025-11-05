import { Module } from '@nestjs/common';
import { DevConfigService } from './dev-config.service';
import { ConfigService } from './config.service';
import { ConfigController } from './config.controller';

@Module({
  providers: [DevConfigService, ConfigService],
  controllers: [ConfigController],
  exports: [DevConfigService, ConfigService],
})
export class ConfigModule {}


