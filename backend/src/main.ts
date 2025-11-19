import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import express from 'express';
import cors from 'cors';
import * as cookieParser from 'cookie-parser';
import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  try {
    logger.log(`🚀 Starting application with NODE_ENV: ${process.env.NODE_ENV || 'undefined'}`);
    logger.log(`📂 Working directory: ${process.cwd()}`);
    logger.log(`🔧 Environment variables: NODE_ENV=${process.env.NODE_ENV}, PORT=${process.env.PORT}, SERVICE_ACCOUNT_PATH=${process.env.SERVICE_ACCOUNT_PATH}`);

    const app = await NestFactory.create(AppModule, { cors: false }); // Disable NestJS CORS

  // SECURITY: Enable cookie parsing for HttpOnly cookies
  app.use(cookieParser());

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

    // Ensure Express parses FHIR JSON payloads
    app.use(express.json({ type: ['application/json', 'application/fhir+json'] }));
    const port = process.env.PORT ?? 3000;
    // Listen on 0.0.0.0 for Cloud Run (required for container environments)
    await app.listen(port, '0.0.0.0');
    logger.log(`✅ Application is running on http://0.0.0.0:${port}`);
  } catch (error) {
    logger.error(`❌ Failed to start application: ${error.message}`);
    logger.error(error.stack);
    process.exit(1);
  }
}
bootstrap();
