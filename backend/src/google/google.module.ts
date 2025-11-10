import { Module } from '@nestjs/common';
import { GoogleController } from './google.controller';
import { CompositionSimplifiedController } from './composition-simplified.controller';
import { DischargeUploadController } from './discharge-upload.controller';
import { PatientsController } from './patients.controller';
import { GoogleService } from './google.service';
import { SimplifiedContentService } from './simplified-content.service';
import { DischargeUploadService } from './discharge-upload.service';
import { ConfigModule } from '../config/config.module';
import { PubSubModule } from '../pubsub/pubsub.module';

@Module({
  imports: [ConfigModule, PubSubModule],
  controllers: [GoogleController, CompositionSimplifiedController, DischargeUploadController, PatientsController],
  providers: [GoogleService, SimplifiedContentService, DischargeUploadService],
  exports: [GoogleService],
})
export class GoogleModule {}


