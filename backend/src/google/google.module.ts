import { Module } from '@nestjs/common';
import { GoogleController } from './google.controller';
import { CompositionSimplifiedController } from './composition-simplified.controller';
import { DischargeUploadController } from './discharge-upload.controller';
import { GoogleService } from './google.service';
import { SimplifiedContentService } from './simplified-content.service';
import { DischargeUploadService } from './discharge-upload.service';
import { ConfigModule } from '../config/config.module';

@Module({
  imports: [ConfigModule],
  controllers: [GoogleController, CompositionSimplifiedController, DischargeUploadController],
  providers: [GoogleService, SimplifiedContentService, DischargeUploadService],
  exports: [GoogleService],
})
export class GoogleModule {}


