import { Controller, Get, Post, Body, Query, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { CernerAuthService } from './cerner-auth.service';
import { SessionService } from './session.service';
import { TenantContext } from '../tenant/tenant.decorator';
import type { TenantContext as TenantContextType } from '../tenant/tenant-context';
import type {
  SSOInitiationRequest,
  SSOCallbackRequest,
} from './types/auth.types';
import { AuthType } from './types/auth.types';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly cernerAuthService: CernerAuthService,
    private readonly sessionService: SessionService,
  ) {}

  /**
   * Generate a random state parameter for OAuth
   */
  private generateState(): string {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }

  /**
   * Extract tenant ID from ISS URL
   */
  private extractTenantFromIss(iss: string): string | null {
    try {
      // For Cerner URLs like: https://fhir-ehr-code.cerner.com/r4/ec2458f2-1e24-41c8-b71b-0e701af7583d
      // Extract the tenant ID (the UUID part)
      const url = new URL(iss);
      const pathParts = url.pathname.split('/');
      
      // Look for UUID pattern in the path
      for (const part of pathParts) {
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(part)) {
          return part;
        }
      }
      
      // If no UUID found, try to extract from hostname or use a mapping
      if (url.hostname.includes('cerner.com')) {
        // You could implement a mapping here based on hostname
        return 'default';
      }
      
      return null;
    } catch (error) {
      this.logger.warn(`Failed to extract tenant from ISS: ${iss}`, error);
      return null;
    }
  }

  /**
   * Extract tenant ID from state parameter
   */
  private extractTenantFromState(state: string): string | null {
    try {
      // The state parameter could contain tenant information
      // For now, we'll look for UUID patterns in the state
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(state)) {
        return state;
      }
      
      // If state contains tenant info in a different format, parse it here
      // For example: "tenant:ec2458f2-1e24-41c8-b71b-0e701af7583d:random"
      const tenantMatch = state.match(/tenant:([0-9a-f-]+)/i);
      if (tenantMatch) {
        return tenantMatch[1];
      }
      
      return null;
    } catch (error) {
      this.logger.warn(`Failed to extract tenant from state: ${state}`, error);
      return null;
    }
  }

  /**
   * Handle SMART on FHIR launch (no tenant ID required)
   */
  @Get('launch')
  async handleLaunch(
    @Query('iss') iss?: string,
    @Query('launch') launch?: string,
  ) {
    try {
      this.logger.log(`🚀 SMART on FHIR launch received - ISS: ${iss}, Launch: ${launch}`);
      
      if (!iss || !launch) {
        throw new HttpException(
          {
            message: 'Missing required parameters',
            error: 'Both iss and launch parameters are required',
            received: { iss, launch },
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      // Extract tenant ID from ISS URL or use default
      const tenantId = this.extractTenantFromIss(iss) || 'default';
      
      // Create a minimal context for the launch
      const ctx: TenantContextType = {
        tenantId,
        timestamp: new Date(),
        requestId: `launch-${Date.now()}`,
      };

      // Generate state for security (include tenant info for callback)
      const state = `tenant:${tenantId}:${this.generateState()}`;
      
      this.logger.log(`🚀 Launch request details:`, {
        tenant_id: tenantId,
        launch_context: launch,
        state: state,
        issuer: iss,
      });
      
      // Initiate SSO with launch context
      const request: SSOInitiationRequest = {
        redirect_uri: undefined, // Will use default from config
        state,
        launch,
      };

      this.logger.log(`🔄 Calling initiateProviderSSO with:`, {
        redirect_uri: request.redirect_uri,
        state: request.state,
        launch: request.launch,
      });

      const authUrl = await this.cernerAuthService.initiateProviderSSO(ctx, request);
      
      return {
        success: true,
        message: 'Launch initiated successfully',
        authorization_url: authUrl,
        state,
        launch_context: launch,
        issuer: iss,
        tenant_id: tenantId,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        {
          message: 'Failed to handle launch',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Initiate Cerner SSO for provider app
   */
  @Get('cerner/authorize')
  async initiateSSO(
    @TenantContext() ctx: TenantContextType,
    @Query('redirect_uri') redirectUri?: string,
    @Query('state') state?: string,
    @Query('launch') launch?: string,
  ) {
    try {
      const request: SSOInitiationRequest = {
        redirect_uri: redirectUri,
        state,
        launch,
      };

      const authUrl = await this.cernerAuthService.initiateProviderSSO(ctx, request);
      
      return {
        success: true,
        authorization_url: authUrl,
        state: state || 'generated-state',
      };
    } catch (error) {
      throw new HttpException(
        {
          message: 'Failed to initiate SSO',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Handle Cerner SSO callback (GET - for browser redirects)
   */
  @Get('cerner/callback')
  async handleSSOCallbackGet(
    @Query('code') code?: string,
    @Query('state') state?: string,
    @Query('session_state') sessionState?: string,
    @Query('error') error?: string,
    @Query('error_description') errorDescription?: string,
    @Query('error_uri') errorUri?: string,
    @Query() allParams?: any,
  ) {
    try {
      // Log all incoming parameters
      this.logger.log('🔄 Cerner callback received with full details:');
      this.logger.log(`  - Code: ${code ? 'present (' + code.substring(0, 10) + '...)' : 'missing'}`);
      this.logger.log(`  - State: ${state || 'missing'}`);
      this.logger.log(`  - Session State: ${sessionState || 'missing'}`);
      this.logger.log(`  - Error: ${error || 'none'}`);
      this.logger.log(`  - Error Description: ${errorDescription || 'none'}`);
      this.logger.log(`  - Error URI: ${errorUri || 'none'}`);
      this.logger.log(`  - All Query Params:`, JSON.stringify(allParams, null, 2));
      
      if (error) {
        this.logger.error(`❌ Cerner authorization failed:`, {
          error,
          error_description: errorDescription,
          error_uri: errorUri,
          all_params: allParams,
        });
        return {
          success: false,
          message: 'Cerner authorization failed',
          error: error,
          error_description: errorDescription,
          error_uri: errorUri,
          debug_info: {
            received_params: allParams,
            timestamp: new Date().toISOString(),
          },
        };
      }

      if (!code || !state) {
        this.logger.error(`❌ Missing required callback parameters:`, {
          has_code: !!code,
          has_state: !!state,
          all_params: allParams,
        });
        return {
          success: false,
          message: 'Missing required callback parameters',
          received: { 
            code: !!code, 
            state: !!state,
            all_params: allParams,
          },
        };
      }

      // Extract tenant ID from state or use default
      const tenantId = this.extractTenantFromState(state) || 'ec2458f2-1e24-41c8-b71b-0e701af7583d';
      this.logger.log(`🏥 Using tenant ID: ${tenantId}`);
      
      const ctx: TenantContextType = {
        tenantId,
        timestamp: new Date(),
        requestId: `callback-${Date.now()}`,
      };

      const request: SSOCallbackRequest = {
        code,
        state,
        session_state: sessionState,
      };

      this.logger.log(`🔄 Attempting to handle provider callback with:`, {
        tenant_id: tenantId,
        code_length: code.length,
        state,
        session_state: sessionState,
      });

      const session = await this.cernerAuthService.handleProviderCallback(ctx, request);
      
      this.logger.log(`✅ SSO callback successful:`, {
        session_id: session.id,
        user_id: session.userId,
        tenant_id: session.tenantId,
        auth_type: session.authType,
        expires_at: session.expiresAt,
      });
      
      return {
        success: true,
        message: 'SSO callback successful',
        session_id: session.id,
        user_id: session.userId,
        tenant_id: session.tenantId,
        auth_type: session.authType,
        expires_at: session.expiresAt,
      };
    } catch (error) {
      this.logger.error('💥 Callback error:', {
        error: error.message,
        stack: error.stack,
        received_params: {
          code: code ? 'present' : 'missing',
          state,
          session_state: sessionState,
          error,
          error_description: errorDescription,
          all_params: allParams,
        },
      });
      return {
        success: false,
        message: 'Failed to handle SSO callback',
        error: error.message,
        debug_info: {
          error_stack: error.stack,
          received_params: allParams,
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  /**
   * Handle Cerner SSO callback (POST - for programmatic calls)
   */
  @Post('cerner/callback')
  async handleSSOCallback(
    @Body() body: SSOCallbackRequest,
  ) {
    try {
      // Extract tenant ID from state or use default
      const tenantId = this.extractTenantFromState(body.state) || 'ec2458f2-1e24-41c8-b71b-0e701af7583d';
      
      const ctx: TenantContextType = {
        tenantId,
        timestamp: new Date(),
        requestId: `callback-post-${Date.now()}`,
      };

      const session = await this.cernerAuthService.handleProviderCallback(ctx, body);
      
      return {
        success: true,
        session_id: session.id,
        user_id: session.userId,
        tenant_id: session.tenantId,
        auth_type: session.authType,
        expires_at: session.expiresAt,
      };
    } catch (error) {
      throw new HttpException(
        {
          message: 'Failed to handle SSO callback',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Refresh provider app tokens
   */
  @Post('cerner/refresh')
  async refreshTokens(
    @TenantContext() ctx: TenantContextType,
    @Body() body: { session_id: string },
  ) {
    try {
      const session = this.sessionService.getSession(body.session_id);
      if (!session) {
        throw new HttpException(
          {
            message: 'Session not found',
            session_id: body.session_id,
          },
          HttpStatus.NOT_FOUND,
        );
      }

      if (session.tenantId !== ctx.tenantId) {
        throw new HttpException(
          {
            message: 'Session does not belong to this tenant',
            session_id: body.session_id,
            tenant_id: ctx.tenantId,
          },
          HttpStatus.FORBIDDEN,
        );
      }

      const newTokens = await this.cernerAuthService.refreshProviderTokens(session);
      
      return {
        success: true,
        session_id: session.id,
        tokens: {
          access_token: newTokens.access_token,
          expires_in: newTokens.expires_in,
          token_type: newTokens.token_type,
        },
        expires_at: new Date(Date.now() + (newTokens.expires_in * 1000)),
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        {
          message: 'Failed to refresh tokens',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get session information
   */
  @Get('session/:sessionId')
  async getSession(
    @TenantContext() ctx: TenantContextType,
    @Query('sessionId') sessionId: string,
  ) {
    try {
      const session = this.sessionService.getSession(sessionId);
      if (!session) {
        throw new HttpException(
          {
            message: 'Session not found',
            session_id: sessionId,
          },
          HttpStatus.NOT_FOUND,
        );
      }

      if (session.tenantId !== ctx.tenantId) {
        throw new HttpException(
          {
            message: 'Session does not belong to this tenant',
            session_id: sessionId,
            tenant_id: ctx.tenantId,
          },
          HttpStatus.FORBIDDEN,
        );
      }

      return {
        success: true,
        session: {
          id: session.id,
          user_id: session.userId,
          tenant_id: session.tenantId,
          auth_type: session.authType,
          expires_at: session.expiresAt,
          created_at: session.createdAt,
          last_accessed_at: session.lastAccessedAt,
          is_valid: this.sessionService.isSessionValid(sessionId),
        },
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        {
          message: 'Failed to get session',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get all active sessions for the tenant
   */
  @Get('sessions')
  async getActiveSessions(
    @TenantContext() ctx: TenantContextType,
    @Query('authType') authType?: AuthType,
  ) {
    try {
      const sessions = this.sessionService.getActiveSessions(ctx.tenantId, authType);
      
      return {
        success: true,
        sessions: sessions.map(session => ({
          id: session.id,
          user_id: session.userId,
          auth_type: session.authType,
          expires_at: session.expiresAt,
          created_at: session.createdAt,
          last_accessed_at: session.lastAccessedAt,
        })),
        count: sessions.length,
      };
    } catch (error) {
      throw new HttpException(
        {
          message: 'Failed to get active sessions',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Remove a session
   */
  @Post('session/:sessionId/revoke')
  async revokeSession(
    @TenantContext() ctx: TenantContextType,
    @Query('sessionId') sessionId: string,
  ) {
    try {
      const session = this.sessionService.getSession(sessionId);
      if (!session) {
        throw new HttpException(
          {
            message: 'Session not found',
            session_id: sessionId,
          },
          HttpStatus.NOT_FOUND,
        );
      }

      if (session.tenantId !== ctx.tenantId) {
        throw new HttpException(
          {
            message: 'Session does not belong to this tenant',
            session_id: sessionId,
            tenant_id: ctx.tenantId,
          },
          HttpStatus.FORBIDDEN,
        );
      }

      const removed = this.sessionService.removeSession(sessionId);
      
      return {
        success: removed,
        message: removed ? 'Session revoked successfully' : 'Failed to revoke session',
        session_id: sessionId,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        {
          message: 'Failed to revoke session',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get session statistics
   */
  @Get('stats')
  async getSessionStats(@TenantContext() ctx: TenantContextType) {
    try {
      const stats = this.sessionService.getSessionStats();
      
      return {
        success: true,
        stats,
      };
    } catch (error) {
      throw new HttpException(
        {
          message: 'Failed to get session statistics',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
