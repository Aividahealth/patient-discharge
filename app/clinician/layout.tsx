import type React from "react"
import { AuthGuard } from "@/components/auth-guard"

export default function ClinicianLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AuthGuard requiredRole="clinician">{children}</AuthGuard>
}
