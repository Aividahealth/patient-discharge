import { Controller, Post, Body, HttpException, HttpStatus, Logger, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import type { LoginResponse } from './types/user.types';
import { Public } from './auth.guard';
import { LoginDto } from './dto/login.dto';

@Controller('api/auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  /**
   * POST /api/auth/login
   * Simple password-based login for any user
   * SECURITY: Sets JWT token in HttpOnly cookie instead of response body
   * SECURITY: Input validation via LoginDto prevents injection attacks
   */
  @Public()
  @Post('login')
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<Omit<LoginResponse, 'token'>> {
    try {
      this.logger.log(`📝 Login request for user: ${loginDto.username} in tenant: ${loginDto.tenantId}`);

      // Convert DTO to LoginRequest (validation already done by ValidationPipe)
      const loginRequest = {
        tenantId: loginDto.tenantId,
        username: loginDto.username,
        password: loginDto.password,
      };

      const loginResponse = await this.authService.login(loginRequest);

      // SECURITY: Set JWT token in HttpOnly cookie (not accessible to JavaScript)
      response.cookie('auth_token', loginResponse.token, {
        httpOnly: true,        // Not accessible via JavaScript (XSS protection)
        secure: process.env.NODE_ENV === 'production', // HTTPS only in production
        sameSite: 'strict',    // CSRF protection
        maxAge: loginResponse.expiresIn * 1000, // Convert seconds to milliseconds
        path: '/',
      });

      this.logger.log(`✅ Login successful for user: ${loginDto.username} - token set in HttpOnly cookie`);

      // Return response WITHOUT token (token is in cookie)
      const { token, ...responseWithoutToken } = loginResponse;
      return responseWithoutToken;
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

  /**
   * POST /api/auth/logout
   * Clear authentication cookie
   */
  @Public()
  @Post('logout')
  async logout(@Res({ passthrough: true }) response: Response): Promise<{ success: boolean; message: string }> {
    try {
      // Clear the auth cookie
      response.clearCookie('auth_token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
      });

      this.logger.log('✅ User logged out - auth cookie cleared');

      return {
        success: true,
        message: 'Logged out successfully',
      };
    } catch (error) {
      this.logger.error(`❌ Logout failed: ${error.message}`);
      throw new HttpException(
        {
          message: 'Logout failed',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}

