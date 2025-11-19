"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Eye, EyeOff, Shield, AlertCircle } from "lucide-react"
import Image from "next/image"
import { CommonHeader } from "@/components/common-header"
import { CommonFooter } from "@/components/common-footer"
import { useTenant } from "@/contexts/tenant-context"
import { login as loginApi } from "@/lib/api/auth"

export default function SystemAdminLoginPage() {
  const router = useRouter()
  const { login } = useTenant()
  const [showPassword, setShowPassword] = useState(false)

  // Login form state
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [loginError, setLoginError] = useState("")
  const [isLoggingIn, setIsLoggingIn] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      setIsLoggingIn(true)
      setLoginError("")

      // Call the login API with 'system' as tenantId
      const authData = await loginApi({
        tenantId: 'system',
        username,
        password,
      })

      // Verify the user is actually a system admin
      if (authData.user.role !== 'system_admin') {
        throw new Error('Access denied. System admin role required.')
      }

      // Store in tenant context
      await login(authData)

      // Redirect to system admin portal
      router.push('/system-admin')
    } catch (error) {
      console.error('[SystemAdminLogin] Error:', error)
      setLoginError(error instanceof Error ? error.message : "Login failed. Please try again.")
    } finally {
      setIsLoggingIn(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 flex flex-col">
      <CommonHeader title="System Admin Login" hideTenantInfo={true} />
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="flex h-20 w-20 items-center justify-center rounded-lg bg-purple-600">
                <Shield className="h-12 w-12 text-white" />
              </div>
              <div className="text-left">
                <h1 className="font-heading text-2xl font-bold text-purple-900">System Administration</h1>
                <p className="text-sm text-purple-700">Multi-Tenant Management Portal</p>
              </div>
            </div>
            <p className="text-purple-800">Sign in with your system administrator credentials</p>
          </div>

          {/* Login Form */}
          <Card className="border-purple-200 shadow-lg">
            <CardHeader className="space-y-1 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-t-lg">
              <CardTitle className="font-heading text-xl text-center text-purple-900">
                <Shield className="h-5 w-5 inline mr-2" />
                System Admin Sign In
              </CardTitle>
              <CardDescription className="text-center text-purple-700">
                Access the system-wide administration panel
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              {/* Login Error Display */}
              {loginError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-red-600">{loginError}</p>
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username" className="text-purple-900">Username</Label>
                  <Input
                    id="username"
                    placeholder="Enter your system admin username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    className="border-purple-200 focus:border-purple-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-purple-900">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="border-purple-200 focus:border-purple-500"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <Button
                  type="submit"
                  className="w-full bg-purple-600 hover:bg-purple-700"
                  disabled={isLoggingIn}
                >
                  <Shield className="h-4 w-4 mr-2" />
                  {isLoggingIn ? 'Signing in...' : 'Sign In'}
                </Button>
              </form>

              <div className="mt-6 p-3 bg-purple-50 border border-purple-200 rounded-md">
                <p className="text-xs text-purple-800 text-center">
                  <Shield className="h-3 w-3 inline mr-1" />
                  This portal is restricted to authorized system administrators only
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      <CommonFooter />
    </div>
  )
}
