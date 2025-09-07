"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Heart, Stethoscope, Settings, Eye, EyeOff, Shield, Users, User } from "lucide-react"
import Link from "next/link"
import Image from "next/image"

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [loginType, setLoginType] = useState("patient")
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [accessPassword, setAccessPassword] = useState("")
  const [passwordError, setPasswordError] = useState("")

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (accessPassword === "Adyar2Austin") {
      setIsAuthenticated(true)
      setPasswordError("")
    } else {
      setPasswordError("Incorrect password. Please try again.")
    }
  }

  const demoCredentials = {
    patient: {
      token: "DEMO-PATIENT-2024",
      description: "Access your discharge instructions and medication schedule",
    },
    clinician: {
      email: "demo.clinician@hospital.com",
      password: "Aivida2024",
      description: "Review and publish patient discharge instructions",
    },
    admin: {
      email: "admin@hospital.com",
      password: "AdminCare2024",
      description: "Manage system configuration and user access",
    },
  }

  // Password protection gate
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
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
            <p className="text-muted-foreground">Enter access password to continue</p>
          </div>

          {/* Password Form */}
          <Card>
            <CardHeader className="space-y-1">
              <CardTitle className="font-heading text-xl text-center">Access Required</CardTitle>
              <CardDescription className="text-center">This area is password protected</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="access-password">Password</Label>
                  <Input
                    id="access-password"
                    type="password"
                    placeholder="Enter access password"
                    value={accessPassword}
                    onChange={(e) => setAccessPassword(e.target.value)}
                    className={passwordError ? "border-red-500" : ""}
                  />
                  {passwordError && (
                    <p className="text-sm text-red-500">{passwordError}</p>
                  )}
                </div>
                <Button type="submit" className="w-full">
                  <Shield className="h-4 w-4 mr-2" />
                  Access Platform
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
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
                <div className="space-y-2">
                  <Label htmlFor="patient-token">Access Token</Label>
                  <Input
                    id="patient-token"
                    placeholder="Enter your discharge access token"
                    defaultValue={demoCredentials.patient.token}
                  />
                  <p className="text-xs text-muted-foreground">{demoCredentials.patient.description}</p>
                </div>
                <Link href="/patient" className="block">
                  <Button className="w-full">
                    <User className="h-4 w-4 mr-2" />
                    Access Patient Portal
                  </Button>
                </Link>
              </TabsContent>

              {/* Clinician Login */}
              <TabsContent value="clinician" className="space-y-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="clinician-email">Email</Label>
                    <Input
                      id="clinician-email"
                      type="email"
                      placeholder="Enter your email"
                      defaultValue={demoCredentials.clinician.email}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="clinician-password">Password</Label>
                    <div className="relative">
                      <Input
                        id="clinician-password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter your password"
                        defaultValue={demoCredentials.clinician.password}
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
                  <p className="text-xs text-muted-foreground">{demoCredentials.clinician.description}</p>
                </div>
                <Link href="/clinician" className="block">
                  <Button className="w-full">
                    <Stethoscope className="h-4 w-4 mr-2" />
                    Access Clinician Portal
                  </Button>
                </Link>
              </TabsContent>

              {/* Admin Login */}
              <TabsContent value="admin" className="space-y-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="admin-email">Email</Label>
                    <Input
                      id="admin-email"
                      type="email"
                      placeholder="Enter your email"
                      defaultValue={demoCredentials.admin.email}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="admin-password">Password</Label>
                    <div className="relative">
                      <Input
                        id="admin-password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter your password"
                        defaultValue={demoCredentials.admin.password}
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
                  <p className="text-xs text-muted-foreground">{demoCredentials.admin.description}</p>
                </div>
                <Link href="/admin" className="block">
                  <Button className="w-full">
                    <Settings className="h-4 w-4 mr-2" />
                    Access Admin Dashboard
                  </Button>
                </Link>
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

        {/* Demo Information */}
        <Card className="border-accent/20 bg-accent/5">
          <CardHeader className="pb-3">
            <CardTitle className="font-heading text-lg flex items-center gap-2">
              <Badge variant="secondary">Demo Mode</Badge>
              Quick Access Credentials
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="font-medium">Patient Access Token:</p>
              <code className="text-xs bg-muted px-2 py-1 rounded">{demoCredentials.patient.token}</code>
            </div>
            <div>
              <p className="font-medium">Clinician Login:</p>
              <code className="text-xs bg-muted px-2 py-1 rounded">{demoCredentials.clinician.email}</code>
            </div>
            <div>
              <p className="font-medium">Admin Login:</p>
              <code className="text-xs bg-muted px-2 py-1 rounded">{demoCredentials.admin.email}</code>
            </div>
            <p className="text-xs text-muted-foreground">
              This is a demonstration environment. In production, secure authentication and OTP verification would be
              required.
            </p>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center space-y-2">
          <p className="text-xs text-muted-foreground">
            Need help? Contact your healthcare provider or system administrator.
          </p>
          <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
            <Link href="#" className="hover:text-foreground">
              Privacy Policy
            </Link>
            <span>•</span>
            <Link href="#" className="hover:text-foreground">
              Terms of Service
            </Link>
            <span>•</span>
            <Link href="#" className="hover:text-foreground">
              Support
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
