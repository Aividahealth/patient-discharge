import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from './auth.service';
import { ConfigService } from '../config/config.service';
import { JWTPayload } from './types/user.types';

/**
 * Decorator to mark routes as public (skip authentication)
 */
export const Public = () => SetMetadata('isPublic', true);

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);

  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if route is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const { headers } = request;

    // Extract Bearer token from Authorization header
    const authHeader = headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      this.logger.warn('Missing or invalid Authorization header');
      throw new UnauthorizedException('Missing or invalid Authorization header. Expected: Bearer <token>');
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Extract X-Tenant-ID header
    const tenantIdHeader = headers['x-tenant-id'];
    if (!tenantIdHeader) {
      this.logger.warn('Missing X-Tenant-ID header');
      throw new UnauthorizedException('Missing X-Tenant-ID header');
    }

    // Verify and decode JWT token
    const payload = await this.authService.verifyToken(token);
    if (!payload) {
      this.logger.warn('Invalid or expired token');
      throw new UnauthorizedException('Invalid or expired token');
    }

    // Check token expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      this.logger.warn(`Token expired at ${new Date(payload.exp * 1000).toISOString()}`);
      throw new UnauthorizedException('Token has expired');
    }

    // Verify tenantId from token matches X-Tenant-ID header
    if (payload.tenantId !== tenantIdHeader) {
      this.logger.warn(
        `Tenant ID mismatch: token has ${payload.tenantId}, header has ${tenantIdHeader}`,
      );
      throw new UnauthorizedException('Tenant ID in token does not match X-Tenant-ID header');
    }

    // Verify tenant exists in Firestore
    const firestoreConfig = await this.configService.getTenantConfig(tenantIdHeader);
    if (!firestoreConfig) {
      this.logger.warn(`Tenant not found in Firestore: ${tenantIdHeader}`);
      throw new UnauthorizedException(`Tenant ${tenantIdHeader} not found in Firestore`);
    }

    // Attach user info to request for use in controllers
    request.user = {
      userId: payload.userId,
      tenantId: payload.tenantId,
      username: payload.username,
      name: payload.name,
      role: payload.role,
      linkedPatientId: payload.linkedPatientId,
    };

    this.logger.debug(`✅ Authentication successful for user: ${payload.username} (${payload.userId}) in tenant: ${payload.tenantId}`);

    return true;
  }
}

