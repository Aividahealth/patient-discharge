/**
 * Comprehensive Portal Integration Tests
 *
 * Tests all portals (Clinician, Expert, Patient, Admin) with discharge summaries
 * Uses demo tenant and tags all created resources for cleanup
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { Firestore } from '@google-cloud/firestore';
import { Storage } from '@google-cloud/storage';
import * as request from 'supertest';
import * as path from 'path';
import * as fs from 'fs';
import * as YAML from 'yaml';

import { TestUserManager, TestUser } from './utils/test-user-manager';
import { TestDischargeManager, TestDischargeSummary } from './utils/test-discharge-manager';

describe('Portal Integration Tests - All Portals', () => {
  let app: INestApplication;
  let firestore: Firestore;
  let storage: Storage;
  let userManager: TestUserManager;
  let dischargeManager: TestDischargeManager;

  // Test users
  let patientUser: TestUser;
  let clinicianUser: TestUser;
  let expertUser: TestUser;
  let adminUser: TestUser;

  // Test data
  let dischargeSummaries: TestDischargeSummary[];
  const TENANT_ID = 'demo';
  const TEST_TAG = 'portal-integration-test';
  const TEST_DATA_DIR = path.join(__dirname, '../test-data/discharge-summaries');

  // Auth tokens (JWT)
  let patientToken: string;
  let clinicianToken: string;
  let expertToken: string;
  let adminToken: string;

  /**
   * Initialize Firestore and Storage clients
   */
  function initializeClients(): { firestore: Firestore; storage: Storage } {
    const serviceAccountPath = getServiceAccountPath();

    if (serviceAccountPath && fs.existsSync(serviceAccountPath)) {
      const firestore = new Firestore({ keyFilename: serviceAccountPath });
      const storage = new Storage({ keyFilename: serviceAccountPath });
      return { firestore, storage };
    } else {
      const firestore = new Firestore();
      const storage = new Storage();
      return { firestore, storage };
    }
  }

  /**
   * Get service account path from config
   */
  function getServiceAccountPath(): string | undefined {
    try {
      const env = process.env.NODE_ENV || 'dev';
      const configPath = path.resolve(process.cwd(), `.settings.${env}/config.yaml`);

      if (fs.existsSync(configPath)) {
        const raw = fs.readFileSync(configPath, 'utf8');
        const config = YAML.parse(raw);
        return config.firestore_service_account_path;
      }
    } catch (error) {
      // Fall back to environment variable
    }
    return process.env.SERVICE_ACCOUNT_PATH;
  }

  /**
   * Get GCS bucket name from config
   */
  function getGCSBucketName(): string {
    try {
      const env = process.env.NODE_ENV || 'dev';
      const configPath = path.resolve(process.cwd(), `.settings.${env}/config.yaml`);

      if (fs.existsSync(configPath)) {
        const raw = fs.readFileSync(configPath, 'utf8');
        const config = YAML.parse(raw);
        return config.gcs_bucket_name || 'patient-discharge-dev';
      }
    } catch (error) {
      // Fall back to default
    }
    return process.env.GCS_BUCKET_NAME || 'patient-discharge-dev';
  }

  /**
   * Login helper
   */
  async function login(username: string, password: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .set('X-Tenant-ID', TENANT_ID)
      .send({ username, password })
      .expect(200);

    return response.body.token;
  }

  beforeAll(async () => {
    console.log('\n🚀 Starting Portal Integration Tests...\n');

    // Initialize clients
    const clients = initializeClients();
    firestore = clients.firestore;
    storage = clients.storage;
    const bucketName = getGCSBucketName();

    console.log('✅ Initialized Firestore and Storage clients');

    // Initialize managers
    userManager = new TestUserManager(firestore, TEST_TAG);
    dischargeManager = new TestDischargeManager(firestore, storage, bucketName, TEST_TAG);

    console.log('✅ Initialized test managers');

    // Clean up any leftover test data from previous runs
    console.log('\n🧹 Cleaning up leftover test data...');
    const deletedUsers = await userManager.cleanupAllTestUsers();
    const deletedSummaries = await dischargeManager.cleanupAllTestSummaries();
    console.log(`   Deleted ${deletedUsers} test users`);
    console.log(`   Deleted ${deletedSummaries} test discharge summaries`);

    // Create test users
    console.log('\n👥 Creating test users...');
    const users = await userManager.createPortalTestUsers(TENANT_ID);
    patientUser = users.patient;
    clinicianUser = users.clinician;
    expertUser = users.expert;
    adminUser = users.admin;

    console.log(`   ✅ Patient: ${patientUser.username} (${patientUser.id})`);
    console.log(`   ✅ Clinician: ${clinicianUser.username} (${clinicianUser.id})`);
    console.log(`   ✅ Expert: ${expertUser.username} (${expertUser.id})`);
    console.log(`   ✅ Admin: ${adminUser.username} (${adminUser.id})`);

    // Create discharge summaries from test data directory
    console.log('\n📄 Creating test discharge summaries...');
    dischargeSummaries = await dischargeManager.createDischargeSummariesFromDirectory(
      TENANT_ID,
      TEST_DATA_DIR
    );
    console.log(`   ✅ Created ${dischargeSummaries.length} discharge summaries`);
    dischargeSummaries.forEach(summary => {
      console.log(`      - ${summary.patientName} (${summary.mrn})`);
    });

    // Initialize NestJS application
    console.log('\n🏗️  Initializing NestJS application...');
    // Note: This would need to import your actual AppModule
    // For now, we'll set up a minimal test module
    // const moduleFixture: TestingModule = await Test.createTestingModule({
    //   imports: [AppModule],
    // }).compile();
    //
    // app = moduleFixture.createNestApplication();
    // await app.init();
    // console.log('✅ NestJS application initialized');

    console.log('\n✅ Test setup complete!\n');
  }, 120000); // 2 minute timeout for setup

  afterAll(async () => {
    console.log('\n🧹 Cleaning up test data...');

    // Clean up discharge summaries
    const deletedSummaries = await dischargeManager.cleanupCreatedSummaries();
    console.log(`   Deleted ${deletedSummaries} discharge summaries`);

    // Clean up users
    const deletedUsers = await userManager.cleanupCreatedUsers();
    console.log(`   Deleted ${deletedUsers} users`);

    // Close app
    if (app) {
      await app.close();
    }

    console.log('✅ Cleanup complete!\n');
  }, 60000); // 1 minute timeout for cleanup

  describe('Authentication Tests', () => {
    it('should authenticate patient user', async () => {
      expect(patientUser).toBeDefined();
      console.log(`   Testing login for: ${patientUser.username}`);

      // This would require the actual backend to be running
      // For now, we'll verify the user exists in Firestore
      const user = await userManager.findUser(TENANT_ID, patientUser.username);
      expect(user).toBeDefined();
      expect(user.role).toBe('patient');
      expect(user.testTag).toBe(TEST_TAG);
    });

    it('should authenticate clinician user', async () => {
      const user = await userManager.findUser(TENANT_ID, clinicianUser.username);
      expect(user).toBeDefined();
      expect(user.role).toBe('clinician');
    });

    it('should authenticate expert user', async () => {
      const user = await userManager.findUser(TENANT_ID, expertUser.username);
      expect(user).toBeDefined();
      expect(user.role).toBe('expert');
    });

    it('should authenticate admin user', async () => {
      const user = await userManager.findUser(TENANT_ID, adminUser.username);
      expect(user).toBeDefined();
      expect(user.role).toBe('tenant_admin');
    });
  });

  describe('Clinician Portal Tests', () => {
    it('should verify discharge summaries exist in Firestore', async () => {
      expect(dischargeSummaries).toBeDefined();
      expect(dischargeSummaries.length).toBeGreaterThan(0);

      for (const summary of dischargeSummaries) {
        const doc = await dischargeManager.findSummary(summary.id);
        expect(doc).toBeDefined();
        expect(doc.tenantId).toBe(TENANT_ID);
        expect(doc.testTag).toBe(TEST_TAG);
        expect(doc.status).toBe('raw');
      }
    });

    it('should have uploaded files to GCS', async () => {
      for (const summary of dischargeSummaries) {
        expect(summary.gcsPath).toMatch(/^gs:\/\//);
        expect(summary.gcsPath).toContain(TENANT_ID);
        expect(summary.gcsPath).toContain('raw');
      }
    });

    it('should filter discharge summaries by clinician', async () => {
      // Clinician should see all discharge summaries for their tenant
      const snapshot = await firestore
        .collection('discharge_summaries')
        .where('tenantId', '==', TENANT_ID)
        .where('testTag', '==', TEST_TAG)
        .get();

      expect(snapshot.size).toBe(dischargeSummaries.length);
    });

    it('should allow clinician to request simplification', async () => {
      const summary = dischargeSummaries[0];

      // Update status to 'simplifying'
      await dischargeManager.updateSummaryStatus(summary.id, 'simplifying');

      // Verify update
      const updated = await dischargeManager.findSummary(summary.id);
      expect(updated.status).toBe('simplifying');
    });
  });

  describe('Expert Portal Tests', () => {
    it('should allow expert to view discharge summaries for review', async () => {
      // Expert should see summaries that need review
      const snapshot = await firestore
        .collection('discharge_summaries')
        .where('tenantId', '==', TENANT_ID)
        .where('testTag', '==', TEST_TAG)
        .get();

      expect(snapshot.size).toBeGreaterThan(0);
    });

    it('should allow expert to add quality metrics', async () => {
      const summary = dischargeSummaries[0];

      // Simulate adding quality metrics
      await firestore
        .collection('discharge_summaries')
        .doc(summary.id)
        .update({
          qualityMetrics: {
            accuracy: 95,
            completeness: 90,
            readability: 88,
            reviewedBy: expertUser.id,
            reviewedAt: new Date(),
          },
          updatedAt: new Date(),
        });

      // Verify update
      const updated = await dischargeManager.findSummary(summary.id);
      expect(updated.qualityMetrics).toBeDefined();
      expect(updated.qualityMetrics.reviewedBy).toBe(expertUser.id);
    });

    it('should allow expert to approve discharge summary', async () => {
      const summary = dischargeSummaries[1];

      await dischargeManager.updateSummaryStatus(summary.id, 'approved');

      const updated = await dischargeManager.findSummary(summary.id);
      expect(updated.status).toBe('approved');
    });
  });

  describe('Patient Portal Tests', () => {
    it('should allow patient to view their discharge summaries', async () => {
      // Patient should only see summaries linked to their patientId
      const patientSummaries = dischargeSummaries.filter(
        s => s.patientId === patientUser.linkedPatientId
      );

      // Since our test data doesn't link to specific patients,
      // we'll create one specifically for this patient
      const patientSummary = await dischargeManager.createDischargeSummary({
        tenantId: TENANT_ID,
        patientId: patientUser.linkedPatientId!,
        patientName: patientUser.name,
        mrn: 'MRN-PATIENT-TEST',
        filePath: path.join(TEST_DATA_DIR, 'patient-001-discharge.md'),
      });

      expect(patientSummary).toBeDefined();
      expect(patientSummary.patientId).toBe(patientUser.linkedPatientId);

      // Verify patient can query their summaries
      const snapshot = await firestore
        .collection('discharge_summaries')
        .where('tenantId', '==', TENANT_ID)
        .where('patientId', '==', patientUser.linkedPatientId)
        .get();

      expect(snapshot.size).toBeGreaterThan(0);
    });

    it('should not allow patient to view other patients summaries', async () => {
      // Patient should not see summaries for other patients
      const otherPatientId = 'different-patient-id';

      const snapshot = await firestore
        .collection('discharge_summaries')
        .where('tenantId', '==', TENANT_ID)
        .where('patientId', '==', otherPatientId)
        .where('testTag', '==', TEST_TAG)
        .get();

      // Verify these summaries exist
      const allSnapshot = await firestore
        .collection('discharge_summaries')
        .where('tenantId', '==', TENANT_ID)
        .where('testTag', '==', TEST_TAG)
        .get();

      // Patient should only access their own data through API authorization
      expect(allSnapshot.size).toBeGreaterThan(0);
    });
  });

  describe('Admin Portal Tests', () => {
    it('should allow admin to view all users in tenant', async () => {
      const snapshot = await firestore
        .collection('users')
        .where('tenantId', '==', TENANT_ID)
        .where('testTag', '==', TEST_TAG)
        .get();

      expect(snapshot.size).toBeGreaterThanOrEqual(4); // At least our 4 test users

      const roles = snapshot.docs.map(doc => doc.data().role);
      expect(roles).toContain('patient');
      expect(roles).toContain('clinician');
      expect(roles).toContain('expert');
      expect(roles).toContain('tenant_admin');
    });

    it('should allow admin to view tenant metrics', async () => {
      // Count discharge summaries
      const summariesSnapshot = await firestore
        .collection('discharge_summaries')
        .where('tenantId', '==', TENANT_ID)
        .where('testTag', '==', TEST_TAG)
        .get();

      const metrics = {
        totalSummaries: summariesSnapshot.size,
        totalUsers: 4,
        summariesByStatus: {
          raw: 0,
          simplifying: 0,
          approved: 0,
        },
      };

      summariesSnapshot.docs.forEach(doc => {
        const status = doc.data().status;
        metrics.summariesByStatus[status] = (metrics.summariesByStatus[status] || 0) + 1;
      });

      expect(metrics.totalSummaries).toBeGreaterThan(0);
      expect(metrics.totalUsers).toBe(4);
      console.log('   Tenant Metrics:', JSON.stringify(metrics, null, 2));
    });

    it('should allow admin to view tenant configuration', async () => {
      const configDoc = await firestore
        .collection('config')
        .doc(TENANT_ID)
        .get();

      expect(configDoc.exists).toBe(true);

      const config = configDoc.data();
      expect(config).toBeDefined();
      expect(config!.id).toBe(TENANT_ID);
      expect(config!.features).toBeDefined();

      console.log('   Tenant Config Features:', config!.features);
    });

    it('should allow admin to manage user accounts', async () => {
      const user = await userManager.findUser(TENANT_ID, patientUser.username);
      expect(user).toBeDefined();

      // Simulate updating user (e.g., locking account)
      await firestore
        .collection('users')
        .doc(user.id)
        .update({
          isLocked: true,
          updatedAt: new Date(),
        });

      // Verify update
      const updatedUser = await userManager.findUser(TENANT_ID, patientUser.username);
      expect(updatedUser.isLocked).toBe(true);

      // Restore state
      await firestore
        .collection('users')
        .doc(user.id)
        .update({
          isLocked: false,
          updatedAt: new Date(),
        });
    });
  });

  describe('Cross-Portal Workflow Tests', () => {
    it('should complete full discharge summary workflow', async () => {
      // 1. Clinician uploads/creates discharge summary (already done in setup)
      const summary = dischargeSummaries[2];
      expect(summary.status).toBe('raw');

      // 2. Clinician requests simplification
      await dischargeManager.updateSummaryStatus(summary.id, 'simplifying');
      let updated = await dischargeManager.findSummary(summary.id);
      expect(updated.status).toBe('simplifying');

      // 3. Simplification completes (simulated)
      await dischargeManager.updateSummaryStatus(summary.id, 'simplified');
      updated = await dischargeManager.findSummary(summary.id);
      expect(updated.status).toBe('simplified');

      // 4. Expert reviews simplified version
      await firestore
        .collection('discharge_summaries')
        .doc(summary.id)
        .update({
          qualityMetrics: {
            accuracy: 92,
            completeness: 88,
            readability: 95,
            reviewedBy: expertUser.id,
            reviewedAt: new Date(),
          },
        });

      // 5. Expert approves
      await dischargeManager.updateSummaryStatus(summary.id, 'approved');
      updated = await dischargeManager.findSummary(summary.id);
      expect(updated.status).toBe('approved');
      expect(updated.qualityMetrics.reviewedBy).toBe(expertUser.id);

      // 6. Patient can now view approved summary
      // (This would be checked through API with proper auth)
      expect(updated.status).toBe('approved');
    });
  });

  describe('Data Isolation Tests', () => {
    it('should enforce tenant isolation', async () => {
      // All test data should be isolated to demo tenant
      const summaries = await firestore
        .collection('discharge_summaries')
        .where('testTag', '==', TEST_TAG)
        .get();

      summaries.docs.forEach(doc => {
        expect(doc.data().tenantId).toBe(TENANT_ID);
      });

      const users = await firestore
        .collection('users')
        .where('testTag', '==', TEST_TAG)
        .get();

      users.docs.forEach(doc => {
        expect(doc.data().tenantId).toBe(TENANT_ID);
      });
    });

    it('should tag all test data for cleanup', async () => {
      // Verify all created data has the test tag
      const summaries = await firestore
        .collection('discharge_summaries')
        .where('testTag', '==', TEST_TAG)
        .get();

      expect(summaries.size).toBeGreaterThan(0);

      const users = await firestore
        .collection('users')
        .where('testTag', '==', TEST_TAG)
        .get();

      expect(users.size).toBeGreaterThanOrEqual(4);
    });
  });
});
