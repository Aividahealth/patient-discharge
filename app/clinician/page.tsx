"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import {
  Upload,
  FileText,
  Edit3,
  Eye,
  Save,
  Send,
  Download,
  Printer as Print,
  AlertCircle,
  User,
  Stethoscope,
  RefreshCw,
} from "lucide-react"

export default function ClinicianDashboard() {
  const [selectedPatient, setSelectedPatient] = useState<string | null>("patient-1")
  const [editMode, setEditMode] = useState(false)
  const [approvalStatus, setApprovalStatus] = useState({
    medications: false,
    appointments: false,
    dietActivity: false,
  })

  const patients = [
    {
      id: "patient-1",
      name: "John Smith",
      mrn: "MRN-12345",
      room: "Room 302",
      dischargeDate: "2024-03-15",
      status: "pending-review",
    },
    {
      id: "patient-2",
      name: "Maria Garcia",
      mrn: "MRN-67890",
      room: "Room 205",
      dischargeDate: "2024-03-16",
      status: "approved",
    },
  ]

  const toggleApproval = (section: keyof typeof approvalStatus) => {
    setApprovalStatus((prev) => ({ ...prev, [section]: !prev[section] }))
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                <Stethoscope className="h-5 w-5" />
              </div>
              <div>
                <h1 className="font-heading text-xl font-semibold text-foreground">Aivida</h1>
                <p className="text-sm text-muted-foreground">Clinician Portal</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="bg-transparent">
                Dr. Sarah Johnson, MD
              </Badge>
              <Avatar className="h-8 w-8">
                <AvatarImage src="/clinician-avatar.png" />
                <AvatarFallback>SJ</AvatarFallback>
              </Avatar>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <div className="grid lg:grid-cols-4 gap-6">
          {/* Patient List Sidebar */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="font-heading text-lg">Discharge Queue</CardTitle>
                <CardDescription>Patients ready for discharge review</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button className="w-full justify-start bg-transparent" variant="outline">
                  <Upload className="h-4 w-4 mr-2" />
                  Upload New Summary
                </Button>
                <Separator />
                {patients.map((patient) => (
                  <div
                    key={patient.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedPatient === patient.id
                        ? "border-secondary bg-secondary/10"
                        : "border-border hover:border-secondary/50"
                    }`}
                    onClick={() => setSelectedPatient(patient.id)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-medium text-sm">{patient.name}</p>
                        <p className="text-xs text-muted-foreground">{patient.mrn}</p>
                      </div>
                      <Badge variant={patient.status === "approved" ? "default" : "secondary"} className="text-xs">
                        {patient.status === "approved" ? "Approved" : "Review"}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground space-y-1">
                      <p>{patient.room}</p>
                      <p>Discharge: {patient.dischargeDate}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            {selectedPatient ? (
              <div className="space-y-6">
                {/* Patient Header */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src="/patient-avatar.png" />
                          <AvatarFallback>JS</AvatarFallback>
                        </Avatar>
                        <div>
                          <CardTitle className="font-heading text-xl">John Smith</CardTitle>
                          <CardDescription className="text-base">
                            MRN: 12345 • Room 302 • Cardiology Unit
                          </CardDescription>
                          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                            <span>Discharge Date: March 15, 2024</span>
                            <span>•</span>
                            <span>Dr. Sarah Johnson, MD</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => setEditMode(!editMode)}>
                          {editMode ? <Eye className="h-4 w-4 mr-2" /> : <Edit3 className="h-4 w-4 mr-2" />}
                          {editMode ? "Preview" : "Edit"}
                        </Button>
                        <Button variant="outline" size="sm">
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Regenerate
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                </Card>

                {/* Side-by-Side Editor */}
                <div className="grid lg:grid-cols-2 gap-6">
                  {/* Original Document */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="font-heading text-lg flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        Original Discharge Summary
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="bg-muted/30 p-4 rounded-lg text-sm space-y-4 max-h-96 overflow-y-auto">
                        <div>
                          <h4 className="font-medium mb-2">DISCHARGE DIAGNOSIS:</h4>
                          <p className="text-muted-foreground">
                            Chest pain, rule out acute coronary syndrome. Cardiac catheterization negative for
                            significant coronary artery disease.
                          </p>
                        </div>
                        <div>
                          <h4 className="font-medium mb-2">MEDICATIONS:</h4>
                          <p className="text-muted-foreground">
                            1. Metoprolol tartrate 25mg PO BID
                            <br />
                            2. Atorvastatin 20mg PO QHS
                            <br />
                            3. Aspirin 81mg PO daily
                          </p>
                        </div>
                        <div>
                          <h4 className="font-medium mb-2">FOLLOW-UP:</h4>
                          <p className="text-muted-foreground">
                            Cardiology clinic in 1 week. Primary care in 2 weeks. Patient should monitor BP daily.
                          </p>
                        </div>
                        <div>
                          <h4 className="font-medium mb-2">ACTIVITY:</h4>
                          <p className="text-muted-foreground">
                            No lifting &gt;10lbs x 2 weeks. Gradual return to normal activity. Walking encouraged.
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Simplified Patient Version */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="font-heading text-lg flex items-center gap-2">
                        <User className="h-5 w-5" />
                        Patient-Friendly Version
                        {editMode && <Badge variant="secondary">Editing Mode</Badge>}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {editMode ? (
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="overview">Overview</Label>
                            <Textarea
                              id="overview"
                              className="mt-1"
                              rows={3}
                              defaultValue="You were treated for chest pain and underwent cardiac catheterization. The procedure was successful and showed no significant blockages."
                            />
                          </div>
                          <div>
                            <Label htmlFor="medications">Medications</Label>
                            <Textarea
                              id="medications"
                              className="mt-1"
                              rows={4}
                              defaultValue="Take these medications exactly as prescribed:
• Metoprolol 25mg - twice daily with food
• Atorvastatin 20mg - once daily at bedtime
• Aspirin 81mg - once daily with food"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="bg-muted/30 p-4 rounded-lg text-sm space-y-4 max-h-96 overflow-y-auto">
                          <div>
                            <h4 className="font-medium mb-2">What happened during your stay:</h4>
                            <p className="text-muted-foreground">
                              You were treated for chest pain and underwent cardiac catheterization. The procedure was
                              successful and showed no significant blockages.
                            </p>
                          </div>
                          <div>
                            <h4 className="font-medium mb-2">Your medications:</h4>
                            <p className="text-muted-foreground">
                              Take these medications exactly as prescribed:
                              <br />• Metoprolol 25mg - twice daily with food
                              <br />• Atorvastatin 20mg - once daily at bedtime
                              <br />• Aspirin 81mg - once daily with food
                            </p>
                          </div>
                          <div>
                            <h4 className="font-medium mb-2">Your appointments:</h4>
                            <p className="text-muted-foreground">
                              • Cardiology follow-up: March 22, 2024 at 10:30 AM
                              <br />• Primary care check-up: April 5, 2024 at 2:00 PM
                            </p>
                          </div>
                          <div>
                            <h4 className="font-medium mb-2">Activity guidelines:</h4>
                            <p className="text-muted-foreground">
                              • No lifting over 10 pounds for 2 weeks
                              <br />• Walking 20-30 minutes daily is encouraged
                              <br />• Gradually return to normal activities
                            </p>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Review Sections */}
                <Card>
                  <CardHeader>
                    <CardTitle className="font-heading text-lg">Required Section Review</CardTitle>
                    <CardDescription>
                      Please review and approve each section before publishing to patient
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid md:grid-cols-3 gap-4">
                      {/* Medications Review */}
                      <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <div
                            className={`h-4 w-4 rounded-full ${
                              approvalStatus.medications ? "bg-green-500" : "bg-orange-500"
                            }`}
                          />
                          <div>
                            <p className="font-medium text-sm">Medications</p>
                            <p className="text-xs text-muted-foreground">3 medications listed</p>
                          </div>
                        </div>
                        <Switch
                          checked={approvalStatus.medications}
                          onCheckedChange={() => toggleApproval("medications")}
                        />
                      </div>

                      {/* Appointments Review */}
                      <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <div
                            className={`h-4 w-4 rounded-full ${
                              approvalStatus.appointments ? "bg-green-500" : "bg-orange-500"
                            }`}
                          />
                          <div>
                            <p className="font-medium text-sm">Appointments</p>
                            <p className="text-xs text-muted-foreground">2 appointments scheduled</p>
                          </div>
                        </div>
                        <Switch
                          checked={approvalStatus.appointments}
                          onCheckedChange={() => toggleApproval("appointments")}
                        />
                      </div>

                      {/* Diet & Activity Review */}
                      <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <div
                            className={`h-4 w-4 rounded-full ${
                              approvalStatus.dietActivity ? "bg-green-500" : "bg-orange-500"
                            }`}
                          />
                          <div>
                            <p className="font-medium text-sm">Diet & Activity</p>
                            <p className="text-xs text-muted-foreground">Guidelines provided</p>
                          </div>
                        </div>
                        <Switch
                          checked={approvalStatus.dietActivity}
                          onCheckedChange={() => toggleApproval("dietActivity")}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Additional Options */}
                <Card>
                  <CardHeader>
                    <CardTitle className="font-heading text-lg">Additional Options</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="sensitive-info">Redact Sensitive Information</Label>
                        <div className="mt-2 space-y-2">
                          <div className="flex items-center space-x-2">
                            <Switch id="redact-room" />
                            <Label htmlFor="redact-room" className="text-sm">
                              Room number
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Switch id="redact-mrn" />
                            <Label htmlFor="redact-mrn" className="text-sm">
                              Medical record number
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Switch id="redact-insurance" />
                            <Label htmlFor="redact-insurance" className="text-sm">
                              Insurance information
                            </Label>
                          </div>
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="clarifications">Additional Clarifications</Label>
                        <Textarea
                          id="clarifications"
                          className="mt-2"
                          rows={4}
                          placeholder="Add any additional notes or clarifications for the patient..."
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Action Buttons */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm">
                      <Save className="h-4 w-4 mr-2" />
                      Save Draft
                    </Button>
                    <Button variant="outline" size="sm">
                      <Download className="h-4 w-4 mr-2" />
                      Generate PDF
                    </Button>
                    <Button variant="outline" size="sm">
                      <Print className="h-4 w-4 mr-2" />
                      Print Handout
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      disabled={!Object.values(approvalStatus).every(Boolean)}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <Send className="h-4 w-4 mr-2" />
                      Publish to Patient
                    </Button>
                  </div>
                </div>

                {/* Status Alert */}
                {!Object.values(approvalStatus).every(Boolean) && (
                  <Card className="border-orange-200 bg-orange-50">
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-2 text-orange-800">
                        <AlertCircle className="h-4 w-4" />
                        <p className="text-sm">
                          Please review and approve all required sections before publishing to patient.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            ) : (
              <Card className="h-96 flex items-center justify-center">
                <div className="text-center">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="font-heading text-lg font-medium mb-2">Select a Patient</h3>
                  <p className="text-muted-foreground">
                    Choose a patient from the discharge queue to review their instructions
                  </p>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
