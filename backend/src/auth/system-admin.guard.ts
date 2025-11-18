import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
  Logger,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from './auth.service';

/**
 * Decorator to mark routes as requiring system admin access
 */
export const RequireSystemAdmin = () => SetMetadata('requireSystemAdmin', true);

@Injectable()
export class SystemAdminGuard implements CanActivate {
  private readonly logger = new Logger(SystemAdminGuard.name);

  constructor(
    private readonly authService: AuthService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // Skip authentication for OPTIONS (CORS preflight) requests
    if (request.method === 'OPTIONS') {
      return true;
    }

    const { headers } = request;

    // Step 1: Check Authorization header exists
    const authHeader = headers.authorization || headers.Authorization;
    if (!authHeader) {
      this.logger.warn('Missing Authorization header');
      throw new UnauthorizedException('Missing Authorization header. Expected: Bearer <token>');
    }

    if (!authHeader.startsWith('Bearer ')) {
      this.logger.warn(`Invalid Authorization header format`);
      throw new UnauthorizedException('Invalid Authorization header format. Expected: Bearer <token>');
    }

    const token = authHeader.substring(7).trim(); // Remove 'Bearer ' prefix and trim whitespace

    // Validate token format (JWT should have 3 parts separated by dots)
    if (!token || token.split('.').length !== 3) {
      this.logger.warn(`Invalid token format`);
      throw new UnauthorizedException('Invalid token format. Expected JWT token with 3 segments.');
    }

    // Step 2: Verify JWT token
    const jwtPayload = await this.authService.verifyToken(token);
    if (!jwtPayload) {
      this.logger.warn('JWT verification failed');
      throw new UnauthorizedException('Invalid or expired token');
    }

    // Check token expiration
    const now = Math.floor(Date.now() / 1000);
    if (jwtPayload.exp && jwtPayload.exp < now) {
      this.logger.warn(`Token expired at ${new Date(jwtPayload.exp * 1000).toISOString()}`);
      throw new UnauthorizedException('Token has expired');
    }

    // Step 3: Verify user is system admin
    if (jwtPayload.role !== 'system_admin') {
      this.logger.warn(
        `Access denied: user ${jwtPayload.username} with role ${jwtPayload.role} attempted to access system admin endpoint`,
      );
      throw new ForbiddenException('Access denied. System admin role required.');
    }

    // Attach auth info to request for use in controllers
    request.user = {
      userId: jwtPayload.userId,
      tenantId: jwtPayload.tenantId,
      username: jwtPayload.username,
      name: jwtPayload.name,
      role: jwtPayload.role,
    };

    this.logger.debug(
      `✅ System admin authentication successful for user: ${jwtPayload.username} (${jwtPayload.userId})`,
    );

    return true;
  }
}
