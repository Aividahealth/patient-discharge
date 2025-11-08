'use client'

import { Button, ButtonProps } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { forwardRef } from 'react'

/**
 * Tenant-aware button variants that use CSS variables
 * These buttons automatically adapt to tenant branding colors
 */

interface TenantButtonProps extends ButtonProps {
  tenantVariant?: 'primary' | 'secondary' | 'accent' | 'outline' | 'ghost'
}

export const TenantButton = forwardRef<HTMLButtonElement, TenantButtonProps>(
  ({ tenantVariant = 'primary', className, style, ...props }, ref) => {
    const variantStyles = {
      primary: {
        backgroundColor: 'var(--tenant-primary)',
        color: 'white',
        border: 'none',
      },
      secondary: {
        backgroundColor: 'var(--tenant-secondary)',
        color: 'white',
        border: 'none',
      },
      accent: {
        backgroundColor: 'var(--tenant-accent)',
        color: 'white',
        border: 'none',
      },
      outline: {
        backgroundColor: 'transparent',
        color: 'var(--tenant-primary)',
        borderColor: 'var(--tenant-primary)',
        borderWidth: '1px',
        borderStyle: 'solid',
      },
      ghost: {
        backgroundColor: 'transparent',
        color: 'var(--tenant-primary)',
      },
    }

    const hoverClass = {
      primary: 'hover:opacity-90',
      secondary: 'hover:opacity-90',
      accent: 'hover:opacity-90',
      outline: 'hover:bg-[var(--tenant-primary)] hover:text-white hover:opacity-90',
      ghost: 'hover:bg-[var(--tenant-primary)] hover:bg-opacity-10',
    }

    return (
      <Button
        ref={ref}
        variant="default"
        className={cn(
          'transition-all duration-200',
          hoverClass[tenantVariant],
          className
        )}
        style={{
          ...variantStyles[tenantVariant],
          ...style,
        }}
        {...props}
      />
    )
  }
)

TenantButton.displayName = 'TenantButton'
