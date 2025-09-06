"use client"

import { useState } from "react"
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
import {
  Settings,
  Database,
  Users,
  Shield,
  FileText,
  BarChart3,
  Download,
  Upload,
  Globe,
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
} from "lucide-react"

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("overview")
  const [integrationSettings, setIntegrationSettings] = useState({
    pdfExtract: true,
    hl7: false,
    fhir: true,
  })

  const toggleIntegration = (key: keyof typeof integrationSettings) => {
    setIntegrationSettings((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Settings className="h-5 w-5" />
              </div>
              <div>
                <h1 className="font-heading text-xl font-semibold text-foreground">Aivida</h1>
                <p className="text-sm text-muted-foreground">Admin Dashboard</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="bg-transparent">
                System Administrator
              </Badge>
              <Avatar className="h-8 w-8">
                <AvatarImage src="/admin-avatar.png" />
                <AvatarFallback>AD</AvatarFallback>
              </Avatar>
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
            <TabsTrigger value="content" className="flex flex-col gap-1 py-3">
              <Globe className="h-4 w-4" />
              <span className="text-xs">Content</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex flex-col gap-1 py-3">
              <Settings className="h-4 w-4" />
              <span className="text-xs">System</span>
            </TabsTrigger>
          </TabsList>

          {/* Overview Dashboard */}
          <TabsContent value="overview" className="space-y-6">
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
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
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
                <p className="text-muted-foreground">Manage clinician and patient access roles</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline">
                  <Upload className="h-4 w-4 mr-2" />
                  Import Users
                </Button>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add User
                </Button>
              </div>
            </div>

            {/* SSO Configuration */}
            <Card>
              <CardHeader>
                <CardTitle className="font-heading">Single Sign-On (SSO)</CardTitle>
                <CardDescription>Configure SAML/OIDC authentication for pilot deployment</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="saml-endpoint">SAML Endpoint URL</Label>
                    <Input id="saml-endpoint" placeholder="https://your-idp.com/saml/sso" className="mt-1" />
                  </div>
                  <div>
                    <Label htmlFor="oidc-issuer">OIDC Issuer</Label>
                    <Input id="oidc-issuer" placeholder="https://your-idp.com/auth/realms/hospital" className="mt-1" />
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch id="sso-enabled" />
                  <Label htmlFor="sso-enabled">Enable SSO Authentication</Label>
                </div>
              </CardContent>
            </Card>

            {/* User List */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="font-heading">Active Users</CardTitle>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input placeholder="Search users..." className="pl-8 w-64" />
                    </div>
                    <Button variant="outline" size="sm">
                      <Filter className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    {
                      name: "Dr. Sarah Johnson",
                      email: "s.johnson@hospital.com",
                      role: "Clinician",
                      department: "Cardiology",
                      lastActive: "2 hours ago",
                      status: "active",
                    },
                    {
                      name: "Dr. Michael Chen",
                      email: "m.chen@hospital.com",
                      role: "Clinician",
                      department: "Internal Medicine",
                      lastActive: "1 day ago",
                      status: "active",
                    },
                    {
                      name: "John Smith",
                      email: "john.smith@email.com",
                      role: "Patient",
                      department: "N/A",
                      lastActive: "30 min ago",
                      status: "active",
                    },
                  ].map((user, index) => (
                    <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback>
                            {user.name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{user.name}</p>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <Badge variant={user.role === "Clinician" ? "default" : "secondary"}>{user.role}</Badge>
                          <p className="text-xs text-muted-foreground mt-1">{user.department}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm">{user.lastActive}</p>
                          <Badge variant="outline" className="text-xs">
                            {user.status}
                          </Badge>
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
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

            {/* Audit Trail */}
            <Card>
              <CardHeader>
                <CardTitle className="font-heading">Recent Audit Trail</CardTitle>
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
          </TabsContent>

          {/* Content Management */}
          <TabsContent value="content" className="space-y-6">
            <div>
              <h2 className="font-heading text-2xl">Content Management</h2>
              <p className="text-muted-foreground">Manage language packs, disclaimers, and content policies</p>
            </div>

            {/* Language Packs */}
            <Card>
              <CardHeader>
                <CardTitle className="font-heading">Language Packs</CardTitle>
                <CardDescription>Manage multilingual content and translations</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-3 gap-4">
                  {[
                    { code: "en", name: "English", status: "active", completion: "100%" },
                    { code: "es", name: "Spanish", status: "active", completion: "95%" },
                    { code: "zh", name: "Chinese", status: "pending", completion: "60%" },
                  ].map((lang) => (
                    <div key={lang.code} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <p className="font-medium">{lang.name}</p>
                        <p className="text-sm text-muted-foreground">{lang.code.toUpperCase()}</p>
                      </div>
                      <div className="text-right">
                        <Badge variant={lang.status === "active" ? "default" : "secondary"}>{lang.status}</Badge>
                        <p className="text-xs text-muted-foreground mt-1">{lang.completion}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Content Disclaimers */}
            <Card>
              <CardHeader>
                <CardTitle className="font-heading">Content Disclaimers</CardTitle>
                <CardDescription>Legal disclaimers and notices shown to patients</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="medical-disclaimer">Medical Disclaimer</Label>
                  <Textarea
                    id="medical-disclaimer"
                    className="mt-1"
                    rows={4}
                    defaultValue="This information is for educational purposes only and should not replace professional medical advice. Always consult your healthcare provider for medical decisions."
                  />
                </div>
                <div>
                  <Label htmlFor="privacy-notice">Privacy Notice</Label>
                  <Textarea
                    id="privacy-notice"
                    className="mt-1"
                    rows={3}
                    defaultValue="Your health information is protected under HIPAA. We use secure systems to protect your privacy and confidentiality."
                  />
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
    </div>
  )
}
