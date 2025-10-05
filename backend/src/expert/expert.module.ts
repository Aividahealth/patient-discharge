import { Module } from '@nestjs/common';
import { ExpertController } from './expert.controller';
import { ExpertService } from './expert.service';
import { DevConfigService } from '../config/dev-config.service';

@Module({
  controllers: [ExpertController],
  providers: [ExpertService, DevConfigService],
  exports: [ExpertService],
})
export class ExpertModule {}
