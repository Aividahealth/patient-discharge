'use client'

import { Badge, BadgeProps } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface TenantBadgeProps extends Omit<BadgeProps, 'variant'> {
  tenantVariant?: 'primary' | 'secondary' | 'accent' | 'light'
}

/**
 * Tenant-aware badge that uses CSS variables for colors
 * The 'light' variant has a semi-transparent background with opaque text
 */
export function TenantBadge({ tenantVariant = 'primary', className, children, ...props }: TenantBadgeProps) {
  if (tenantVariant === 'light') {
    return (
      <Badge
        variant="outline"
        className={cn('text-xs relative overflow-hidden', className)}
        style={{
          color: 'var(--tenant-primary)',
          borderColor: 'var(--tenant-primary)',
        }}
        {...props}
      >
        {/* Background layer with opacity */}
        <span
          className="absolute inset-0 -z-10"
          style={{
            backgroundColor: 'var(--tenant-primary)',
            opacity: 0.1,
          }}
        />
        {children}
      </Badge>
    )
  }

  const variantStyles = {
    primary: {
      backgroundColor: 'var(--tenant-primary)',
      color: 'white',
      borderColor: 'var(--tenant-primary)',
    },
    secondary: {
      backgroundColor: 'var(--tenant-secondary)',
      color: 'white',
      borderColor: 'var(--tenant-secondary)',
    },
    accent: {
      backgroundColor: 'var(--tenant-accent)',
      color: 'white',
      borderColor: 'var(--tenant-accent)',
    },
  }

  return (
    <Badge
      variant="outline"
      className={cn('text-xs', className)}
      style={variantStyles[tenantVariant]}
      {...props}
    >
      {children}
    </Badge>
  )
}
