"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Shield, BarChart3, Building2, UserPlus, Users, FileText, Eye, Trash2, Plus, LogOut, AlertCircle } from "lucide-react"
import { CommonHeader } from "@/components/common-header"
import { CommonFooter } from "@/components/common-footer"
import { useTenant } from "@/contexts/tenant-context"
import {
  SystemAdminApi,
  TenantConfig,
  CreateTenantRequest,
  CreateTenantAdminRequest,
  AggregatedMetrics,
  TenantMetrics,
} from "@/lib/api/system-admin"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"

export default function SystemAdminPortal() {
  const router = useRouter()
  const { authData, logout } = useTenant()
  const [api, setApi] = useState<SystemAdminApi | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  // Data states
  const [tenants, setTenants] = useState<TenantConfig[]>([])
  const [aggregatedMetrics, setAggregatedMetrics] = useState<AggregatedMetrics | null>(null)
  const [selectedTenantMetrics, setSelectedTenantMetrics] = useState<TenantMetrics | null>(null)

  // Form states - Tenant Onboarding
  const [newTenant, setNewTenant] = useState<CreateTenantRequest>({
    id: '',
    name: '',
    branding: {
      logo: '',
      primaryColor: '#3b82f6',
      secondaryColor: '#60a5fa',
    },
    features: {
      patientPortal: true,
      clinicianPortal: true,
      expertPortal: true,
      chatbot: true,
    },
  })

  // Form states - Tenant Admin Creation
  const [newTenantAdmin, setNewTenantAdmin] = useState<CreateTenantAdminRequest>({
    tenantId: '',
    username: '',
    password: '',
    name: '',
  })

  // Dialog states
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [tenantToDelete, setTenantToDelete] = useState<string | null>(null)

  // Verify system admin access
  useEffect(() => {
    if (!authData) {
      router.push('/system-admin/login')
      return
    }

    if (authData.user.role !== 'system_admin') {
      router.push('/login')
      return
    }

    // Initialize API client
    const apiClient = new SystemAdminApi(authData.token)
    setApi(apiClient)
    loadData(apiClient)
  }, [authData, router])

  const loadData = async (apiClient: SystemAdminApi) => {
    try {
      setLoading(true)
      setError("")

      // Load tenants and aggregated metrics in parallel
      const [tenantsData, metricsData] = await Promise.all([
        apiClient.getAllTenants(),
        apiClient.getAggregatedMetrics(),
      ])

      setTenants(tenantsData)
      setAggregatedMetrics(metricsData)
    } catch (err) {
      console.error('Error loading data:', err)
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!api) return

    try {
      setError("")
      await api.createTenant(newTenant)

      // Reset form
      setNewTenant({
        id: '',
        name: '',
        branding: {
          logo: '',
          primaryColor: '#3b82f6',
          secondaryColor: '#60a5fa',
        },
        features: {
          patientPortal: true,
          clinicianPortal: true,
          expertPortal: true,
          chatbot: true,
        },
      })

      // Reload data
      await loadData(api)
      alert('Tenant created successfully!')
    } catch (err) {
      console.error('Error creating tenant:', err)
      setError(err instanceof Error ? err.message : 'Failed to create tenant')
    }
  }

  const handleDeleteTenant = async () => {
    if (!api || !tenantToDelete) return

    try {
      setError("")
      await api.deleteTenant(tenantToDelete)
      setShowDeleteDialog(false)
      setTenantToDelete(null)

      // Reload data
      await loadData(api)
      alert('Tenant deleted successfully!')
    } catch (err) {
      console.error('Error deleting tenant:', err)
      setError(err instanceof Error ? err.message : 'Failed to delete tenant')
    }
  }

  const handleCreateTenantAdmin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!api) return

    try {
      setError("")
      await api.createTenantAdmin(newTenantAdmin)

      // Reset form
      setNewTenantAdmin({
        tenantId: '',
        username: '',
        password: '',
        name: '',
      })

      alert('Tenant admin created successfully!')
    } catch (err) {
      console.error('Error creating tenant admin:', err)
      setError(err instanceof Error ? err.message : 'Failed to create tenant admin')
    }
  }

  const handleViewTenantMetrics = async (tenantId: string) => {
    if (!api) return

    try {
      const metrics = await api.getTenantMetrics(tenantId)
      setSelectedTenantMetrics(metrics)
    } catch (err) {
      console.error('Error loading tenant metrics:', err)
      setError(err instanceof Error ? err.message : 'Failed to load tenant metrics')
    }
  }

  const handleLogout = () => {
    logout()
    router.push('/system-admin/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-lg">Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 flex flex-col">
      <CommonHeader title="System Administration" hideTenantInfo={true} />

      <div className="flex-1 p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-purple-900 flex items-center gap-2">
                <Shield className="h-8 w-8" />
                System Administration
              </h1>
              <p className="text-purple-700 mt-1">
                Welcome, {authData?.user.name} • Managing {tenants.length} tenant{tenants.length !== 1 ? 's' : ''}
              </p>
            </div>
            <Button onClick={handleLogout} variant="outline" className="border-purple-300">
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>

          {/* Error Display */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Tabs */}
          <Tabs defaultValue="dashboard" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4 bg-white">
              <TabsTrigger value="dashboard">
                <BarChart3 className="h-4 w-4 mr-2" />
                Dashboard
              </TabsTrigger>
              <TabsTrigger value="tenants">
                <Building2 className="h-4 w-4 mr-2" />
                Tenants
              </TabsTrigger>
              <TabsTrigger value="onboarding">
                <Plus className="h-4 w-4 mr-2" />
                Onboarding
              </TabsTrigger>
              <TabsTrigger value="admins">
                <UserPlus className="h-4 w-4 mr-2" />
                Tenant Admins
              </TabsTrigger>
            </TabsList>

            {/* Dashboard Tab */}
            <TabsContent value="dashboard" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Total Tenants</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{aggregatedMetrics?.totalTenants || 0}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Total Users</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{aggregatedMetrics?.totalUsers || 0}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Discharge Summaries</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{aggregatedMetrics?.totalDischargeSummaries || 0}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Avg Feedback Rating</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">
                      {aggregatedMetrics?.averageFeedbackRating?.toFixed(1) || '0.0'}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Tenant Metrics Table */}
              <Card>
                <CardHeader>
                  <CardTitle>Tenant Metrics</CardTitle>
                  <CardDescription>Performance metrics for each tenant</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tenant</TableHead>
                        <TableHead className="text-right">Users</TableHead>
                        <TableHead className="text-right">Summaries</TableHead>
                        <TableHead className="text-right">Feedback</TableHead>
                        <TableHead className="text-right">Avg Rating</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {aggregatedMetrics?.tenantMetrics.map((metrics) => (
                        <TableRow key={metrics.tenantId}>
                          <TableCell className="font-medium">{metrics.tenantName}</TableCell>
                          <TableCell className="text-right">{metrics.users.total}</TableCell>
                          <TableCell className="text-right">{metrics.dischargeSummaries.total}</TableCell>
                          <TableCell className="text-right">{metrics.expertFeedback.total}</TableCell>
                          <TableCell className="text-right">{metrics.expertFeedback.averageRating.toFixed(1)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tenants Tab */}
            <TabsContent value="tenants" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>All Tenants</CardTitle>
                  <CardDescription>Manage existing tenants</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tenant ID</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Features</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tenants.map((tenant) => (
                        <TableRow key={tenant.id}>
                          <TableCell className="font-mono">{tenant.id}</TableCell>
                          <TableCell>{tenant.name}</TableCell>
                          <TableCell>
                            <div className="flex gap-1 flex-wrap">
                              {tenant.features.patientPortal && <Badge variant="secondary">Patient</Badge>}
                              {tenant.features.clinicianPortal && <Badge variant="secondary">Clinician</Badge>}
                              {tenant.features.expertPortal && <Badge variant="secondary">Expert</Badge>}
                              {tenant.features.chatbot && <Badge variant="secondary">Chatbot</Badge>}
                            </div>
                          </TableCell>
                          <TableCell>{new Date(tenant.createdAt).toLocaleDateString()}</TableCell>
                          <TableCell className="text-right space-x-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleViewTenantMetrics(tenant.id)}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              View
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => {
                                setTenantToDelete(tenant.id)
                                setShowDeleteDialog(true)
                              }}
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
                              Delete
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Selected Tenant Metrics */}
              {selectedTenantMetrics && (
                <Card>
                  <CardHeader>
                    <CardTitle>Metrics for {selectedTenantMetrics.tenantName}</CardTitle>
                    <CardDescription>Detailed metrics breakdown</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h3 className="font-semibold mb-2">Users by Role</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        <div className="p-3 bg-blue-50 rounded-md">
                          <div className="text-sm text-muted-foreground">Patients</div>
                          <div className="text-2xl font-bold">{selectedTenantMetrics.users.byRole.patient}</div>
                        </div>
                        <div className="p-3 bg-green-50 rounded-md">
                          <div className="text-sm text-muted-foreground">Clinicians</div>
                          <div className="text-2xl font-bold">{selectedTenantMetrics.users.byRole.clinician}</div>
                        </div>
                        <div className="p-3 bg-purple-50 rounded-md">
                          <div className="text-sm text-muted-foreground">Experts</div>
                          <div className="text-2xl font-bold">{selectedTenantMetrics.users.byRole.expert}</div>
                        </div>
                        <div className="p-3 bg-orange-50 rounded-md">
                          <div className="text-sm text-muted-foreground">Admins</div>
                          <div className="text-2xl font-bold">{selectedTenantMetrics.users.byRole.tenant_admin}</div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="font-semibold mb-2">Discharge Summaries by Status</h3>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                        <div className="p-3 bg-gray-50 rounded-md">
                          <div className="text-sm text-muted-foreground">Raw Only</div>
                          <div className="text-2xl font-bold">{selectedTenantMetrics.dischargeSummaries.byStatus.raw_only}</div>
                        </div>
                        <div className="p-3 bg-blue-50 rounded-md">
                          <div className="text-sm text-muted-foreground">Simplified</div>
                          <div className="text-2xl font-bold">{selectedTenantMetrics.dischargeSummaries.byStatus.simplified}</div>
                        </div>
                        <div className="p-3 bg-green-50 rounded-md">
                          <div className="text-sm text-muted-foreground">Translated</div>
                          <div className="text-2xl font-bold">{selectedTenantMetrics.dischargeSummaries.byStatus.translated}</div>
                        </div>
                        <div className="p-3 bg-yellow-50 rounded-md">
                          <div className="text-sm text-muted-foreground">Processing</div>
                          <div className="text-2xl font-bold">{selectedTenantMetrics.dischargeSummaries.byStatus.processing}</div>
                        </div>
                        <div className="p-3 bg-red-50 rounded-md">
                          <div className="text-sm text-muted-foreground">Error</div>
                          <div className="text-2xl font-bold">{selectedTenantMetrics.dischargeSummaries.byStatus.error}</div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Onboarding Tab */}
            <TabsContent value="onboarding">
              <Card>
                <CardHeader>
                  <CardTitle>Tenant Onboarding</CardTitle>
                  <CardDescription>Create a new tenant organization</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleCreateTenant} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="tenant-id">Tenant ID *</Label>
                        <Input
                          id="tenant-id"
                          placeholder="e.g., hospital-a"
                          value={newTenant.id}
                          onChange={(e) => setNewTenant({ ...newTenant, id: e.target.value })}
                          required
                        />
                        <p className="text-xs text-muted-foreground">Unique identifier (lowercase, hyphens allowed)</p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="tenant-name">Tenant Name *</Label>
                        <Input
                          id="tenant-name"
                          placeholder="e.g., Hospital A"
                          value={newTenant.name}
                          onChange={(e) => setNewTenant({ ...newTenant, name: e.target.value })}
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="logo-url">Logo URL</Label>
                        <Input
                          id="logo-url"
                          placeholder="https://..."
                          value={newTenant.branding.logo}
                          onChange={(e) => setNewTenant({
                            ...newTenant,
                            branding: { ...newTenant.branding, logo: e.target.value }
                          })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="primary-color">Primary Color</Label>
                        <Input
                          id="primary-color"
                          type="color"
                          value={newTenant.branding.primaryColor}
                          onChange={(e) => setNewTenant({
                            ...newTenant,
                            branding: { ...newTenant.branding, primaryColor: e.target.value }
                          })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="secondary-color">Secondary Color</Label>
                        <Input
                          id="secondary-color"
                          type="color"
                          value={newTenant.branding.secondaryColor}
                          onChange={(e) => setNewTenant({
                            ...newTenant,
                            branding: { ...newTenant.branding, secondaryColor: e.target.value }
                          })}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Features</Label>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="feature-patient"
                            checked={newTenant.features?.patientPortal}
                            onCheckedChange={(checked) => setNewTenant({
                              ...newTenant,
                              features: { ...newTenant.features, patientPortal: !!checked }
                            })}
                          />
                          <label htmlFor="feature-patient" className="text-sm">Patient Portal</label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="feature-clinician"
                            checked={newTenant.features?.clinicianPortal}
                            onCheckedChange={(checked) => setNewTenant({
                              ...newTenant,
                              features: { ...newTenant.features, clinicianPortal: !!checked }
                            })}
                          />
                          <label htmlFor="feature-clinician" className="text-sm">Clinician Portal</label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="feature-expert"
                            checked={newTenant.features?.expertPortal}
                            onCheckedChange={(checked) => setNewTenant({
                              ...newTenant,
                              features: { ...newTenant.features, expertPortal: !!checked }
                            })}
                          />
                          <label htmlFor="feature-expert" className="text-sm">Expert Portal</label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="feature-chatbot"
                            checked={newTenant.features?.chatbot}
                            onCheckedChange={(checked) => setNewTenant({
                              ...newTenant,
                              features: { ...newTenant.features, chatbot: !!checked }
                            })}
                          />
                          <label htmlFor="feature-chatbot" className="text-sm">Chatbot</label>
                        </div>
                      </div>
                    </div>

                    <Button type="submit" className="w-full bg-purple-600 hover:bg-purple-700">
                      <Plus className="h-4 w-4 mr-2" />
                      Create Tenant
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tenant Admins Tab */}
            <TabsContent value="admins">
              <Card>
                <CardHeader>
                  <CardTitle>Create Tenant Admin</CardTitle>
                  <CardDescription>Create an admin user for a specific tenant</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleCreateTenantAdmin} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="admin-tenant">Tenant *</Label>
                      <select
                        id="admin-tenant"
                        className="w-full rounded-md border border-input bg-background px-3 py-2"
                        value={newTenantAdmin.tenantId}
                        onChange={(e) => setNewTenantAdmin({ ...newTenantAdmin, tenantId: e.target.value })}
                        required
                      >
                        <option value="">Select a tenant</option>
                        {tenants.map((tenant) => (
                          <option key={tenant.id} value={tenant.id}>
                            {tenant.name} ({tenant.id})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="admin-username">Username *</Label>
                        <Input
                          id="admin-username"
                          placeholder="admin.user"
                          value={newTenantAdmin.username}
                          onChange={(e) => setNewTenantAdmin({ ...newTenantAdmin, username: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="admin-name">Full Name *</Label>
                        <Input
                          id="admin-name"
                          placeholder="John Doe"
                          value={newTenantAdmin.name}
                          onChange={(e) => setNewTenantAdmin({ ...newTenantAdmin, name: e.target.value })}
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="admin-password">Password *</Label>
                      <Input
                        id="admin-password"
                        type="password"
                        placeholder="Enter secure password"
                        value={newTenantAdmin.password}
                        onChange={(e) => setNewTenantAdmin({ ...newTenantAdmin, password: e.target.value })}
                        required
                      />
                      <p className="text-xs text-muted-foreground">
                        Password should be at least 8 characters
                      </p>
                    </div>

                    <Button type="submit" className="w-full bg-purple-600 hover:bg-purple-700">
                      <UserPlus className="h-4 w-4 mr-2" />
                      Create Tenant Admin
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Tenant</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this tenant? This will permanently delete the tenant configuration
              and all associated users. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteTenant}>
              Delete Tenant
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CommonFooter />
    </div>
  )
}
