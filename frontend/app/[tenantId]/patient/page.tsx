"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { PatientChatbot } from "@/components/patient-chatbot"
import { FeedbackButton } from "@/components/feedback-button"
import { CommonHeader } from "@/components/common-header"
import { CommonFooter } from "@/components/common-footer"
import { AuthGuard } from "@/components/auth-guard"
import { ErrorBoundary } from "@/components/error-boundary"
import { TenantButton } from "@/components/tenant-button"
import { TenantBadge } from "@/components/tenant-badge"
import { tenantColors } from "@/lib/tenant-colors"
import { patientTranslations } from "@/lib/translations"
import { SUPPORTED_LANGUAGES } from "@/lib/constants/languages"
import { usePDFExport } from "@/hooks/use-pdf-export"
import { useTenant } from "@/contexts/tenant-context"
import { login } from "@/lib/api/auth"
import { getPatientDetails, getTranslatedContent } from "@/lib/discharge-summaries"
import html2canvas from "html2canvas"
import {
  Heart,
  Pill,
  Calendar,
  Utensils,
  AlertTriangle,
  Download,
  Printer as Print,
  MessageCircle,
  Globe,
  Clock,
  MapPin,
  CheckCircle2,
  X,
  Phone,
  Loader2,
} from "lucide-react"

export default function PatientDashboard() {
  const searchParams = useSearchParams()
  const { login: contextLogin, token, user, tenant, isAuthenticated } = useTenant()

  const [patientId, setPatientId] = useState<string | null>(null)
  const [compositionId, setCompositionId] = useState<string | null>(null)
  const [language, setLanguage] = useState("en")
  const [viewTranslated, setViewTranslated] = useState(false)
  const [checkedMeds, setCheckedMeds] = useState<Record<string, boolean>>({})
  const [showChat, setShowChat] = useState(false)
  const [activeTab, setActiveTab] = useState("overview")
  const [isLoadingData, setIsLoadingData] = useState(true)
  const [dischargeSummary, setDischargeSummary] = useState<string>("")
  const [dischargeInstructions, setDischargeInstructions] = useState<string>("")
  const [translatedSummary, setTranslatedSummary] = useState<string>("")
  const [translatedInstructions, setTranslatedInstructions] = useState<string>("")
  const [preferredLanguage, setPreferredLanguage] = useState<string | null>(null)
  const { exportToPDF } = usePDFExport()

  // Auto-login with patient credentials if not authenticated
  useEffect(() => {
    const autoLogin = async () => {
      if (!isAuthenticated) {
        try {
          console.log('[Patient Portal] Attempting auto-login for demo patient...')
          const authData = await login({
            tenantId: tenant?.id || 'demo',
            username: 'patient',
            password: 'Adyar2Austin'
          })
          console.log('[Patient Portal] Auto-login successful:', authData.user.name)
          contextLogin(authData)
        } catch (error) {
          console.error('[Patient Portal] Auto-login failed:', error)
          setIsLoadingData(false)
        }
      }
    }
    autoLogin()
  }, [isAuthenticated, contextLogin, tenant])

  // Get patientId and compositionId from URL parameters
  useEffect(() => {
    const pid = searchParams.get('patientId')
    const cid = searchParams.get('compositionId')
    const lang = searchParams.get('language')

    console.log('[Patient Portal] URL parameters:', { patientId: pid, compositionId: cid, language: lang })

    if (pid) setPatientId(pid)
    if (cid) setCompositionId(cid)
    if (lang) setPreferredLanguage(lang)
  }, [searchParams])

  // Fetch patient's discharge summary and instructions
  useEffect(() => {
    const fetchPatientData = async () => {
      console.log('[Patient Portal] Fetch check:', {
        hasPatientId: !!patientId,
        hasCompositionId: !!compositionId,
        hasToken: !!token,
        hasTenant: !!tenant,
        patientId,
        compositionId,
        tenantId: tenant?.id
      })

      if (!patientId || !compositionId || !token || !tenant) {
        console.log('[Patient Portal] Missing required data, stopping fetch')
        setIsLoadingData(false)
        return
      }

      console.log('[Patient Portal] Fetching patient details...')
      setIsLoadingData(true)
      try {
        const details = await getPatientDetails(
          patientId,
          compositionId,
          token,
          tenant.id
        )
        console.log('[Patient Portal] Patient details fetched successfully')

        // Set discharge summary and instructions
        setDischargeSummary(details.simplifiedSummary?.text || details.rawSummary?.text || "")
        setDischargeInstructions(details.simplifiedInstructions?.text || details.rawInstructions?.text || "")

        // Fetch translated content if preferred language is set and not English
        if (preferredLanguage && preferredLanguage !== 'en') {
          const translated = await getTranslatedContent(
            compositionId,
            preferredLanguage,
            token,
            tenant.id
          )

          if (translated?.content) {
            // Parse the combined translated content
            const parts = translated.content.content.split('\n\n---\n\n')
            setTranslatedSummary(parts[0] || "")
            setTranslatedInstructions(parts[1] || "")
          }
        }

        console.log('[Patient Portal] Data loaded, setting loading to false')
        setIsLoadingData(false)
      } catch (error) {
        console.error('[Patient Portal] Failed to fetch patient data:', error)
        // Show user-friendly error message
        alert('Failed to load your discharge information. Please refresh the page or contact support.')
        setIsLoadingData(false)
      }
    }

    fetchPatientData()
  }, [patientId, compositionId, token, tenant, preferredLanguage])

  // Mock patient data for UI elements (will be replaced with real data later)
  const patientData = {
    name: user?.name || "Patient",
    medications: [
      {
        name: "Metoprolol",
        dose: "25mg",
        instructions: "Take twice daily with food. Do not stop suddenly.",
      },
      {
        name: "Atorvastatin",
        dose: "20mg",
        instructions: "Take once daily at bedtime. Avoid grapefruit.",
      },
      {
        name: "Aspirin",
        dose: "81mg",
        instructions: "Take once daily with food to prevent stomach upset.",
      },
    ],
    appointments: [
      {
        date: "March 22, 2024",
        doctor: "Dr. Sarah Johnson",
        specialty: "Cardiology Follow-up",
      },
      {
        date: "April 5, 2024",
        doctor: "Dr. Michael Chen",
        specialty: "Primary Care Check-up",
      },
    ],
  }

  const toggleMedication = (medId: string) => {
    setCheckedMeds((prev) => ({ ...prev, [medId]: !prev[medId] }))
  }

  const printDischargeSummary = () => {
    // Get the current language translations
    const t = translations[language as keyof typeof translations]
    
    // Create a comprehensive discharge summary content for printing
    const content = `
DISCHARGE INSTRUCTIONS - ${patientData.name}
Discharge Date: March 15, 2024
Attending Physician: Dr. Sarah Johnson, MD

${t.recoverySummary}
${t.reasonForStay}: ${t.reasonText}
${t.whatHappened}: ${t.whatHappenedText}

${t.yourMedications}:
${patientData.medications.map((med) => `- ${med.name} ${med.dose}: ${med.instructions}`).join("\n")}

${t.upcomingAppointments}:
${patientData.appointments.map((apt) => `- ${apt.date}: ${apt.doctor} (${apt.specialty})`).join("\n")}

${t.dietActivityGuidelines}:
${t.foodsToInclude}:
- Fresh fruits and vegetables
- Whole grains (brown rice, oats)
- Lean proteins (fish, chicken, beans)
- Low-fat dairy products
- Nuts and seeds (unsalted)

${t.foodsToLimit}:
- High-sodium foods (processed meats, canned soups)
- Fried and fast foods
- Sugary drinks and desserts
- Excessive alcohol

${t.activityGuidelines}:
${t.recommendedActivities}:
- Walking 20-30 minutes daily
- Light stretching or yoga
- Swimming (after incision heals)
- Household chores (light cleaning)

${t.activitiesToAvoid}:
- Heavy lifting (over 10 pounds)
- Intense exercise or running
- Driving for 2 weeks
- Contact sports

${t.whenToSeekHelp}:
${t.call911}:
- Severe chest pain or pressure
- Difficulty breathing or shortness of breath
- Sudden weakness or numbness
- Loss of consciousness

${t.callDoctor}:
- Increased swelling in legs or feet
- Rapid weight gain (3+ pounds in 2 days)
- Persistent cough or wheezing
- Dizziness or lightheadedness
- Unusual fatigue or weakness
- Signs of infection at incision site

EMERGENCY CONTACTS:
- 24/7 Nurse Hotline: (555) 999-0000
- Dr. Sarah Johnson: (555) 123-4567
- Emergency: 911

IMPORTANT: This content has been simplified using artificial intelligence for better patient understanding.
    `
    
    // Create a new window for printing
    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Discharge Instructions - ${patientData.name}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              margin: 20px;
              color: #333;
            }
            h1 {
              color: #2563eb;
              border-bottom: 2px solid #2563eb;
              padding-bottom: 10px;
            }
            h2 {
              color: #1e40af;
              margin-top: 20px;
              margin-bottom: 10px;
            }
            .patient-info {
              background-color: #f8fafc;
              padding: 15px;
              border-left: 4px solid #2563eb;
              margin-bottom: 20px;
            }
            .section {
              margin-bottom: 20px;
            }
            .disclaimer {
              background-color: #fef3c7;
              border: 1px solid #f59e0b;
              padding: 10px;
              margin-top: 20px;
              font-style: italic;
              font-size: 0.9em;
            }
            @media print {
              body { margin: 0; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <h1>DISCHARGE INSTRUCTIONS</h1>
          <div class="patient-info">
            <strong>Patient:</strong> ${patientData.name}<br>
            <strong>Discharge Date:</strong> March 15, 2024<br>
            <strong>Attending Physician:</strong> Dr. Sarah Johnson, MD
          </div>
          
          <div class="section">
            <h2>${t.recoverySummary}</h2>
            <p><strong>${t.reasonForStay}:</strong> ${t.reasonText}</p>
            <p><strong>${t.whatHappened}:</strong> ${t.whatHappenedText}</p>
          </div>
          
          <div class="section">
            <h2>${t.yourMedications}</h2>
            <ul>
              ${patientData.medications.map((med) => `<li><strong>${med.name} ${med.dose}:</strong> ${med.instructions}</li>`).join("")}
            </ul>
          </div>
          
          <div class="section">
            <h2>${t.upcomingAppointments}</h2>
            <ul>
              ${patientData.appointments.map((apt) => `<li><strong>${apt.date}:</strong> ${apt.doctor} (${apt.specialty})</li>`).join("")}
            </ul>
          </div>
          
          <div class="section">
            <h2>${t.dietActivityGuidelines}</h2>
            <h3>${t.foodsToInclude}</h3>
            <ul>
              <li>Fresh fruits and vegetables</li>
              <li>Whole grains (brown rice, oats)</li>
              <li>Lean proteins (fish, chicken, beans)</li>
              <li>Low-fat dairy products</li>
              <li>Nuts and seeds (unsalted)</li>
            </ul>
            
            <h3>${t.foodsToLimit}</h3>
            <ul>
              <li>High-sodium foods (processed meats, canned soups)</li>
              <li>Fried and fast foods</li>
              <li>Sugary drinks and desserts</li>
              <li>Excessive alcohol</li>
            </ul>
            
            <h3>${t.activityGuidelines}</h3>
            <h4>${t.recommendedActivities}</h4>
            <ul>
              <li>Walking 20-30 minutes daily</li>
              <li>Light stretching or yoga</li>
              <li>Swimming (after incision heals)</li>
              <li>Household chores (light cleaning)</li>
            </ul>
            
            <h4>${t.activitiesToAvoid}</h4>
            <ul>
              <li>Heavy lifting (over 10 pounds)</li>
              <li>Intense exercise or running</li>
              <li>Driving for 2 weeks</li>
              <li>Contact sports</li>
            </ul>
          </div>
          
          <div class="section">
            <h2>${t.whenToSeekHelp}</h2>
            <h3>${t.call911}</h3>
            <ul>
              <li>Severe chest pain or pressure</li>
              <li>Difficulty breathing or shortness of breath</li>
              <li>Sudden weakness or numbness</li>
              <li>Loss of consciousness</li>
            </ul>
            
            <h3>${t.callDoctor}</h3>
            <ul>
              <li>Increased swelling in legs or feet</li>
              <li>Rapid weight gain (3+ pounds in 2 days)</li>
              <li>Persistent cough or wheezing</li>
              <li>Dizziness or lightheadedness</li>
              <li>Unusual fatigue or weakness</li>
              <li>Signs of infection at incision site</li>
            </ul>
          </div>
          
          <div class="section">
            <h2>EMERGENCY CONTACTS</h2>
            <ul>
              <li><strong>24/7 Nurse Hotline:</strong> (555) 999-0000</li>
              <li><strong>Dr. Sarah Johnson:</strong> (555) 123-4567</li>
              <li><strong>Emergency:</strong> 911</li>
            </ul>
          </div>
          
          <div class="disclaimer">
            <strong>IMPORTANT:</strong> This content has been simplified using artificial intelligence for better patient understanding.
          </div>
        </body>
        </html>
      `)
      printWindow.document.close()
      printWindow.focus()
      printWindow.print()
      printWindow.close()
    }
  }

  const downloadPDF = async () => {
    const t = patientTranslations[language as keyof typeof patientTranslations]

    // Create comprehensive discharge summary content
    const content = `
${t.recoverySummary}
${t.reasonForStay}: ${t.reasonText}
${t.whatHappened}: ${t.whatHappenedText}

${t.yourMedications}:
${patientData.medications.map((med) => `- ${med.name} ${med.dose}: ${med.instructions}`).join("\n")}

${t.upcomingAppointments}:
${patientData.appointments.map((apt) => `- ${apt.date}: ${apt.doctor} (${apt.specialty})`).join("\n")}

${t.dietActivityGuidelines}:
${t.foodsToInclude}:
- Fresh fruits and vegetables
- Whole grains (brown rice, oats)
- Lean proteins (fish, chicken, beans)
- Low-fat dairy products
- Nuts and seeds (unsalted)

${t.foodsToLimit}:
- High-sodium foods (processed meats, canned soups)
- Fried and fast foods
- Sugary drinks and desserts
- Excessive alcohol

${t.activityGuidelines}:
${t.recommendedActivities}:
- Walking 20-30 minutes daily
- Light stretching or yoga
- Swimming (after incision heals)
- Household chores (light cleaning)

${t.activitiesToAvoid}:
- Heavy lifting (over 10 pounds)
- Intense exercise or running
- Driving for 2 weeks
- Contact sports

${t.whenToSeekHelp}:
${t.call911}:
- Severe chest pain or pressure
- Difficulty breathing or shortness of breath
- Sudden weakness or numbness
- Loss of consciousness

${t.callDoctor}:
- Increased swelling in legs or feet
- Rapid weight gain (3+ pounds in 2 days)
- Persistent cough or wheezing
- Dizziness or lightheadedness
- Unusual fatigue or weakness
- Signs of infection at incision site

EMERGENCY CONTACTS:
- 24/7 Nurse Hotline: (555) 999-0000
- Dr. Sarah Johnson: (555) 123-4567
- Emergency: 911
`

    await exportToPDF({
      header: {
        title: 'DISCHARGE INSTRUCTIONS',
        patientName: patientData.name,
        fields: [
          { label: 'Discharge Date', value: 'March 15, 2024' },
          { label: 'Attending Physician', value: 'Dr. Sarah Johnson, MD' }
        ]
      },
      content,
      footer: 'This content has been simplified using artificial intelligence for better patient understanding.',
      filename: `discharge-instructions-${patientData.name.replace(' ', '-').toLowerCase()}.pdf`
    })
  }

  const t = patientTranslations[language as keyof typeof patientTranslations]

  // Show loading state while fetching patient data
  if (isLoadingData) {
    return (
      <ErrorBoundary>
        <AuthGuard>
          <div className="min-h-screen bg-background flex flex-col">
            <CommonHeader />
            <main className="flex-1 flex items-center justify-center">
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <p className="text-lg text-muted-foreground">Loading your discharge information...</p>
              </div>
            </main>
            <CommonFooter />
          </div>
        </AuthGuard>
      </ErrorBoundary>
    )
  }

  return (
    <ErrorBoundary>
      <AuthGuard>
        <div className="min-h-screen bg-background flex flex-col">
      <CommonHeader title="Patient Portal" />
      
      {/* Patient Portal Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg text-white" style={tenantColors.bgPrimary}>
                <Heart className="h-5 w-5" />
              </div>
              <div>
                <h1 className="font-heading text-xl font-semibold text-foreground">Patient Portal</h1>
                <p className="text-sm text-muted-foreground">{t.patientPortal}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Language Toggle */}
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="bg-transparent border border-border rounded-md px-2 py-1 text-sm"
                >
                  {Object.entries(SUPPORTED_LANGUAGES).map(([code, lang]) => (
                    <option key={code} value={code}>
                      {lang.nativeName}
                    </option>
                  ))}
                </select>
              </div>
              <FeedbackButton userType="patient" />
              <Avatar className="h-8 w-8">
                <AvatarImage src="/patient-avatar.png" />
                <AvatarFallback>JS</AvatarFallback>
              </Avatar>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 max-w-6xl">
        {/* Patient Info Card */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="font-heading text-2xl">{t.welcomeBack}</CardTitle>
                <CardDescription className="text-base mt-1">{t.dischargedFrom}</CardDescription>
                <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                  <span>{t.dischargeDate}</span>
                  <span>•</span>
                  <span>Dr. Sarah Johnson, MD</span>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={downloadPDF}>
                  <Download className="h-4 w-4 mr-2" />
                  {t.downloadPDF}
                </Button>
                <Button variant="outline" size="sm" onClick={printDischargeSummary}>
                  <Print className="h-4 w-4 mr-2" />
                  {t.print}
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 h-auto p-1">
            <TabsTrigger value="overview" className="flex flex-col gap-1 py-3">
              <Heart className="h-4 w-4" />
              <span className="text-xs">{t.overview}</span>
            </TabsTrigger>
            <TabsTrigger value="medications" className="flex flex-col gap-1 py-3">
              <Pill className="h-4 w-4" />
              <span className="text-xs">{t.medications}</span>
            </TabsTrigger>
            <TabsTrigger value="appointments" className="flex flex-col gap-1 py-3">
              <Calendar className="h-4 w-4" />
              <span className="text-xs">{t.appointments}</span>
            </TabsTrigger>
            <TabsTrigger value="diet-activity" className="flex flex-col gap-1 py-3">
              <Utensils className="h-4 w-4" />
              <span className="text-xs">{t.dietActivity}</span>
            </TabsTrigger>
            <TabsTrigger value="warnings" className="flex flex-col gap-1 py-3">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-xs">{t.warningsSigns}</span>
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="font-heading">{t.recoverySummary}</CardTitle>
                  <div className="flex items-center gap-2 mt-2">
                    <TenantBadge tenantVariant="light">
                      AI Generated
                    </TenantBadge>
                    <span className="text-xs text-muted-foreground">
                      This content has been simplified using artificial intelligence
                    </span>
                  </div>
                  {preferredLanguage && preferredLanguage !== 'en' && (
                    <div className="flex items-center gap-2 mt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setViewTranslated(!viewTranslated)}
                      >
                        <Globe className="h-4 w-4 mr-2" />
                        {viewTranslated ? 'View Original' : `View ${SUPPORTED_LANGUAGES.find(l => l.code === preferredLanguage)?.name}`}
                      </Button>
                    </div>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="prose prose-sm max-w-none">
                    {viewTranslated && translatedSummary ? (
                      <div dangerouslySetInnerHTML={{ __html: translatedSummary.replace(/\n/g, '<br />') }} />
                    ) : (
                      <div dangerouslySetInnerHTML={{ __html: dischargeSummary.replace(/\n/g, '<br />') }} />
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="font-heading">{t.quickActions}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button
                    className="w-full justify-start bg-transparent"
                    variant="outline"
                    onClick={() => setActiveTab("medications")}
                  >
                    <Pill className="h-4 w-4 mr-2" />
                    {t.viewTodaysMeds}
                  </Button>
                  <Button
                    className="w-full justify-start bg-transparent"
                    variant="outline"
                    onClick={() => setActiveTab("appointments")}
                  >
                    <Calendar className="h-4 w-4 mr-2" />
                    {t.nextAppointment}
                  </Button>
                  <Button className="w-full justify-start bg-transparent" variant="outline">
                    <Phone className="h-4 w-4 mr-2" />
                    {t.callNurse}
                  </Button>
                  <Button
                    className="w-full justify-start bg-transparent"
                    variant="outline"
                    onClick={() => setShowChat(true)}
                  >
                    <MessageCircle className="h-4 w-4 mr-2" />
                    {t.askQuestion}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Medications Tab */}
          <TabsContent value="medications" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-2xl">{t.yourMedications}</h2>
              <Button variant="outline" size="sm">
                <Print className="h-4 w-4 mr-2" />
                {t.printChecklist}
              </Button>
            </div>

            <div className="grid gap-4">
              {[
                {
                  id: "med1",
                  name: "Metoprolol",
                  dose: "25mg",
                  frequency: t.twiceDaily,
                  timing: t.morningEvening,
                  instructions: t.medInstructionTakeWithFood,
                  morning: true,
                  evening: true,
                },
                {
                  id: "med2",
                  name: "Atorvastatin",
                  dose: "20mg",
                  frequency: t.onceDaily,
                  timing: t.evening,
                  instructions: t.medInstructionBedtimeGrapefruit,
                  evening: true,
                },
                {
                  id: "med3",
                  name: "Aspirin",
                  dose: "81mg",
                  frequency: t.onceDaily,
                  timing: t.morning,
                  instructions: t.medInstructionTakeWithFoodStomach,
                  morning: true,
                },
              ].map((med) => (
                <Card key={med.id} className="relative">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-heading text-lg font-semibold">{med.name}</h3>
                          <Badge variant="secondary">{med.dose}</Badge>
                        </div>
                        <div className="grid sm:grid-cols-2 gap-4 mb-4">
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">{t.frequency}</p>
                            <p className="text-sm">{med.frequency}</p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">{t.whenToTake}</p>
                            <p className="text-sm">{med.timing}</p>
                          </div>
                        </div>
                        <div className="mb-4">
                          <p className="text-sm font-medium text-muted-foreground mb-1">{t.specialInstructions}</p>
                          <p className="text-sm">{med.instructions}</p>
                        </div>
                        <div className="flex gap-2">
                          {med.morning && (
                            <Button
                              variant={checkedMeds[`${med.id}-morning`] ? "default" : "outline"}
                              size="sm"
                              onClick={() => toggleMedication(`${med.id}-morning`)}
                            >
                              {checkedMeds[`${med.id}-morning`] ? (
                                <CheckCircle2 className="h-4 w-4 mr-1" />
                              ) : (
                                <Clock className="h-4 w-4 mr-1" />
                              )}
                              {t.morning}
                            </Button>
                          )}
                          {med.evening && (
                            <Button
                              variant={checkedMeds[`${med.id}-evening`] ? "default" : "outline"}
                              size="sm"
                              onClick={() => toggleMedication(`${med.id}-evening`)}
                            >
                              {checkedMeds[`${med.id}-evening`] ? (
                                <CheckCircle2 className="h-4 w-4 mr-1" />
                              ) : (
                                <Clock className="h-4 w-4 mr-1" />
                              )}
                              {t.evening}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Appointments Tab */}
          <TabsContent value="appointments" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-2xl">{t.upcomingAppointments}</h2>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                {t.downloadCalendar}
              </Button>
            </div>

            <div className="grid gap-4">
              {[
                {
                  date: "March 22, 2024",
                  time: "10:30 AM",
                  doctor: "Dr. Sarah Johnson",
                  specialty: "Cardiology Follow-up",
                  location: "General Hospital - Cardiology Clinic",
                  address: "123 Medical Center Dr, Suite 200",
                  preparation: t.appointmentPrepMedicationList,
                },
                {
                  date: "April 5, 2024",
                  time: "2:00 PM",
                  doctor: "Dr. Michael Chen",
                  specialty: "Primary Care Check-up",
                  location: "Family Medicine Clinic",
                  address: "456 Health Plaza, Building A",
                  preparation: t.appointmentPrepFasting,
                },
              ].map((apt, index) => (
                <Card key={index}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="font-heading text-lg font-semibold mb-1">{apt.specialty}</h3>
                        <p className="text-muted-foreground">{apt.doctor}</p>
                      </div>
                      <Badge variant="outline">{apt.date}</Badge>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4 mb-4">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{apt.time}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{apt.location}</span>
                      </div>
                    </div>

                    <div className="mb-4">
                      <p className="text-sm text-muted-foreground mb-1">{t.address}</p>
                      <p className="text-sm">{apt.address}</p>
                    </div>

                    <div className="mb-4">
                      <p className="text-sm font-medium text-muted-foreground mb-1">{t.preparationNotes}</p>
                      <p className="text-sm">{apt.preparation}</p>
                    </div>

                    <div className="flex gap-2">
                      <Button variant="outline" size="sm">
                        <MapPin className="h-4 w-4 mr-1" />
                        {t.directions}
                      </Button>
                      <Button variant="outline" size="sm">
                        <Calendar className="h-4 w-4 mr-1" />
                        {t.addToCalendar}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Diet & Activity Tab */}
          <TabsContent value="diet-activity" className="space-y-6">
            <h2 className="font-heading text-2xl">{t.dietActivityGuidelines}</h2>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Diet Guidelines */}
              <Card>
                <CardHeader>
                  <CardTitle className="font-heading flex items-center gap-2">
                    <Utensils className="h-5 w-5" />
                    {t.dietRecommendations}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="font-medium text-green-700 mb-2 flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4" />
                      {t.foodsToInclude}
                    </h4>
                    <ul className="text-sm space-y-1 text-muted-foreground ml-6">
                      <li>• {t.foodIncludeFreshFruits}</li>
                      <li>• {t.foodIncludeWholeGrains}</li>
                      <li>• {t.foodIncludeLeanProteins}</li>
                      <li>• {t.foodIncludeLowFatDairy}</li>
                      <li>• {t.foodIncludeNutsSeeds}</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-medium text-red-700 mb-2 flex items-center gap-2">
                      <X className="h-4 w-4" />
                      {t.foodsToLimit}
                    </h4>
                    <ul className="text-sm space-y-1 text-muted-foreground ml-6">
                      <li>• {t.foodLimitHighSodium}</li>
                      <li>• {t.foodLimitFriedFast}</li>
                      <li>• {t.foodLimitSugaryDrinks}</li>
                      <li>• {t.foodLimitAlcohol}</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>

              {/* Activity Guidelines */}
              <Card>
                <CardHeader>
                  <CardTitle className="font-heading flex items-center gap-2">
                    <Heart className="h-5 w-5" />
                    {t.activityGuidelines}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="font-medium text-green-700 mb-2 flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4" />
                      {t.recommendedActivities}
                    </h4>
                    <ul className="text-sm space-y-1 text-muted-foreground ml-6">
                      <li>• {t.activityRecommendedWalking}</li>
                      <li>• {t.activityRecommendedStretching}</li>
                      <li>• {t.activityRecommendedSwimming}</li>
                      <li>• {t.activityRecommendedChores}</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-medium text-red-700 mb-2 flex items-center gap-2">
                      <X className="h-4 w-4" />
                      {t.activitiesToAvoid}
                    </h4>
                    <ul className="text-sm space-y-1 text-muted-foreground ml-6">
                      <li>• {t.activityAvoidHeavyLifting}</li>
                      <li>• {t.activityAvoidIntenseExercise}</li>
                      <li>• {t.activityAvoidDriving}</li>
                      <li>• {t.activityAvoidContactSports}</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Warning Signs Tab */}
          <TabsContent value="warnings" className="space-y-6">
            <h2 className="font-heading text-2xl">{t.whenToSeekHelp}</h2>

            <Card className="border-red-200 bg-red-50">
              <CardHeader>
                <CardTitle className="font-heading text-red-800 flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  {t.call911}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-red-700">
                  <li className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>{t.warning911ChestPain}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>{t.warning911Breathing}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>{t.warning911Weakness}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>{t.warning911Consciousness}</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="border-orange-200 bg-orange-50">
              <CardHeader>
                <CardTitle className="font-heading text-orange-800 flex items-center gap-2">
                  <Phone className="h-5 w-5" />
                  {t.callDoctor}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-orange-700">
                  <li>• {t.warningDoctorSwelling}</li>
                  <li>• {t.warningDoctorWeightGain}</li>
                  <li>• {t.warningDoctorCough}</li>
                  <li>• {t.warningDoctorDizziness}</li>
                  <li>• {t.warningDoctorFatigue}</li>
                  <li>• {t.warningDoctorInfection}</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="font-heading">{t.emergencyContacts}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div>
                    <p className="font-medium">{t.nurseHotline}</p>
                    <p className="text-sm text-muted-foreground">{t.nonEmergency}</p>
                  </div>
                  <Button variant="outline" size="sm">
                    <Phone className="h-4 w-4 mr-2" />
                    {t.callNow}
                  </Button>
                </div>
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div>
                    <p className="font-medium">Dr. Sarah Johnson</p>
                    <p className="text-sm text-muted-foreground">{t.cardiologyOffice}</p>
                  </div>
                  <Button variant="outline" size="sm">
                    <Phone className="h-4 w-4 mr-2" />
                    (555) 123-4567
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Floating Chat Button */}
      <TenantButton
        tenantVariant="primary"
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg"
        onClick={() => setShowChat(true)}
      >
        <MessageCircle className="h-6 w-6" />
      </TenantButton>

      <PatientChatbot 
        isOpen={showChat} 
        onClose={() => setShowChat(false)} 
        patientData={patientData}
        dischargeSummary={dischargeSummary}
        dischargeInstructions={dischargeInstructions}
        compositionId={compositionId || ''}
        patientId={patientId || ''}
      />
      
      <CommonFooter />
      </div>
      </AuthGuard>
    </ErrorBoundary>
  )
}
