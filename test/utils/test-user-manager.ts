/**
 * Test User Manager
 *
 * Utility for creating and managing test users with tags for easy cleanup
 */

import * as bcrypt from 'bcryptjs';
import { Firestore } from '@google-cloud/firestore';
import * as crypto from 'crypto';

export interface TestUserOptions {
  tenantId: string;
  username: string;
  name: string;
  role: 'patient' | 'clinician' | 'expert' | 'tenant_admin' | 'system_admin';
  linkedPatientId?: string;
  email?: string;
  password?: string;
}

export interface TestUser extends TestUserOptions {
  id: string;
  password: string;
  passwordHash: string;
  createdAt: Date;
}

export class TestUserManager {
  private firestore: Firestore;
  private testTag: string;
  private createdUsers: TestUser[] = [];

  constructor(firestore: Firestore, testTag: string = 'portal-integration-test') {
    this.firestore = firestore;
    this.testTag = testTag;
  }

  /**
   * Generate a secure random password
   */
  private generatePassword(): string {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%';
    const length = 16;
    let password = '';
    for (let i = 0; i < length; i++) {
      const randomIndex = crypto.randomInt(0, charset.length);
      password += charset[randomIndex];
    }
    return password;
  }

  /**
   * Hash password using bcrypt
   */
  private async hashPassword(password: string): Promise<string> {
    const saltRounds = 10;
    return bcrypt.hash(password, saltRounds);
  }

  /**
   * Create a test user with the test tag
   */
  async createUser(options: TestUserOptions): Promise<TestUser> {
    const password = options.password || this.generatePassword();
    const passwordHash = await this.hashPassword(password);
    const now = new Date();

    const userData = {
      tenantId: options.role === 'system_admin' ? null : options.tenantId,
      username: options.username,
      passwordHash: passwordHash,
      name: options.name,
      role: options.role,
      linkedPatientId: options.linkedPatientId || null,
      email: options.email || null,

      // Test tag for easy identification and cleanup
      testTag: this.testTag,
      testCreatedAt: now.toISOString(),

      // Account status
      isActive: true,
      isLocked: false,
      failedLoginAttempts: 0,

      // Audit fields
      createdAt: now,
      updatedAt: now,
      createdBy: 'test-automation',
    };

    const docRef = this.firestore.collection('users').doc();
    await docRef.set(userData);

    const testUser: TestUser = {
      id: docRef.id,
      ...options,
      password,
      passwordHash,
      createdAt: now,
    };

    this.createdUsers.push(testUser);
    return testUser;
  }

  /**
   * Create multiple test users
   */
  async createUsers(usersOptions: TestUserOptions[]): Promise<TestUser[]> {
    const users: TestUser[] = [];
    for (const options of usersOptions) {
      const user = await this.createUser(options);
      users.push(user);
    }
    return users;
  }

  /**
   * Get all created users
   */
  getCreatedUsers(): TestUser[] {
    return [...this.createdUsers];
  }

  /**
   * Find user by username and tenant
   */
  async findUser(tenantId: string, username: string): Promise<any> {
    const snapshot = await this.firestore
      .collection('users')
      .where('tenantId', '==', tenantId)
      .where('username', '==', username)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return null;
    }

    const doc = snapshot.docs[0];
    return {
      id: doc.id,
      ...doc.data(),
    };
  }

  /**
   * Delete a specific user by ID
   */
  async deleteUser(userId: string): Promise<void> {
    await this.firestore.collection('users').doc(userId).delete();
    this.createdUsers = this.createdUsers.filter(u => u.id !== userId);
  }

  /**
   * Delete all users created by this manager
   */
  async cleanupCreatedUsers(): Promise<number> {
    let deletedCount = 0;

    for (const user of this.createdUsers) {
      try {
        await this.firestore.collection('users').doc(user.id).delete();
        deletedCount++;
      } catch (error) {
        console.error(`Failed to delete user ${user.id}:`, error.message);
      }
    }

    this.createdUsers = [];
    return deletedCount;
  }

  /**
   * Delete all users with the test tag (including from previous runs)
   */
  async cleanupAllTestUsers(): Promise<number> {
    const snapshot = await this.firestore
      .collection('users')
      .where('testTag', '==', this.testTag)
      .get();

    let deletedCount = 0;
    const batch = this.firestore.batch();
    let batchSize = 0;
    const MAX_BATCH_SIZE = 500;

    for (const doc of snapshot.docs) {
      batch.delete(doc.ref);
      batchSize++;

      if (batchSize >= MAX_BATCH_SIZE) {
        await batch.commit();
        deletedCount += batchSize;
        batchSize = 0;
      }
    }

    if (batchSize > 0) {
      await batch.commit();
      deletedCount += batchSize;
    }

    this.createdUsers = [];
    return deletedCount;
  }

  /**
   * Get credentials for a user (for login)
   */
  getUserCredentials(user: TestUser): { username: string; password: string; tenantId: string } {
    return {
      username: user.username,
      password: user.password,
      tenantId: user.tenantId,
    };
  }

  /**
   * Create standard set of portal test users
   */
  async createPortalTestUsers(tenantId: string): Promise<{
    patient: TestUser;
    clinician: TestUser;
    expert: TestUser;
    admin: TestUser;
  }> {
    const timestamp = Date.now();

    const patient = await this.createUser({
      tenantId,
      username: `test-patient-${timestamp}`,
      name: '[TEST] Patient User',
      role: 'patient',
      linkedPatientId: `patient-test-${timestamp}`,
      email: `patient-${timestamp}@test.local`,
    });

    const clinician = await this.createUser({
      tenantId,
      username: `test-clinician-${timestamp}`,
      name: '[TEST] Clinician User',
      role: 'clinician',
      email: `clinician-${timestamp}@test.local`,
    });

    const expert = await this.createUser({
      tenantId,
      username: `test-expert-${timestamp}`,
      name: '[TEST] Expert User',
      role: 'expert',
      email: `expert-${timestamp}@test.local`,
    });

    const admin = await this.createUser({
      tenantId,
      username: `test-admin-${timestamp}`,
      name: '[TEST] Admin User',
      role: 'tenant_admin',
      email: `admin-${timestamp}@test.local`,
    });

    return { patient, clinician, expert, admin };
  }
}
