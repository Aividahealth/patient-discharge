"use client"

import Image from "next/image"
import Link from "next/link"
import { useTenant } from "@/contexts/tenant-context"

interface CommonHeaderProps {
  title?: string
  hideTenantInfo?: boolean // When true, always show Aivida branding
}

/**
 * Normalize tenant logo path
 * - If it's already a full URL (http/https), use it as-is
 * - If it's a local path, extract filename and point to /tenant/ folder
 */
function normalizeTenantLogoPath(logoPath: string | undefined): string {
  if (!logoPath) return '/aivida-logo.png'
  
  // If it's already a full URL (GCS or other external URL), use it as-is
  if (logoPath.startsWith('http://') || logoPath.startsWith('https://')) {
    return logoPath
  }
  
  // For local paths, extract just the filename from the path
  const filename = logoPath.split('/').pop() || logoPath
  
  // Return path pointing to /public/tenant/ folder
  return `/tenant/${filename}`
}

export function CommonHeader({ title, hideTenantInfo = false }: CommonHeaderProps) {
  const { tenant } = useTenant()

  // Use tenant branding if available and not hidden, otherwise fall back to Aivida defaults
  const shouldShowTenant = !hideTenantInfo && tenant
  const logo = shouldShowTenant && tenant.branding?.logo 
    ? normalizeTenantLogoPath(tenant.branding.logo)
    : "/aivida-logo.png"
  const name = shouldShowTenant ? tenant.name : "Aivida Health"

  return (
    <header className="bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex items-center justify-center">
          {/* Logo and Title */}
          <div className="flex items-center space-x-3">
            <Link href="/" className="flex items-center space-x-3 hover:opacity-80 transition-opacity">
              <Image
                src={logo}
                alt={name}
                width={40}
                height={40}
                className="rounded-lg"
              />
              <div>
                <span
                  className="text-xl font-bold"
                  style={shouldShowTenant ? { color: 'var(--tenant-primary)' } : { color: '#0f172a' }}
                >
                  {name}
                </span>
                {title && (
                  <p className="text-sm text-slate-600">{title}</p>
                )}
              </div>
            </Link>
          </div>
        </div>
      </div>
    </header>
  )
}
