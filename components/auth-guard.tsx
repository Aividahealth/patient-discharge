"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Shield, AlertTriangle } from "lucide-react"
import Link from "next/link"

interface AuthGuardProps {
  children: React.ReactNode
  requiredRole: "patient" | "clinician" | "admin"
}

export function AuthGuard({ children, requiredRole }: AuthGuardProps) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [userRole, setUserRole] = useState<string | null>(null)

  useEffect(() => {
    // In a real implementation, this would check actual authentication state
    // For demo purposes, we'll simulate authentication based on current path
    const checkAuth = () => {
      const currentPath = window.location.pathname

      // Simulate authentication check
      if (currentPath.includes("/patient")) {
        setUserRole("patient")
        setIsAuthenticated(true)
      } else if (currentPath.includes("/clinician")) {
        setUserRole("clinician")
        setIsAuthenticated(true)
      } else if (currentPath.includes("/admin")) {
        setUserRole("admin")
        setIsAuthenticated(true)
      } else {
        setIsAuthenticated(false)
      }
    }

    checkAuth()
  }, [])

  if (isAuthenticated === null) {
    // Loading state
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Shield className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Verifying authentication...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated || userRole !== requiredRole) {
    // Unauthorized access
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex items-center justify-center mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                <AlertTriangle className="h-6 w-6" />
              </div>
            </div>
            <CardTitle className="font-heading">Access Denied</CardTitle>
            <CardDescription>
              You don't have permission to access this area. Please sign in with the appropriate credentials.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-muted-foreground space-y-2">
              <p>
                <strong>Required Role:</strong> {requiredRole}
              </p>
              <p>
                <strong>Your Role:</strong> {userRole || "Not authenticated"}
              </p>
            </div>
            <div className="flex gap-2">
              <Link href="/login" className="flex-1">
                <Button className="w-full">Sign In</Button>
              </Link>
              <Link href="/" className="flex-1">
                <Button variant="outline" className="w-full bg-transparent">
                  Home
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return <>{children}</>
}
