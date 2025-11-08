import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Decorator to extract user information from request
 * Use this in controllers to access authenticated user data
 * 
 * Example:
 * @Get('profile')
 * async getProfile(@CurrentUser() user: UserPayload) {
 *   return user;
 * }
 */
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);

/**
 * Type for user payload attached to request by AuthGuard
 */
export interface UserPayload {
  userId: string;
  tenantId: string;
  username: string;
  name: string;
  role: string;
  linkedPatientId?: string;
}

