export type UserRole = 'patient' | 'clinician' | 'expert' | 'admin' | 'system_admin';

export interface User {
  id: string;
  tenantId: string;
  username: string;
  passwordHash: string; // bcrypt hash
  name: string;
  role: UserRole;
  linkedPatientId?: string; // For patient role
  createdAt: Date;
  updatedAt: Date;
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

