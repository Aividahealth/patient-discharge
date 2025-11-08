import { Controller, Post, Body, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { AuthService } from './auth.service';
import type { LoginRequest, LoginResponse } from './types/user.types';
import { Public } from './auth.guard';

@Controller('api/auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  /**
   * POST /api/auth/login
   * Simple password-based login for any user
   */
  @Public()
  @Post('login')
  async login(@Body() request: LoginRequest): Promise<LoginResponse> {
    try {
      this.logger.log(`📝 Login request for user: ${request.username} in tenant: ${request.tenantId}`);

      // Validate request
      if (!request.tenantId || !request.username || !request.password) {
        throw new HttpException(
          {
            message: 'Missing required fields',
            error: 'tenantId, username, and password are required',
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      const response = await this.authService.login(request);

      this.logger.log(`✅ Login successful for user: ${request.username}`);
      return response;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(`❌ Login failed: ${error.message}`);
      throw new HttpException(
        {
          message: 'Login failed',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}

