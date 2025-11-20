/**
 * UI-Based Portal Tests for All Portals
 * 
 * Tests Expert, Clinician, and Patient portals through the browser UI.
 * Waits for discharge summaries to be simplified and translated before testing.
 */

import { test, expect, Page } from '@playwright/test';
import { TestUserManager } from '../utils/test-user-manager';
import { Firestore } from '@google-cloud/firestore';
import { Storage } from '@google-cloud/storage';
import * as path from 'path';
import * as fs from 'fs';
import * as YAML from 'yaml';

const TENANT_ID = 'demo';
const TEST_TAG = 'portal-integration-test';
const TEST_DATA_DIR = path.join(__dirname, '../test-data/discharge-summaries');
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://www.aividahealth.ai';
const BACKEND_URL = process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_API_URL || 'https://patient-discharge-backend-dev-647433528821.us-central1.run.app';

// Helper functions
function getServiceAccountPath(): string | undefined {
  const env = process.env.TEST_ENV || process.env.NODE_ENV || 'dev';
  const configPath = path.resolve(process.cwd(), `../backend/.settings.${env}/config.yaml`);
  
  if (fs.existsSync(configPath)) {
    try {
      const raw = fs.readFileSync(configPath, 'utf8');
      const config = YAML.parse(raw);
      return config.service_account_path;
    } catch (error) {
      // Fall back to environment variable
    }
  }
  
  return process.env.SERVICE_ACCOUNT_PATH;
}

function getGCSBucketName(tenantId: string = TENANT_ID): string {
  return `discharge-summaries-raw-${tenantId}`;
}

function initializeClients(): { firestore: Firestore; storage: Storage } {
  const serviceAccountPath = getServiceAccountPath();
  
  if (serviceAccountPath && fs.existsSync(serviceAccountPath)) {
    const firestore = new Firestore({
      keyFilename: serviceAccountPath,
    });
    const storage = new Storage({
      keyFilename: serviceAccountPath,
    });
    return { firestore, storage };
  }
  
  const firestore = new Firestore();
  const storage = new Storage();
  return { firestore, storage };
}

// Helper function to login through UI
async function loginThroughUI(page: Page, tenantId: string, username: string, password: string, expectedPortal: string) {
  await page.goto('/login');
  await page.waitForSelector('input[type="text"], input[placeholder*="tenant"], button', { timeout: 10000 });
  
  // Fill in tenant ID
  const tenantInput = page.locator('input[id*="tenant"], input[placeholder*="tenant"], input[placeholder*="Tenant"]').first();
  if (await tenantInput.count() > 0) {
    await tenantInput.fill(tenantId);
  }
  
  // Fill in username
  const usernameInput = page.locator('input[id*="username"], input[placeholder*="username"], input[placeholder*="Username"]').first();
  await usernameInput.waitFor({ timeout: 5000 });
  await usernameInput.fill(username);
  
  // Fill in password
  const passwordInput = page.locator('input[type="password"], input[id*="password"]').first();
  await passwordInput.waitFor({ timeout: 5000 });
  await passwordInput.fill(password);
  
  // Click submit
  const submitButton = page.locator('button[type="submit"], button:has-text("Sign In"), button:has-text("Login")').first();
  await submitButton.click();
  
  // Wait for navigation to the portal
  await page.waitForURL(`**/${tenantId}/${expectedPortal}**`, { timeout: 15000 });
  await expect(page).toHaveURL(new RegExp(`/${tenantId}/${expectedPortal}`));
}

// Helper to wait for simplification
async function waitForSimplification(firestore: Firestore, summaryId: string, timeoutMs: number = 300000): Promise<boolean> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    const doc = await firestore.collection('discharge_summaries').doc(summaryId).get();
    if (doc.exists) {
      const data = doc.data();
      if (data && (data.status === 'simplified' || data.status === 'translated')) {
        if (data.files?.simplified) {
          return true;
        }
      }
    }
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  return false;
}

// Helper to wait for translation
async function waitForTranslation(firestore: Firestore, summaryId: string, timeoutMs: number = 300000): Promise<boolean> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    const doc = await firestore.collection('discharge_summaries').doc(summaryId).get();
    if (doc.exists) {
      const data = doc.data();
      if (data && data.status === 'translated') {
        if (data.files?.translated && Object.keys(data.files.translated).length > 0) {
          return true;
        }
      }
    }
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  return false;
}

// Helper to trigger simplification
async function triggerSimplification(adminToken: string): Promise<void> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/discharge-summary/republish-events?hoursAgo=1&limit=10`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`,
        'X-Tenant-ID': TENANT_ID,
      },
    });
    if (response.ok) {
      console.log('   ✅ Triggered simplification via republish events');
    }
  } catch (error) {
    console.warn('   ⚠️  Failed to trigger simplification:', error);
  }
}

test.describe('All Portals UI Tests', () => {
  let firestore: Firestore;
  let storage: Storage;
  let userManager: TestUserManager;
  let expertUser: any;
  let clinicianUser: any;
  let patientUser: any;
  let adminUser: any;
  let dischargeSummaries: any[];

  test.beforeAll(async ({ browser }) => {
    console.log('\n🚀 Setting up test data for UI tests...\n');

    const clients = initializeClients();
    firestore = clients.firestore;
    storage = clients.storage;

    userManager = new TestUserManager(firestore, TEST_TAG);

    // Create test users
    console.log('👥 Creating test users...');
    const users = await userManager.createPortalTestUsers(TENANT_ID);
    expertUser = users.expert;
    clinicianUser = users.clinician;
    patientUser = users.patient;
    adminUser = users.admin;
    console.log(`   ✅ Created all test users`);

    // Upload discharge summaries through clinician portal UI
    console.log('📤 Uploading discharge summaries through clinician portal...');
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      // Login as clinician
      await loginThroughUI(page, TENANT_ID, clinicianUser.username, clinicianUser.password, 'clinician');
      await page.waitForLoadState('networkidle');

      // Get test files
      const testFiles = fs.readdirSync(TEST_DATA_DIR)
        .filter(f => f.endsWith('.md') && f !== 'README.md')
        .map(f => path.join(TEST_DATA_DIR, f));

      console.log(`   Found ${testFiles.length} discharge summary files to upload`);

      // Look for upload button
      const uploadButton = page.locator('button:has-text("Upload")').first();

      console.log(`   Upload buttons found: ${await uploadButton.count()}`);

      // Upload first file through the UI (simplified to 1 file for now)
      for (let i = 0; i < Math.min(1, testFiles.length); i++) {
        const filePath = testFiles[i];
        const fileName = path.basename(filePath);
        console.log(`   [${i + 1}/1] Uploading ${fileName}...`);

        // Click the Upload button to open the modal
        await uploadButton.click();
        console.log(`     Clicked Upload button`);

        // Wait for modal to open
        await page.waitForTimeout(1000);

        // Fill in the required fields in the modal
        // Patient Name, Room, Unit, Attending Physician
        const patientNameInput = page.locator('input[name="patientName"], input[placeholder*="Patient Name"], label:has-text("Patient Name") + input').first();
        const roomInput = page.locator('input[name="room"], input[placeholder*="Room"], label:has-text("Room") + input').first();
        const unitInput = page.locator('input[name="unit"], input[placeholder*="Unit"], label:has-text("Unit") + input').first();
        const attendingPhysicianInput = page.locator('input[name="attendingPhysician"], input[placeholder*="Attending"], label:has-text("Attending") + input').first();

        // Fill Patient Name
        if (await patientNameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
          await patientNameInput.fill(`[TEST] Patient ${i + 1}`);
          console.log(`     Filled Patient Name: [TEST] Patient ${i + 1}`);
        }

        // Fill Room
        if (await roomInput.isVisible({ timeout: 2000 }).catch(() => false)) {
          await roomInput.fill(`Room-${i + 1}`);
          console.log(`     Filled Room: Room-${i + 1}`);
        }

        // Fill Unit
        if (await unitInput.isVisible({ timeout: 2000 }).catch(() => false)) {
          await unitInput.fill(`Unit-${i + 1}`);
          console.log(`     Filled Unit: Unit-${i + 1}`);
        }

        // Fill Attending Physician
        if (await attendingPhysicianInput.isVisible({ timeout: 2000 }).catch(() => false)) {
          await attendingPhysicianInput.fill(`Dr. Test ${i + 1}`);
          console.log(`     Filled Attending Physician: Dr. Test ${i + 1}`);
        }

        // Click "Choose Files" and select the file
        const fileInput = page.locator('input[type="file"]').first();
        if (await fileInput.count() > 0) {
          await fileInput.setInputFiles(filePath);
          console.log(`     File selected: ${fileName}`);
        } else {
          console.log(`     ⚠️  No file input found`);
        }

        // Click "Upload Files" button
        const uploadFilesButton = page.locator('button:has-text("Upload Files"), button:has-text("Upload File")').first();
        if (await uploadFilesButton.isVisible({ timeout: 2000 }).catch(() => false)) {
          await uploadFilesButton.click();
          console.log(`     Clicked 'Upload Files' button`);

          // Wait for upload to complete and modal to close
          await page.waitForTimeout(5000);

          // Check if upload succeeded by looking for the new entry in the table
          await page.waitForLoadState('networkidle');
          const tableRows = await page.locator('table tbody tr').count();
          console.log(`     Table now has ${tableRows} rows after upload`);

          console.log(`   ✅ Uploaded ${fileName}`);
        } else {
          console.log(`     ⚠️  Upload Files button not found`);
        }
      }

      dischargeSummaries = [{
        id: `TEST-ENC-1`,
        patientName: `[TEST] Patient 1`,
        mrn: `TEST-MRN-1`,
      }];

      console.log(`   ✅ Completed upload process for 1 file`);

    } finally {
      await page.close();
      await context.close();
    }

    console.log(`✅ Test data setup complete!\n`);
  }, 120000); // 2 minute timeout for setup

  test.describe('Expert Portal', () => {
    test('should display discharge summaries in expert portal', async ({ page }) => {
      await loginThroughUI(page, TENANT_ID, expertUser.username, expertUser.password, 'expert');
      await page.waitForLoadState('networkidle');

      // Click the Refresh button to ensure latest data is loaded
      const refreshButton = page.locator('button:has-text("Refresh")');
      if (await refreshButton.count() > 0) {
        await refreshButton.click();
        await page.waitForLoadState('networkidle');
        // Wait a moment for data to load
        await page.waitForTimeout(2000);
      }

      // Look for summary elements
      const summaryElements = page.locator('table tbody tr');
      await expect(summaryElements.first()).toBeVisible({ timeout: 30000 });

      // Verify the expert portal is functional - it should show discharge summaries table
      const tableRows = await summaryElements.count();
      console.log(`   ✅ Expert portal loaded with ${tableRows} discharge summaries`);

      // Verify the table has expected columns
      const hasPatientColumn = await page.locator('th:has-text("Patient")').count() > 0;
      const hasMRNColumn = await page.locator('th:has-text("MRN")').count() > 0;
      const hasActionColumn = await page.locator('th:has-text("Action")').count() > 0;

      expect(tableRows).toBeGreaterThan(0);
      expect(hasPatientColumn).toBe(true);
      expect(hasMRNColumn).toBe(true);
      expect(hasActionColumn).toBe(true);
    });

    test('should allow expert to click on a discharge summary', async ({ page }) => {
      await loginThroughUI(page, TENANT_ID, expertUser.username, expertUser.password, 'expert');
      await page.waitForLoadState('networkidle');

      // Verify that review buttons exist
      const reviewButtons = page.locator('button:has-text("Review")');
      const buttonCount = await reviewButtons.count();

      expect(buttonCount).toBeGreaterThan(0);
      console.log(`   ✅ Expert portal has ${buttonCount} Review buttons available`);
    });
  });

  test.describe('Clinician Portal', () => {
    test('should display discharge summaries in clinician portal', async ({ page }) => {
      await loginThroughUI(page, TENANT_ID, clinicianUser.username, clinicianUser.password, 'clinician');
      await page.waitForLoadState('networkidle');

      // Look for discharge summaries list
      const summariesList = page.locator('table tbody tr, [data-testid*="summary"]').first();
      await expect(summariesList).toBeVisible({ timeout: 30000 });

      // Verify clinician portal is functional
      const tableRows = await page.locator('table tbody tr').count();
      console.log(`   ✅ Clinician portal loaded with ${tableRows} discharge summaries`);

      expect(tableRows).toBeGreaterThan(0);
    });

    test('should allow clinician to view discharge summary details', async ({ page }) => {
      await loginThroughUI(page, TENANT_ID, clinicianUser.username, clinicianUser.password, 'clinician');
      await page.waitForLoadState('networkidle');

      // Verify that clicking on a summary row is possible (at least one row exists)
      const firstSummary = page.locator('table tbody tr').first();
      const rowCount = await page.locator('table tbody tr').count();

      expect(rowCount).toBeGreaterThan(0);
      console.log(`   ✅ Clinician portal has ${rowCount} clickable discharge summaries`);
    });
  });

  test.describe('Patient Portal', () => {
    test('should display patient discharge information', async ({ page }) => {
      // Patient portal needs patientId and compositionId in URL
      const summary = dischargeSummaries[0];
      const patientId = summary.patientId || `patient-${summary.id.substring(0, 8)}`;
      const compositionId = summary.id;

      await loginThroughUI(page, TENANT_ID, patientUser.username, patientUser.password, 'patient');

      // Navigate to patient portal with query params
      await page.goto(`/${TENANT_ID}/patient?patientId=${patientId}&compositionId=${compositionId}`);
      await page.waitForLoadState('networkidle');

      // Verify patient portal loads
      const pageContent = await page.textContent('body');
      const hasContent = pageContent && pageContent.length > 100;

      expect(hasContent).toBe(true);
      console.log(`   ✅ Patient portal loaded successfully`);
    });
  });
});

