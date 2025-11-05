import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { UserService } from './user.service';
import { DevConfigService } from '../config/dev-config.service';
import { ConfigService } from '../config/config.service';
import { LoginRequest, LoginResponse, JWTPayload } from './types/user.types';

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

    // Verify password
    const isPasswordValid = await bcrypt.compare(request.password, user.passwordHash);
    if (!isPasswordValid) {
      this.logger.warn(`Invalid password for user: ${request.username}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify tenant exists (check Firestore first, then YAML config)
    const yamlTenantConfig = await this.configService.getTenantConfig(request.tenantId);
    if (!yamlTenantConfig) {
      this.logger.error(`Tenant configuration not found: ${request.tenantId}`);
      throw new UnauthorizedException('Tenant not found');
    }

    // Generate JWT token
    const now = Math.floor(Date.now() / 1000);
    const payload: JWTPayload = {
      userId: user.id,
      tenantId: user.tenantId,
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

    // Get tenant configuration from Firestore (with fallback to YAML)
    const tenantConfig = await this.tenantConfigService.getTenantConfigWithFallback(request.tenantId);
    
    if (!tenantConfig) {
      this.logger.warn(`Tenant configuration not found for: ${request.tenantId}, using defaults`);
    }

    // Build response with tenant branding from config
    const response: LoginResponse = {
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
}

