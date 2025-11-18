'use client'

import { ApiClient } from '../api-client'

export type UserRole = 'patient' | 'clinician' | 'expert' | 'tenant_admin' | 'system_admin'

export interface User {
  id: string
  tenantId: string | null // null for system_admin only
  username: string
  name: string
  email?: string
  role: UserRole
  linkedPatientId?: string
  isActive: boolean
  isLocked: boolean
  failedLoginAttempts: number
  lastSuccessfulLoginAt?: Date | string
  createdAt: Date | string
  updatedAt: Date | string
  createdBy?: string
  lastUpdatedBy?: string
}

export interface CreateUserRequest {
  username: string
  password: string
  name: string
  email?: string
  role: UserRole
  linkedPatientId?: string
}

export interface UpdateUserRequest {
  name?: string
  email?: string
  role?: UserRole
  linkedPatientId?: string
  password?: string
}

/**
 * List all users for the current tenant
 */
export async function listUsers(tenantId: string, token: string): Promise<User[]> {
  const client = new ApiClient({ tenantId, token })
  const users = await client.get<User[]>('/api/users')
  return users
}

/**
 * Get a specific user by ID
 */
export async function getUser(userId: string, tenantId: string, token: string): Promise<User> {
  const client = new ApiClient({ tenantId, token })
  const user = await client.get<User>(`/api/users/${userId}`)
  return user
}

/**
 * Create a new user
 */
export async function createUser(
  request: CreateUserRequest,
  tenantId: string,
  token: string
): Promise<User> {
  const client = new ApiClient({ tenantId, token })
  const user = await client.post<User>('/api/users', request)
  return user
}

/**
 * Update an existing user
 */
export async function updateUser(
  userId: string,
  request: UpdateUserRequest,
  tenantId: string,
  token: string
): Promise<User> {
  const client = new ApiClient({ tenantId, token })
  const user = await client.put<User>(`/api/users/${userId}`, request)
  return user
}

/**
 * Delete a user
 */
export async function deleteUser(
  userId: string,
  tenantId: string,
  token: string
): Promise<{ success: boolean; message: string }> {
  const client = new ApiClient({ tenantId, token })
  const result = await client.delete<{ success: boolean; message: string }>(`/api/users/${userId}`)
  return result
}
