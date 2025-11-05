import { Module } from '@nestjs/common';
import { GoogleController } from './google.controller';
import { CompositionSimplifiedController } from './composition-simplified.controller';
import { GoogleService } from './google.service';
import { SimplifiedContentService } from './simplified-content.service';
import { ConfigModule } from '../config/config.module';

@Module({
  imports: [ConfigModule],
  controllers: [GoogleController, CompositionSimplifiedController],
  providers: [GoogleService, SimplifiedContentService],
  exports: [GoogleService],
})
export class GoogleModule {}


