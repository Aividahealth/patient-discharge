/**
 * Utility functions for working with tenant branding colors
 * These functions return inline styles that use CSS variables set by TenantBranding component
 */

export const tenantColors = {
  // Background colors
  bgPrimary: { backgroundColor: 'var(--tenant-primary)' },
  bgSecondary: { backgroundColor: 'var(--tenant-secondary)' },
  bgAccent: { backgroundColor: 'var(--tenant-accent)' },

  // Text colors
  textPrimary: { color: 'var(--tenant-primary)' },
  textSecondary: { color: 'var(--tenant-secondary)' },
  textAccent: { color: 'var(--tenant-accent)' },

  // Border colors
  borderPrimary: { borderColor: 'var(--tenant-primary)' },
  borderSecondary: { borderColor: 'var(--tenant-secondary)' },
  borderAccent: { borderColor: 'var(--tenant-accent)' },
}

/**
 * Get tenant color value from CSS variable
 * Useful for components that need the raw color value
 */
export const getTenantColor = (variant: 'primary' | 'secondary' | 'accent' = 'primary'): string => {
  if (typeof window === 'undefined') return '#3b82f6' // Default fallback for SSR

  const varName = `--tenant-${variant}`
  const color = getComputedStyle(document.documentElement).getPropertyValue(varName)
  return color || '#3b82f6' // Fallback to blue-500
}

/**
 * Tenant-aware badge/pill styles
 */
export const tenantBadgeStyles = {
  primary: {
    backgroundColor: 'var(--tenant-primary)',
    color: 'white',
  },
  secondary: {
    backgroundColor: 'var(--tenant-secondary)',
    color: 'white',
  },
  accent: {
    backgroundColor: 'var(--tenant-accent)',
    color: 'white',
  },
  outline: {
    backgroundColor: 'transparent',
    color: 'var(--tenant-primary)',
    borderColor: 'var(--tenant-primary)',
    borderWidth: '1px',
    borderStyle: 'solid',
  },
  light: {
    // Using filter for background opacity while keeping text opaque
    position: 'relative' as const,
    color: 'var(--tenant-primary)',
    borderColor: 'var(--tenant-primary)',
    borderWidth: '1px',
    borderStyle: 'solid',
  },
}

/**
 * Helper component style for light badge background
 * Use this as a ::before pseudo-element or wrapper div
 */
export const tenantLightBadgeBg = {
  backgroundColor: 'var(--tenant-primary)',
  opacity: 0.1,
}

/**
 * Tenant-aware status colors
 */
export const getTenantStatusStyle = (status: 'success' | 'warning' | 'error' | 'info' | 'default') => {
  switch (status) {
    case 'success':
      return { backgroundColor: '#10b981', color: 'white' } // green
    case 'warning':
      return { backgroundColor: '#f59e0b', color: 'white' } // amber
    case 'error':
      return { backgroundColor: '#ef4444', color: 'white' } // red
    case 'info':
      return tenantColors.bgPrimary
    case 'default':
    default:
      return tenantColors.bgPrimary
  }
}
