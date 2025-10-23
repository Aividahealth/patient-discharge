import { createParamDecorator, ExecutionContext, BadRequestException } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { TenantContext as TenantContextType } from './tenant-context';

export const TenantContext = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): TenantContextType => {
    const request = ctx.switchToHttp().getRequest();
    const tenantService = new TenantService();
    
    try {
      const tenantId = tenantService.extractTenantId(request);
      return {
        tenantId,
        timestamp: new Date(),
        requestId: request.headers['x-request-id'] as string || `req_${Date.now()}`,
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  },
);
