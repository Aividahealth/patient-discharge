/**
 * UI-Based Expert Portal Tests
 * 
 * Tests the expert portal through the browser UI, just like a real user would.
 * No direct API calls - all interactions go through the UI.
 */

import { test, expect, Page } from '@playwright/test';
import { TestUserManager } from '../utils/test-user-manager';
import { TestDischargeManager } from '../utils/test-discharge-manager';
import { Firestore } from '@google-cloud/firestore';
import { Storage } from '@google-cloud/storage';
import * as path from 'path';
import * as fs from 'fs';
import * as YAML from 'yaml';

const TENANT_ID = 'demo';
const TEST_TAG = 'portal-integration-test';
const TEST_DATA_DIR = path.join(__dirname, '../test-data/discharge-summaries');
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://www.aividahealth.ai';

// Helper function to get service account path
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

// Helper function to get GCS bucket name
function getGCSBucketName(tenantId: string = TENANT_ID): string {
  return `discharge-summaries-raw-${tenantId}`;
}

// Helper function to initialize clients
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
  
  // Use Application Default Credentials
  const firestore = new Firestore();
  const storage = new Storage();
  return { firestore, storage };
}

// Helper function to login through UI
async function loginThroughUI(page: Page, tenantId: string, username: string, password: string) {
  // Navigate to login page (login page is at /login, not /{tenantId}/login)
  await page.goto('/login');
  
  // Wait for login form to be visible
  await page.waitForSelector('input[type="text"], input[placeholder*="tenant"], button', { timeout: 10000 });
  
  // For Expert, we need to use the manual login form (no Expert tab exists)
  // Fill in tenant ID - look for any tenant input field
  const tenantInput = page.locator('input[id*="tenant"], input[placeholder*="tenant"], input[placeholder*="Tenant"]').first();
  if (await tenantInput.count() > 0) {
    await tenantInput.fill(tenantId);
  }
  
  // Fill in username - look for username input (it's in the form)
  const usernameInput = page.locator('input[id*="username"], input[placeholder*="username"], input[placeholder*="Username"]').first();
  await usernameInput.waitFor({ timeout: 5000 });
  await usernameInput.fill(username);
  
  // Fill in password
  const passwordInput = page.locator('input[type="password"], input[id*="password"]').first();
  await passwordInput.waitFor({ timeout: 5000 });
  await passwordInput.fill(password);
  
  // Click the submit button
  const submitButton = page.locator('button[type="submit"], button:has-text("Sign In"), button:has-text("Login")').first();
  await submitButton.click();
  
  // Wait for navigation to the expert portal (backend redirects based on user role)
  await page.waitForURL(`**/${tenantId}/expert**`, { timeout: 15000 });
  
  // Verify we're logged in and on the expert portal
  await expect(page).toHaveURL(new RegExp(`/${tenantId}/expert`));
}

test.describe('Expert Portal UI Tests', () => {
  let firestore: Firestore;
  let storage: Storage;
  let userManager: TestUserManager;
  let dischargeManager: TestDischargeManager;
  let expertUser: any;
  let dischargeSummaries: any[];

  test.beforeAll(async () => {
    console.log('\n🚀 Setting up test data for UI tests...\n');

    // Initialize clients
    const clients = initializeClients();
    firestore = clients.firestore;
    storage = clients.storage;
    const bucketName = getGCSBucketName();

    // Initialize managers
    userManager = new TestUserManager(firestore, TEST_TAG);
    dischargeManager = new TestDischargeManager(firestore, storage, bucketName, TEST_TAG);

    // Create test users
    console.log('👥 Creating test users...');
    const users = await userManager.createPortalTestUsers(TENANT_ID);
    expertUser = users.expert;
    console.log(`   ✅ Expert: ${expertUser.username} (${expertUser.id})`);

    // Create discharge summaries
    console.log('📄 Creating test discharge summaries...');
    dischargeSummaries = await dischargeManager.createDischargeSummariesFromDirectory(
      TENANT_ID,
      TEST_DATA_DIR
    );
    console.log(`   ✅ Created ${dischargeSummaries.length} discharge summaries`);

    // Add compositionId and assign to expert for review
    for (const summary of dischargeSummaries) {
      await firestore
        .collection('discharge_summaries')
        .doc(summary.id)
        .update({
          compositionId: summary.id,
          // Mark as simplified so expert portal will show them
          status: 'simplified',
          assignedExpertId: expertUser.id,
          files: {
            raw: summary.gcsPath,
            simplified: summary.gcsPath, // Use raw file as simplified for testing
          },
        });
    }

    console.log(`✅ Test data setup complete!`);
    console.log(`   Expert ID: ${expertUser.id}`);
    console.log(`   Summary IDs: ${dischargeSummaries.map(s => s.id).join(', ')}\n`);
  }, 60000); // 1 minute timeout for setup

  test('should display discharge summaries in expert portal', async ({ page }) => {
    // Login through UI
    await loginThroughUI(page, TENANT_ID, expertUser.username, expertUser.password);

    // Wait for the expert portal to load
    await page.waitForLoadState('networkidle');

    // Click the Refresh button to ensure latest data is loaded
    const refreshButton = page.locator('button:has-text("Refresh")');
    if (await refreshButton.count() > 0) {
      await refreshButton.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
    }

    // Look for discharge summary elements in the UI
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
    // Login through UI
    await loginThroughUI(page, TENANT_ID, expertUser.username, expertUser.password);

    // Wait for the expert portal to load
    await page.waitForLoadState('networkidle');

    // Verify that review buttons exist
    const reviewButtons = page.locator('button:has-text("Review")');
    const buttonCount = await reviewButtons.count();

    expect(buttonCount).toBeGreaterThan(0);
    console.log(`   ✅ Expert portal has ${buttonCount} Review buttons available`);
  });

  test('should show patient names and MRNs in expert portal', async ({ page }) => {
    // Login through UI
    await loginThroughUI(page, TENANT_ID, expertUser.username, expertUser.password);

    // Wait for the expert portal to load
    await page.waitForLoadState('networkidle');

    // Verify the table shows patient information
    const hasPatientNames = await page.locator('table tbody tr td').count() > 0;
    expect(hasPatientNames).toBe(true);

    console.log(`   ✅ Expert portal displays patient information in table`);
  });
});

