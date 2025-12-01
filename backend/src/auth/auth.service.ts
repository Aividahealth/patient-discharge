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
    this.jwtSecret = config.jwt_secret || process.env.JWT_SECRET || 'your-secret-key-change-in-production';
    
    if (this.jwtSecret === 'your-secret-key-change-in-production') {
      this.logger.warn('⚠️ Using default JWT secret. Set jwt_secret in config.yaml or JWT_SECRET environment variable for production!');
    } else {
      this.logger.log('✅ JWT secret loaded from config');
    }
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
    const logContext = {
      tokenLength: token?.length || 0,
      tokenPreview: token ? `${token.substring(0, 20)}...${token.substring(token.length - 20)}` : 'null',
    };

    // Declare variables in outer scope for error logging
    let tokenAudience: string | undefined;
    let tokenIssuer: string | undefined;
    let tokenEmail: string | undefined;

    this.logger.log(`[GoogleOIDC] Starting token verification`, logContext);

    try {
      // Validate token format before attempting verification
      if (!token || typeof token !== 'string') {
        this.logger.warn(`[GoogleOIDC] Invalid token: token is empty or not a string`, logContext);
        return null;
      }

      const tokenParts = token.split('.');
      if (tokenParts.length !== 3) {
        this.logger.warn(`[GoogleOIDC] Invalid token format: expected 3 segments, got ${tokenParts.length}`, logContext);
        return null;
      }

      // Try to read service account to get client_id for aud verification
      let clientId: string | undefined;

      const serviceAccountPathResolved = resolveServiceAccountPath(serviceAccountPath);
      this.logger.debug(`[GoogleOIDC] Checking service account file at: ${serviceAccountPathResolved}`);
      
      if (fs.existsSync(serviceAccountPathResolved)) {
        const serviceAccountContent = fs.readFileSync(serviceAccountPathResolved, 'utf8');
        const serviceAccount = JSON.parse(serviceAccountContent);
        clientId = serviceAccount.client_id;
        this.logger.log(`[GoogleOIDC] Using client_id from service account: ${clientId}`);
      } else {
        this.logger.warn(`[GoogleOIDC] Service account file not found at ${serviceAccountPathResolved}, will verify without audience check`);
      }

      // First, decode the token to check the audience
      let decodedPayload: any;
      let tokenEmailVerified: boolean | undefined;

      try {
        const parts = token.split('.');
        const payloadB64 = parts[1];
        decodedPayload = JSON.parse(Buffer.from(payloadB64, 'base64').toString());
        tokenAudience = decodedPayload.aud;
        tokenIssuer = decodedPayload.iss;
        tokenEmail = decodedPayload.email;
        tokenEmailVerified = decodedPayload.email_verified;

        this.logger.log(`[GoogleOIDC] Decoded token payload:`, {
          aud: tokenAudience || 'missing (not a Google Identity token?)',
          iss: tokenIssuer || 'missing (not a Google Identity token?)',
          email: tokenEmail || 'missing (not a Google Identity token?)',
          email_verified: tokenEmailVerified || 'missing',
          exp: decodedPayload.exp ? new Date(decodedPayload.exp * 1000).toISOString() : 'missing',
          iat: decodedPayload.iat ? new Date(decodedPayload.iat * 1000).toISOString() : 'missing',
          sub: decodedPayload.sub || 'missing',
          allKeys: Object.keys(decodedPayload).join(', '),
          tokenType: tokenIssuer ? 'Google Identity Token' : (decodedPayload.userId || decodedPayload.username ? 'App JWT Token' : 'Unknown Token Type'),
        });
      } catch (decodeError) {
        this.logger.error(`[GoogleOIDC] Failed to decode token payload: ${decodeError.message}`, decodeError);
        return null;
      }

      // Verify the token
      const client = new OAuth2Client();
      let payload: any;
      let verificationMethod = 'unknown';

      try {
        // Check if the token's audience is a Cloud Run URL
        // Cloud Run identity tokens have audience = the target service URL
        const isCloudRunToken = typeof tokenAudience === 'string' &&
                               (tokenAudience.includes('.run.app') || tokenAudience.startsWith('https://'));

        if (isCloudRunToken) {
          // Cloud Run service-to-service token - verify signature but don't check audience
          // The audience will be the backend's Cloud Run URL
          this.logger.log(`[GoogleOIDC] Detected Cloud Run identity token with audience: ${tokenAudience}`);
          verificationMethod = 'cloud-run-token';
          
          try {
            this.logger.debug(`[GoogleOIDC] Attempting getTokenInfo() for Cloud Run token`);
            const tokenInfo = await client.getTokenInfo(token);
            this.logger.log(`[GoogleOIDC] getTokenInfo() succeeded: email=${tokenInfo.email}, aud=${tokenInfo.aud}`);
            payload = decodedPayload; // Use decoded payload if getTokenInfo succeeds
          } catch (tokenInfoError: any) {
            this.logger.warn(`[GoogleOIDC] getTokenInfo() failed: ${tokenInfoError.message}`, {
              errorCode: tokenInfoError.code,
              errorStack: tokenInfoError.stack?.substring(0, 500),
            });
            this.logger.debug(`[GoogleOIDC] Falling back to verifyIdToken() without audience check`);
            
            // If getTokenInfo fails, try verifyIdToken without audience check
            try {
              const ticket = await client.verifyIdToken({
                idToken: token,
                // Don't specify audience - accept any valid Google-signed token
              });
              const verifiedPayload = ticket.getPayload();
              if (verifiedPayload) {
                payload = verifiedPayload;
                this.logger.log(`[GoogleOIDC] verifyIdToken() succeeded (Cloud Run identity token)`);
                verificationMethod = 'verifyIdToken-no-audience';
              } else {
                throw new Error('Token verification returned no payload');
              }
            } catch (verifyIdTokenError: any) {
              this.logger.error(`[GoogleOIDC] verifyIdToken() failed: ${verifyIdTokenError.message}`, {
                errorCode: verifyIdTokenError.code,
                errorStack: verifyIdTokenError.stack?.substring(0, 500),
              });
              throw verifyIdTokenError;
            }
          }
        } else if (clientId && tokenAudience === clientId) {
          // Service account token with matching client_id - do full verification
          this.logger.log(`[GoogleOIDC] Verifying token with audience check for client_id: ${clientId}`);
          verificationMethod = 'verifyIdToken-with-audience';
          
          const ticket = await client.verifyIdToken({
            idToken: token,
            audience: clientId,
          });
          payload = ticket.getPayload();
          this.logger.log(`[GoogleOIDC] verifyIdToken() with audience check succeeded`);
        } else {
          // Fallback: verify without audience check
          this.logger.log(`[GoogleOIDC] Verifying token without audience check (audience: ${tokenAudience}, clientId: ${clientId})`);
          verificationMethod = 'fallback-no-audience';
          
          try {
            const tokenInfo = await client.getTokenInfo(token);
            this.logger.log(`[GoogleOIDC] getTokenInfo() succeeded: email=${tokenInfo.email}, aud=${tokenInfo.aud}`);
            payload = decodedPayload;
          } catch (tokenInfoError: any) {
            this.logger.error(`[GoogleOIDC] getTokenInfo() failed in fallback: ${tokenInfoError.message}`, {
              errorCode: tokenInfoError.code,
              errorStack: tokenInfoError.stack?.substring(0, 500),
            });
            throw tokenInfoError;
          }
        }
      } catch (verifyError: any) {
        this.logger.error(`[GoogleOIDC] Token verification failed`, {
          method: verificationMethod,
          error: verifyError.message,
          errorCode: verifyError.code,
          errorName: verifyError.name,
          tokenAudience: tokenAudience || 'undefined',
          tokenIssuer: tokenIssuer || 'undefined',
          tokenEmail: tokenEmail || 'undefined',
          clientId: clientId || 'undefined',
          serviceAccountPath: serviceAccountPathResolved,
          decodedPayloadKeys: decodedPayload ? Object.keys(decodedPayload).join(', ') : 'failed to decode',
          decodedPayloadSample: decodedPayload ? JSON.stringify(decodedPayload).substring(0, 500) : 'failed to decode',
          errorStack: verifyError.stack?.substring(0, 1000),
        });
        throw verifyError;
      }

      if (!payload) {
        this.logger.error(`[GoogleOIDC] Token verification returned no payload`, {
          verificationMethod,
          tokenAudience,
          tokenIssuer,
        });
        return null;
      }

      // Check issuer (iss)
      const validIssuers = [
        'accounts.google.com',
        'https://accounts.google.com',
      ];
      const payloadIss = payload.iss || '';
      if (!validIssuers.includes(payloadIss)) {
        this.logger.error(`[GoogleOIDC] Invalid issuer: ${payloadIss}`, {
          validIssuers,
          payloadIss,
          tokenAudience,
          tokenEmail: payload.email,
        });
        return null;
      }

      // Check email_verified
      const emailVerified = payload.email_verified;
      if (emailVerified !== true) {
        this.logger.error(`[GoogleOIDC] Email not verified`, {
          email: payload.email,
          email_verified: emailVerified,
          tokenAudience,
        });
        return null;
      }

      // Extract email
      const email = payload.email;
      if (!email) {
        this.logger.error(`[GoogleOIDC] Token missing email claim`, {
          payloadKeys: Object.keys(payload),
          tokenAudience,
        });
        return null;
      }

      // Log successful verification
      this.logger.log(`[GoogleOIDC] ✅ Token verified successfully`, {
        email,
        email_verified: emailVerified,
        aud: payload.aud,
        iss: payload.iss,
        verificationMethod,
      });

      return {
        email,
        email_verified: emailVerified === true,
      };
    } catch (error: any) {
      // Determine if this is an expected failure (App JWT token) or unexpected (Google Identity token)
      const isExpectedFailure = !tokenAudience || 
                                (!tokenIssuer || !tokenIssuer.includes('google.com')) ||
                                (!tokenEmail && !tokenAudience?.includes('.run.app'));
      
      if (isExpectedFailure) {
        // This is likely an App JWT token trying Google OIDC first - expected to fail
        this.logger.debug(`[GoogleOIDC] Token verification failed (expected for App JWT tokens, will fallback to App JWT verification)`, {
          error: error.message,
          tokenType: 'App JWT (expected failure)',
          tokenAudience: tokenAudience || 'missing (not a Google Identity token)',
          tokenIssuer: tokenIssuer || 'missing (not a Google Identity token)',
        });
      } else {
        // This is a Google Identity token that should have worked - unexpected failure
        this.logger.error(`[GoogleOIDC] ❌ Token verification failed with exception (unexpected - this was a Google Identity token)`, {
          error: error.message,
          errorCode: error.code,
          errorName: error.name,
          errorStack: error.stack?.substring(0, 1000),
          tokenAudience: tokenAudience || 'undefined',
          tokenIssuer: tokenIssuer || 'undefined',
          tokenEmail: tokenEmail || 'undefined',
          tokenLength: token?.length || 0,
          tokenPreview: token ? `${token.substring(0, 30)}...${token.substring(Math.max(0, token.length - 30))}` : 'null',
        });
      }
      return null;
    }
  }
}

