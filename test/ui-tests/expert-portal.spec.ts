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
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3001';

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
  // Navigate to login page
  await page.goto('/login');
  
  // Wait for login form to be visible
  await page.waitForSelector('input[type="text"], input[name="tenantId"]', { timeout: 10000 });
  
  // Fill in tenant ID if there's a field for it
  const tenantInput = page.locator('input[name="tenantId"], input[placeholder*="Tenant"], input[placeholder*="tenant"]').first();
  if (await tenantInput.count() > 0) {
    await tenantInput.fill(tenantId);
  }
  
  // Find and click the portal button (Patient, Clinician, Admin, Expert)
  // The login page has buttons for each portal
  const portalButton = page.locator(`button:has-text("${username}"), button:has-text("Expert"), a:has-text("Expert")`).first();
  
  if (await portalButton.count() > 0) {
    // Click the portal button which triggers auto-login
    await portalButton.click();
    
    // Wait for navigation to the portal
    await page.waitForURL(`**/${tenantId}/expert**`, { timeout: 15000 });
  } else {
    // Fallback: try to find username/password fields and login form
    const usernameInput = page.locator('input[name="username"], input[type="text"]').first();
    const passwordInput = page.locator('input[name="password"], input[type="password"]').first();
    const loginButton = page.locator('button:has-text("Login"), button[type="submit"]').first();
    
    if (await usernameInput.count() > 0 && await passwordInput.count() > 0) {
      await usernameInput.fill(username);
      await passwordInput.fill(password);
      await loginButton.click();
      await page.waitForURL(`**/${tenantId}/expert**`, { timeout: 15000 });
    }
  }
  
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
    
    // Clean up any leftover test data
    console.log('🧹 Cleaning up leftover test data...');
    await userManager.cleanupAllTestUsers();
    await dischargeManager.cleanupAllTestSummaries();
    
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
    
    // Add compositionId to summaries for expert portal
    for (const summary of dischargeSummaries) {
      await firestore
        .collection('discharge_summaries')
        .doc(summary.id)
        .update({ compositionId: summary.id });
    }
    
    console.log('✅ Test data setup complete!\n');
  }, 120000);

  test('should display discharge summaries in expert portal', async ({ page }) => {
    // Login through UI
    await loginThroughUI(page, TENANT_ID, expertUser.username, expertUser.password);
    
    // Wait for the expert portal to load
    await page.waitForLoadState('networkidle');
    
    // Look for discharge summary elements in the UI
    // The expert portal should show a list of summaries
    const summaryElements = page.locator('[data-testid*="summary"], [data-testid*="discharge"], table tbody tr, .summary-item, .discharge-item');
    
    // Wait for at least one summary to appear
    await expect(summaryElements.first()).toBeVisible({ timeout: 10000 });
    
    // Verify we can see patient names or MRNs from our test data
    const pageContent = await page.textContent('body');
    const hasTestData = dischargeSummaries.some(summary => 
      pageContent?.includes(summary.patientName) || pageContent?.includes(summary.mrn)
    );
    
    expect(hasTestData).toBe(true);
    console.log(`   ✅ Found test discharge summaries in expert portal UI`);
  });

  test('should allow expert to click on a discharge summary', async ({ page }) => {
    // Login through UI
    await loginThroughUI(page, TENANT_ID, expertUser.username, expertUser.password);
    
    // Wait for the expert portal to load
    await page.waitForLoadState('networkidle');
    
    // Find and click on the first discharge summary
    // Look for clickable elements (buttons, links, table rows)
    const firstSummary = page.locator('table tbody tr, .summary-item, .discharge-item, button:has-text("Review"), a:has-text("Review")').first();
    
    if (await firstSummary.count() > 0) {
      await firstSummary.click();
      
      // Should navigate to review page
      await page.waitForURL(`**/${TENANT_ID}/expert/review/**`, { timeout: 10000 });
      
      // Verify we're on a review page
      await expect(page).toHaveURL(new RegExp(`/${TENANT_ID}/expert/review/`));
      console.log(`   ✅ Successfully navigated to review page`);
    } else {
      console.warn(`   ⚠️  Could not find clickable summary element`);
    }
  });

  test('should show patient names and MRNs in expert portal', async ({ page }) => {
    // Login through UI
    await loginThroughUI(page, TENANT_ID, expertUser.username, expertUser.password);
    
    // Wait for the expert portal to load
    await page.waitForLoadState('networkidle');
    
    // Get page content
    const pageContent = await page.textContent('body');
    
    // Verify we can see patient information from test data
    for (const summary of dischargeSummaries) {
      const hasPatientName = pageContent?.includes(summary.patientName);
      const hasMRN = pageContent?.includes(summary.mrn);
      
      if (hasPatientName || hasMRN) {
        console.log(`   ✅ Found test patient: ${summary.patientName} (${summary.mrn})`);
      }
    }
    
    // At least one test summary should be visible
    const anyVisible = dischargeSummaries.some(summary => 
      pageContent?.includes(summary.patientName) || pageContent?.includes(summary.mrn)
    );
    
    expect(anyVisible).toBe(true);
  });
});

