"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Heart, Stethoscope, Settings, Eye, EyeOff, Shield, Users, User, AlertCircle } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { CommonHeader } from "@/components/common-header"
import { CommonFooter } from "@/components/common-footer"
import { useTenant } from "@/contexts/tenant-context"
import { login as loginApi } from "@/lib/api/auth"

export default function LoginPage() {
  const router = useRouter()
  const { login } = useTenant()
  const [showPassword, setShowPassword] = useState(false)
  const [loginType, setLoginType] = useState("patient")

  // Login form state
  const [tenantId, setTenantId] = useState("demo")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [loginError, setLoginError] = useState("")
  const [isLoggingIn, setIsLoggingIn] = useState(false)

  const handleManualLogin = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      setIsLoggingIn(true)
      setLoginError("")

      // Call the login API
      const authData = await loginApi({
        tenantId,
        username,
        password,
      })

      // Store in tenant context (now async to fetch config)
      await login(authData)

      // Redirect based on user role
      // Handle new role names and legacy admin role
      const portal = authData.user.role === 'tenant_admin' ? 'admin' : authData.user.role
      router.push(`/${tenantId}/${portal}`)
    } catch (error) {
      console.error('[Login] Error:', error)

      // Parse error message from API for better user experience
      let errorMessage = "Login failed. Please try again."

      if (error instanceof Error) {
        const msg = error.message

        // Check for specific error messages from backend
        if (msg.includes('Account is locked')) {
          errorMessage = "Your account has been locked due to multiple failed login attempts. Please contact your administrator to unlock your account."
        } else if (msg.includes('Account is disabled')) {
          errorMessage = "Your account has been disabled. Please contact your administrator for assistance."
        } else if (msg.includes('Invalid credentials')) {
          errorMessage = "Invalid username or password. Please try again."
        } else if (msg.includes('Tenant') && msg.includes('not found')) {
          errorMessage = "Tenant not found. Please check your tenant ID and try again."
        } else if (msg.includes('Token has expired')) {
          errorMessage = "Your session has expired. Please log in again."
        } else {
          errorMessage = msg
        }
      }

      setLoginError(errorMessage)
    } finally {
      setIsLoggingIn(false)
    }
  }


  // Removed password gate - go directly to login form

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <CommonHeader title="Login" hideTenantInfo={true} />
      <div className="flex-1 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="flex h-20 w-20 items-center justify-center rounded-lg">
              <Image
                src="/aivida-logo.png"
                alt="Aivida Logo"
                width={80}
                height={80}
                className="rounded-lg"
              />
            </div>
            <div className="text-left">
              <h1 className="font-heading text-2xl font-bold text-foreground">Aivida</h1>
              <p className="text-sm text-muted-foreground">Discharge Instructions Platform</p>
            </div>
          </div>
          <p className="text-muted-foreground">Sign in to access your personalized healthcare dashboard</p>
        </div>

        {/* Login Form */}
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="font-heading text-xl text-center">Sign In</CardTitle>
            <CardDescription className="text-center">Choose your account type to continue</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Login Error Display */}
            {loginError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-red-600">{loginError}</p>
              </div>
            )}

            <Tabs value={loginType} onValueChange={setLoginType} className="space-y-4">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="patient" className="flex flex-col gap-1 py-2">
                  <User className="h-4 w-4" />
                  <span className="text-xs">Patient</span>
                </TabsTrigger>
                <TabsTrigger value="clinician" className="flex flex-col gap-1 py-2">
                  <Stethoscope className="h-4 w-4" />
                  <span className="text-xs">Clinician</span>
                </TabsTrigger>
                <TabsTrigger value="admin" className="flex flex-col gap-1 py-2">
                  <Settings className="h-4 w-4" />
                  <span className="text-xs">Admin</span>
                </TabsTrigger>
              </TabsList>

              {/* Patient Login */}
              <TabsContent value="patient" className="space-y-4">
                <form onSubmit={handleManualLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="patient-tenant">Tenant ID</Label>
                    <Input
                      id="patient-tenant"
                      placeholder="Enter tenant ID (e.g., demo)"
                      value={tenantId}
                      onChange={(e) => setTenantId(e.target.value)}
                      required
                    />
                    <p className="text-xs text-muted-foreground">Your organization identifier</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="patient-username">Username</Label>
                    <Input
                      id="patient-username"
                      placeholder="Enter username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="patient-password">Password</Label>
                    <div className="relative">
                      <Input
                        id="patient-password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
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
                    className="w-full"
                    disabled={isLoggingIn}
                  >
                    <User className="h-4 w-4 mr-2" />
                    {isLoggingIn ? 'Logging in...' : 'Sign In'}
                  </Button>
                </form>
              </TabsContent>

              {/* Clinician Login */}
              <TabsContent value="clinician" className="space-y-4">
                <form onSubmit={handleManualLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="clinician-tenant">Tenant ID</Label>
                    <Input
                      id="clinician-tenant"
                      placeholder="Enter tenant ID (e.g., demo)"
                      value={tenantId}
                      onChange={(e) => setTenantId(e.target.value)}
                      required
                    />
                    <p className="text-xs text-muted-foreground">Your organization identifier</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="clinician-username">Username</Label>
                    <Input
                      id="clinician-username"
                      placeholder="Enter username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="clinician-password">Password</Label>
                    <div className="relative">
                      <Input
                        id="clinician-password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
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
                    className="w-full"
                    disabled={isLoggingIn}
                  >
                    <Stethoscope className="h-4 w-4 mr-2" />
                    {isLoggingIn ? 'Logging in...' : 'Sign In'}
                  </Button>
                </form>
              </TabsContent>

              {/* Admin Login */}
              <TabsContent value="admin" className="space-y-4">
                <form onSubmit={handleManualLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="admin-tenant">Tenant ID</Label>
                    <Input
                      id="admin-tenant"
                      placeholder="Enter tenant ID (e.g., demo)"
                      value={tenantId}
                      onChange={(e) => setTenantId(e.target.value)}
                      required
                    />
                    <p className="text-xs text-muted-foreground">Your organization identifier</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="admin-username">Username</Label>
                    <Input
                      id="admin-username"
                      placeholder="Enter username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="admin-password">Password</Label>
                    <div className="relative">
                      <Input
                        id="admin-password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
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
                    className="w-full"
                    disabled={isLoggingIn}
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    {isLoggingIn ? 'Logging in...' : 'Sign In'}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>

            <Separator className="my-6" />

            {/* SSO Options */}
            <div className="space-y-3">
              <p className="text-sm text-center text-muted-foreground">Or continue with SSO</p>
              <div className="grid grid-cols-2 gap-3">
                <Button variant="outline" className="w-full bg-transparent" disabled>
                  <Shield className="h-4 w-4 mr-2" />
                  SAML
                </Button>
                <Button variant="outline" className="w-full bg-transparent" disabled>
                  <Users className="h-4 w-4 mr-2" />
                  OIDC
                </Button>
              </div>
              <p className="text-xs text-center text-muted-foreground">SSO integration available in pilot deployment</p>
            </div>
          </CardContent>
        </Card>


      </div>
      </div>
      <CommonFooter />
    </div>
  )
}
