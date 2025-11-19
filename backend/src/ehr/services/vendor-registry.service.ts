import { Injectable, Logger } from '@nestjs/common';
import { EHRVendor, EHRCapabilities } from '../interfaces/ehr-service.interface';

/**
 * Metadata about an EHR vendor
 */
export interface VendorMetadata {
  vendor: EHRVendor;
  name: string;
  description: string;
  capabilities: EHRCapabilities;
  documentationUrl: string;
  status: 'production' | 'beta' | 'development';
}

/**
 * Registry service for tracking available EHR vendors and their capabilities
 */
@Injectable()
export class VendorRegistryService {
  private readonly logger = new Logger(VendorRegistryService.name);
  private vendors: Map<EHRVendor, VendorMetadata> = new Map();

  constructor() {
    this.registerDefaultVendors();
  }

  /**
   * Register default vendors (Cerner and EPIC)
   */
  private registerDefaultVendors(): void {
    // Register Cerner
    this.registerVendor({
      vendor: EHRVendor.CERNER,
      name: 'Oracle Health (Cerner)',
      description: 'Cerner EHR system with FHIR R4 support',
      capabilities: {
        supportsFHIRR4: true,
        supportsSMARTonFHIR: true,
        supportsPatientAccess: true,
        supportsProviderAccess: true,
        supportedResourceTypes: [
          'Patient',
          'Encounter',
          'DocumentReference',
          'Composition',
          'Binary',
          'Observation',
          'Condition',
          'Medication',
          'MedicationRequest',
          'Procedure',
          'AllergyIntolerance',
          'Immunization',
        ],
        supportsDelete: true,
        supportsUpdate: true,
        maxSearchCount: undefined, // Unlimited
      },
      documentationUrl: 'https://fhir.cerner.com/millennium/r4/',
      status: 'production',
    });

    // Register EPIC
    this.registerVendor({
      vendor: EHRVendor.EPIC,
      name: 'Epic Systems',
      description: 'Epic EHR system with FHIR R4 support',
      capabilities: {
        supportsFHIRR4: true,
        supportsSMARTonFHIR: true,
        supportsPatientAccess: true,
        supportsProviderAccess: true,
        supportedResourceTypes: [
          'Patient',
          'Encounter',
          'DocumentReference',
          'Binary',
          'Observation',
          'Condition',
          'MedicationRequest',
          'Procedure',
          'AllergyIntolerance',
          'Immunization',
          'DiagnosticReport',
          'CarePlan',
        ],
        supportsDelete: false, // Most resources are read-only
        supportsUpdate: false, // Limited update support
        maxSearchCount: 100, // EPIC default: 10, max: 100
      },
      documentationUrl: 'https://fhir.epic.com/',
      status: 'beta',
    });

    this.logger.log(`Registered ${this.vendors.size} EHR vendors`);
  }

  /**
   * Register a new vendor or update existing vendor metadata
   */
  registerVendor(metadata: VendorMetadata): void {
    this.vendors.set(metadata.vendor, metadata);
    this.logger.log(`Registered vendor: ${metadata.name} (${metadata.vendor}) - ${metadata.status}`);
  }

  /**
   * Get metadata for a specific vendor
   */
  getVendor(vendor: EHRVendor): VendorMetadata | undefined {
    return this.vendors.get(vendor);
  }

  /**
   * Get all registered vendors
   */
  getAllVendors(): VendorMetadata[] {
    return Array.from(this.vendors.values());
  }

  /**
   * Get only production-ready vendors
   */
  getProductionVendors(): VendorMetadata[] {
    return Array.from(this.vendors.values()).filter(v => v.status === 'production');
  }

  /**
   * Check if a vendor is supported
   */
  isVendorSupported(vendor: EHRVendor): boolean {
    return this.vendors.has(vendor);
  }

  /**
   * Get capabilities for a specific vendor
   */
  getVendorCapabilities(vendor: EHRVendor): EHRCapabilities | undefined {
    return this.vendors.get(vendor)?.capabilities;
  }

  /**
   * Check if a vendor supports a specific resource type
   */
  supportsResourceType(vendor: EHRVendor, resourceType: string): boolean {
    const capabilities = this.getVendorCapabilities(vendor);
    return capabilities?.supportedResourceTypes.includes(resourceType) || false;
  }

  /**
   * Get vendor name (human-readable)
   */
  getVendorName(vendor: EHRVendor): string {
    return this.vendors.get(vendor)?.name || vendor;
  }
}
