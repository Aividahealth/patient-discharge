import * as crypto from 'crypto';

/**
 * SECURITY: Calculate SHA-256 checksum for document integrity verification (HIPAA M-4)
 *
 * @param content - The content to hash
 * @returns SHA-256 hash as hex string
 */
export function calculateChecksum(content: string | Buffer): string {
  return crypto
    .createHash('sha256')
    .update(content)
    .digest('hex');
}

/**
 * SECURITY: Verify document integrity by comparing checksums
 *
 * @param content - The content to verify
 * @param expectedChecksum - The expected SHA-256 checksum
 * @returns true if checksums match, false otherwise
 */
export function verifyChecksum(content: string | Buffer, expectedChecksum: string): boolean {
  const actualChecksum = calculateChecksum(content);
  return actualChecksum === expectedChecksum;
}

/**
 * SECURITY: Verify document and throw error if tampering detected
 *
 * @param content - The content to verify
 * @param expectedChecksum - The expected SHA-256 checksum
 * @throws Error if checksums don't match (tamper detected)
 */
export function verifyChecksumOrThrow(content: string | Buffer, expectedChecksum: string): void {
  if (!verifyChecksum(content, expectedChecksum)) {
    throw new Error(
      'Document integrity verification failed - possible tampering detected. ' +
      `Expected: ${expectedChecksum}, Got: ${calculateChecksum(content)}`
    );
  }
}
