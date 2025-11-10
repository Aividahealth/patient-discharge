import { Module } from '@nestjs/common';
import { ExpertController } from './expert.controller';
import { ExpertService } from './expert.service';
import { ConfigModule } from '../config/config.module';
import { GoogleModule } from '../google/google.module';

@Module({
  imports: [ConfigModule, GoogleModule],
  controllers: [ExpertController],
  providers: [ExpertService],
  exports: [ExpertService],
})
export class ExpertModule {}
