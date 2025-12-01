/**
 * Shared Login Helpers for UI Tests
 * 
 * Provides reusable login functions for all portal tests
 */

import { Page, expect } from '@playwright/test';

/**
 * Login through the UI for any portal type
 */
export async function loginThroughUI(
  page: Page,
  tenantId: string,
  username: string,
  password: string,
  expectedPortal?: string
): Promise<void> {
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

  // Wait for navigation
  if (expectedPortal) {
    await page.waitForURL(`**/${tenantId}/${expectedPortal}**`, { timeout: 15000 });
    await expect(page).toHaveURL(new RegExp(`/${tenantId}/${expectedPortal}`));
  } else {
    // Wait for any navigation to complete
    await page.waitForLoadState('networkidle');
  }
}

