import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';

/**
 * Guard to enforce tenant isolation
 *
 * This guard ensures that users can only access resources within their own tenant,
 * except for system_admin who can access any tenant.
 *
 * Validation:
 * - Checks if user's tenantId matches the X-Tenant-ID header
 * - system_admin role bypasses this check (can access any tenant)
 * - Prevents cross-tenant data access
 *
 * Prerequisites:
 * - AuthGuard must run before this guard (to set request.user)
 * - X-Tenant-ID header must be present
 *
 * Usage:
 * @UseGuards(AuthGuard, TenantGuard)
 * @Get('/patients')
 * getPatients() { ... }
 */
@Injectable()
export class TenantGuard implements CanActivate {
  private readonly logger = new Logger(TenantGuard.name);

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const auth = request.auth;
    const user = request.user;

    // Allow service accounts to bypass tenant checks
    // Service accounts are authenticated via Google OIDC and are trusted
    if (auth && auth.type === 'service') {
      this.logger.debug(
        `TenantGuard: Service account ${auth.email} granted access (service-to-service authentication)`,
      );
      return true;
    }

    // User should be set by AuthGuard
    if (!user) {
      this.logger.warn('TenantGuard: No user found in request. Did AuthGuard run?');
      throw new ForbiddenException('Authentication required');
    }

    // system_admin can access any tenant
    if (user.role === 'system_admin') {
      this.logger.debug(
        `TenantGuard: System admin ${user.username} granted cross-tenant access`,
      );
      return true;
    }

    const tenantIdHeader = request.headers['x-tenant-id'];

    if (!tenantIdHeader) {
      this.logger.warn('TenantGuard: Missing X-Tenant-ID header');
      throw new ForbiddenException('Missing X-Tenant-ID header');
    }

    // Verify user's tenant matches the requested tenant
    if (user.tenantId !== tenantIdHeader) {
      this.logger.warn(
        `TenantGuard: Tenant mismatch for user ${user.username}. User tenant: ${user.tenantId}, Requested tenant: ${tenantIdHeader}`,
      );
      throw new ForbiddenException(
        `Access denied. You do not have access to tenant: ${tenantIdHeader}`,
      );
    }

    this.logger.debug(
      `TenantGuard: User ${user.username} granted access to tenant ${user.tenantId}`,
    );

    return true;
  }
}
