import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { DevConfigService } from './config/dev-config.service';
import express from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS for frontend
  app.enableCors({
    origin: '*', // Allow all origins
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: false, // Cannot use wildcard origin with credentials:true
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
