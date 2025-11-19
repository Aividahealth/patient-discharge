import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../types/user.types';

export const ROLES_KEY = 'roles';

/**
 * Decorator to specify which roles are allowed to access an endpoint
 *
 * Usage:
 * @Roles('clinician', 'expert')
 * @Get('/patients')
 * getPatients() { ... }
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
