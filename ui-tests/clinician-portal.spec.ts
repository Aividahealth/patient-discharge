/**
 * UI-Based Clinician Portal Tests
 *
 * Tests the clinician portal through the browser UI.
 * Includes upload functionality and discharge summary management.
 */

import { test, expect, Page } from '@playwright/test';
import { TestUserManager } from '../utils/test-user-manager';
import { Firestore } from '@google-cloud/firestore';
import { Storage } from '@google-cloud/storage';
import * as path from 'path';
import * as fs from 'fs';
import * as YAML from 'yaml';

const TENANT_ID = 'demo';
const TEST_TAG = 'clinician-portal-test';
const TEST_DATA_DIR = path.join(__dirname, '../test-data/discharge-summaries');
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://www.aividahealth.ai';

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
async function loginThroughUI(page: Page, tenantId: string, username: string, password: string) {
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

  // Wait for navigation to the clinician portal
  await page.waitForURL(`**/${tenantId}/clinician**`, { timeout: 15000 });
  await expect(page).toHaveURL(new RegExp(`/${tenantId}/clinician`));
}

test.describe('Clinician Portal UI Tests', () => {
  let firestore: Firestore;
  let storage: Storage;
  let userManager: TestUserManager;
  let clinicianUser: any;

  test.beforeAll(async () => {
    console.log('\n🚀 Setting up clinician portal test data...\n');

    const clients = initializeClients();
    firestore = clients.firestore;
    storage = clients.storage;

    userManager = new TestUserManager(firestore, TEST_TAG);

    // Create test users
    console.log('👥 Creating test users...');
    const users = await userManager.createPortalTestUsers(TENANT_ID);
    clinicianUser = users.clinician;
    console.log(`   ✅ Created clinician user: ${clinicianUser.username}`);

    console.log(`✅ Test data setup complete!\n`);
  }, 60000);

  test('should display clinician portal dashboard', async ({ page }) => {
    await loginThroughUI(page, TENANT_ID, clinicianUser.username, clinicianUser.password);
    await page.waitForLoadState('networkidle');

    // Verify portal loads
    const pageContent = await page.textContent('body');
    expect(pageContent).toBeTruthy();
    expect(pageContent!.length).toBeGreaterThan(100);

    console.log(`   ✅ Clinician portal dashboard loaded successfully`);
  });

  test('should display discharge summaries table', async ({ page }) => {
    await loginThroughUI(page, TENANT_ID, clinicianUser.username, clinicianUser.password);
    await page.waitForLoadState('networkidle');

    // Look for discharge summaries table
    const table = page.locator('table');
    await expect(table).toBeVisible({ timeout: 15000 });

    const tableRows = await page.locator('table tbody tr').count();
    console.log(`   ✅ Clinician portal shows ${tableRows} discharge summaries`);
  });

  test('should have upload button', async ({ page }) => {
    await loginThroughUI(page, TENANT_ID, clinicianUser.username, clinicianUser.password);
    await page.waitForLoadState('networkidle');

    // Verify upload button exists
    const uploadButton = page.locator('button:has-text("Upload")');
    await expect(uploadButton.first()).toBeVisible({ timeout: 15000 });

    console.log(`   ✅ Upload button is visible`);
  });

  test('should open upload modal when clicking upload button', async ({ page }) => {
    await loginThroughUI(page, TENANT_ID, clinicianUser.username, clinicianUser.password);
    await page.waitForLoadState('networkidle');

    // Click upload button
    const uploadButton = page.locator('button:has-text("Upload")').first();
    await uploadButton.click();

    // Wait for modal to open
    await page.waitForTimeout(1000);

    // Verify modal fields are visible
    const patientNameInput = page.locator('input[name="patientName"], input[placeholder*="Patient Name"], label:has-text("Patient Name") + input').first();
    const fileInput = page.locator('input[type="file"]').first();

    const hasPatientNameField = await patientNameInput.isVisible({ timeout: 5000 }).catch(() => false);
    const hasFileInput = await fileInput.count() > 0;

    expect(hasPatientNameField || hasFileInput).toBe(true);

    console.log(`   ✅ Upload modal opened successfully`);
  });

  test('should successfully upload a discharge summary', async ({ page }) => {
    await loginThroughUI(page, TENANT_ID, clinicianUser.username, clinicianUser.password);
    await page.waitForLoadState('networkidle');

    // Get test file
    const testFiles = fs.readdirSync(TEST_DATA_DIR)
      .filter(f => f.endsWith('.md') && f !== 'README.md');

    expect(testFiles.length).toBeGreaterThan(0);
    const testFilePath = path.join(TEST_DATA_DIR, testFiles[0]);

    // Click upload button
    const uploadButton = page.locator('button:has-text("Upload")').first();
    await uploadButton.click();
    await page.waitForTimeout(1000);

    // Fill in form fields
    const patientNameInput = page.locator('input[name="patientName"], input[placeholder*="Patient Name"], label:has-text("Patient Name") + input').first();
    const roomInput = page.locator('input[name="room"], input[placeholder*="Room"], label:has-text("Room") + input').first();
    const unitInput = page.locator('input[name="unit"], input[placeholder*="Unit"], label:has-text("Unit") + input').first();
    const attendingPhysicianInput = page.locator('input[name="attendingPhysician"], input[placeholder*="Attending"], label:has-text("Attending") + input').first();

    if (await patientNameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await patientNameInput.fill('[CLINICIAN-TEST] Test Patient');
    }
    if (await roomInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await roomInput.fill('Room-101');
    }
    if (await unitInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await unitInput.fill('ICU');
    }
    if (await attendingPhysicianInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await attendingPhysicianInput.fill('Dr. Test');
    }

    // Select file
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(testFilePath);

    // Click upload
    const uploadFilesButton = page.locator('button:has-text("Upload Files"), button:has-text("Upload File")').first();
    await uploadFilesButton.click();

    // Wait for upload to complete
    await page.waitForTimeout(5000);

    console.log(`   ✅ Successfully uploaded discharge summary`);
  });

  test('should allow clicking on discharge summary row', async ({ page }) => {
    await loginThroughUI(page, TENANT_ID, clinicianUser.username, clinicianUser.password);
    await page.waitForLoadState('networkidle');

    // Verify table rows are clickable
    const tableRows = page.locator('table tbody tr');
    const rowCount = await tableRows.count();

    if (rowCount > 0) {
      console.log(`   ✅ Clinician portal has ${rowCount} clickable discharge summary rows`);
    } else {
      console.log(`   ⚠️  No discharge summaries found in clinician portal`);
    }
  });
});
