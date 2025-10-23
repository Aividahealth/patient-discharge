import { Module } from '@nestjs/common';
import { PubSubService } from './pubsub.service';
import { ConfigModule } from '../config/config.module';

@Module({
  imports: [ConfigModule],
  providers: [PubSubService],
  exports: [PubSubService],
})
export class PubSubModule {}
