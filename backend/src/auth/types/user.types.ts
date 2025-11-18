export type UserRole = 'patient' | 'clinician' | 'expert' | 'tenant_admin' | 'system_admin';

export interface User {
  id: string;
  tenantId: string | null; // null for system_admin only
  username: string;
  passwordHash: string; // bcrypt hash
  name: string;
  role: UserRole;
  linkedPatientId?: string; // For patient role

  // Account Status
  isActive: boolean; // Account enabled/disabled
  isLocked: boolean; // Account locked due to failed attempts
  lockedAt?: Date; // When account was locked
  lockedReason?: string; // Reason for lock

  // Failed Login Tracking
  failedLoginAttempts: number; // Counter (0-3)
  lastFailedLoginAt?: Date; // Last failed attempt
  lastSuccessfulLoginAt?: Date; // Last successful login

  // Audit Fields
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string; // Admin who created user
  lastUpdatedBy?: string; // Admin who last modified
}

export interface LoginRequest {
  tenantId: string;
  username: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  token: string;
  expiresIn: number;
  user: {
    id: string;
    tenantId: string;
    username: string;
    name: string;
    role: string;
    linkedPatientId?: string;
  };
  tenant: {
    id: string;
    name: string;
    branding: {
      logo: string;
      primaryColor: string;
      secondaryColor: string;
    };
  };
}

export interface JWTPayload {
  userId: string;
  tenantId: string;
  username: string;
  name: string;
  role: string;
  linkedPatientId?: string;
  exp: number;
  iat: number;
}

export interface AuthPayload {
  type: 'service' | 'user';
  email?: string;        // For service type
  userId?: string;       // For user type
  username?: string;     // For user type
  name?: string;         // For user type
  role?: string;         // For user type
  tenantId?: string;
}
