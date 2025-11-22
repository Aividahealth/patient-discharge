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
import { DevConfigService } from '../config/dev-config.service';
import { JWTPayload, AuthPayload } from './types/user.types';

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
    private readonly devConfigService: DevConfigService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // Skip authentication for OPTIONS (CORS preflight) requests
    if (request.method === 'OPTIONS') {
      return true;
    }

    // Check if route is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const { headers } = request;

    // Step 1: Check Authorization header exists
    const authHeader = headers.authorization || headers.Authorization;
    if (!authHeader) {
      this.logger.warn('Missing Authorization header');
      this.logger.debug(`Available headers: ${Object.keys(headers).join(', ')}`);
      throw new UnauthorizedException('Missing Authorization header. Expected: Bearer <token>');
    }
    
    if (!authHeader.startsWith('Bearer ')) {
      this.logger.warn(`Invalid Authorization header format. Header value: ${authHeader.substring(0, 50)}...`);
      throw new UnauthorizedException('Invalid Authorization header format. Expected: Bearer <token>');
    }

    const token = authHeader.substring(7).trim(); // Remove 'Bearer ' prefix and trim whitespace

    // Decode JWT header to check algorithm (for debugging)
    try {
      const headerB64 = token.split('.')[0];
      const header = JSON.parse(Buffer.from(headerB64, 'base64').toString());
      this.logger.debug(`[AuthGuard] Token header decoded: ${JSON.stringify(header)}`);
      
      // Also try to decode payload for debugging
      try {
        const payloadB64 = token.split('.')[1];
        const payload = JSON.parse(Buffer.from(payloadB64, 'base64').toString());
        this.logger.debug(`[AuthGuard] Token payload preview:`, {
          aud: payload.aud,
          iss: payload.iss,
          email: payload.email,
          email_verified: payload.email_verified,
          exp: payload.exp ? new Date(payload.exp * 1000).toISOString() : 'missing',
          iat: payload.iat ? new Date(payload.iat * 1000).toISOString() : 'missing',
        });
      } catch (payloadError) {
        this.logger.debug(`[AuthGuard] Could not decode token payload: ${payloadError.message}`);
      }
    } catch (e) {
      this.logger.debug(`[AuthGuard] Could not decode token header: ${e.message}`);
    }

    // Validate token format (JWT should have 3 parts separated by dots)
    if (!token || token.split('.').length !== 3) {
      this.logger.warn(`Invalid token format. Token length: ${token.length}, segments: ${token.split('.').length}`);
      this.logger.debug(`Token preview (first 50 chars): ${token.substring(0, 50)}`);
      throw new UnauthorizedException('Invalid token format. Expected JWT token with 3 segments.');
    }

    // Extract X-Tenant-ID header (required for both auth types)
    const tenantIdHeader = headers['x-tenant-id'];
    if (!tenantIdHeader) {
      this.logger.warn('Missing X-Tenant-ID header');
      throw new UnauthorizedException('Missing X-Tenant-ID header');
    }

    // Step 2: Try Google OIDC verification
    let authPayload: AuthPayload | null = null;

    try {
      const config = this.devConfigService.get();
      this.logger.debug(`[AuthGuard] Attempting Google OIDC verification`, {
        hasServiceAuthnPath: !!config.service_authn_path,
        serviceAuthnPath: config.service_authn_path,
        tenantId: tenantIdHeader,
      });

      if (config.service_authn_path) {
        const googleOidcResult = await this.authService.verifyGoogleOIDCToken(
          token,
          config.service_authn_path,
        );

        if (googleOidcResult) {
          // Google OIDC verification successful
          authPayload = {
            type: 'service',
            email: googleOidcResult.email,
            tenantId: tenantIdHeader,
          };
          this.logger.log(
            `[AuthGuard] ✅ Google OIDC authentication successful for service: ${googleOidcResult.email} in tenant: ${tenantIdHeader}`,
          );
        } else {
          this.logger.warn(`[AuthGuard] Google OIDC verification returned null (token invalid or verification failed)`);
        }
      } else {
        this.logger.debug(`[AuthGuard] service_authn_path not configured, skipping Google OIDC verification`);
      }
    } catch (error: any) {
      this.logger.error(`[AuthGuard] Google OIDC verification threw exception: ${error.message}`, {
        errorCode: error.code,
        errorName: error.name,
        errorStack: error.stack?.substring(0, 500),
      });
      // Continue to try app JWT verification
    }

    // Step 3: Try app JWT verification (if Google OIDC didn't succeed)
    if (!authPayload) {
      const jwtPayload = await this.authService.verifyToken(token);
      if (jwtPayload) {
        // Check token expiration
        const now = Math.floor(Date.now() / 1000);
        if (jwtPayload.exp && jwtPayload.exp < now) {
          this.logger.warn(`Token expired at ${new Date(jwtPayload.exp * 1000).toISOString()}`);
          throw new UnauthorizedException('Token has expired');
        }

        // Verify tenantId from token matches X-Tenant-ID header
        // Special handling for system_admin: can use any tenantId in header to access that tenant's resources
        if (jwtPayload.role === 'system_admin') {
          // System admin can access any tenant, so we allow any tenantId in the header
          // The tenantId will be validated later when accessing tenant-specific resources
          this.logger.debug(
            `System admin accessing tenant: ${tenantIdHeader}`,
          );
        } else if (jwtPayload.tenantId !== tenantIdHeader) {
          this.logger.warn(
            `Tenant ID mismatch: token has ${jwtPayload.tenantId}, header has ${tenantIdHeader}`,
          );
          throw new UnauthorizedException('Tenant ID in token does not match X-Tenant-ID header');
        }

        // App JWT verification successful
        authPayload = {
          type: 'user',
          userId: jwtPayload.userId,
          username: jwtPayload.username,
          name: jwtPayload.name,
          role: jwtPayload.role,
          tenantId: jwtPayload.tenantId ?? undefined, // Convert null to undefined
        };
        this.logger.debug(
          `✅ App JWT authentication successful for user: ${jwtPayload.username} (${jwtPayload.userId}) in tenant: ${jwtPayload.tenantId}`,
        );
      }
    }

    // Step 4: If both failed, return 401
    if (!authPayload) {
      this.logger.warn('Both Google OIDC and app JWT verification failed');
      throw new UnauthorizedException('Invalid or expired token');
    }

    // Verify tenant exists in Firestore (skip for 'system' tenant used by system_admin)
    if (tenantIdHeader !== 'system') {
      const firestoreConfig = await this.configService.getTenantConfig(tenantIdHeader);
      if (!firestoreConfig) {
        this.logger.warn(`Tenant not found in Firestore: ${tenantIdHeader}`);
        throw new UnauthorizedException(`Tenant ${tenantIdHeader} not found in Firestore`);
      }
    } else {
      this.logger.debug('Skipping Firestore tenant verification for system tenant');
    }

    // Attach auth info to request for use in controllers
    request.auth = authPayload;
    // Also set request.user for backward compatibility (if user type)
    if (authPayload.type === 'user') {
      request.user = {
        userId: authPayload.userId!,
        tenantId: authPayload.tenantId,
        username: authPayload.username!,
        name: authPayload.name!,
        role: authPayload.role!,
      };
    }

    return true;
  }
}

