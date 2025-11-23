import { Injectable, Logger } from '@nestjs/common';
import { Firestore } from '@google-cloud/firestore';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { DevConfigService } from '../config/dev-config.service';
import { GoogleService } from '../google/google.service';
import { QualityMetricsService } from '../quality-metrics/quality-metrics.service';
import { FirestoreService } from '../discharge-summaries/firestore.service';
import { CernerService } from '../cerner/cerner.service';
import type {
  ExpertFeedback,
  SubmitFeedbackDto,
  UpdateFeedbackDto,
  ReviewSummary,
  ReviewListQuery,
  ReviewListResponse,
  FeedbackStats,
  FeedbackResponse,
} from './expert.types';
import { resolveServiceAccountPath } from '../utils/path.helper';
import { TenantContext } from '../tenant/tenant-context';

@Injectable()
export class ExpertService {
  private readonly logger = new Logger(ExpertService.name);
  private firestore: Firestore | null = null;
  private readonly feedbackCollection = 'expert_feedback';
  private readonly summariesCollection = 'discharge_summaries';

  constructor(
    private configService: DevConfigService,
    private googleService?: GoogleService,
    private qualityMetricsService?: QualityMetricsService,
    private firestoreService?: FirestoreService,
    private cernerService?: CernerService,
  ) {}

  private getFirestore(): Firestore {
    if (!this.firestore) {
      let serviceAccountPath: string | undefined;

      try {
        const config = this.configService.get();
        // Use firestore_service_account_path first, fallback to service_account_path
        const configPath = config.firestore_service_account_path || config.service_account_path;
        if (configPath) {
          // Resolve the path - handles both full paths and filenames
          const resolvedPath = resolveServiceAccountPath(configPath);
          // Check if file exists before using it
          if (fs.existsSync(resolvedPath)) {
            serviceAccountPath = resolvedPath;
            this.logger.log(`Using Firestore service account: ${serviceAccountPath}`);
          } else {
            this.logger.log(`Firestore service account file not found at ${resolvedPath}, using Application Default Credentials`);
          }
        }
      } catch (error) {
        // Config not loaded yet or running in Cloud Run with ADC
        this.logger.log('Config not available, using Application Default Credentials');
      }

      this.firestore = new Firestore(
        serviceAccountPath ? { keyFilename: serviceAccountPath } : {},
      );

      this.logger.log('Expert Service initialized with Firestore');
    }
    return this.firestore;
  }

  /**
   * Get list of discharge summaries for expert review
   * Uses the same FHIR-based logic as clinician portal to ensure consistency
   */
  async getReviewList(query: ReviewListQuery, ctx: TenantContext): Promise<ReviewListResponse> {
    if (!this.googleService) {
      this.logger.error('GoogleService not available - cannot query FHIR');
      return { summaries: [], total: 0 };
    }

    const firestore = this.getFirestore();
    const limit = query.limit || 20;
    const offset = query.offset || 0;

    try {
      this.logger.log(`📋 Retrieving expert review list for tenant: ${ctx.tenantId} with filters: ${JSON.stringify(query)}`);

      // Step 1: Query FHIR Composition resources (same as clinician portal)
      const compositionsResult = await this.googleService.fhirSearch(
        'Composition',
        {
          type: 'http://loinc.org|18842-5', // Discharge summary LOINC code
          _count: 100,
        },
        ctx,
      );

      if (!compositionsResult?.entry || compositionsResult.entry.length === 0) {
        this.logger.log('No Compositions found in FHIR');
        return { summaries: [], total: 0 };
      }

      const summaries: ReviewSummary[] = [];

      // Step 2: Process each Composition
      for (const entry of compositionsResult.entry) {
        try {
          const composition = entry.resource;
          const compositionId = composition.id;

          // Extract Patient reference
          const patientRef = composition.subject?.reference; // Patient/patient-id
          if (!patientRef) {
            this.logger.warn(`Composition ${compositionId} missing Patient reference`);
            continue;
          }

          const patientId = patientRef.replace('Patient/', '');

          // Step 3: Check Firestore for simplifiedAt/translatedAt (for metadata, not filtering)
          // Note: We don't filter by simplifiedAt/translatedAt to ensure both portals show the same list
          // The type parameter is used for UI organization, not data filtering
          let firestoreData: any = null;
          try {
            const firestoreDoc = await firestore
              .collection(this.summariesCollection)
              .doc(compositionId)
              .get();
            
            if (firestoreDoc.exists) {
              firestoreData = firestoreDoc.data();
            }
          } catch (error) {
            this.logger.debug(`Could not fetch Firestore data for ${compositionId}: ${error.message}`);
          }

          // Step 4: Note - We removed the type filter to match clinician portal behavior
          // Both portals now show all compositions from FHIR
          // The type parameter is still passed but not used for filtering

          // Step 5: Fetch Patient resource (for name, MRN, preferred language)
          const patient = await this.googleService.fhirRead('Patient', patientId, ctx);
          const mrn = patient.identifier?.find(
            (id: any) => id.type?.coding?.[0]?.code === 'MR'
          )?.value || '';
          const patientName = patient.name?.[0]?.text || 
            `${patient.name?.[0]?.given?.join(' ') || ''} ${patient.name?.[0]?.family || ''}`.trim() || 'Unknown';

          // Step 6: Get preferred language from FHIR Patient resource
          let preferredLanguage: string | undefined;
          if (firestoreData?.preferredLanguage) {
            preferredLanguage = firestoreData.preferredLanguage;
          } else if (patient.communication) {
            const preferredComm = patient.communication.find((c: any) => c.preferred === true);
            if (preferredComm?.language?.coding?.[0]?.code) {
              preferredLanguage = preferredComm.language.coding[0].code;
            } else if (patient.communication?.[0]?.language?.coding?.[0]?.code) {
              preferredLanguage = patient.communication[0].language.coding[0].code;
            } else {
              preferredLanguage = 'en';
            }
          } else {
            preferredLanguage = 'en';
          }

          // Step 7: Get review stats from Firestore expert_feedback collection
          const feedbackSnapshot = await firestore
            .collection(this.feedbackCollection)
            .where('tenantId', '==', ctx.tenantId)
            .where('dischargeSummaryId', '==', compositionId)
            .get();

          const feedbackDocs = feedbackSnapshot.docs;
          const reviewCount = feedbackDocs.length;

          let avgRating: number | undefined;
          let latestReviewDate: Date | undefined;

          if (reviewCount > 0) {
            const ratings = feedbackDocs.map((f) => f.data().overallRating);
            avgRating = ratings.reduce((a, b) => a + b, 0) / ratings.length;

            const reviewDates = feedbackDocs.map((f) => f.data().reviewDate?.toDate?.() || f.data().reviewDate);
            latestReviewDate = reviewDates.sort((a, b) => b.getTime() - a.getTime())[0];
          }

          // Step 8: Get quality metrics from QualityMetricsService
          let qualityMetrics: any = undefined;
          if (this.qualityMetricsService) {
            try {
              const metrics = await this.qualityMetricsService.getMetrics(compositionId);
              if (metrics) {
                qualityMetrics = {
                  fleschKincaidGradeLevel: metrics.fleschKincaidGradeLevel,
                  fleschReadingEase: metrics.fleschReadingEase,
                  smogIndex: metrics.smogIndex,
                  compressionRatio: metrics.compressionRatio,
                  avgSentenceLength: metrics.avgSentenceLength,
                };
              }
            } catch (error) {
              this.logger.debug(`Could not fetch quality metrics for ${compositionId}: ${error.message}`);
            }
          }

          // Step 9: Get simplifiedAt/translatedAt from Firestore
          const simplifiedAt = firestoreData?.simplifiedAt?.toDate?.() || firestoreData?.simplifiedAt;
          const translatedAt = firestoreData?.translatedAt?.toDate?.() || firestoreData?.translatedAt;

          const summary: ReviewSummary = {
            id: patientId, // Patient ID (for consistency with clinician portal)
            compositionId: compositionId, // Composition ID (for fetching content)
            patientName: patientName || firestoreData?.patientName,
            mrn: mrn || firestoreData?.mrn,
            simplifiedAt,
            translatedAt,
            reviewCount,
            avgRating: avgRating ? Math.round(avgRating * 10) / 10 : undefined,
            latestReviewDate,
            qualityMetrics,
            language: preferredLanguage,
          };

          // Step 10: Apply filters
          if (query.filter === 'no_reviews' && reviewCount > 0) continue;
          if (query.filter === 'low_rating' && (!avgRating || avgRating >= 3.5)) continue;

          summaries.push(summary);
        } catch (error) {
          this.logger.error(`❌ Error processing Composition entry: ${error.message}`);
          // Continue with next entry
          continue;
        }
      }

      this.logger.log(`✅ Retrieved ${summaries.length} summaries from FHIR for expert review`);

      // Step 11: Apply pagination
      const paginatedSummaries = summaries.slice(offset, offset + limit);

      return {
        summaries: paginatedSummaries,
        total: summaries.length,
      };
    } catch (error) {
      this.logger.error(`❌ Error retrieving expert review list: ${error.message}`);
      throw error;
    }
  }

  /**
   * Submit expert feedback
   */
  async submitFeedback(dto: SubmitFeedbackDto, tenantId: string, ctx?: TenantContext): Promise<ExpertFeedback> {
    const firestore = this.getFirestore();
    const now = new Date();

    // Try to create DocumentReference in Cerner if Cerner encounter ID is found
    let cernerDocumentReferenceId: string | undefined;
    if (ctx) {
      try {
        const cernerEncounterId = await this.extractCernerEncounterId(dto.dischargeSummaryId, ctx);
        if (cernerEncounterId) {
          this.logger.log(`📤 Found Cerner encounter ID ${cernerEncounterId}, creating DocumentReference in Cerner`);
          const result = await this.createCernerDocumentReference(dto, cernerEncounterId, ctx);
          if (result.success && result.documentReferenceId) {
            cernerDocumentReferenceId = result.documentReferenceId;
            this.logger.log(`✅ Successfully created DocumentReference in Cerner: ${cernerDocumentReferenceId}`);
          } else {
            this.logger.warn(`⚠️ Failed to create DocumentReference in Cerner, continuing with feedback submission`);
          }
        } else {
          this.logger.log(`ℹ️ No Cerner encounter ID found, skipping Cerner DocumentReference creation`);
        }
      } catch (error) {
        // Log error but don't fail feedback submission
        this.logger.error(`❌ Error creating Cerner DocumentReference: ${error.message}`);
      }
    }

    // Build feedback object, excluding undefined values
    const feedback: any = {
      tenantId, // Store tenantId for multi-tenant isolation
      dischargeSummaryId: dto.dischargeSummaryId,
      reviewType: dto.reviewType,
      reviewerName: dto.reviewerName,
      reviewDate: now,
      overallRating: dto.overallRating,
      hasHallucination: dto.hasHallucination,
      hasMissingInfo: dto.hasMissingInfo,
      createdAt: now,
    };

    // Only add optional fields if they have values
    if (dto.language) {
      feedback.language = dto.language;
    }
    if (dto.reviewerHospital) {
      feedback.reviewerHospital = dto.reviewerHospital;
    }
    if (dto.whatWorksWell) {
      feedback.whatWorksWell = dto.whatWorksWell;
    }
    if (dto.whatNeedsImprovement) {
      feedback.whatNeedsImprovement = dto.whatNeedsImprovement;
    }
    if (dto.specificIssues) {
      feedback.specificIssues = dto.specificIssues;
    }
    if (cernerDocumentReferenceId) {
      feedback.cernerDocumentReferenceId = cernerDocumentReferenceId;
    }

    const docRef = await firestore
      .collection(this.feedbackCollection)
      .add(feedback);

    this.logger.log(
      `Expert feedback submitted: ${docRef.id} for summary ${dto.dischargeSummaryId} for tenant: ${tenantId}`,
    );

    return {
      ...feedback,
      id: docRef.id,
    } as ExpertFeedback;
  }

  /**
   * Get feedback for a specific discharge summary with aggregated statistics
   */
  async getFeedbackForSummary(
    summaryId: string,
    tenantId: string,
    options: {
      reviewType?: 'simplification' | 'translation';
      includeStats?: boolean;
      includeFeedback?: boolean;
      limit?: number;
      offset?: number;
      sortBy?: 'reviewDate' | 'rating' | 'createdAt';
      sortOrder?: 'asc' | 'desc';
    } = {},
  ): Promise<FeedbackResponse> {
    const {
      reviewType,
      includeStats = true,
      includeFeedback = true,
      limit = 50,
      offset = 0,
      sortBy = 'reviewDate',
      sortOrder = 'desc',
    } = options;

    const firestore = this.getFirestore();

    // Build base query - always filter by tenantId (required for multi-tenant isolation)
    let query = firestore
      .collection(this.feedbackCollection)
      .where('tenantId', '==', tenantId)
      .where('dischargeSummaryId', '==', summaryId) as any;

    // Filter by review type if provided
    if (reviewType) {
      query = query.where('reviewType', '==', reviewType);
    }

    // Get all matching feedback for stats calculation
    const allSnapshot = await query.get();
    const allFeedback = allSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      reviewDate: doc.data().reviewDate?.toDate?.() || doc.data().reviewDate,
      createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
      updatedAt: doc.data().updatedAt?.toDate?.() || doc.data().updatedAt,
    })) as ExpertFeedback[];

    // Calculate statistics
    let stats: FeedbackStats | undefined;
    if (includeStats) {
      stats = this.calculateFeedbackStats(allFeedback);
    }

    // Get paginated and sorted feedback
    let feedback: ExpertFeedback[] = [];
    if (includeFeedback) {
      // Sort feedback
      const sortedFeedback = [...allFeedback].sort((a, b) => {
        let aValue: any;
        let bValue: any;

        switch (sortBy) {
          case 'rating':
            aValue = a.overallRating;
            bValue = b.overallRating;
            break;
          case 'createdAt':
            aValue = a.createdAt;
            bValue = b.createdAt;
            break;
          case 'reviewDate':
          default:
            aValue = a.reviewDate;
            bValue = b.reviewDate;
            break;
        }

        if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });

      // Apply pagination
      feedback = sortedFeedback.slice(offset, offset + limit);
    }

    return {
      success: true,
      summaryId,
      stats,
      feedback,
      pagination: {
        total: allFeedback.length,
        limit,
        offset,
        hasMore: offset + limit < allFeedback.length,
      },
    };
  }

  /**
   * Calculate aggregated statistics from feedback array
   */
  private calculateFeedbackStats(feedback: ExpertFeedback[]): FeedbackStats {
    if (feedback.length === 0) {
      return {
        totalReviews: 0,
        simplificationReviews: 0,
        translationReviews: 0,
        averageRating: 0,
        simplificationRating: 0,
        translationRating: 0,
        latestReviewDate: null,
        latestSimplificationReview: null,
        latestTranslationReview: null,
        hasHallucination: false,
        hasMissingInfo: false,
        ratingDistribution: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
      };
    }

    const simplificationFeedback = feedback.filter((f) => f.reviewType === 'simplification');
    const translationFeedback = feedback.filter((f) => f.reviewType === 'translation');

    // Calculate average ratings
    const totalRating = feedback.reduce((sum, f) => sum + f.overallRating, 0);
    const simplificationRating =
      simplificationFeedback.length > 0
        ? simplificationFeedback.reduce((sum, f) => sum + f.overallRating, 0) /
          simplificationFeedback.length
        : 0;
    const translationRating =
      translationFeedback.length > 0
        ? translationFeedback.reduce((sum, f) => sum + f.overallRating, 0) /
          translationFeedback.length
        : 0;

    // Find latest review dates - handle various date formats safely
    const parseDate = (d: any): Date | null => {
      try {
        if (d instanceof Date) return d;
        if (typeof d === 'string') return new Date(d);
        if (d && typeof d === 'object' && 'toDate' in d) {
          const timestamp = d as { toDate: () => Date };
          if (typeof timestamp.toDate === 'function') {
            return timestamp.toDate();
          }
        }
        return null;
      } catch (e) {
        this.logger.warn(`Invalid date format: ${d}`);
        return null;
      }
    };

    const reviewDates = feedback
      .map((f) => f.reviewDate)
      .filter((d) => d != null)
      .map(parseDate)
      .filter((d): d is Date => d != null && !isNaN(d.getTime()))
      .sort((a, b) => b.getTime() - a.getTime());

    const simplificationDates = simplificationFeedback
      .map((f) => f.reviewDate)
      .filter((d) => d != null)
      .map(parseDate)
      .filter((d): d is Date => d != null && !isNaN(d.getTime()))
      .sort((a, b) => b.getTime() - a.getTime());

    const translationDates = translationFeedback
      .map((f) => f.reviewDate)
      .filter((d) => d != null)
      .map(parseDate)
      .filter((d): d is Date => d != null && !isNaN(d.getTime()))
      .sort((a, b) => b.getTime() - a.getTime());

    // Rating distribution
    const ratingDistribution: { [key: string]: number } = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
    feedback.forEach((f) => {
      ratingDistribution[f.overallRating.toString()]++;
    });

    // Check for flags
    const hasHallucination = feedback.some((f) => f.hasHallucination);
    const hasMissingInfo = feedback.some((f) => f.hasMissingInfo);

    return {
      totalReviews: feedback.length,
      simplificationReviews: simplificationFeedback.length,
      translationReviews: translationFeedback.length,
      averageRating: totalRating / feedback.length,
      simplificationRating,
      translationRating,
      latestReviewDate: reviewDates.length > 0 ? reviewDates[0].toISOString() : null,
      latestSimplificationReview:
        simplificationDates.length > 0 ? simplificationDates[0].toISOString() : null,
      latestTranslationReview:
        translationDates.length > 0 ? translationDates[0].toISOString() : null,
      hasHallucination,
      hasMissingInfo,
      ratingDistribution,
    };
  }

  /**
   * Validate feedback data
   */
  validateFeedback(dto: SubmitFeedbackDto): string | null {
    // Required fields
    if (!dto.dischargeSummaryId || dto.dischargeSummaryId.trim() === '') {
      return 'Missing required field: dischargeSummaryId';
    }

    if (!dto.reviewType) {
      return 'Missing required field: reviewType';
    }

    if (dto.reviewType !== 'simplification' && dto.reviewType !== 'translation') {
      return "reviewType must be 'simplification' or 'translation'";
    }

    // Language is required for translation reviews
    if (dto.reviewType === 'translation' && (!dto.language || dto.language.trim() === '')) {
      return "language is required when reviewType is 'translation'";
    }

    // Validate ISO 639-1 language codes (basic check)
    if (dto.language && dto.language.length !== 2) {
      return 'language must be a valid ISO 639-1 code (2 characters)';
    }

    if (!dto.reviewerName || dto.reviewerName.trim() === '') {
      return 'Missing required field: reviewerName';
    }

    if (dto.reviewerName.length < 2 || dto.reviewerName.length > 100) {
      return 'reviewerName must be between 2 and 100 characters';
    }

    if (dto.reviewerHospital && dto.reviewerHospital.length > 200) {
      return 'reviewerHospital must not exceed 200 characters';
    }

    if (dto.overallRating === undefined || dto.overallRating === null) {
      return 'Missing required field: overallRating';
    }

    if (!Number.isInteger(dto.overallRating) || dto.overallRating < 1 || dto.overallRating > 5) {
      return 'overallRating must be between 1 and 5';
    }

    if (dto.whatWorksWell && dto.whatWorksWell.length > 2000) {
      return 'whatWorksWell must not exceed 2000 characters';
    }

    if (dto.whatNeedsImprovement && dto.whatNeedsImprovement.length > 2000) {
      return 'whatNeedsImprovement must not exceed 2000 characters';
    }

    if (dto.specificIssues && dto.specificIssues.length > 5000) {
      return 'specificIssues must not exceed 5000 characters';
    }

    if (typeof dto.hasHallucination !== 'boolean') {
      return 'Missing required field: hasHallucination (must be boolean)';
    }

    if (typeof dto.hasMissingInfo !== 'boolean') {
      return 'Missing required field: hasMissingInfo (must be boolean)';
    }

    return null; // No validation errors
  }

  /**
   * Validate update feedback data (allows partial updates)
   */
  validateUpdateFeedback(dto: UpdateFeedbackDto): string | null {
    // Validate reviewType if provided
    if (dto.reviewType !== undefined) {
      if (dto.reviewType !== 'simplification' && dto.reviewType !== 'translation') {
        return "reviewType must be 'simplification' or 'translation'";
      }
    }

    // Validate language if provided
    if (dto.language !== undefined && dto.language.length !== 2) {
      return 'language must be a valid ISO 639-1 code (2 characters)';
    }

    // Validate reviewerName if provided
    if (dto.reviewerName !== undefined) {
      if (dto.reviewerName.trim() === '') {
        return 'reviewerName cannot be empty';
      }
      if (dto.reviewerName.length < 2 || dto.reviewerName.length > 100) {
        return 'reviewerName must be between 2 and 100 characters';
      }
    }

    // Validate reviewerHospital if provided
    if (dto.reviewerHospital !== undefined && dto.reviewerHospital.length > 200) {
      return 'reviewerHospital must not exceed 200 characters';
    }

    // Validate overallRating if provided
    if (dto.overallRating !== undefined) {
      if (!Number.isInteger(dto.overallRating) || dto.overallRating < 1 || dto.overallRating > 5) {
        return 'overallRating must be between 1 and 5';
      }
    }

    // Validate text fields if provided
    if (dto.whatWorksWell !== undefined && dto.whatWorksWell.length > 2000) {
      return 'whatWorksWell must not exceed 2000 characters';
    }

    if (dto.whatNeedsImprovement !== undefined && dto.whatNeedsImprovement.length > 2000) {
      return 'whatNeedsImprovement must not exceed 2000 characters';
    }

    if (dto.specificIssues !== undefined && dto.specificIssues.length > 5000) {
      return 'specificIssues must not exceed 5000 characters';
    }

    // Validate boolean fields if provided
    if (dto.hasHallucination !== undefined && typeof dto.hasHallucination !== 'boolean') {
      return 'hasHallucination must be boolean';
    }

    if (dto.hasMissingInfo !== undefined && typeof dto.hasMissingInfo !== 'boolean') {
      return 'hasMissingInfo must be boolean';
    }

    return null; // No validation errors
  }

  /**
   * Verify that a composition exists in Google FHIR store
   */
  async verifyCompositionExists(compositionId: string, ctx?: TenantContext): Promise<boolean> {
    try {
      if (!this.googleService) {
        // If GoogleService is not available, skip verification
        this.logger.warn('GoogleService not available, skipping composition verification');
        return true;
      }

      if (!ctx) {
        // If no tenant context provided, skip verification
        this.logger.warn('No tenant context provided, skipping composition verification');
        return true;
      }

      await this.googleService.fhirRead('Composition', compositionId, ctx);
      return true;
    } catch (error) {
      this.logger.warn(`Composition ${compositionId} not found or error: ${error.message}`);
      return false;
    }
  }

  /**
   * Extract Cerner encounter ID from Composition's Encounter resource
   */
  async extractCernerEncounterId(compositionId: string, ctx: TenantContext): Promise<string | null> {
    try {
      if (!this.googleService) {
        this.logger.warn('GoogleService not available, cannot extract Cerner encounter ID');
        return null;
      }

      // Step 1: Read Composition from Google FHIR
      this.logger.log(`📋 Reading Composition ${compositionId} to extract encounter reference`);
      const composition = await this.googleService.fhirRead('Composition', compositionId, ctx);
      
      if (!composition || composition.resourceType !== 'Composition') {
        this.logger.warn(`Composition ${compositionId} not found or invalid`);
        return null;
      }

      // Step 2: Extract encounter reference
      const encounterRef = composition.encounter?.reference;
      if (!encounterRef) {
        this.logger.warn(`Composition ${compositionId} does not have an encounter reference`);
        return null;
      }

      // Step 3: Parse encounter ID from reference (remove "Encounter/" prefix)
      const encounterId = encounterRef.replace('Encounter/', '');
      if (!encounterId) {
        this.logger.warn(`Invalid encounter reference format: ${encounterRef}`);
        return null;
      }

      // Step 4: Fetch Encounter from Google FHIR
      this.logger.log(`🏥 Fetching Encounter ${encounterId} to check for Cerner encounter ID`);
      const encounter = await this.googleService.fhirRead('Encounter', encounterId, ctx);
      
      if (!encounter || encounter.resourceType !== 'Encounter') {
        this.logger.warn(`Encounter ${encounterId} not found or invalid`);
        return null;
      }

      // Step 5: Check meta.tag for original-cerner-id
      const tags = encounter.meta?.tag || [];
      const cernerTag = tags.find((tag: any) => tag.system === 'original-cerner-id');
      
      if (cernerTag && cernerTag.code) {
        const cernerEncounterId = cernerTag.code;
        this.logger.log(`✅ Found Cerner encounter ID: ${cernerEncounterId}`);
        return cernerEncounterId;
      }

      this.logger.log(`ℹ️ Encounter ${encounterId} does not have original-cerner-id tag`);
      return null;
    } catch (error) {
      this.logger.error(`❌ Error extracting Cerner encounter ID: ${error.message}`);
      return null;
    }
  }

  /**
   * Create DocumentReference in Cerner with expert feedback data
   */
  async createCernerDocumentReference(
    dto: SubmitFeedbackDto,
    cernerEncounterId: string,
    ctx: TenantContext,
  ): Promise<{ success: boolean; documentReferenceId?: string }> {
    try {
      if (!this.cernerService) {
        this.logger.warn('CernerService not available, cannot create DocumentReference in Cerner');
        return { success: false };
      }

      // Fetch Encounter from Cerner to get patient reference
      this.logger.log(`📋 Fetching Encounter ${cernerEncounterId} from Cerner to extract patient reference`);
      const encounter = await this.cernerService.fetchResource('Encounter', cernerEncounterId, ctx);
      
      if (!encounter || encounter.resourceType !== 'Encounter') {
        this.logger.warn(`Encounter ${cernerEncounterId} not found or invalid in Cerner`);
        return { success: false };
      }

      // Extract patient reference from encounter
      const patientRef = encounter.subject?.reference;
      if (!patientRef) {
        this.logger.warn(`Encounter ${cernerEncounterId} does not have a patient reference`);
        return { success: false };
      }

      // Extract patient display name if available
      const patientDisplay = encounter.subject?.display || 
        (patientRef.includes('/') ? patientRef.split('/')[1] : patientRef);

      this.logger.log(`✅ Found patient reference: ${patientRef} (display: ${patientDisplay})`);

      // Build DocumentReference payload based on provided structure
      const documentReference = {
        resourceType: 'DocumentReference',
        identifier: [
          {
            system: 'https://fhir.cerner.com/ceuuid',
            value: `CE${uuidv4().replace(/-/g, '')}`, // Generate unique identifier using UUID
          },
        ],
        status: 'current',
        docStatus: 'final',
        type: {
          coding: [
            {
              system: 'http://loinc.org',
              code: '18842-5',
              display: 'Consult note',
              userSelected: false,
            },
          ],
          text: dto.reviewType, // Set to "simplification" or "translation"
        },
        category: [
          {
            coding: [
              {
                system: 'http://hl7.org/fhir/us/core/CodeSystem/us-core-documentreference-category',
                code: 'clinical-note',
                display: 'Clinical Note',
                userSelected: false,
              },
            ],
            text: 'Clinical Note',
          },
          {
            coding: [
              {
                system: 'http://loinc.org',
                code: '11488-4',
                display: 'Consult note',
                userSelected: false,
              },
            ],
          },
        ],
        subject: {
          reference: patientRef, // Extracted from Cerner Encounter
          display: patientDisplay, // Extracted from Cerner Encounter
        },
        date: new Date().toISOString(),
        content: [
          {
            attachment: {
              contentType: 'text/plain; charset=UTF-8',
              title: 'Discharge Summary',
              creation: new Date().toISOString(),
              data: this.buildFeedbackContent(dto), // Base64 encoded feedback content
            },
            format: {
              system: 'http://ihe.net/fhir/ValueSet/IHE.FormatCode.codesystem',
              code: 'urn:ihe:iti:xds:2017:mimeTypeSufficient',
              display: 'mimeType Sufficient',
            },
          },
        ],
        context: {
          encounter: [
            {
              reference: `Encounter/${cernerEncounterId}`, // Use the extracted Cerner encounter ID
            },
          ],
          period: {
            start: new Date().toISOString(),
            end: new Date().toISOString(),
          },
        },
      };

      this.logger.log(`📤 Creating DocumentReference in Cerner for encounter ${cernerEncounterId}`);
      const result = await this.cernerService.createResource('DocumentReference', documentReference, ctx);
      
      // Log the full result for debugging
      this.logger.log(`📋 Cerner createResource response: ${JSON.stringify(result)}`);
      
      // Extract ID from various possible response formats
      let documentReferenceId: string | undefined;
      
      if (result) {
        // Case 1: Full FHIR resource with id field
        if (result.resourceType === 'DocumentReference' && result.id) {
          documentReferenceId = result.id;
        }
        // Case 2: Minimal object with just id (from Location header extraction)
        else if (result.id) {
          documentReferenceId = String(result.id);
        }
        // Case 3: Response is just a number/string (the ID)
        else if (typeof result === 'string' || typeof result === 'number') {
          documentReferenceId = String(result);
        }
      }
      
      if (documentReferenceId) {
        this.logger.log(`✅ Successfully created DocumentReference in Cerner: ${documentReferenceId}`);
        return { success: true, documentReferenceId };
      } else {
        this.logger.warn(`⚠️ DocumentReference creation returned unexpected result. Could not extract ID. Result: ${JSON.stringify(result)}`);
        return { success: false };
      }
    } catch (error) {
      this.logger.error(`❌ Failed to create DocumentReference in Cerner: ${error.message}`);
      return { success: false };
    }
  }

  /**
   * Build feedback content as base64 encoded text
   */
  private buildFeedbackContent(dto: SubmitFeedbackDto): string {
    const feedbackText = [
      `Expert Feedback - ${dto.reviewType}`,
      `Reviewer: ${dto.reviewerName}`,
      dto.reviewerHospital ? `Hospital: ${dto.reviewerHospital}` : '',
      `Rating: ${dto.overallRating}/5`,
      '',
      dto.whatWorksWell ? `What Works Well:\n${dto.whatWorksWell}` : '',
      '',
      dto.whatNeedsImprovement ? `What Needs Improvement:\n${dto.whatNeedsImprovement}` : '',
      '',
      dto.specificIssues ? `Specific Issues:\n${dto.specificIssues}` : '',
      '',
      `Has Hallucination: ${dto.hasHallucination ? 'Yes' : 'No'}`,
      `Has Missing Info: ${dto.hasMissingInfo ? 'Yes' : 'No'}`,
      dto.language ? `Language: ${dto.language}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    // Convert to base64
    return Buffer.from(feedbackText, 'utf8').toString('base64');
  }

  /**
   * Get feedback by ID
   */
  async getFeedbackById(id: string, tenantId: string): Promise<ExpertFeedback | null> {
    const firestore = this.getFirestore();
    const docRef = firestore.collection(this.feedbackCollection).doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return null;
    }

    const data = doc.data();
    
    // Validate tenantId
    if (data?.tenantId !== tenantId) {
      return null;
    }

    return {
      id: doc.id,
      ...data,
      reviewDate: data?.reviewDate?.toDate?.() || data?.reviewDate,
      createdAt: data?.createdAt?.toDate?.() || data?.createdAt,
      updatedAt: data?.updatedAt?.toDate?.() || data?.updatedAt,
    } as ExpertFeedback;
  }

  /**
   * Update existing feedback
   */
  async updateFeedback(id: string, dto: UpdateFeedbackDto, tenantId: string): Promise<ExpertFeedback | null> {
    const firestore = this.getFirestore();
    const docRef = firestore.collection(this.feedbackCollection).doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return null;
    }

    const docData = doc.data();
    
    // Validate tenantId
    if (docData?.tenantId !== tenantId) {
      return null;
    }

    const now = new Date();
    const updateData: any = {
      updatedAt: now,
    };

    // Only update fields that are provided
    if (dto.reviewType !== undefined) updateData.reviewType = dto.reviewType;
    if (dto.language !== undefined) updateData.language = dto.language;
    if (dto.reviewerName !== undefined) updateData.reviewerName = dto.reviewerName;
    if (dto.reviewerHospital !== undefined) updateData.reviewerHospital = dto.reviewerHospital;
    if (dto.overallRating !== undefined) updateData.overallRating = dto.overallRating;
    if (dto.whatWorksWell !== undefined) updateData.whatWorksWell = dto.whatWorksWell;
    if (dto.whatNeedsImprovement !== undefined) updateData.whatNeedsImprovement = dto.whatNeedsImprovement;
    if (dto.specificIssues !== undefined) updateData.specificIssues = dto.specificIssues;
    if (dto.hasHallucination !== undefined) updateData.hasHallucination = dto.hasHallucination;
    if (dto.hasMissingInfo !== undefined) updateData.hasMissingInfo = dto.hasMissingInfo;

    await docRef.update(updateData);

    this.logger.log(`Expert feedback updated: ${id} for tenant: ${tenantId}`);

    // Return updated feedback
    const updatedDoc = await docRef.get();
    const updatedData = updatedDoc.data();
    return {
      id: updatedDoc.id,
      ...updatedData,
      reviewDate: updatedData?.reviewDate?.toDate?.() || updatedData?.reviewDate,
      createdAt: updatedData?.createdAt?.toDate?.() || updatedData?.createdAt,
      updatedAt: updatedData?.updatedAt?.toDate?.() || updatedData?.updatedAt,
    } as ExpertFeedback;
  }
}
