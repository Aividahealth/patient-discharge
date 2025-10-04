import { Module } from '@nestjs/common';
import { DevConfigService } from './dev-config.service';

@Module({
  providers: [DevConfigService],
  exports: [DevConfigService],
})
export class ConfigModule {}


