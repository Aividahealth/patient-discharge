import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Firestore } from '@google-cloud/firestore';
import { DevConfigService } from '../config/dev-config.service';
import { User } from './types/user.types';
import { resolveServiceAccountPath } from '../utils/path.helper';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);
  private firestore: Firestore | null = null;
  private readonly collectionName = 'users';

  constructor(private readonly configService: DevConfigService) {}

  /**
   * Initialize Firestore client lazily
   */
  private getFirestore(): Firestore {
    if (!this.firestore) {
      let serviceAccountPath: string | undefined;

      try {
        const config = this.configService.get();
        if (config.firestore_service_account_path) {
          // Resolve the path - handles both full paths and filenames
          const resolved = resolveServiceAccountPath(config.firestore_service_account_path);
          // Only use if file exists; otherwise fall back to ADC
          const fs = require('fs');
          if (fs.existsSync(resolved)) {
            serviceAccountPath = resolved;
            this.logger.log(`Using Firestore service account for UserService: ${resolved}`);
          } else {
            this.logger.log(`Firestore service account not found at ${resolved}, using Application Default Credentials`);
          }
        }
      } catch (error) {
        this.logger.log('Config not available, using Application Default Credentials');
      }

      this.firestore = new Firestore(
        serviceAccountPath ? { keyFilename: serviceAccountPath } : {},
      );

      this.logger.log('Firestore User Service initialized');
    }
    return this.firestore;
  }

  /**
   * Find user by tenantId and username
   */
  async findByUsername(tenantId: string, username: string): Promise<User | null> {
    try {
      const doc = await this.getFirestore()
        .collection(this.collectionName)
        .where('tenantId', '==', tenantId)
        .where('username', '==', username)
        .limit(1)
        .get();

      if (doc.empty) {
        return null;
      }

      const userData = doc.docs[0].data();
      return {
        id: doc.docs[0].id,
        ...userData,
        createdAt: userData.createdAt?.toDate() || new Date(),
        updatedAt: userData.updatedAt?.toDate() || new Date(),
      } as User;
    } catch (error) {
      this.logger.error(`Error finding user by username: ${error.message}`);
      throw error;
    }
  }

  /**
   * Find user by ID
   */
  async findById(id: string): Promise<User | null> {
    try {
      const doc = await this.getFirestore()
        .collection(this.collectionName)
        .doc(id)
        .get();

      if (!doc.exists) {
        return null;
      }

      const userData = doc.data();
      return {
        id: doc.id,
        ...userData,
        createdAt: userData?.createdAt?.toDate() || new Date(),
        updatedAt: userData?.updatedAt?.toDate() || new Date(),
      } as User;
    } catch (error) {
      this.logger.error(`Error finding user by ID: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create a new user
   */
  async create(user: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
    try {
      const now = new Date();
      const docRef = this.getFirestore().collection(this.collectionName).doc();

      const userData = {
        ...user,
        createdAt: now,
        updatedAt: now,
      };

      await docRef.set(userData);

      this.logger.log(`Created user: ${docRef.id} for tenant: ${user.tenantId}`);

      return {
        id: docRef.id,
        ...userData,
        createdAt: now,
        updatedAt: now,
      };
    } catch (error) {
      this.logger.error(`Error creating user: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update user
   */
  async update(id: string, updates: Partial<Omit<User, 'id' | 'createdAt'>>): Promise<User> {
    try {
      const docRef = this.getFirestore().collection(this.collectionName).doc(id);

      const updateData = {
        ...updates,
        updatedAt: new Date(),
      };

      await docRef.update(updateData);

      const updatedUser = await this.findById(id);
      if (!updatedUser) {
        throw new NotFoundException(`User ${id} not found`);
      }

      this.logger.log(`Updated user: ${id}`);
      return updatedUser;
    } catch (error) {
      this.logger.error(`Error updating user: ${error.message}`);
      throw error;
    }
  }

  /**
   * Find all users by tenant ID
   */
  async findByTenant(tenantId: string): Promise<User[]> {
    try {
      const snapshot = await this.getFirestore()
        .collection(this.collectionName)
        .where('tenantId', '==', tenantId)
        .get();

      if (snapshot.empty) {
        return [];
      }

      return snapshot.docs.map(doc => {
        const userData = doc.data();
        return {
          id: doc.id,
          ...userData,
          createdAt: userData.createdAt?.toDate() || new Date(),
          updatedAt: userData.updatedAt?.toDate() || new Date(),
        } as User;
      });
    } catch (error) {
      this.logger.error(`Error finding users by tenant: ${error.message}`);
      throw error;
    }
  }

  /**
   * Delete a user
   */
  async delete(id: string): Promise<void> {
    try {
      await this.getFirestore()
        .collection(this.collectionName)
        .doc(id)
        .delete();

      this.logger.log(`Deleted user: ${id}`);
    } catch (error) {
      this.logger.error(`Error deleting user: ${error.message}`);
      throw error;
    }
  }
}

