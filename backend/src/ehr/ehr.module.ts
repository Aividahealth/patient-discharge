import { Module } from '@nestjs/common';
import { EHRController } from './controllers/ehr.controller';
import { JWKSController } from './controllers/jwks.controller';
import { EHRServiceFactory } from './factories/ehr-service.factory';
import { VendorRegistryService } from './services/vendor-registry.service';
import { CernerAdapter } from './adapters/cerner.adapter';
import { EPICAdapter } from './adapters/epic.adapter';
import { ConfigModule } from '../config/config.module';
import { AuditModule } from '../audit/audit.module';

/**
 * EHR Module - Vendor-agnostic EHR integration
 *
 * This module provides a unified interface for integrating with multiple EHR vendors
 * including Cerner, EPIC, Allscripts, and more. It uses the Adapter + Factory pattern
 * to dynamically route requests to the appropriate vendor based on tenant configuration.
 *
 * Key Components:
 * - EHRServiceFactory: Creates appropriate adapter based on tenant vendor
 * - IEHRService: Common interface all adapters implement
 * - CernerAdapter: Cerner-specific FHIR implementation
 * - EPICAdapter: EPIC-specific FHIR implementation
 * - VendorRegistryService: Tracks available vendors and capabilities
 * - EHRController: Generic REST API endpoints
 */
@Module({
  imports: [ConfigModule, AuditModule],
  controllers: [EHRController, JWKSController],
  providers: [
    EHRServiceFactory,
    VendorRegistryService,
    CernerAdapter,
    EPICAdapter,
  ],
  exports: [
    EHRServiceFactory,
    VendorRegistryService,
  ],
})
export class EHRModule {}
