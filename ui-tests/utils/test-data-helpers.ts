/**
 * Test Data Helpers
 * 
 * Provides utilities for managing test data and waiting for async operations
 */

import { Firestore } from '@google-cloud/firestore';

/**
 * Wait for discharge summary to be simplified
 */
export async function waitForSimplification(
  firestore: Firestore,
  summaryId: string,
  timeoutMs: number = 300000
): Promise<boolean> {
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
    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
  }
  console.warn(`   ⚠️  Timeout waiting for simplification of ${summaryId}`);
  return false;
}

/**
 * Wait for discharge summary to be translated
 */
export async function waitForTranslation(
  firestore: Firestore,
  summaryId: string,
  timeoutMs: number = 300000
): Promise<boolean> {
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
    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
  }
  console.warn(`   ⚠️  Timeout waiting for translation of ${summaryId}`);
  return false;
}

/**
 * Trigger simplification via backend API
 */
export async function triggerSimplification(
  backendUrl: string,
  tenantId: string,
  adminToken: string,
  hoursAgo: number = 1,
  limit: number = 10
): Promise<void> {
  try {
    const response = await fetch(`${backendUrl}/api/discharge-summary/republish-events?hoursAgo=${hoursAgo}&limit=${limit}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`,
        'X-Tenant-ID': tenantId,
      },
    });
    if (response.ok) {
      console.log('   ✅ Triggered simplification via republish events');
    } else {
      console.warn(`   ⚠️  Failed to trigger simplification: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    console.warn('   ⚠️  Failed to trigger simplification:', error);
  }
}

/**
 * Get discharge summary from Firestore
 */
export async function getDischargeSummary(
  firestore: Firestore,
  summaryId: string
): Promise<any | null> {
  const doc = await firestore.collection('discharge_summaries').doc(summaryId).get();
  if (doc.exists) {
    return { id: doc.id, ...doc.data() };
  }
  return null;
}

