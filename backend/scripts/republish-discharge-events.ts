#!/usr/bin/env ts-node

/**
 * Script to republish discharge export events for recently uploaded discharge summaries
 * 
 * Usage:
 *   ts-node scripts/republish-discharge-events.ts [tenantId] [hoursAgo] [limit]
 * 
 * Examples:
 *   ts-node scripts/republish-discharge-events.ts default 24 10
 *   ts-node scripts/republish-discharge-events.ts ctest 48 50
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { GoogleService } from '../src/google/google.service';
import { PubSubService } from '../src/pubsub/pubsub.service';
import { DevConfigService } from '../src/config/dev-config.service';
import { TenantContext } from '../src/tenant/tenant-context';
import { Logger } from '@nestjs/common';

interface CompositionSearchResult {
  resourceType: string;
  id: string;
  date: string;
  subject: {
    reference: string;
  };
  encounter?: {
    reference: string;
  };
}

async function republishDischargeEvents() {
  const logger = new Logger('RepublishDischargeEvents');
  
  // Parse command line arguments
  const tenantId = process.argv[2] || 'default';
  const hoursAgo = parseInt(process.argv[3] || '24', 10);
  const limit = parseInt(process.argv[4] || '10', 10);

  logger.log(`🚀 Starting republish for tenant: ${tenantId}`);
  logger.log(`📅 Looking for compositions from last ${hoursAgo} hours`);
  logger.log(`📊 Limit: ${limit} compositions`);

  // Create NestJS application context
  const app = await NestFactory.createApplicationContext(AppModule);
  const googleService = app.get(GoogleService);
  const pubSubService = app.get(PubSubService);
  const configService = app.get(DevConfigService);

  // Create tenant context
  const ctx: TenantContext = {
    tenantId,
    timestamp: new Date(),
  };

  try {
    // Calculate date threshold
    const dateThreshold = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
    const dateThresholdISO = dateThreshold.toISOString();

    logger.log(`🔍 Searching for compositions created after: ${dateThresholdISO}`);

    // Search for recent compositions
    // Using _lastUpdated to find recently created/updated compositions
    const searchParams: any = {
      _sort: '-_lastUpdated',
      _count: limit,
      _lastUpdated: `ge${dateThresholdISO.split('.')[0]}`, // Remove milliseconds for FHIR date format
    };

    logger.log(`📋 Search params: ${JSON.stringify(searchParams)}`);

    const searchResult = await googleService.fhirSearch('Composition', searchParams, ctx);

    if (!searchResult?.entry || searchResult.entry.length === 0) {
      logger.warn(`❌ No compositions found in the last ${hoursAgo} hours for tenant ${tenantId}`);
      await app.close();
      return;
    }

    logger.log(`✅ Found ${searchResult.entry.length} compositions`);

    let successCount = 0;
    let errorCount = 0;

    // Process each composition
    for (const entry of searchResult.entry) {
      const composition = entry.resource as CompositionSearchResult;

      if (!composition || composition.resourceType !== 'Composition') {
        logger.warn(`⚠️  Skipping invalid composition entry`);
        continue;
      }

      const compositionId = composition.id;
      const patientRef = composition.subject?.reference;
      const encounterRef = composition.encounter?.reference;

      if (!patientRef) {
        logger.warn(`⚠️  Skipping composition ${compositionId}: no patient reference`);
        continue;
      }

      // Extract patient ID from reference (format: "Patient/patient-id")
      const patientId = patientRef.replace('Patient/', '');
      
      // Extract encounter ID if present (format: "Encounter/encounter-id")
      const googleEncounterId = encounterRef?.replace('Encounter/', '') || '';

      logger.log(`📄 Processing composition ${compositionId} for patient ${patientId}`);

      try {
        // Create encounter export event
        const event = {
          tenantId,
          patientId,
          googleCompositionId: compositionId,
          googleEncounterId,
          cernerEncounterId: '', // Empty for manual uploads
          exportTimestamp: composition.date || new Date().toISOString(),
          status: 'success' as const,
        };

        // Publish event
        await pubSubService.publishEncounterExportEvent(event);
        logger.log(`✅ Published event for composition ${compositionId}`);
        successCount++;
      } catch (error) {
        logger.error(`❌ Failed to publish event for composition ${compositionId}: ${error.message}`);
        errorCount++;
      }
    }

    logger.log(`\n📊 Summary:`);
    logger.log(`   ✅ Successfully republished: ${successCount}`);
    logger.log(`   ❌ Failed: ${errorCount}`);
    logger.log(`   📄 Total processed: ${searchResult.entry.length}`);

  } catch (error) {
    logger.error(`💥 Error during republish: ${error.message}`);
    logger.error(error.stack);
  } finally {
    await app.close();
  }
}

// Run the script
republishDischargeEvents()
  .then(() => {
    console.log('✅ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  });

