"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { useTenant } from "@/contexts/tenant-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { FeedbackButton } from "@/components/feedback-button"
import { CommonHeader } from "@/components/common-header"
import { CommonFooter } from "@/components/common-footer"
import { AuthGuard } from "@/components/auth-guard"
import { ErrorBoundary } from "@/components/error-boundary"
import { TenantButton } from "@/components/tenant-button"
import { tenantColors } from "@/lib/tenant-colors"
import { AddUserDialog, EditUserDialog, DeleteUserDialog } from "@/components/user-management-dialogs"
import { listUsers, createUser, updateUser, deleteUser, type User, type CreateUserRequest, type UpdateUserRequest } from "@/lib/api/users"
import { getTenantMetrics } from "@/lib/api/tenant"
import type { TenantMetrics } from "@/types/tenant-metrics"
import { useToast } from "@/hooks/use-toast"
import {
  Settings,
  Database,
  Users,
  Shield,
  FileText,
  BarChart3,
  Download,
  Upload,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Eye,
  Edit,
  Trash2,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Bell,
  PieChart,
  LineChart,
  Activity,
  Brain,
  Zap,
  Star,
  LogOut,
} from "lucide-react"

export default function AdminDashboard() {
  const params = useParams()
  const { user, token, tenantId, logout } = useTenant()
  const { toast } = useToast()

  const [activeTab, setActiveTab] = useState("overview")
  const [integrationSettings, setIntegrationSettings] = useState({
    pdfExtract: true,
    hl7: false,
    fhir: true,
  })
  const [notifications, setNotifications] = useState([
    {
      id: 1,
      type: "info",
      title: "New User Registered",
      message: "Dr. Emily Rodriguez joined the Cardiology department",
      timestamp: "15 minutes ago",
      unread: true,
    },
    {
      id: 2,
      type: "success",
      title: "Backup Completed",
      message: "Daily backup completed successfully",
      timestamp: "1 hour ago",
      unread: false,
    },
  ])
  const [isLiveMode, setIsLiveMode] = useState(true)

  // User management state
  const [users, setUsers] = useState<User[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [addUserOpen, setAddUserOpen] = useState(false)
  const [editUserOpen, setEditUserOpen] = useState(false)
  const [deleteUserOpen, setDeleteUserOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)

  // Analytics/metrics state
  const [metrics, setMetrics] = useState<TenantMetrics | null>(null)
  const [loadingMetrics, setLoadingMetrics] = useState(false)

  const toggleIntegration = (key: keyof typeof integrationSettings) => {
    setIntegrationSettings((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  // Fetch users when component mounts or when users tab is active
  useEffect(() => {
    if (activeTab === "users" && token && tenantId) {
      fetchUsers()
    }
  }, [activeTab, token, tenantId])

  // Fetch metrics when analytics tab is active
  useEffect(() => {
    if (activeTab === "analytics" && token && tenantId) {
      fetchMetrics()
    }
  }, [activeTab, token, tenantId])

  const fetchUsers = async () => {
    if (!token || !tenantId) return

    setLoadingUsers(true)
    try {
      const fetchedUsers = await listUsers(tenantId, token)
      setUsers(fetchedUsers)
    } catch (error) {
      console.error('Error fetching users:', error)
      toast({
        title: "Error",
        description: "Failed to load users. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoadingUsers(false)
    }
  }

  const fetchMetrics = async () => {
    if (!token || !tenantId) return

    setLoadingMetrics(true)
    try {
      const fetchedMetrics = await getTenantMetrics(tenantId, token)
      setMetrics(fetchedMetrics)
    } catch (error) {
      console.error('Error fetching metrics:', error)
      toast({
        title: "Error",
        description: "Failed to load analytics. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoadingMetrics(false)
    }
  }

  const handleCreateUser = async (request: CreateUserRequest) => {
    if (!token || !tenantId) return

    try {
      await createUser(request, tenantId, token)
      toast({
        title: "Success",
        description: "User created successfully",
      })
      fetchUsers() // Refresh the list
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create user",
        variant: "destructive",
      })
      throw error
    }
  }

  const handleUpdateUser = async (userId: string, request: UpdateUserRequest) => {
    if (!token || !tenantId) return

    try {
      await updateUser(userId, request, tenantId, token)
      toast({
        title: "Success",
        description: "User updated successfully",
      })
      fetchUsers() // Refresh the list
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update user",
        variant: "destructive",
      })
      throw error
    }
  }

  const handleDeleteUser = async (userId: string) => {
    if (!token || !tenantId) return

    try {
      await deleteUser(userId, tenantId, token)
      toast({
        title: "Success",
        description: "User deleted successfully",
      })
      fetchUsers() // Refresh the list
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete user",
        variant: "destructive",
      })
      throw error
    }
  }

  // Filter users based on search query
  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <ErrorBoundary>
      <AuthGuard>
        <div className="min-h-screen bg-background flex flex-col">
      <CommonHeader title="Admin Portal" />
      
      {/* Admin Portal Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Settings className="h-5 w-5" />
              </div>
              <div>
                <h1 className="font-heading text-xl font-semibold text-foreground">Admin Portal</h1>
                <p className="text-sm text-muted-foreground">Admin Dashboard</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <FeedbackButton userType="admin" />
              <Badge variant="outline" className="bg-transparent">
                System Administrator
              </Badge>
              <Avatar className="h-8 w-8">
                <AvatarImage src="/admin-avatar.png" />
                <AvatarFallback>AD</AvatarFallback>
              </Avatar>
              <Button variant="ghost" size="sm" onClick={logout}>
                <LogOut className="h-4 w-4" />
                <span className="ml-2 hidden sm:inline">Logout</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-6 h-auto p-1">
            <TabsTrigger value="overview" className="flex flex-col gap-1 py-3">
              <BarChart3 className="h-4 w-4" />
              <span className="text-xs">Overview</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex flex-col gap-1 py-3">
              <PieChart className="h-4 w-4" />
              <span className="text-xs">Analytics</span>
            </TabsTrigger>
            <TabsTrigger value="integrations" className="flex flex-col gap-1 py-3">
              <Database className="h-4 w-4" />
              <span className="text-xs">Data Sources</span>
            </TabsTrigger>
            <TabsTrigger value="users" className="flex flex-col gap-1 py-3">
              <Users className="h-4 w-4" />
              <span className="text-xs">User Management</span>
            </TabsTrigger>
            <TabsTrigger value="audit" className="flex flex-col gap-1 py-3">
              <Shield className="h-4 w-4" />
              <span className="text-xs">Audit & Logs</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex flex-col gap-1 py-3">
              <Settings className="h-4 w-4" />
              <span className="text-xs">System</span>
            </TabsTrigger>
          </TabsList>

          {/* Overview Dashboard */}
          <TabsContent value="overview" className="space-y-6">
            {/* Live Mode Toggle and Notifications */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${isLiveMode ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
                  <span className="text-sm font-medium">
                    {isLiveMode ? 'Live Mode' : 'Static Mode'}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsLiveMode(!isLiveMode)}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  {isLiveMode ? 'Pause Updates' : 'Resume Updates'}
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm">
                  <Bell className="h-4 w-4 mr-2" />
                  Notifications ({notifications.filter(n => n.unread).length})
                </Button>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Export Report
                </Button>
              </div>
            </div>

            {/* Key Metrics */}
            <div className="grid md:grid-cols-4 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Discharges Processed</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">1,247</div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <TrendingUp className="h-3 w-3 text-green-500" />
                    +12% from last month
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
                  <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">94.2%</div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <TrendingUp className="h-3 w-3 text-green-500" />
                    +2.1% from last month
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Patient Satisfaction</CardTitle>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">4.7/5</div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <TrendingUp className="h-3 w-3 text-green-500" />
                    +0.3 from last month
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Readmission Rate</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">8.3%</div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <TrendingDown className="h-3 w-3 text-green-500" />
                    -1.2% from last month
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Section Completion Rates */}
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="font-heading">Section Completion Rates</CardTitle>
                  <CardDescription>Percentage of discharges with complete sections</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Medications</span>
                    <div className="flex items-center gap-2">
                      <div className="w-32 bg-muted rounded-full h-2">
                        <div className="bg-primary h-2 rounded-full" style={{ width: "96%" }}></div>
                      </div>
                      <span className="text-sm font-medium">96%</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Appointments</span>
                    <div className="flex items-center gap-2">
                      <div className="w-32 bg-muted rounded-full h-2">
                        <div className="bg-secondary h-2 rounded-full" style={{ width: "89%" }}></div>
                      </div>
                      <span className="text-sm font-medium">89%</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Diet & Activity</span>
                    <div className="flex items-center gap-2">
                      <div className="w-32 bg-muted rounded-full h-2">
                        <div className="bg-accent h-2 rounded-full" style={{ width: "92%" }}></div>
                      </div>
                      <span className="text-sm font-medium">92%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="font-heading">Recent Activity</CardTitle>
                  <CardDescription>Latest system events and updates</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-3 text-sm">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-muted-foreground">Dr. Johnson published 3 discharge instructions</span>
                    <span className="text-xs text-muted-foreground ml-auto">2 min ago</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <div className="w-2 h-2 rounded-full" style={tenantColors.bgPrimary}></div>
                    <span className="text-muted-foreground">New FHIR integration configured</span>
                    <span className="text-xs text-muted-foreground ml-auto">1 hour ago</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                    <span className="text-muted-foreground">User access review completed</span>
                    <span className="text-xs text-muted-foreground ml-auto">3 hours ago</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Analytics Dashboard */}
          <TabsContent value="analytics" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-heading text-2xl">Analytics Dashboard</h2>
                <p className="text-muted-foreground">Comprehensive insights and performance metrics</p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Export Data
                </Button>
                <Button variant="outline" size="sm" onClick={fetchMetrics} disabled={loadingMetrics}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${loadingMetrics ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
            </div>

            {/* Key Performance Indicators */}
            {loadingMetrics ? (
              <div className="grid md:grid-cols-3 gap-6">
                {[1, 2, 3].map((i) => (
                  <Card key={i}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Loading...</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-8 bg-muted animate-pulse rounded"></div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : metrics ? (
              <div className="grid md:grid-cols-3 gap-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Discharge Summaries</CardTitle>
                    <Activity className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{metrics.dischargeSummaries.total.toLocaleString()}</div>
                    <p className="text-xs text-muted-foreground">
                      Simplified: {metrics.dischargeSummaries.byStatus.simplified}, Translated: {metrics.dischargeSummaries.byStatus.translated}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{metrics.users.total.toLocaleString()}</div>
                    <p className="text-xs text-muted-foreground">
                      Patients: {metrics.users.byRole.patient}, Clinicians: {metrics.users.byRole.clinician}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Expert Feedback</CardTitle>
                    <Star className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{metrics.expertFeedback.averageRating.toFixed(1)}/5</div>
                    <p className="text-xs text-muted-foreground">
                      Based on {metrics.expertFeedback.total} feedback submissions
                    </p>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="grid md:grid-cols-3 gap-6">
                <Card className="col-span-3">
                  <CardContent className="pt-6">
                    <p className="text-center text-muted-foreground">No metrics available. Click Refresh to load data.</p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Charts Section */}
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="font-heading">Discharge Volume Trends</CardTitle>
                  <CardDescription>Monthly discharge processing over the last 12 months</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-64 flex items-center justify-center bg-muted/30 rounded-lg">
                    <div className="text-center">
                      <LineChart className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">Line chart showing discharge trends</p>
                      <p className="text-xs text-muted-foreground">Integration with charting library needed</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="font-heading">Department Distribution</CardTitle>
                  <CardDescription>Discharge processing by hospital department</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-64 flex items-center justify-center bg-muted/30 rounded-lg">
                    <div className="text-center">
                      <PieChart className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">Pie chart showing department breakdown</p>
                      <p className="text-xs text-muted-foreground">Integration with charting library needed</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Usage Metrics */}
            {metrics && (
              <div className="grid md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="font-heading">User Breakdown by Role</CardTitle>
                    <CardDescription>Distribution of users across different roles</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Patients</span>
                      <span className="text-sm font-medium">{metrics.users.byRole.patient.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Clinicians</span>
                      <span className="text-sm font-medium">{metrics.users.byRole.clinician.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Experts</span>
                      <span className="text-sm font-medium">{metrics.users.byRole.expert.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Tenant Admins</span>
                      <span className="text-sm font-medium">{metrics.users.byRole.tenant_admin.toLocaleString()}</span>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between font-medium">
                      <span className="text-sm">Total Users</span>
                      <span className="text-sm">{metrics.users.total.toLocaleString()}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="font-heading">Discharge Summary Status</CardTitle>
                    <CardDescription>Breakdown of discharge summaries by processing status</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Raw Only</span>
                      <span className="text-sm font-medium">{metrics.dischargeSummaries.byStatus.raw_only.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Simplified</span>
                      <span className="text-sm font-medium">{metrics.dischargeSummaries.byStatus.simplified.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Translated</span>
                      <span className="text-sm font-medium">{metrics.dischargeSummaries.byStatus.translated.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Processing</span>
                      <span className="text-sm font-medium">{metrics.dischargeSummaries.byStatus.processing.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Error</span>
                      <span className="text-sm font-medium text-destructive">{metrics.dischargeSummaries.byStatus.error.toLocaleString()}</span>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between font-medium">
                      <span className="text-sm">Total</span>
                      <span className="text-sm">{metrics.dischargeSummaries.total.toLocaleString()}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Quality Metrics */}
            {metrics && (
              <div className="grid md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="font-heading">Expert Feedback Quality</CardTitle>
                    <CardDescription>Ratings from expert reviewers on discharge summaries</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Average Rating</span>
                      <div className="flex items-center gap-2">
                        <div className="w-32 bg-muted rounded-full h-3">
                          <div
                            className="bg-green-500 h-3 rounded-full transition-all"
                            style={{ width: `${(metrics.expertFeedback.averageRating / 5) * 100}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-medium">{metrics.expertFeedback.averageRating.toFixed(1)}/5</span>
                      </div>
                    </div>
                    <Separator />
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Total Feedback Submissions</span>
                        <span className="font-medium">{metrics.expertFeedback.total.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Summaries Reviewed</span>
                        <span className="font-medium">{((metrics.expertFeedback.total / metrics.dischargeSummaries.total) * 100).toFixed(1)}%</span>
                      </div>
                    </div>
                    <Separator />
                    <div className="text-xs text-muted-foreground">
                      <p>• Expert feedback helps improve AI-generated summaries</p>
                      <p>• Ratings are submitted by clinical experts reviewing discharge instructions</p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="font-heading">System Health</CardTitle>
                    <CardDescription>Processing status and error rates</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Success Rate</span>
                        <span className="font-medium text-green-600">
                          {(((metrics.dischargeSummaries.total - metrics.dischargeSummaries.byStatus.error) / metrics.dischargeSummaries.total) * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className="bg-green-500 h-2 rounded-full transition-all"
                          style={{ width: `${((metrics.dischargeSummaries.total - metrics.dischargeSummaries.byStatus.error) / metrics.dischargeSummaries.total) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                    <Separator />
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Currently Processing</span>
                        <Badge variant="secondary">{metrics.dischargeSummaries.byStatus.processing.toLocaleString()}</Badge>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Errors</span>
                        <Badge variant="destructive">{metrics.dischargeSummaries.byStatus.error.toLocaleString()}</Badge>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Completed Successfully</span>
                        <Badge variant="default">{(metrics.dischargeSummaries.byStatus.simplified + metrics.dischargeSummaries.byStatus.translated).toLocaleString()}</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

          </TabsContent>

          {/* Data Sources & Integrations */}
          <TabsContent value="integrations" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-heading text-2xl">Data Source Configuration</h2>
                <p className="text-muted-foreground">Configure input sources and FHIR resource mappings</p>
              </div>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Integration
              </Button>
            </div>

            {/* Input Sources */}
            <Card>
              <CardHeader>
                <CardTitle className="font-heading">Input Sources</CardTitle>
                <CardDescription>Toggle available data input methods</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base">PDF Document Extraction</Label>
                    <p className="text-sm text-muted-foreground">Extract data from uploaded PDF discharge summaries</p>
                  </div>
                  <Switch
                    checked={integrationSettings.pdfExtract}
                    onCheckedChange={() => toggleIntegration("pdfExtract")}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base">HL7 Messages</Label>
                    <p className="text-sm text-muted-foreground">Process HL7 ADT and discharge messages</p>
                  </div>
                  <Switch checked={integrationSettings.hl7} onCheckedChange={() => toggleIntegration("hl7")} />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base">FHIR Endpoints</Label>
                    <p className="text-sm text-muted-foreground">Connect to FHIR R4 compliant systems</p>
                  </div>
                  <Switch checked={integrationSettings.fhir} onCheckedChange={() => toggleIntegration("fhir")} />
                </div>
              </CardContent>
            </Card>

            {/* FHIR Resource Mapping */}
            <Card>
              <CardHeader>
                <CardTitle className="font-heading">FHIR Resource Mapping</CardTitle>
                <CardDescription>Configure how FHIR resources map to discharge instruction sections</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="medication-resource">Medication Resources</Label>
                    <Input
                      id="medication-resource"
                      defaultValue="MedicationRequest, MedicationStatement"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="appointment-resource">Appointment Resources</Label>
                    <Input id="appointment-resource" defaultValue="Appointment, ServiceRequest" className="mt-1" />
                  </div>
                  <div>
                    <Label htmlFor="nutrition-resource">Nutrition Resources</Label>
                    <Input id="nutrition-resource" defaultValue="NutritionOrder, DiagnosticReport" className="mt-1" />
                  </div>
                  <div>
                    <Label htmlFor="careplan-resource">Care Plan Resources</Label>
                    <Input id="careplan-resource" defaultValue="CarePlan, Goal" className="mt-1" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* User Management */}
          <TabsContent value="users" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-heading text-2xl">User Management</h2>
                <p className="text-muted-foreground">Manage users for patient, clinician, expert, and admin roles</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline">
                  <Upload className="h-4 w-4 mr-2" />
                  Import Users
                </Button>
                <Button onClick={() => setAddUserOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add User
                </Button>
              </div>
            </div>

            {/* User List */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="font-heading">Active Users ({filteredUsers.length})</CardTitle>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search users..."
                        className="pl-8 w-64"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                    <Button variant="outline" size="sm" onClick={fetchUsers} disabled={loadingUsers}>
                      <RefreshCw className={`h-4 w-4 ${loadingUsers ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loadingUsers ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-center">
                      <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Loading users...</p>
                    </div>
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-center">
                      <Users className="h-12 w-12 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        {searchQuery ? 'No users found matching your search' : 'No users found. Click "Add User" to create one.'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredUsers.map((user) => (
                      <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback>
                              {user.name
                                .split(" ")
                                .map((n) => n[0])
                                .join("")
                                .toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{user.name}</p>
                            <p className="text-sm text-muted-foreground">@{user.username}</p>
                            {user.email && (
                              <p className="text-xs text-muted-foreground">{user.email}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="flex items-center gap-2">
                              <Badge variant={
                                user.role === "tenant_admin" || user.role === "system_admin" ? "default" :
                                user.role === "clinician" ? "secondary" :
                                user.role === "expert" ? "outline" :
                                "outline"
                              }>
                                {user.role === "tenant_admin" ? "Tenant Admin" :
                                 user.role === "system_admin" ? "System Admin" :
                                 user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                              </Badge>
                              {!user.isActive && (
                                <Badge variant="destructive" className="text-xs">Inactive</Badge>
                              )}
                              {user.isLocked && (
                                <Badge variant="destructive" className="text-xs">Locked</Badge>
                              )}
                            </div>
                            {user.linkedPatientId && (
                              <p className="text-xs text-muted-foreground mt-1">Patient ID: {user.linkedPatientId}</p>
                            )}
                          </div>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedUser(user)
                                setEditUserOpen(true)
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedUser(user)
                                setDeleteUserOpen(true)
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Audit & Logs */}
          <TabsContent value="audit" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-heading text-2xl">Audit & Logs</h2>
                <p className="text-muted-foreground">View access trails and export anonymized metrics</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Export Logs
                </Button>
                <Button variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Export Metrics
                </Button>
              </div>
            </div>

            {/* User Activity Audit Trail */}
            <Card>
              <CardHeader>
                <CardTitle className="font-heading">User Activity Audit Trail</CardTitle>
                <CardDescription>Who viewed, edited, or published discharge instructions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    {
                      timestamp: "2024-03-15 14:30:22",
                      user: "Dr. Sarah Johnson",
                      action: "Published",
                      resource: "Discharge Instructions - John Smith",
                      ip: "192.168.1.100",
                    },
                    {
                      timestamp: "2024-03-15 14:25:15",
                      user: "Dr. Sarah Johnson",
                      action: "Edited",
                      resource: "Medication Section - John Smith",
                      ip: "192.168.1.100",
                    },
                    {
                      timestamp: "2024-03-15 14:20:08",
                      user: "John Smith",
                      action: "Viewed",
                      resource: "Discharge Instructions",
                      ip: "10.0.0.45",
                    },
                    {
                      timestamp: "2024-03-15 13:45:33",
                      user: "Dr. Michael Chen",
                      action: "Generated",
                      resource: "AI Summary - Maria Garcia",
                      ip: "192.168.1.102",
                    },
                  ].map((log, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg text-sm">
                      <div className="flex items-center gap-4">
                        <div className="text-muted-foreground font-mono">{log.timestamp}</div>
                        <div className="font-medium">{log.user}</div>
                        <Badge
                          variant={
                            log.action === "Published" ? "default" : log.action === "Edited" ? "secondary" : "outline"
                          }
                        >
                          {log.action}
                        </Badge>
                        <div className="text-muted-foreground">{log.resource}</div>
                      </div>
                      <div className="text-muted-foreground font-mono text-xs">{log.ip}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* AI Audit Logs */}
            <Card>
              <CardHeader>
                <CardTitle className="font-heading">AI Audit Logs</CardTitle>
                <CardDescription>AI-generated discharge summaries for review and validation</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {[
                    {
                      timestamp: "2024-03-15 15:45:12",
                      patient: "Priya Sharma",
                      mrn: "P-12345",
                      action: "Generated",
                      processingTime: "3.2s",
                      originalSummary: "Patient underwent laparoscopic cholecystectomy for acute cholecystitis. Post-operative course was uncomplicated. Patient was started on clear liquids and advanced to regular diet as tolerated. Incision sites are clean, dry, and intact with no signs of infection. Patient ambulated without difficulty. Pain well controlled with oral analgesics. Discharge medications include: Acetaminophen 650mg PO q6h PRN pain, Ibuprofen 400mg PO q8h PRN pain, Oxycodone 5mg PO q4h PRN severe pain. Follow-up with general surgery in 2 weeks. Return to ED for fever >101.5°F, severe abdominal pain, or signs of infection.",
                      simplifiedSummary: "You had surgery to remove your gallbladder. Everything went well! You can eat normally now. Your cuts are healing nicely. Keep taking your pain medicine as needed. See your surgeon in 2 weeks. Call us if you get a fever over 101.5°F or have severe belly pain."
                    },
                    {
                      timestamp: "2024-03-15 15:42:33",
                      patient: "Nguyen Minh Duc",
                      mrn: "N-34567",
                      action: "Regenerated",
                      processingTime: "2.8s",
                      originalSummary: "Patient presented with acute appendicitis and underwent laparoscopic appendectomy. Post-operative recovery was uneventful. Patient tolerated diet advancement well. Surgical incisions are healing appropriately. Patient ambulating independently. Pain management adequate with prescribed medications. Discharge instructions include: Acetaminophen 650mg PO q6h, Ibuprofen 400mg PO q8h, return to general surgery clinic in 1 week, resume normal activities as tolerated, avoid heavy lifting for 2 weeks. Patient counseled on signs of infection and when to seek medical attention.",
                      simplifiedSummary: "You had surgery to remove your appendix. You're recovering well! You can eat normally and walk around. Take your pain medicine as directed. Come back to see us in 1 week. You can do normal activities but don't lift heavy things for 2 weeks. Call us if you see signs of infection."
                    },
                    {
                      timestamp: "2024-03-15 15:38:45",
                      patient: "John Smith",
                      mrn: "J-78901",
                      action: "Translated",
                      processingTime: "1.9s",
                      originalSummary: "Patient admitted for acute myocardial infarction, underwent cardiac catheterization with stent placement. Post-procedure course stable. Patient on dual antiplatelet therapy. Discharge medications: Aspirin 81mg daily, Clopidogrel 75mg daily, Atorvastatin 40mg daily, Metoprolol 25mg BID. Follow-up with cardiology in 1 week. Cardiac rehabilitation recommended. Return to ED for chest pain, shortness of breath, or signs of bleeding.",
                      simplifiedSummary: "You had a heart attack and we put in a stent to help your heart. You're doing well! Take your heart medicines every day. See your heart doctor in 1 week. Start cardiac rehab when ready. Call 911 if you have chest pain or trouble breathing."
                    },
                  ].map((log, index) => (
                    <div key={index} className="border rounded-lg p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="text-muted-foreground font-mono text-xs">{log.timestamp}</div>
                          <div className="flex items-center gap-2">
                            <Brain className="h-4 w-4 text-blue-500" />
                            <span className="font-medium">GPT-4</span>
                          </div>
                          <Badge variant="default">{log.action}</Badge>
                          <div className="text-muted-foreground">
                            {log.patient} ({log.mrn})
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <div className="text-right">
                            <div>Processing Time: {log.processingTime}</div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <h4 className="font-medium text-sm mb-2 text-red-600">Original Discharge Summary</h4>
                          <div className="bg-red-50 border border-red-200 rounded p-3 text-xs max-h-32 overflow-y-auto">
                            {log.originalSummary}
                          </div>
                        </div>
                        <div>
                          <h4 className="font-medium text-sm mb-2 text-green-600">Simplified Patient Version</h4>
                          <div className="bg-green-50 border border-green-200 rounded p-3 text-xs max-h-32 overflow-y-auto">
                            {log.simplifiedSummary}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* System Settings */}
          <TabsContent value="settings" className="space-y-6">
            <div>
              <h2 className="font-heading text-2xl">System Settings</h2>
              <p className="text-muted-foreground">Configure retention policies and system preferences</p>
            </div>

            {/* Data Retention */}
            <Card>
              <CardHeader>
                <CardTitle className="font-heading">Data Retention Policy</CardTitle>
                <CardDescription>Configure how long data is stored in the system</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="patient-data-retention">Patient Data Retention (days)</Label>
                    <Input id="patient-data-retention" type="number" defaultValue="2555" className="mt-1" />
                    <p className="text-xs text-muted-foreground mt-1">7 years (HIPAA requirement)</p>
                  </div>
                  <div>
                    <Label htmlFor="audit-log-retention">Audit Log Retention (days)</Label>
                    <Input id="audit-log-retention" type="number" defaultValue="2190" className="mt-1" />
                    <p className="text-xs text-muted-foreground mt-1">6 years (compliance requirement)</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch id="auto-purge" />
                  <Label htmlFor="auto-purge">Enable automatic data purging</Label>
                </div>
              </CardContent>
            </Card>

            {/* API Management */}
            <Card>
              <CardHeader>
                <CardTitle className="font-heading">API Management</CardTitle>
                <CardDescription>Manage API keys, rate limits, and access controls</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="api-rate-limit">API Rate Limit (requests/hour)</Label>
                    <Input id="api-rate-limit" type="number" defaultValue="1000" className="mt-1" />
                  </div>
                  <div>
                    <Label htmlFor="api-timeout">Request Timeout (seconds)</Label>
                    <Input id="api-timeout" type="number" defaultValue="30" className="mt-1" />
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">Production API Key</p>
                      <p className="text-sm text-muted-foreground">prod_****_****_****_****</p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm">
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">Development API Key</p>
                      <p className="text-sm text-muted-foreground">dev_****_****_****_****</p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm">
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* System Preferences */}
            <Card>
              <CardHeader>
                <CardTitle className="font-heading">System Preferences</CardTitle>
                <CardDescription>General system configuration options</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base">Maintenance Mode</Label>
                    <p className="text-sm text-muted-foreground">Temporarily disable patient access for maintenance</p>
                  </div>
                  <Switch />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base">Email Notifications</Label>
                    <p className="text-sm text-muted-foreground">Send system alerts and notifications via email</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base">Analytics Collection</Label>
                    <p className="text-sm text-muted-foreground">Collect anonymized usage analytics</p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <CommonFooter />

      {/* User Management Dialogs */}
      <AddUserDialog
        open={addUserOpen}
        onOpenChange={setAddUserOpen}
        onSubmit={handleCreateUser}
      />
      <EditUserDialog
        open={editUserOpen}
        onOpenChange={setEditUserOpen}
        user={selectedUser}
        onSubmit={handleUpdateUser}
      />
      <DeleteUserDialog
        open={deleteUserOpen}
        onOpenChange={setDeleteUserOpen}
        user={selectedUser}
        onConfirm={handleDeleteUser}
      />
      </div>
      </AuthGuard>
    </ErrorBoundary>
  )
}
