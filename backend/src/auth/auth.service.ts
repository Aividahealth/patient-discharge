import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import * as fs from 'node:fs';
import { UserService } from './user.service';
import { DevConfigService } from '../config/dev-config.service';
import { ConfigService } from '../config/config.service';
import { LoginRequest, LoginResponse, JWTPayload } from './types/user.types';
import { resolveServiceAccountPath } from '../utils/path.helper';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly jwtSecret: string;
  private readonly jwtExpiresIn: number = 86400; // 24 hours in seconds

  constructor(
    private readonly userService: UserService,
    private readonly configService: DevConfigService,
    private readonly tenantConfigService: ConfigService,
  ) {
    // Get JWT secret from config.yaml or environment variable
    const config = this.configService.get();
    this.jwtSecret = config.jwt_secret || process.env.JWT_SECRET;

    // SECURITY: Enforce JWT secret configuration - no default fallback
    if (!this.jwtSecret) {
      const errorMsg = 'FATAL: JWT_SECRET must be configured. Set jwt_secret in config.yaml or JWT_SECRET environment variable.';
      this.logger.error(errorMsg);
      throw new Error(errorMsg);
    }

    // SECURITY: Validate secret strength (minimum 32 characters)
    if (this.jwtSecret.length < 32) {
      const errorMsg = `FATAL: JWT_SECRET must be at least 32 characters long. Current length: ${this.jwtSecret.length}`;
      this.logger.error(errorMsg);
      throw new Error(errorMsg);
    }

    this.logger.log('✅ JWT secret loaded and validated from config');
  }

  /**
   * Authenticate user and generate JWT token
   */
  async login(request: LoginRequest): Promise<LoginResponse> {
    this.logger.log(`Login attempt for user: ${request.username} in tenant: ${request.tenantId}`);

    // Find user by tenantId and username
    const user = await this.userService.findByUsername(request.tenantId, request.username);

    if (!user) {
      this.logger.warn(`User not found: ${request.username} in tenant: ${request.tenantId}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if account is active
    if (!user.isActive) {
      this.logger.warn(`Account is disabled for user: ${request.username}`);
      throw new UnauthorizedException('Account is disabled. Please contact your administrator.');
    }

    // Check if account is locked
    if (user.isLocked) {
      this.logger.warn(`Account is locked for user: ${request.username} (locked at: ${user.lockedAt})`);
      throw new UnauthorizedException('Account is locked due to multiple failed login attempts. Please contact your administrator to unlock your account.');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(request.password, user.passwordHash);
    if (!isPasswordValid) {
      this.logger.warn(`Invalid password for user: ${request.username} (attempt ${user.failedLoginAttempts + 1}/3)`);

      // Increment failed login attempts
      const newFailedAttempts = user.failedLoginAttempts + 1;
      const shouldLock = newFailedAttempts >= 3;

      await this.userService.update(user.id, {
        failedLoginAttempts: newFailedAttempts,
        lastFailedLoginAt: new Date(),
        ...(shouldLock && {
          isLocked: true,
          lockedAt: new Date(),
          lockedReason: 'Exceeded maximum failed login attempts (3)',
        }),
      });

      if (shouldLock) {
        this.logger.warn(`🔒 Account locked for user: ${request.username} after ${newFailedAttempts} failed attempts`);
        throw new UnauthorizedException('Account is locked due to multiple failed login attempts. Please contact your administrator to unlock your account.');
      }

      throw new UnauthorizedException('Invalid credentials');
    }


    // Reset failed login attempts on successful login
    if (user.failedLoginAttempts > 0) {
      await this.userService.update(user.id, {
        failedLoginAttempts: 0,
        lastSuccessfulLoginAt: new Date(),
      });
    } else {
      // Just update last successful login
      await this.userService.update(user.id, {
        lastSuccessfulLoginAt: new Date(),
      });
    }

    // For system admins, skip tenant config verification
    if (user.role === 'system_admin') {
      this.logger.log(`System admin login for user: ${user.username}`);
    } else {
      // Verify tenant exists (check Firestore first, then YAML config)
      const yamlTenantConfig = await this.configService.getTenantConfig(request.tenantId);
      if (!yamlTenantConfig) {
        this.logger.error(`Tenant configuration not found: ${request.tenantId}`);
        throw new UnauthorizedException('Tenant not found');
      }
    }

    // Generate JWT token
    const now = Math.floor(Date.now() / 1000);
    // Use user.tenantId if available, otherwise use request.tenantId (for system_admin)
    const tenantId = user.tenantId || request.tenantId;
    const payload: JWTPayload = {
      userId: user.id,
      tenantId: tenantId,
      username: user.username,
      name: user.name,
      role: user.role,
      linkedPatientId: user.linkedPatientId,
      exp: now + this.jwtExpiresIn,
      iat: now,
    };

    this.logger.log(`📝 Generated JWT token with payload:`, {
      userId: payload.userId,
      tenantId: payload.tenantId,
      username: payload.username,
      role: payload.role,
      linkedPatientId: payload.linkedPatientId,
      exp: new Date(payload.exp * 1000).toISOString(),
      iat: new Date(payload.iat * 1000).toISOString(),
    });

    const token = jwt.sign(payload, this.jwtSecret);

    this.logger.log(`✅ Login successful for user: ${user.username} (${user.id})`);

    // Build response with tenant branding from config
    let response: LoginResponse;

    if (user.role === 'system_admin') {
      // System admin gets a special tenant config
      response = {
        success: true,
        token,
        expiresIn: this.jwtExpiresIn,
        user: {
          id: user.id,
          tenantId: user.tenantId,
          username: user.username,
          name: user.name,
          role: user.role,
          linkedPatientId: user.linkedPatientId,
        },
        tenant: {
          id: 'system',
          name: 'System Administration',
          branding: {
            logo: 'https://storage.googleapis.com/logos/system-admin.png',
            primaryColor: '#7c3aed',
            secondaryColor: '#a78bfa',
          },
        },
      };
    } else {
      // Get tenant configuration from Firestore (with fallback to YAML)
      const tenantConfig = await this.tenantConfigService.getTenantConfigWithFallback(request.tenantId);

      if (!tenantConfig) {
        this.logger.warn(`Tenant configuration not found for: ${request.tenantId}, using defaults`);
      }

      response = {
        success: true,
        token,
        expiresIn: this.jwtExpiresIn,
        user: {
          id: user.id,
          tenantId: tenantId,
          username: user.username,
          name: user.name,
          role: user.role,
          linkedPatientId: user.linkedPatientId,
        },
        tenant: tenantConfig
          ? {
              id: tenantConfig.id,
              name: tenantConfig.name,
              branding: {
                logo: tenantConfig.branding.logo,
                primaryColor: tenantConfig.branding.primaryColor,
                secondaryColor: tenantConfig.branding.secondaryColor,
              },
            }
          : {
              // Fallback to defaults if config not found
              id: request.tenantId,
              name: `${request.tenantId} Hospital`,
              branding: {
                logo: `https://storage.googleapis.com/logos/${request.tenantId}.png`,
                primaryColor: '#3b82f6',
                secondaryColor: '#60a5fa',
              },
            },
      };
    }

    return response;
  }

  /**
   * Verify JWT token
   */
  async verifyToken(token: string): Promise<JWTPayload | null> {
    try {
      const payload = jwt.verify(token, this.jwtSecret) as JWTPayload;
      return payload;
    } catch (error) {
      this.logger.warn(`Token verification failed: ${error.message}`);
      return null;
    }
  }

  /**
   * Hash password (for creating users)
   */
  async hashPassword(password: string): Promise<string> {
    const saltRounds = 10;
    return bcrypt.hash(password, saltRounds);
  }

  /**
   * Verify Google OIDC token
   * Verifies JWT signature against Google certs and checks required claims
   */
  async verifyGoogleOIDCToken(
    token: string,
    serviceAccountPath: string,
  ): Promise<{ email: string; email_verified: boolean } | null> {
    try {
      // Validate token format before attempting verification
      if (!token || typeof token !== 'string') {
        this.logger.warn('Invalid token: token is empty or not a string');
        return null;
      }

      const tokenParts = token.split('.');
      if (tokenParts.length !== 3) {
        this.logger.warn(`Invalid token format: expected 3 segments, got ${tokenParts.length}`);
        return null;
      }

      // Try to read service account to get client_id for aud verification
      let clientId: string | undefined;

      const serviceAccountPathResolved = resolveServiceAccountPath(serviceAccountPath);
      if (fs.existsSync(serviceAccountPathResolved)) {
        const serviceAccountContent = fs.readFileSync(serviceAccountPathResolved, 'utf8');
        const serviceAccount = JSON.parse(serviceAccountContent);
        clientId = serviceAccount.client_id;
        this.logger.debug(`Using client_id from service account: ${clientId}`);
      } else {
        this.logger.debug(`Service account file not found at ${serviceAccountPathResolved}, will verify without audience check`);
      }

      // First, decode the token to check the audience
      const parts = token.split('.');
      const payloadB64 = parts[1];
      const decodedPayload = JSON.parse(Buffer.from(payloadB64, 'base64').toString());
      const tokenAudience = decodedPayload.aud;

      this.logger.debug(`Token audience: ${tokenAudience}`);

      // Verify the token
      const client = new OAuth2Client();
      let payload: any;

      try {
        // Check if the token's audience is a Cloud Run URL
        // Cloud Run identity tokens have audience = the target service URL
        const isCloudRunToken = typeof tokenAudience === 'string' &&
                               (tokenAudience.includes('.run.app') || tokenAudience.startsWith('https://'));

        if (isCloudRunToken) {
          // Cloud Run service-to-service token - verify signature but don't check audience
          // The audience will be the backend's Cloud Run URL
          this.logger.debug(`Detected Cloud Run identity token with audience: ${tokenAudience}`);
          try {
            const tokenInfo = await client.getTokenInfo(token);
            this.logger.debug(`Token info: email=${tokenInfo.email}, aud=${tokenInfo.aud}`);
          } catch (tokenInfoError) {
            this.logger.debug(`getTokenInfo failed: ${tokenInfoError.message}, continuing with signature verification`);
            // If getTokenInfo fails, try verifyIdToken without audience check
            const ticket = await client.verifyIdToken({
              idToken: token,
              // Don't specify audience - accept any valid Google-signed token
            });
            const verifiedPayload = ticket.getPayload();
            if (verifiedPayload) {
              payload = verifiedPayload;
              this.logger.debug(`Google OIDC verified using verifyIdToken (Cloud Run identity token)`);
            } else {
              throw new Error('Token verification returned no payload');
            }
          }
          if (!payload) {
            payload = decodedPayload; // Use the already-decoded payload if we got tokenInfo successfully
          }
          this.logger.debug(`Google OIDC verified (Cloud Run identity token)`);
        } else if (clientId && tokenAudience === clientId) {
          // Service account token with matching client_id - do full verification
          this.logger.debug(`Verifying token with audience check for client_id: ${clientId}`);
          const ticket = await client.verifyIdToken({
            idToken: token,
            audience: clientId,
          });
          payload = ticket.getPayload();
          this.logger.debug(`Google OIDC verified with audience check (client_id: ${clientId})`);
        } else {
          // Fallback: verify without audience check
          this.logger.debug(`Verifying token without audience check (audience: ${tokenAudience})`);
          const tokenInfo = await client.getTokenInfo(token);
          this.logger.debug(`Token info: email=${tokenInfo.email}, aud=${tokenInfo.aud}`);
          payload = decodedPayload;
          this.logger.debug(`Google OIDC verified without audience check`);
        }
      } catch (verifyError) {
        this.logger.warn(`Token verification failed: ${verifyError.message}`);
        throw verifyError;
      }


      if (!payload) {
        this.logger.warn('Google OIDC token verification returned no payload');
        return null;
      }

      // Check issuer (iss)
      const validIssuers = [
        'accounts.google.com',
        'https://accounts.google.com',
      ];
      if (!validIssuers.includes(payload.iss || '')) {
        this.logger.warn(`Invalid issuer: ${payload.iss}`);
        return null;
      }

      // Check email_verified
      if (payload.email_verified !== true) {
        this.logger.warn(`Email not verified for: ${payload.email}`);
        return null;
      }

      // Extract email
      const email = payload.email;
      if (!email) {
        this.logger.warn('Google OIDC token missing email claim');
        return null;
      }

      // Log token details for debugging
      this.logger.debug(`✅ Google OIDC token verified for email: ${email}, aud: ${payload.aud}`);
      return {
        email,
        email_verified: payload.email_verified === true,
      };
    } catch (error) {
      this.logger.warn(`Google OIDC token verification failed: ${error.message}`);
      return null;
    }
  }
}

