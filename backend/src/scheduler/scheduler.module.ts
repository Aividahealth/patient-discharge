import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SchedulerController } from './scheduler.controller';
import { DischargeExportModule } from '../discharge-export/discharge-export.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    DischargeExportModule,
  ],
  controllers: [SchedulerController],
  providers: [],
  exports: [],
})
export class SchedulerModule {}
