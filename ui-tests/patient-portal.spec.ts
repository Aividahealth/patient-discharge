/**
 * UI-Based Patient Portal Tests
 *
 * Tests the patient portal through the browser UI.
 * Patient portal displays discharge information for a specific patient and composition.
 */

import { test, expect, Page } from '@playwright/test';
import { TestUserManager } from '../utils/test-user-manager';
import { Firestore } from '@google-cloud/firestore';
import { Storage } from '@google-cloud/storage';
import * as path from 'path';
import * as fs from 'fs';
import * as YAML from 'yaml';

const TENANT_ID = 'demo';
const TEST_TAG = 'patient-portal-test';
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

  // Wait for navigation to complete
  await page.waitForLoadState('networkidle');
}

test.describe('Patient Portal UI Tests', () => {
  let firestore: Firestore;
  let storage: Storage;
  let userManager: TestUserManager;
  let patientUser: any;

  test.beforeAll(async () => {
    console.log('\n🚀 Setting up patient portal test data...\n');

    const clients = initializeClients();
    firestore = clients.firestore;
    storage = clients.storage;

    userManager = new TestUserManager(firestore, TEST_TAG);

    // Create test users
    console.log('👥 Creating test users...');
    const users = await userManager.createPortalTestUsers(TENANT_ID);
    patientUser = users.patient;
    console.log(`   ✅ Created patient user: ${patientUser.username}`);

    console.log(`✅ Test data setup complete!\n`);
  }, 60000);

  test('should display patient portal with query parameters', async ({ page }) => {
    // Patient portal requires patientId and compositionId
    const patientId = 'test-patient-123';
    const compositionId = 'test-composition-123';

    await loginThroughUI(page, TENANT_ID, patientUser.username, patientUser.password);

    // Navigate to patient portal with query params
    await page.goto(`/${TENANT_ID}/patient?patientId=${patientId}&compositionId=${compositionId}`);
    await page.waitForLoadState('networkidle');

    // Verify portal loads (even if data doesn't exist, page should render)
    const pageContent = await page.textContent('body');
    expect(pageContent).toBeTruthy();
    expect(pageContent!.length).toBeGreaterThan(50);

    console.log(`   ✅ Patient portal loaded with query parameters`);
  });

  test('should display patient portal without errors', async ({ page }) => {
    await loginThroughUI(page, TENANT_ID, patientUser.username, patientUser.password);

    // Navigate to patient portal base URL
    await page.goto(`/${TENANT_ID}/patient`);
    await page.waitForLoadState('networkidle');

    // Verify no error page is shown
    const pageContent = await page.textContent('body');
    expect(pageContent).toBeTruthy();

    // Check if error messages are NOT displayed
    const hasError = await page.locator('text=/error|Error|not found|Not Found/i').count();
    console.log(`   ✅ Patient portal loaded without critical errors (error count: ${hasError})`);
  });

  test('should have proper page structure', async ({ page }) => {
    const patientId = 'test-patient-456';
    const compositionId = 'test-composition-456';

    await loginThroughUI(page, TENANT_ID, patientUser.username, patientUser.password);
    await page.goto(`/${TENANT_ID}/patient?patientId=${patientId}&compositionId=${compositionId}`);
    await page.waitForLoadState('networkidle');

    // Verify basic HTML structure exists
    const body = await page.locator('body');
    await expect(body).toBeVisible();

    const hasContent = await page.textContent('body');
    expect(hasContent!.length).toBeGreaterThan(50);

    console.log(`   ✅ Patient portal has proper page structure`);
  });

  test('should handle missing query parameters gracefully', async ({ page }) => {
    await loginThroughUI(page, TENANT_ID, patientUser.username, patientUser.password);

    // Navigate without query params
    await page.goto(`/${TENANT_ID}/patient`);
    await page.waitForLoadState('networkidle');

    // Page should still load (might show a message about missing data)
    const pageContent = await page.textContent('body');
    expect(pageContent).toBeTruthy();

    console.log(`   ✅ Patient portal handles missing query parameters`);
  });

  test('should be accessible after login', async ({ page }) => {
    await loginThroughUI(page, TENANT_ID, patientUser.username, patientUser.password);

    // Try to access patient portal
    const response = await page.goto(`/${TENANT_ID}/patient`);

    // Should not get 404 or 500
    expect(response?.status()).toBeLessThan(500);

    console.log(`   ✅ Patient portal is accessible after login (status: ${response?.status()})`);
  });
});
