/**
 * Test Discharge Summary Manager
 *
 * Utility for creating and managing test discharge summaries with tags for easy cleanup
 */

import { Firestore } from '@google-cloud/firestore';
import { Storage } from '@google-cloud/storage';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

export interface TestDischargeSummaryOptions {
  tenantId: string;
  patientId?: string;
  patientName?: string;
  mrn?: string;
  encounterId?: string;
  admissionDate?: Date;
  dischargeDate?: Date;
  filePath: string; // Path to .md or .pdf file
}

export interface TestDischargeSummary {
  id: string;
  tenantId: string;
  patientId?: string;
  patientName?: string;
  mrn?: string;
  encounterId?: string;
  status: string;
  gcsPath: string;
  metadata: any;
}

export class TestDischargeManager {
  private firestore: Firestore;
  private storage: Storage;
  private testTag: string;
  private createdSummaries: TestDischargeSummary[] = [];
  private bucketName: string;

  constructor(
    firestore: Firestore,
    storage: Storage,
    bucketName: string,
    testTag: string = 'portal-integration-test'
  ) {
    this.firestore = firestore;
    this.storage = storage;
    this.bucketName = bucketName;
    this.testTag = testTag;
  }

  /**
   * Check if bucket exists
   */
  private async bucketExists(bucketName: string): Promise<boolean> {
    try {
      const bucket = this.storage.bucket(bucketName);
      const [exists] = await bucket.exists();
      return exists;
    } catch (error) {
      return false;
    }
  }

  /**
   * Ensure bucket exists, create if it doesn't
   */
  private async ensureBucketExists(bucketName: string): Promise<void> {
    const exists = await this.bucketExists(bucketName);
    if (!exists) {
      console.log(`Bucket ${bucketName} does not exist, creating it...`);
      try {
        const location = process.env.LOCATION || 'us-central1';
        await this.storage.createBucket(bucketName, {
          location,
          storageClass: 'STANDARD',
        });
        console.log(`✅ Created bucket: ${bucketName}`);
      } catch (error) {
        console.error(`Failed to create bucket ${bucketName}:`, error);
        throw new Error(`Failed to create bucket ${bucketName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  /**
   * Upload a discharge summary file to GCS
   */
  private async uploadToGCS(
    filePath: string,
    destinationPath: string
  ): Promise<string> {
    // Ensure bucket exists before uploading
    await this.ensureBucketExists(this.bucketName);

    const bucket = this.storage.bucket(this.bucketName);
    const fileContent = fs.readFileSync(filePath);
    const file = bucket.file(destinationPath);

    await file.save(fileContent, {
      metadata: {
        contentType: this.getContentType(filePath),
        metadata: {
          testTag: this.testTag,
        },
      },
    });

    return `gs://${this.bucketName}/${destinationPath}`;
  }

  /**
   * Get content type based on file extension
   */
  private getContentType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const contentTypes: Record<string, string> = {
      '.md': 'text/markdown',
      '.pdf': 'application/pdf',
      '.txt': 'text/plain',
    };
    return contentTypes[ext] || 'application/octet-stream';
  }

  /**
   * Extract patient info from markdown file
   */
  private extractPatientInfoFromMarkdown(filePath: string): {
    patientName?: string;
    mrn?: string;
    encounterId?: string;
  } {
    const content = fs.readFileSync(filePath, 'utf-8');
    const result: any = {};

    // Extract patient name
    const nameMatch = content.match(/\*\*Patient Name:\*\*\s*(.+)/);
    if (nameMatch) {
      result.patientName = nameMatch[1].trim();
    }

    // Extract MRN
    const mrnMatch = content.match(/\*\*MRN:\*\*\s*(.+)/);
    if (mrnMatch) {
      result.mrn = mrnMatch[1].trim();
    }

    // Extract Encounter ID
    const encounterMatch = content.match(/\*\*Encounter ID:\*\*\s*(.+)/);
    if (encounterMatch) {
      result.encounterId = encounterMatch[1].trim();
    }

    return result;
  }

  /**
   * Create a test discharge summary
   */
  async createDischargeSummary(
    options: TestDischargeSummaryOptions
  ): Promise<TestDischargeSummary> {
    const summaryId = uuidv4();
    const now = new Date();

    // Read file and extract metadata
    let metadata = {};
    const fileExt = path.extname(options.filePath);
    if (fileExt === '.md') {
      metadata = this.extractPatientInfoFromMarkdown(options.filePath);
    }

    // Merge with provided options
    const patientName = options.patientName || metadata['patientName'] || 'Test Patient';
    const mrn = options.mrn || metadata['mrn'] || `MRN-${summaryId.substring(0, 8)}`;
    const encounterId = options.encounterId || metadata['encounterId'] || `ENC-${summaryId.substring(0, 8)}`;
    const patientId = options.patientId || `patient-${summaryId.substring(0, 8)}`;

    // Upload to GCS
    const fileName = path.basename(options.filePath);
    const gcsPath = `${options.tenantId}/raw/${summaryId}/${fileName}`;
    const gcsUri = await this.uploadToGCS(options.filePath, gcsPath);

    // Create Firestore document
    // For test data, use the document ID as compositionId since we don't have real FHIR Compositions
    const summaryData = {
      id: summaryId,
      compositionId: summaryId, // Use document ID as compositionId for test data
      tenantId: options.tenantId,
      patientId,
      patientName,
      mrn,
      encounterId,
      admissionDate: options.admissionDate || null,
      dischargeDate: options.dischargeDate || new Date(),
      status: 'raw',
      files: {
        raw: gcsUri,
      },

      // Test tag for cleanup
      testTag: this.testTag,
      testCreatedAt: now.toISOString(),

      // Timestamps
      createdAt: now,
      updatedAt: now,
      createdBy: 'test-automation',
    };

    await this.firestore
      .collection('discharge_summaries')
      .doc(summaryId)
      .set(summaryData);

    const summary: TestDischargeSummary = {
      id: summaryId,
      tenantId: options.tenantId,
      patientId,
      patientName,
      mrn,
      encounterId,
      status: 'raw',
      gcsPath: gcsUri,
      metadata: summaryData,
    };

    this.createdSummaries.push(summary);
    return summary;
  }

  /**
   * Create multiple discharge summaries from a directory
   */
  async createDischargeSummariesFromDirectory(
    tenantId: string,
    directoryPath: string
  ): Promise<TestDischargeSummary[]> {
    // Ensure bucket exists before processing files
    await this.ensureBucketExists(this.bucketName);

    const files = fs.readdirSync(directoryPath);
    const summaries: TestDischargeSummary[] = [];
    const errors: Array<{ file: string; error: string }> = [];

    for (const file of files) {
      // Skip non-discharge files
      if (file === 'README.md' || (!file.endsWith('.md') && !file.endsWith('.pdf'))) {
        continue;
      }

      const filePath = path.join(directoryPath, file);
      try {
        const summary = await this.createDischargeSummary({
          tenantId,
          filePath,
        });
        summaries.push(summary);
        console.log(`   ✅ Created summary from ${file}: ${summary.id}`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`   ❌ Failed to create discharge summary from ${file}:`, errorMsg);
        errors.push({ file, error: errorMsg });
      }
    }

    if (errors.length > 0) {
      console.warn(`⚠️  ${errors.length} file(s) failed to process:`);
      errors.forEach(({ file, error }) => {
        console.warn(`   - ${file}: ${error}`);
      });
    }

    return summaries;
  }

  /**
   * Get all created summaries
   */
  getCreatedSummaries(): TestDischargeSummary[] {
    return [...this.createdSummaries];
  }

  /**
   * Find discharge summary by ID
   */
  async findSummary(summaryId: string): Promise<any> {
    const doc = await this.firestore
      .collection('discharge_summaries')
      .doc(summaryId)
      .get();

    if (!doc.exists) {
      return null;
    }

    return {
      id: doc.id,
      ...doc.data(),
    };
  }

  /**
   * Update discharge summary status
   */
  async updateSummaryStatus(summaryId: string, status: string): Promise<void> {
    await this.firestore
      .collection('discharge_summaries')
      .doc(summaryId)
      .update({
        status,
        updatedAt: new Date(),
      });
  }

  /**
   * Delete a specific discharge summary
   */
  async deleteSummary(summaryId: string): Promise<void> {
    // Delete from Firestore
    await this.firestore
      .collection('discharge_summaries')
      .doc(summaryId)
      .delete();

    // Delete from GCS (best effort)
    try {
      const bucket = this.storage.bucket(this.bucketName);
      await bucket.deleteFiles({
        prefix: `demo/raw/${summaryId}/`,
      });
    } catch (error) {
      console.warn(`Failed to delete GCS files for ${summaryId}:`, error.message);
    }

    this.createdSummaries = this.createdSummaries.filter(s => s.id !== summaryId);
  }

  /**
   * Delete all summaries created by this manager
   */
  async cleanupCreatedSummaries(): Promise<number> {
    let deletedCount = 0;

    for (const summary of this.createdSummaries) {
      try {
        await this.deleteSummary(summary.id);
        deletedCount++;
      } catch (error) {
        console.error(`Failed to delete summary ${summary.id}:`, error.message);
      }
    }

    this.createdSummaries = [];
    return deletedCount;
  }

  /**
   * Delete all discharge summaries with the test tag
   */
  async cleanupAllTestSummaries(): Promise<number> {
    const snapshot = await this.firestore
      .collection('discharge_summaries')
      .where('testTag', '==', this.testTag)
      .get();

    let deletedCount = 0;
    const batch = this.firestore.batch();
    let batchSize = 0;
    const MAX_BATCH_SIZE = 500;

    const summariesToDelete: string[] = [];

    for (const doc of snapshot.docs) {
      batch.delete(doc.ref);
      summariesToDelete.push(doc.id);
      batchSize++;

      if (batchSize >= MAX_BATCH_SIZE) {
        await batch.commit();
        deletedCount += batchSize;
        batchSize = 0;
      }
    }

    if (batchSize > 0) {
      await batch.commit();
      deletedCount += batchSize;
    }

    // Clean up GCS files (best effort)
    const bucket = this.storage.bucket(this.bucketName);
    for (const summaryId of summariesToDelete) {
      try {
        await bucket.deleteFiles({
          prefix: `demo/raw/${summaryId}/`,
        });
      } catch (error) {
        // Ignore errors - best effort cleanup
      }
    }

    this.createdSummaries = [];
    return deletedCount;
  }
}
