/**
 * Script to check if all Firestore collections are multi-tenant
 * This script analyzes the codebase to identify:
 * 1. All Firestore collections used
 * 2. Whether they filter by tenantId
 * 3. Whether they store tenantId in documents
 */

import * as fs from 'fs';
import * as path from 'path';

interface CollectionAnalysis {
  collectionName: string;
  files: string[];
  hasTenantFilter: boolean;
  storesTenantId: boolean;
  issues: string[];
}

const collections: Map<string, CollectionAnalysis> = new Map();

function analyzeFile(filePath: string): void {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const fileName = path.basename(filePath);

  // Find all collection references
  const collectionMatches = content.matchAll(/\.collection\(['"]([^'"]+)['"]\)/g);
  
  for (const match of collectionMatches) {
    const collectionName = match[1];
    
    if (!collections.has(collectionName)) {
      collections.set(collectionName, {
        collectionName,
        files: [],
        hasTenantFilter: false,
        storesTenantId: false,
        issues: [],
      });
    }

    const analysis = collections.get(collectionName)!;
    if (!analysis.files.includes(fileName)) {
      analysis.files.push(fileName);
    }

    // Check if this file uses tenant filtering
    const fileContent = content;
    const hasTenantFilter = 
      fileContent.includes(`where('tenantId'`) ||
      fileContent.includes(`where("tenantId"`) ||
      fileContent.includes(`.tenantId`) ||
      fileContent.includes(`tenantId:`) ||
      fileContent.includes(`tenantId ===`) ||
      fileContent.includes(`tenantId ==`);

    if (hasTenantFilter) {
      analysis.hasTenantFilter = true;
    }

    // Check if tenantId is stored in documents
    if (fileContent.includes('tenantId') && (
      fileContent.includes('tenantId:') ||
      fileContent.includes('tenantId =') ||
      fileContent.includes('tenantId,')
    )) {
      analysis.storesTenantId = true;
    }
  }
}

function walkDirectory(dir: string): void {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      // Skip node_modules, dist, .git, etc.
      if (!['node_modules', 'dist', '.git', '.next', 'coverage'].includes(file)) {
        walkDirectory(filePath);
      }
    } else if (file.endsWith('.ts') && !file.endsWith('.spec.ts') && !file.endsWith('.test.ts')) {
      analyzeFile(filePath);
    }
  }
}

function main() {
  console.log('🔍 Analyzing Firestore collections for multi-tenant support...\n');

  const backendSrc = path.join(process.cwd(), 'backend', 'src');
  if (fs.existsSync(backendSrc)) {
    walkDirectory(backendSrc);
  }

  console.log('📊 Collection Analysis Results:');
  console.log('='.repeat(80));

  const issues: string[] = [];
  const multiTenant: string[] = [];
  const notMultiTenant: string[] = [];

  for (const [collectionName, analysis] of collections.entries()) {
    console.log(`\n📁 Collection: ${collectionName}`);
    console.log(`   Files: ${analysis.files.join(', ')}`);
    console.log(`   Has Tenant Filter: ${analysis.hasTenantFilter ? '✅' : '❌'}`);
    console.log(`   Stores TenantId: ${analysis.storesTenantId ? '✅' : '❌'}`);

    // Determine if it's multi-tenant
    if (collectionName === 'config') {
      // Config collection uses tenantId as document ID, so it's multi-tenant by design
      console.log(`   Status: ✅ Multi-tenant (uses tenantId as document ID)`);
      multiTenant.push(collectionName);
    } else if (analysis.hasTenantFilter && analysis.storesTenantId) {
      console.log(`   Status: ✅ Multi-tenant`);
      multiTenant.push(collectionName);
    } else if (analysis.hasTenantFilter || analysis.storesTenantId) {
      console.log(`   Status: ⚠️  Partially multi-tenant`);
      analysis.issues.push('Has tenant filtering or stores tenantId, but not both consistently');
      issues.push(`${collectionName}: Partial multi-tenant support`);
      notMultiTenant.push(collectionName);
    } else {
      console.log(`   Status: ❌ NOT multi-tenant`);
      analysis.issues.push('No tenant filtering or tenantId storage found');
      issues.push(`${collectionName}: Missing tenant isolation`);
      notMultiTenant.push(collectionName);
    }

    if (analysis.issues.length > 0) {
      console.log(`   Issues:`);
      analysis.issues.forEach(issue => {
        console.log(`     - ${issue}`);
      });
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('📊 Summary:');
  console.log('='.repeat(80));
  console.log(`✅ Multi-tenant collections: ${multiTenant.length}`);
  multiTenant.forEach(c => console.log(`   - ${c}`));
  
  console.log(`\n❌ NOT multi-tenant collections: ${notMultiTenant.length}`);
  notMultiTenant.forEach(c => console.log(`   - ${c}`));

  if (issues.length > 0) {
    console.log(`\n⚠️  Issues found: ${issues.length}`);
    issues.forEach(issue => console.log(`   - ${issue}`));
  }

  console.log('\n' + '='.repeat(80));
  if (notMultiTenant.length === 0) {
    console.log('✅ All collections are multi-tenant!');
  } else {
    console.log('❌ Some collections are NOT multi-tenant and need to be fixed.');
    console.log('\n🔧 Recommendations:');
    console.log('1. Add tenantId field to all document types');
    console.log('2. Filter all queries by tenantId');
    console.log('3. Validate tenantId in all create/update operations');
    console.log('4. Use TenantContext to get tenantId in all service methods');
  }
}

main();

