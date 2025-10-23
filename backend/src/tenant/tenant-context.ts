export interface TenantContext {
  tenantId: string;
  timestamp: Date;
  requestId?: string;
  userId?: string;
}

export class TenantContextService {
  private static context = new Map<string, TenantContext>();

  static setContext(requestId: string, context: TenantContext): void {
    this.context.set(requestId, context);
  }

  static getContext(requestId: string): TenantContext | undefined {
    return this.context.get(requestId);
  }

  static clearContext(requestId: string): void {
    this.context.delete(requestId);
  }

  static getCurrentContext(): TenantContext | undefined {
    // This would need to be implemented with async context or request-scoped storage
    // For now, we'll use a simpler approach with the decorator
    return undefined;
  }
}

