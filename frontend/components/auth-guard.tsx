'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTenant } from '@/contexts/tenant-context'

interface AuthGuardProps {
  children: React.ReactNode
  requiredRole?: string | string[] // Role or array of roles that can access
}

export function AuthGuard({ children, requiredRole }: AuthGuardProps) {
  const { isAuthenticated, isLoading, user } = useTenant()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      console.log('[AuthGuard] Not authenticated, redirecting to /login')
      router.push('/login')
      return
    }

    // Check role-based access if requiredRole is specified
    if (!isLoading && isAuthenticated && requiredRole && user) {
      const allowedRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole]
      const userRole = user.role
      
      // Map 'admin' to 'tenant_admin' for backward compatibility
      const normalizedRoles = allowedRoles.map(role => role === 'admin' ? 'tenant_admin' : role)
      
      if (!normalizedRoles.includes(userRole)) {
        console.log(`[AuthGuard] User role '${userRole}' not allowed. Required roles: ${normalizedRoles.join(', ')}. Redirecting to /login`)
        router.push('/login')
      }
    }
  }, [isAuthenticated, isLoading, router, requiredRole, user])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return null // Will redirect to login
  }

  // Check role-based access
  if (requiredRole && user) {
    const allowedRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole]
    const normalizedRoles = allowedRoles.map(role => role === 'admin' ? 'tenant_admin' : role)
    
    if (!normalizedRoles.includes(user.role)) {
      return null // Will redirect to login
    }
  }

  return <>{children}</>
}