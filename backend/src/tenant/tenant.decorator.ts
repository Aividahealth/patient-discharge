import { createParamDecorator, ExecutionContext, BadRequestException } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { TenantContext as TenantContextType } from './tenant-context';

export const TenantContext = createParamDecorator(
  (data: { optional?: boolean } = {}, ctx: ExecutionContext): TenantContextType => {
    const request = ctx.switchToHttp().getRequest();
    const tenantService = new TenantService();

    try {
      const tenantId = data?.optional
        ? tenantService.extractTenantIdOptional(request)
        : tenantService.extractTenantId(request);

      return {
        tenantId: tenantId || 'default',
        timestamp: new Date(),
        requestId: request.headers['x-request-id'] as string || `req_${Date.now()}`,
      };
    } catch (error) {
      if (data?.optional) {
        // If optional, return default context
        return {
          tenantId: 'default',
          timestamp: new Date(),
          requestId: request.headers['x-request-id'] as string || `req_${Date.now()}`,
        };
      }
      throw new BadRequestException(error.message);
    }
  },
);
