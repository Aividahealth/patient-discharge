'use client'

import { useTenant } from '@/contexts/tenant-context'
import { useEffect } from 'react'

/**
 * Component that applies tenant branding to the page
 * Uses tenant config from the TenantContext
 */
export function TenantBranding() {
  const { tenant } = useTenant()

  useEffect(() => {
    if (!tenant?.branding) return

    const { primaryColor, secondaryColor, accentColor } = tenant.branding

    // Apply CSS variables for tenant colors
    document.documentElement.style.setProperty('--tenant-primary', primaryColor)
    document.documentElement.style.setProperty('--tenant-secondary', secondaryColor)
    document.documentElement.style.setProperty('--tenant-accent', accentColor || primaryColor)

    console.log('[TenantBranding] Applied tenant colors:', {
      primary: primaryColor,
      secondary: secondaryColor,
      accent: accentColor,
    })

    // Update favicon if available
    if (tenant.branding.favicon) {
      const favicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement
      if (favicon) {
        favicon.href = tenant.branding.favicon
      } else {
        const newFavicon = document.createElement('link')
        newFavicon.rel = 'icon'
        newFavicon.href = tenant.branding.favicon
        document.head.appendChild(newFavicon)
      }
    }
  }, [tenant])

  return null // This component doesn't render anything
}

/**
 * Hook to access tenant branding
 */
export function useTenantBranding() {
  const { tenant } = useTenant()
  return tenant?.branding || null
}

/**
 * Hook to access tenant features
 */
export function useTenantFeatures() {
  const { tenant } = useTenant()
  return tenant?.features || null
}

/**
 * Hook to access tenant config
 */
export function useTenantConfig() {
  const { tenant } = useTenant()
  return tenant?.config || null
}
