import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as qs from 'qs';
import { DevConfigService } from '../config/dev-config.service';
import { SessionService } from './session.service';
import { TenantContext } from '../tenant/tenant-context';
import {
  AuthType,
  SystemAppConfig,
  ProviderAppConfig,
  AuthTokens,
  UserSession,
  SSOInitiationRequest,
  SSOCallbackRequest,
} from './types/auth.types';

@Injectable()
export class CernerAuthService {
  private readonly logger = new Logger(CernerAuthService.name);

  constructor(
    private readonly configService: DevConfigService,
    private readonly sessionService: SessionService,
  ) {}

  /**
   * Authenticate using system app (client credentials flow)
   */
  async authenticateSystemApp(ctx: TenantContext): Promise<AuthTokens> {
    this.logger.log(`Authenticating system app for tenant: ${ctx.tenantId}`);

    const config = this.getSystemAppConfig(ctx.tenantId);
    if (!config) {
      throw new Error(`System app configuration not found for tenant: ${ctx.tenantId}`);
    }

    const credentials = Buffer.from(`${config.client_id}:${config.client_secret}`).toString('base64');
    const headers = {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    };

    const data = qs.stringify({
      grant_type: 'client_credentials',
      scope: config.scopes,
    });

    try {
      const response = await axios.post(config.token_url, data, { headers });
      const tokens: AuthTokens = {
        access_token: response.data.access_token,
        expires_in: response.data.expires_in || 3600,
        token_type: response.data.token_type || 'Bearer',
        scope: response.data.scope,
      };

      this.logger.log(`System app authentication successful for tenant: ${ctx.tenantId}`);
      return tokens;
    } catch (error) {
      this.logger.error(`System app authentication failed for tenant: ${ctx.tenantId}`, error);
      throw new Error(`System app authentication failed: ${error.message}`);
    }
  }

  /**
   * Initiate provider app SSO (authorization code flow)
   */
  async initiateProviderSSO(
    ctx: TenantContext,
    request: SSOInitiationRequest,
  ): Promise<string> {
    this.logger.log(`Initiating provider SSO for tenant: ${ctx.tenantId}`);

    const config = this.getProviderAppConfig(ctx.tenantId);
    if (!config) {
      throw new Error(`Provider app configuration not found for tenant: ${ctx.tenantId}`);
    }

    // Get the FHIR server base URL for the audience parameter
    const cernerConfig = this.configService.getTenantCernerConfig(ctx.tenantId);
    const fhirBaseUrl = cernerConfig?.base_url;
    
    if (!fhirBaseUrl) {
      throw new Error(`FHIR base URL not found for tenant: ${ctx.tenantId}`);
    }

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: config.client_id,
      redirect_uri: request.redirect_uri || config.redirect_uri,
      scope: config.scopes,
      state: request.state || this.generateState(),
      aud: fhirBaseUrl, // Add the audience parameter
    });

    // Always add launch parameter if provided
    if (request.launch) {
      params.append('launch', request.launch);
      this.logger.log(`Adding launch parameter: ${request.launch}`);
    } else {
      this.logger.warn(`No launch parameter provided in request`);
    }

    const authUrl = `${config.authorization_url}?${params.toString()}`;
    this.logger.log(`Generated authorization URL for tenant: ${ctx.tenantId} with audience: ${fhirBaseUrl}`);
    this.logger.log(`Authorization URL: ${authUrl}`);
    
    return authUrl;
  }

  /**
   * Handle provider app callback (exchange code for tokens)
   */
  async handleProviderCallback(
    ctx: TenantContext,
    request: SSOCallbackRequest,
  ): Promise<UserSession> {
    this.logger.log(`Handling provider callback for tenant: ${ctx.tenantId}`);

    const config = this.getProviderAppConfig(ctx.tenantId);
    if (!config) {
      throw new Error(`Provider app configuration not found for tenant: ${ctx.tenantId}`);
    }

    this.logger.log(`🔑 Token exchange details:`, {
      client_id: config.client_id,
      client_secret: config.client_secret ? 'present' : 'missing',
      token_url: config.token_url,
      redirect_uri: config.redirect_uri,
      code: request.code ? 'present' : 'missing',
      state: request.state,
    });

    // Use client_id as form parameter if client_secret is empty, otherwise use Basic auth
    let headers: any = {
      'Content-Type': 'application/x-www-form-urlencoded',
    };

    let data: any = {
      grant_type: 'authorization_code',
      code: request.code,
      redirect_uri: config.redirect_uri,
    };

    if (config.client_secret && config.client_secret.trim() !== '') {
      // Use Basic authentication with client credentials
      data.client_id = config.client_id;
      data.client_secret = config.client_secret;
      this.logger.log(`🔐 Using Basic authentication with client credentials`);
    } else {
      // Use client_id as form parameter (public client)
      data.client_id = config.client_id;
      this.logger.log(`🔓 Using client_id as form parameter (public client)`);
    }

    const dataString = qs.stringify(data);

    this.logger.log(`🔄 Making token request to: ${config.token_url}`);
    this.logger.log(`📤 Request data:`, {
      grant_type: 'authorization_code',
      code: request.code ? 'present' : 'missing',
      redirect_uri: config.redirect_uri,
      client_id: data.client_id ? 'present' : 'missing',
      auth_method: headers.Authorization ? 'Basic' : 'Form parameter',
    });

    try {
      const response = await axios.post(config.token_url, dataString, { headers });
      
      this.logger.log(`✅ Token exchange successful:`, {
        access_token: response.data.access_token ? 'present' : 'missing',
        refresh_token: response.data.refresh_token ? 'present' : 'missing',
        expires_in: response.data.expires_in,
        token_type: response.data.token_type,
        scope: response.data.scope,
      });

      const tokens: AuthTokens = {
        access_token: response.data.access_token,
        refresh_token: response.data.refresh_token,
        expires_in: response.data.expires_in || 3600,
        token_type: response.data.token_type || 'Bearer',
        scope: response.data.scope,
      };

      // Extract user ID from token or response
      const userId = this.extractUserIdFromToken(tokens.access_token);
      
      // Create user session
      const session = this.sessionService.createSession(
        userId,
        ctx.tenantId,
        AuthType.PROVIDER,
        tokens,
      );

      this.logger.log(`Provider callback successful for user: ${userId}, tenant: ${ctx.tenantId}`);
      return session;
    } catch (error) {
      this.logger.error(`❌ Provider callback failed for tenant: ${ctx.tenantId}`, {
        error: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        response_data: error.response?.data,
        request_url: config.token_url,
        request_headers: headers,
        request_data: dataString,
      });
      throw new Error(`Provider callback failed: ${error.message}`);
    }
  }

  /**
   * Refresh provider app tokens
   */
  async refreshProviderTokens(session: UserSession): Promise<AuthTokens> {
    this.logger.log(`Refreshing tokens for session: ${session.id}`);

    if (!session.tokens.refresh_token) {
      throw new Error('No refresh token available for session');
    }

    const config = this.getProviderAppConfig(session.tenantId);
    if (!config) {
      throw new Error(`Provider app configuration not found for tenant: ${session.tenantId}`);
    }

    const credentials = Buffer.from(`${config.client_id}:${config.client_secret}`).toString('base64');
    const headers = {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    };

    const data = qs.stringify({
      grant_type: 'refresh_token',
      refresh_token: session.tokens.refresh_token,
    });

    try {
      const response = await axios.post(config.token_url, data, { headers });
      const newTokens: AuthTokens = {
        access_token: response.data.access_token,
        refresh_token: response.data.refresh_token || session.tokens.refresh_token,
        expires_in: response.data.expires_in || 3600,
        token_type: response.data.token_type || 'Bearer',
        scope: response.data.scope,
      };

      // Update session with new tokens
      this.sessionService.updateSessionTokens(session.id, newTokens);

      this.logger.log(`Tokens refreshed successfully for session: ${session.id}`);
      return newTokens;
    } catch (error) {
      this.logger.error(`Token refresh failed for session: ${session.id}`, error);
      throw new Error(`Token refresh failed: ${error.message}`);
    }
  }

  /**
   * Get system app configuration for tenant
   */
  private getSystemAppConfig(tenantId: string): SystemAppConfig | null {
    const tenantConfig = this.configService.getTenantConfig(tenantId);
    return tenantConfig?.cerner?.system_app || null;
  }

  /**
   * Get provider app configuration for tenant
   */
  private getProviderAppConfig(tenantId: string): ProviderAppConfig | null {
    const tenantConfig = this.configService.getTenantConfig(tenantId);
    return tenantConfig?.cerner?.provider_app || null;
  }

  /**
   * Generate a random state parameter for OAuth
   */
  private generateState(): string {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }

  /**
   * Extract user ID from access token (JWT decode)
   */
  private extractUserIdFromToken(accessToken: string): string {
    try {
      // Simple JWT decode (you might want to use a proper JWT library)
      const parts = accessToken.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid JWT token format');
      }

      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
      
      // Try different possible user ID fields
      return payload.sub || 
             payload.user_id || 
             payload.patient || 
             payload.practitioner ||
             `user-${Date.now()}`; // Fallback
    } catch (error) {
      this.logger.warn('Failed to extract user ID from token, using fallback');
      return `user-${Date.now()}`;
    }
  }

  /**
   * Validate that a tenant has the required configuration
   */
  validateTenantConfig(tenantId: string, authType: AuthType): boolean {
    if (authType === AuthType.SYSTEM) {
      return this.getSystemAppConfig(tenantId) !== null;
    } else {
      return this.getProviderAppConfig(tenantId) !== null;
    }
  }
}
