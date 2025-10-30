import { Firestore } from '@google-cloud/firestore';
import { createLogger } from './common/utils/logger';

const logger = createLogger('FirestoreService');

export interface DischargeSummaryMetadata {
  files: {
    raw: string;
    simplified?: string;
    translated?: Record<string, string>;
  };
  status: 'raw_only' | 'simplified' | 'translated';
  metadata?: {
    patientName?: string;
    mrn?: string;
    admissionDate?: Date;
    dischargeDate?: Date;
    diagnosis?: string[];
  };
  createdAt: Date;
  updatedAt: Date;
  simplifiedAt?: Date;
  translatedAt?: Date;
}

export class FirestoreService {
  private firestore: Firestore;
  private readonly collection = 'discharge_summaries';

  constructor() {
    // Use Application Default Credentials in Cloud Run
    this.firestore = new Firestore();
    logger.info('FirestoreService initialized');
  }

  /**
   * Create or update a discharge summary record in Firestore
   */
  async upsertDischargeSummary(
    rawFileName: string,
    simplifiedFileName: string,
  ): Promise<void> {
    try {
      const now = new Date();

      // Extract base name from raw file (without extension and path)
      const baseName = this.extractBaseName(rawFileName);

      // Check if a record already exists with this raw file
      const existingSnapshot = await this.firestore
        .collection(this.collection)
        .where('files.raw', '==', rawFileName)
        .limit(1)
        .get();

      if (!existingSnapshot.empty) {
        // Update existing record
        const doc = existingSnapshot.docs[0];
        await doc.ref.update({
          'files.simplified': simplifiedFileName,
          status: 'simplified',
          simplifiedAt: now,
          updatedAt: now,
        });

        logger.info('Updated existing Firestore record', {
          id: doc.id,
          rawFileName,
          simplifiedFileName,
        });
      } else {
        // Create new record
        const newDoc: DischargeSummaryMetadata = {
          files: {
            raw: rawFileName,
            simplified: simplifiedFileName,
          },
          status: 'simplified',
          metadata: {
            diagnosis: [baseName], // Use filename as diagnosis placeholder
          },
          createdAt: now,
          updatedAt: now,
          simplifiedAt: now,
        };

        const docRef = await this.firestore.collection(this.collection).add(newDoc);

        logger.info('Created new Firestore record', {
          id: docRef.id,
          rawFileName,
          simplifiedFileName,
        });
      }
    } catch (error) {
      logger.error('Failed to upsert Firestore record', error as Error, {
        rawFileName,
        simplifiedFileName,
      });
      // Don't throw - Firestore errors shouldn't fail the whole function
      // The file is already processed and saved to GCS
    }
  }

  /**
   * Extract base name from file path
   * Example: "path/to/Patient-Name.md" -> "Patient-Name"
   */
  private extractBaseName(fileName: string): string {
    const parts = fileName.split('/');
    const fileNameOnly = parts[parts.length - 1];
    return fileNameOnly.replace(/\.(md|txt)$/i, '');
  }
}
