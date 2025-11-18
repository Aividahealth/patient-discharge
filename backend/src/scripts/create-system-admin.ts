#!/usr/bin/env ts-node

/**
 * Script to create the first system admin user
 * Usage: npx ts-node src/scripts/create-system-admin.ts
 */

import { Firestore } from '@google-cloud/firestore';
import * as bcrypt from 'bcryptjs';
import * as readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
}

async function createSystemAdmin() {
  console.log('=== System Admin User Creation ===\n');

  // Get user input
  const username = await question('Enter username for system admin: ');
  const name = await question('Enter full name: ');
  const password = await question('Enter password (min 8 characters): ');

  // Validate input
  if (!username || username.length < 3) {
    console.error('Error: Username must be at least 3 characters');
    process.exit(1);
  }

  if (!password || password.length < 8) {
    console.error('Error: Password must be at least 8 characters');
    process.exit(1);
  }

  if (!name) {
    console.error('Error: Name is required');
    process.exit(1);
  }

  try {
    // Initialize Firestore
    console.log('\nConnecting to Firestore...');
    const firestore = new Firestore();

    // Check if user already exists
    const existingUser = await firestore
      .collection('users')
      .where('tenantId', '==', 'system')
      .where('username', '==', username)
      .get();

    if (!existingUser.empty) {
      console.error(`Error: System admin user '${username}' already exists`);
      process.exit(1);
    }

    // Hash password
    console.log('Hashing password...');
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user document
    console.log('Creating system admin user...');
    const now = new Date();
    await firestore.collection('users').add({
      tenantId: 'system',
      username,
      passwordHash,
      name,
      role: 'system_admin',
      createdAt: now,
      updatedAt: now,
    });

    console.log('\n✅ System admin user created successfully!');
    console.log(`\nYou can now login at /system-admin/login with:`);
    console.log(`  Username: ${username}`);
    console.log(`  Password: ${password}`);
    console.log('\n⚠️  Please store these credentials securely and delete this output.');

  } catch (error) {
    console.error('\n❌ Error creating system admin user:', error);
    process.exit(1);
  } finally {
    rl.close();
  }
}

createSystemAdmin();
