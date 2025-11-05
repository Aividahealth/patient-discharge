import type React from "react"
import { AuthGuard } from "@/components/auth-guard"
import { TenantBranding } from "@/components/tenant-branding"

export default function ClinicianLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthGuard>
      <TenantBranding />
      {children}
    </AuthGuard>
  )
}
