import type React from "react"
import { AuthGuard } from "@/components/auth-guard"
import { TenantBranding } from "@/components/tenant-branding"

export default function PatientLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthGuard requiredRole="patient">
      <TenantBranding />
      {children}
    </AuthGuard>
  )
}
