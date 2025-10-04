import { Module } from '@nestjs/common';
import { ConfigModule } from '../config/config.module';
import { DischargeSummariesController } from './discharge-summaries.controller';
import { DischargeSummariesService } from './discharge-summaries.service';
import { GcsService } from './gcs.service';
import { FirestoreService } from './firestore.service';

@Module({
  imports: [ConfigModule],
  controllers: [DischargeSummariesController],
  providers: [DischargeSummariesService, GcsService, FirestoreService],
  exports: [DischargeSummariesService],
})
export class DischargeSummariesModule {}
