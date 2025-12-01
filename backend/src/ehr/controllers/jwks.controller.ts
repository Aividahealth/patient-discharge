import { Controller, Get, Param, HttpException, HttpStatus } from '@nestjs/common';
import { DevConfigService } from '../../config/dev-config.service';
import { JWKConverter } from '../utils/jwk-converter';
import * as path from 'path';

/**
 * Public JWKS (JSON Web Key Set) endpoint for EPIC integration
 *
 * EPIC's system-to-system authentication requires apps to host their public keys
 * in JWK format at a publicly accessible HTTPS URL. This controller serves that purpose.
 *
 * Usage:
 * 1. Generate RSA key pair for your tenant
 * 2. Configure tenant with private key path and key_id in config
 * 3. Provide EPIC with: https://your-domain.com/.well-known/jwks/{tenantId}
 * 4. EPIC will fetch the public key from this endpoint to verify JWT signatures
 *
 * @example
 * GET https://your-app.com/.well-known/jwks/hospital-a
 * Returns:
 * {
 *   "keys": [{
 *     "kty": "RSA",
 *     "n": "...",
 *     "e": "AQAB",
 *     "alg": "RS384",
 *     "use": "sig",
 *     "kid": "epic-key-123"
 *   }]
 * }
 */
@Controller('.well-known')
export class JWKSController {
  constructor(private readonly configService: DevConfigService) {}

  /**
   * Serve JWK Set for a specific tenant's EPIC integration
   * This is a PUBLIC endpoint - no authentication required
   * EPIC will call this endpoint to fetch your public key
   */
  @Get('jwks/:tenantId')
  async getJWKS(@Param('tenantId') tenantId: string) {
    try {
      // Get tenant configuration
      const config = this.configService.getConfig();
      const tenantConfig = config.tenants[tenantId];

      if (!tenantConfig) {
        throw new HttpException(
          `Tenant '${tenantId}' not found`,
          HttpStatus.NOT_FOUND,
        );
      }

      // Check if tenant has EPIC configuration
      const ehrConfig = tenantConfig.ehr;
      if (!ehrConfig || ehrConfig.vendor !== 'epic') {
        throw new HttpException(
          `Tenant '${tenantId}' does not have EPIC integration configured`,
          HttpStatus.NOT_FOUND,
        );
      }

      // Get system app configuration (backend service)
      const systemApp = ehrConfig.system_app;
      if (!systemApp || !systemApp.private_key_path || !systemApp.key_id) {
        throw new HttpException(
          `Tenant '${tenantId}' EPIC configuration missing private_key_path or key_id`,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      // Convert private key path to public key path
      // Assumes public key is stored alongside private key with .pub extension
      // e.g., epic-private-key.pem -> epic-public-key.pem
      const privateKeyPath = systemApp.private_key_path;
      const publicKeyPath = privateKeyPath.replace('-private-key.pem', '-public-key.pem');

      // Resolve absolute path (config paths are relative to project root)
      const absolutePath = path.resolve(process.cwd(), publicKeyPath);

      // Generate JWK Set
      const jwks = JWKConverter.generateEPICJWKS(
        absolutePath,
        systemApp.key_id,
      );

      return jwks;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Failed to generate JWKS: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Alternative endpoint for provider app (clinician-facing) JWKS
   * Use this if you have separate keys for system vs provider apps
   */
  @Get('jwks/:tenantId/provider')
  async getProviderJWKS(@Param('tenantId') tenantId: string) {
    try {
      const config = this.configService.getConfig();
      const tenantConfig = config.tenants[tenantId];

      if (!tenantConfig) {
        throw new HttpException(
          `Tenant '${tenantId}' not found`,
          HttpStatus.NOT_FOUND,
        );
      }

      const ehrConfig = tenantConfig.ehr;
      if (!ehrConfig || ehrConfig.vendor !== 'epic') {
        throw new HttpException(
          `Tenant '${tenantId}' does not have EPIC integration configured`,
          HttpStatus.NOT_FOUND,
        );
      }

      // Get provider app configuration (clinician-facing)
      const providerApp = ehrConfig.provider_app;
      if (!providerApp || !providerApp.private_key_path || !providerApp.key_id) {
        throw new HttpException(
          `Tenant '${tenantId}' EPIC provider app configuration missing`,
          HttpStatus.NOT_FOUND,
        );
      }

      const privateKeyPath = providerApp.private_key_path;
      const publicKeyPath = privateKeyPath.replace('-private-key.pem', '-public-key.pem');
      const absolutePath = path.resolve(process.cwd(), publicKeyPath);

      const jwks = JWKConverter.generateEPICJWKS(
        absolutePath,
        providerApp.key_id,
      );

      return jwks;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Failed to generate provider JWKS: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
