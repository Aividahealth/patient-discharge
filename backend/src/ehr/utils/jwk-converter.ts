import * as crypto from 'crypto';
import * as fs from 'fs';

/**
 * Converts an RSA public key from PEM format to JWK (JSON Web Key) format
 * Required for EPIC's system-to-system authentication
 */
export class JWKConverter {
  /**
   * Convert PEM public key to JWK format
   * @param publicKeyPath - Path to the public key PEM file
   * @param keyId - Key identifier (kid) - can be any unique string
   * @returns JWK object
   */
  static pemToJWK(publicKeyPath: string, keyId: string): any {
    try {
      // Read the public key file
      const publicKeyPem = fs.readFileSync(publicKeyPath, 'utf8');

      // Create a KeyObject from the PEM
      const keyObject = crypto.createPublicKey(publicKeyPem);

      // Export as JWK
      const jwk = keyObject.export({ format: 'jwk' });

      // Add required fields for EPIC
      return {
        kty: jwk.kty,           // Key Type (RSA)
        n: jwk.n,               // Modulus
        e: jwk.e,               // Exponent
        alg: 'RS384',           // Algorithm - EPIC requires RS384
        use: 'sig',             // Public key use - signature verification
        kid: keyId,             // Key ID - must match what's in JWT header
      };
    } catch (error) {
      throw new Error(`Failed to convert PEM to JWK: ${error.message}`);
    }
  }

  /**
   * Create a JWK Set (JWKS) with multiple keys
   * @param keys - Array of {publicKeyPath, keyId} objects
   * @returns JWKS object
   */
  static createJWKS(keys: Array<{ publicKeyPath: string; keyId: string }>): any {
    const jwks = {
      keys: keys.map(key => this.pemToJWK(key.publicKeyPath, key.keyId))
    };
    return jwks;
  }

  /**
   * Generate a JWK Set from a single public key
   * @param publicKeyPath - Path to public key PEM file
   * @param keyId - Key identifier
   * @returns JWKS object ready for EPIC
   */
  static generateEPICJWKS(publicKeyPath: string, keyId: string): any {
    return {
      keys: [this.pemToJWK(publicKeyPath, keyId)]
    };
  }
}
