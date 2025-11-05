"use client"

import Image from "next/image"
import Link from "next/link"
import { useTenant } from "@/contexts/tenant-context"

interface CommonHeaderProps {
  title?: string
}

export function CommonHeader({ title }: CommonHeaderProps) {
  const { tenant } = useTenant()

  // Use tenant branding if available, otherwise fall back to defaults
  const logo = tenant?.branding?.logo || "/aivida-logo.png"
  const name = tenant?.name || "Aivida Health"
  const primaryColor = tenant?.branding?.primaryColor

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
                  style={{ color: primaryColor || '#0f172a' }}
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
