import type React from "react"
import { AuthGuard } from "@/components/auth-guard"

export default function PatientLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AuthGuard requiredRole="patient">{children}</AuthGuard>
}
