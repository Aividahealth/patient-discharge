import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Firestore } from '@google-cloud/firestore';
import { DevConfigService } from '../config/dev-config.service';
import {
  DischargeSummaryMetadata,
  DischargeSummaryListQuery,
  DischargeSummaryListResponse,
  DischargeSummaryStatus,
} from './discharge-summary.types';

@Injectable()
export class FirestoreService {
  private readonly logger = new Logger(FirestoreService.name);
  private firestore: Firestore | null = null;
  private readonly collectionName = 'discharge_summaries';

  constructor(private configService: DevConfigService) {}

  /**
   * Initialize Firestore client lazily (only when first needed)
   */
  private getFirestore(): Firestore {
    if (!this.firestore) {
      let serviceAccountPath: string | undefined;

      try {
        const config = this.configService.get();
        serviceAccountPath = config.service_account_path;
      } catch (error) {
        // Config not loaded yet or running in Cloud Run with ADC
        this.logger.log('Config not available, using Application Default Credentials');
      }

      // Use ADC (Application Default Credentials) if no service account path
      this.firestore = new Firestore(
        serviceAccountPath ? { keyFilename: serviceAccountPath } : {},
      );

      this.logger.log('Firestore Service initialized');
    }
    return this.firestore;
  }

  /**
   * Get discharge summary metadata by ID
   */
  async getById(id: string): Promise<DischargeSummaryMetadata> {
    const doc = await this.getFirestore()
      .collection(this.collectionName)
      .doc(id)
      .get();

    if (!doc.exists) {
      throw new NotFoundException(`Discharge summary not found: ${id}`);
    }

    return this.documentToMetadata(id, doc.data());
  }

  /**
   * List discharge summaries with filtering and pagination
   */
  async list(
    query: DischargeSummaryListQuery,
  ): Promise<DischargeSummaryListResponse> {
    let firestoreQuery = this.getFirestore().collection(
      this.collectionName,
    ) as any;

    // Apply filters
    if (query.patientId) {
      firestoreQuery = firestoreQuery.where('patientId', '==', query.patientId);
    }

    if (query.patientName) {
      // Firestore doesn't support case-insensitive search, so we'll do exact match
      // For better search, consider using Algolia or Elasticsearch
      firestoreQuery = firestoreQuery.where(
        'patientName',
        '==',
        query.patientName,
      );
    }

    if (query.status) {
      firestoreQuery = firestoreQuery.where('status', '==', query.status);
    }

    if (query.startDate) {
      const startDate = new Date(query.startDate);
      firestoreQuery = firestoreQuery.where(
        'admissionDate',
        '>=',
        startDate,
      );
    }

    if (query.endDate) {
      const endDate = new Date(query.endDate);
      firestoreQuery = firestoreQuery.where('admissionDate', '<=', endDate);
    }

    // Apply ordering
    const orderBy = query.orderBy || 'updatedAt';
    const orderDirection = query.orderDirection || 'desc';
    firestoreQuery = firestoreQuery.orderBy(orderBy, orderDirection);

    // Get total count (without pagination)
    const countSnapshot = await firestoreQuery.get();
    const total = countSnapshot.size;

    // Apply pagination
    const limit = query.limit || 20;
    const offset = query.offset || 0;

    firestoreQuery = firestoreQuery.limit(limit).offset(offset);

    // Execute query
    const snapshot = await firestoreQuery.get();

    const items: DischargeSummaryMetadata[] = [];
    snapshot.forEach((doc) => {
      items.push(this.documentToMetadata(doc.id, doc.data()));
    });

    return {
      items,
      total,
      limit,
      offset,
    };
  }

  /**
   * Create new discharge summary metadata
   */
  async create(
    metadata: Omit<DischargeSummaryMetadata, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<DischargeSummaryMetadata> {
    const now = new Date();
    const docRef = this.getFirestore().collection(this.collectionName).doc();

    const data = {
      ...metadata,
      createdAt: now,
      updatedAt: now,
    };

    // Remove undefined values (Firestore doesn't accept them)
    const cleanData = this.removeUndefined(data);

    await docRef.set(cleanData);

    this.logger.log(`Created discharge summary: ${docRef.id}`);

    return this.documentToMetadata(docRef.id, data);
  }

  /**
   * Update discharge summary metadata
   */
  async update(
    id: string,
    updates: Partial<
      Omit<DischargeSummaryMetadata, 'id' | 'createdAt' | 'updatedAt'>
    >,
  ): Promise<DischargeSummaryMetadata> {
    const docRef = this.getFirestore().collection(this.collectionName).doc(id);

    const doc = await docRef.get();
    if (!doc.exists) {
      throw new NotFoundException(`Discharge summary not found: ${id}`);
    }

    const updateData = {
      ...updates,
      updatedAt: new Date(),
    };

    // Remove undefined values (Firestore doesn't accept them)
    const cleanData = this.removeUndefined(updateData);

    await docRef.update(cleanData);

    this.logger.log(`Updated discharge summary: ${id}`);

    const updatedDoc = await docRef.get();
    return this.documentToMetadata(id, updatedDoc.data());
  }

  /**
   * Delete discharge summary metadata
   */
  async delete(id: string): Promise<void> {
    const docRef = this.getFirestore().collection(this.collectionName).doc(id);

    const doc = await docRef.get();
    if (!doc.exists) {
      throw new NotFoundException(`Discharge summary not found: ${id}`);
    }

    await docRef.delete();

    this.logger.log(`Deleted discharge summary: ${id}`);
  }

  /**
   * Check if discharge summary exists
   */
  async exists(id: string): Promise<boolean> {
    const doc = await this.getFirestore()
      .collection(this.collectionName)
      .doc(id)
      .get();
    return doc.exists;
  }

  /**
   * Find discharge summary by file path
   */
  async findByFilePath(filePath: string): Promise<DischargeSummaryMetadata | null> {
    const firestore = this.getFirestore();
    const snapshot = await firestore
      .collection(this.collectionName)
      .where('files.raw', '==', filePath)
      .limit(1)
      .get();

    if (snapshot.empty) {
      // Try simplified
      const simplifiedSnapshot = await firestore
        .collection(this.collectionName)
        .where('files.simplified', '==', filePath)
        .limit(1)
        .get();

      if (simplifiedSnapshot.empty) {
        return null;
      }

      const doc = simplifiedSnapshot.docs[0];
      return this.documentToMetadata(doc.id, doc.data());
    }

    const doc = snapshot.docs[0];
    return this.documentToMetadata(doc.id, doc.data());
  }

  /**
   * Get statistics
   */
  async getStats(): Promise<{
    total: number;
    byStatus: { [key in DischargeSummaryStatus]?: number };
  }> {
    const snapshot = await this.getFirestore()
      .collection(this.collectionName)
      .get();

    const byStatus: { [key in DischargeSummaryStatus]?: number } = {};

    snapshot.forEach((doc) => {
      const data = doc.data();
      const status = data.status as DischargeSummaryStatus;

      if (!byStatus[status]) {
        byStatus[status] = 0;
      }
      byStatus[status]++;
    });

    return {
      total: snapshot.size,
      byStatus,
    };
  }

  /**
   * Remove undefined values from object (Firestore doesn't accept them)
   */
  private removeUndefined(obj: any): any {
    const result: any = {};
    for (const key in obj) {
      if (obj[key] !== undefined) {
        if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key]) && !(obj[key] instanceof Date)) {
          result[key] = this.removeUndefined(obj[key]);
        } else {
          result[key] = obj[key];
        }
      }
    }
    return result;
  }

  /**
   * Convert Firestore document to DischargeSummaryMetadata
   */
  private documentToMetadata(
    id: string,
    data: any,
  ): DischargeSummaryMetadata {
    return {
      id,
      patientId: data.patientId,
      patientName: data.patientName,
      mrn: data.mrn,
      encounterId: data.encounterId,
      admissionDate: data.admissionDate?.toDate ? data.admissionDate.toDate() : data.admissionDate,
      dischargeDate: data.dischargeDate?.toDate ? data.dischargeDate.toDate() : data.dischargeDate,
      status: data.status,
      files: data.files,
      createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt,
      updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : data.updatedAt,
      simplifiedAt: data.simplifiedAt?.toDate ? data.simplifiedAt.toDate() : data.simplifiedAt,
      translatedAt: data.translatedAt?.toDate ? data.translatedAt.toDate() : data.translatedAt,
      metadata: data.metadata,
    };
  }

  /**
   * Batch create multiple discharge summaries
   */
  async batchCreate(
    summaries: Omit<
      DischargeSummaryMetadata,
      'id' | 'createdAt' | 'updatedAt'
    >[],
  ): Promise<DischargeSummaryMetadata[]> {
    const firestore = this.getFirestore();
    const batch = firestore.batch();
    const now = new Date();
    const results: DischargeSummaryMetadata[] = [];

    for (const summary of summaries) {
      const docRef = firestore.collection(this.collectionName).doc();
      const data = {
        ...summary,
        createdAt: now,
        updatedAt: now,
      };

      // Remove undefined values (Firestore doesn't accept them)
      const cleanData = this.removeUndefined(data);

      batch.set(docRef, cleanData);
      results.push(this.documentToMetadata(docRef.id, data));
    }

    await batch.commit();

    this.logger.log(`Batch created ${summaries.length} discharge summaries`);

    return results;
  }
}
