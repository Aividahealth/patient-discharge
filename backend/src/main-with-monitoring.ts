/**
 * Enhanced main.ts with Google Cloud Monitoring Integration
 *
 * This file adds:
 * - Structured logging to Cloud Logging
 * - Distributed tracing with Cloud Trace
 * - Request logging middleware
 * - Tracing interceptor
 *
 * To use:
 * 1. Install dependencies (see monitoring/README.md)
 * 2. Set environment variables (GCP_PROJECT_ID, GCP_REGION)
 * 3. Rename this file to main.ts (backup the original)
 * 4. Deploy to Cloud Run
 */

import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import express from 'express';
import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Conditionally import monitoring modules (only if dependencies installed)
let initializeTracing: any;
let loggingMiddleware: any;
let TracingInterceptor: any;
let logger: any;

const MONITORING_ENABLED = process.env.MONITORING_ENABLED !== 'false';

if (MONITORING_ENABLED) {
  try {
    const tracingModule = require('./monitoring/trace-context');
    const loggingModule = require('./monitoring/structured-logger');

    initializeTracing = tracingModule.initializeTracing;
    loggingMiddleware = loggingModule.loggingMiddleware;
    TracingInterceptor = tracingModule.TracingInterceptor;
    logger = loggingModule.logger;

    Logger.log('✅ Monitoring modules loaded successfully', 'Bootstrap');
  } catch (error) {
    Logger.warn('⚠️  Monitoring modules not available. Install dependencies to enable monitoring.', 'Bootstrap');
    Logger.warn(`   Run: npm install @google-cloud/logging @google-cloud/monitoring`, 'Bootstrap');
    MONITORING_ENABLED = false;
  }
}

async function bootstrap() {
  const bootstrapLogger = new Logger('Bootstrap');
  bootstrapLogger.log(`🚀 Starting application with NODE_ENV: ${process.env.NODE_ENV || 'undefined'}`);
  bootstrapLogger.log(`📂 Working directory: ${process.cwd()}`);
  bootstrapLogger.log(`🔧 Environment: NODE_ENV=${process.env.NODE_ENV}, PORT=${process.env.PORT}`);
  bootstrapLogger.log(`📊 Monitoring: ${MONITORING_ENABLED ? 'ENABLED' : 'DISABLED'}`);

  // Initialize OpenTelemetry tracing (if monitoring enabled)
  if (MONITORING_ENABLED && initializeTracing) {
    try {
      const serviceName = process.env.K_SERVICE || 'patient-discharge-backend';
      initializeTracing(serviceName);
      bootstrapLogger.log('✅ Cloud Trace initialized', 'Bootstrap');
    } catch (error) {
      bootstrapLogger.warn(`⚠️  Failed to initialize tracing: ${error.message}`, 'Bootstrap');
    }
  }

  const app = await NestFactory.create(AppModule, { cors: false }); // Disable NestJS CORS

  // Custom CORS middleware
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    const allowedOrigins = [
      'https://www.aividahealth.ai',
      'https://aividahealth.ai',
      'http://localhost:3000',
      'http://localhost:3001'
    ];

    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,Accept,X-Tenant-ID,X-Request-ID');
      res.setHeader('Access-Control-Expose-Headers', 'Content-Type,Authorization,X-Tenant-ID,X-Request-ID');
    }

    // Handle preflight
    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }

    next();
  });

  // Add logging middleware (if monitoring enabled)
  if (MONITORING_ENABLED && loggingMiddleware) {
    app.use(loggingMiddleware);
    bootstrapLogger.log('✅ Request logging middleware enabled', 'Bootstrap');
  }

  // Add tracing interceptor (if monitoring enabled)
  if (MONITORING_ENABLED && TracingInterceptor) {
    app.useGlobalInterceptors(new TracingInterceptor());
    bootstrapLogger.log('✅ Distributed tracing interceptor enabled', 'Bootstrap');
  }

  // Ensure Express parses FHIR JSON payloads
  app.use(express.json({ type: ['application/json', 'application/fhir+json'] }));

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  bootstrapLogger.log(`✅ Application is running on port ${port}`, 'Bootstrap');

  // Log startup to Cloud Logging (if enabled)
  if (MONITORING_ENABLED && logger) {
    await logger.info(
      'backend',
      'app-startup',
      'Patient Discharge Backend started',
      undefined,
      {
        port,
        nodeEnv: process.env.NODE_ENV,
        nodeVersion: process.version,
      }
    );
  }
}

bootstrap().catch((error) => {
  Logger.error(`Failed to start application: ${error.message}`, error.stack, 'Bootstrap');
  process.exit(1);
});
