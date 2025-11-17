import { Module, Global } from '@nestjs/common';
import { MetricsService } from './metrics.service';

/**
 * Monitoring Module
 *
 * Provides structured logging, custom metrics, and distributed tracing
 * for the patient-discharge system.
 *
 * Usage:
 * 1. Import MonitoringModule in app.module.ts
 * 2. Inject MetricsService into your services/controllers
 * 3. Use logger from structured-logger.ts for logging
 * 4. Initialize tracing in main.ts
 */
@Global()
@Module({
  providers: [MetricsService],
  exports: [MetricsService],
})
export class MonitoringModule {}
