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
import { getAuditLogs } from "@/lib/api/audit-logs"
import type { TenantMetrics } from "@/types/tenant-metrics"
import type { AuditLog } from "@/types/audit-logs"
import { useToast } from "@/hooks/use-toast"
import {
  Settings,
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

  // Audit logs state
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [loadingAuditLogs, setLoadingAuditLogs] = useState(false)
  const [auditLogFilter, setAuditLogFilter] = useState<'all' | 'clinician_activity' | 'simplification' | 'translation' | 'chatbot'>('all')

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

  // Fetch audit logs when audit tab is active
  useEffect(() => {
    if (activeTab === "audit" && token && tenantId) {
      fetchAuditLogs()
    }
  }, [activeTab, token, tenantId, auditLogFilter])

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

  const fetchAuditLogs = async () => {
    if (!token || !tenantId) return

    setLoadingAuditLogs(true)
    try {
      const response = await getAuditLogs(
        {
          type: auditLogFilter === 'all' ? undefined : auditLogFilter,
          limit: 50,
          offset: 0,
        },
        tenantId,
        token
      )
      setAuditLogs(response.items)
    } catch (error) {
      console.error('Error fetching audit logs:', error)
      toast({
        title: "Error",
        description: "Failed to load audit logs. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoadingAuditLogs(false)
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
          <TabsList className="grid w-full grid-cols-5 h-auto p-1">
            <TabsTrigger value="overview" className="flex flex-col gap-1 py-3">
              <BarChart3 className="h-4 w-4" />
              <span className="text-xs">Overview</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex flex-col gap-1 py-3">
              <PieChart className="h-4 w-4" />
              <span className="text-xs">Analytics</span>
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
                <p className="text-muted-foreground">Track all system activities and AI operations</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={fetchAuditLogs} disabled={loadingAuditLogs}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${loadingAuditLogs ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Export Logs
                </Button>
              </div>
            </div>

            {/* Filter Tabs */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex gap-2">
                  <Button
                    variant={auditLogFilter === 'all' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setAuditLogFilter('all')}
                  >
                    All Activity
                  </Button>
                  <Button
                    variant={auditLogFilter === 'clinician_activity' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setAuditLogFilter('clinician_activity')}
                  >
                    Clinician Activity
                  </Button>
                  <Button
                    variant={auditLogFilter === 'simplification' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setAuditLogFilter('simplification')}
                  >
                    Simplifications
                  </Button>
                  <Button
                    variant={auditLogFilter === 'translation' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setAuditLogFilter('translation')}
                  >
                    Translations
                  </Button>
                  <Button
                    variant={auditLogFilter === 'chatbot' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setAuditLogFilter('chatbot')}
                  >
                    Chatbot
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Audit Logs */}
            <Card>
              <CardHeader>
                <CardTitle className="font-heading">Activity Logs</CardTitle>
                <CardDescription>Comprehensive audit trail of all system activities</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingAuditLogs ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-center">
                      <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Loading audit logs...</p>
                    </div>
                  </div>
                ) : auditLogs.length === 0 ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-center">
                      <Shield className="h-12 w-12 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">No audit logs found</p>
                      <p className="text-xs text-muted-foreground mt-1">Logs will appear here as activities occur</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {auditLogs.map((log) => (
                      <div key={log.id} className="border rounded-lg p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="text-muted-foreground font-mono text-xs">
                              {new Date(log.timestamp).toLocaleString()}
                            </div>
                            {log.type === 'clinician_activity' && (
                              <>
                                <Badge variant="default">{log.type.replace('_', ' ')}</Badge>
                                <Badge variant="secondary">{log.action}</Badge>
                                <div className="text-sm">
                                  <span className="font-medium">{log.userName || log.userId}</span>
                                  <span className="text-muted-foreground"> {log.action} </span>
                                  <span className="font-medium">{log.resourceType.replace('_', ' ')}</span>
                                  {log.patientName && (
                                    <span className="text-muted-foreground"> for {log.patientName}</span>
                                  )}
                                </div>
                              </>
                            )}
                            {log.type === 'simplification' && (
                              <>
                                <Badge variant="default">Simplification</Badge>
                                <Badge variant={
                                  log.action === 'completed' ? 'default' :
                                  log.action === 'failed' ? 'destructive' : 'secondary'
                                }>
                                  {log.action}
                                </Badge>
                                <div className="text-sm">
                                  <span className="text-muted-foreground">Patient: </span>
                                  <span className="font-medium">{log.patientName || log.patientId}</span>
                                  {log.processingTime && (
                                    <span className="text-muted-foreground ml-2">
                                      ({(log.processingTime / 1000).toFixed(1)}s)
                                    </span>
                                  )}
                                </div>
                              </>
                            )}
                            {log.type === 'translation' && (
                              <>
                                <Badge variant="default">Translation</Badge>
                                <Badge variant={
                                  log.action === 'completed' ? 'default' :
                                  log.action === 'failed' ? 'destructive' : 'secondary'
                                }>
                                  {log.action}
                                </Badge>
                                <div className="text-sm">
                                  <span className="font-medium">{log.sourceLanguage}</span>
                                  <span className="text-muted-foreground"> → </span>
                                  <span className="font-medium">{log.targetLanguage}</span>
                                  <span className="text-muted-foreground"> for {log.patientName || log.patientId}</span>
                                  {log.processingTime && (
                                    <span className="text-muted-foreground ml-2">
                                      ({(log.processingTime / 1000).toFixed(1)}s)
                                    </span>
                                  )}
                                </div>
                              </>
                            )}
                            {log.type === 'chatbot' && (
                              <>
                                <Badge variant="default">Chatbot</Badge>
                                <Badge variant="secondary">{log.action.replace('_', ' ')}</Badge>
                                <div className="text-sm">
                                  <span className="text-muted-foreground">Patient: </span>
                                  <span className="font-medium">{log.patientName || log.patientId}</span>
                                </div>
                              </>
                            )}
                          </div>
                          {log.type === 'simplification' || log.type === 'translation' ? (
                            <div className="flex items-center gap-2">
                              {log.aiModel && (
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Brain className="h-3 w-3" />
                                  <span>{log.aiModel}</span>
                                </div>
                              )}
                            </div>
                          ) : null}
                        </div>

                        {log.type === 'chatbot' && (
                          <div className="mt-2 space-y-2">
                            <div className="bg-blue-50 border border-blue-200 rounded p-2 text-xs">
                              <div className="font-medium text-blue-900 mb-1">Message:</div>
                              <div>{log.message}</div>
                            </div>
                            {log.response && (
                              <div className="bg-green-50 border border-green-200 rounded p-2 text-xs">
                                <div className="font-medium text-green-900 mb-1">Response:</div>
                                <div>{log.response}</div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
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
