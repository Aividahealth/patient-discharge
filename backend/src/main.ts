import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { DevConfigService } from './config/dev-config.service';
import express from 'express';
import cors from 'cors';

async function bootstrap() {
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
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,Accept');
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
  // Load dev configuration at startup so it is ready for FHIR module usage
  const cfg = app.get(DevConfigService);
  try {
    await cfg.load();
    Logger.log('Loaded .settings.dev/config.yaml', 'Bootstrap');
  } catch (err) {
    Logger.error('Failed to load .settings.dev/config.yaml', (err as Error)?.stack, 'Bootstrap');
    throw err;
  }
  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  Logger.log(`Application is running on port ${port}`, 'Bootstrap');
}
bootstrap();
