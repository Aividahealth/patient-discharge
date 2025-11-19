import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { UserRole } from '../types/user.types';

/**
 * Guard to enforce role-based access control
 *
 * This guard checks if the authenticated user's role is in the list of allowed roles
 * specified by the @Roles() decorator.
 *
 * Prerequisites:
 * - AuthGuard must run before this guard (to set request.user)
 * - Route must have @Roles() decorator with allowed roles
 *
 * Usage:
 * @Roles('clinician', 'expert', 'tenant_admin')
 * @UseGuards(AuthGuard, RolesGuard)
 * @Get('/patients')
 * getPatients() { ... }
 */
@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Get required roles from @Roles() decorator
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If no roles specified, allow access
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // User should be set by AuthGuard
    if (!user) {
      this.logger.warn('RolesGuard: No user found in request. Did AuthGuard run?');
      throw new ForbiddenException('Authentication required');
    }

    if (!user.role) {
      this.logger.warn(`RolesGuard: User ${user.userId} has no role assigned`);
      throw new ForbiddenException('User has no role assigned');
    }

    // Check if user's role is in the list of allowed roles
    const hasRole = requiredRoles.includes(user.role as UserRole);

    if (!hasRole) {
      this.logger.warn(
        `RolesGuard: User ${user.username} (${user.role}) attempted to access endpoint requiring roles: ${requiredRoles.join(', ')}`,
      );
      throw new ForbiddenException(
        `Access denied. Required roles: ${requiredRoles.join(', ')}. Your role: ${user.role}`,
      );
    }

    this.logger.debug(
      `RolesGuard: User ${user.username} (${user.role}) granted access. Required roles: ${requiredRoles.join(', ')}`,
    );

    return true;
  }
}
