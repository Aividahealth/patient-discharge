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
import { parseDischargeIntoSections, extractMedications, extractAppointments, type DischargeSections, type Medication, type Appointment } from "@/lib/parse-discharge-sections"
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
  const [activeTab, setActiveTab] = useState("overview")
  const [isLoadingData, setIsLoadingData] = useState(true)
  const [dischargeSummary, setDischargeSummary] = useState<string>("")
  const [dischargeInstructions, setDischargeInstructions] = useState<string>("")
  const [translatedSummary, setTranslatedSummary] = useState<string>("")
  const [translatedInstructions, setTranslatedInstructions] = useState<string>("")
  const [preferredLanguage, setPreferredLanguage] = useState<string | null>(null)
  const [patientName, setPatientName] = useState<string>("")
  const [parsedSections, setParsedSections] = useState<DischargeSections>({})
  const [structuredMedications, setStructuredMedications] = useState<Medication[]>([])
  const [structuredAppointments, setStructuredAppointments] = useState<Appointment[]>([])
  const { exportToPDF} = usePDFExport()

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

  // Auto-fetch compositionId if only patientId is provided
  useEffect(() => {
    const fetchCompositionId = async () => {
      // Only fetch if we have patientId but no compositionId
      if (!patientId || compositionId || !token || !tenant) {
        return
      }

      console.log('[Patient Portal] No compositionId provided, fetching from backend...')
      
      try {
        const getBackendUrl = () => {
          if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
            return 'http://localhost:3000'
          }
          return 'https://patient-discharge-backend-qnzythtpnq-uc.a.run.app'
        }

        const response = await fetch(
          `${getBackendUrl()}/google/patient/${patientId}/composition`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
              'X-Tenant-ID': tenant.id,
            },
          }
        )

        if (response.ok) {
          const data = await response.json()
          console.log('[Patient Portal] Auto-fetched compositionId:', data.compositionId)
          setCompositionId(data.compositionId)
        } else {
          console.error('[Patient Portal] Failed to fetch compositionId:', response.statusText)
          alert('Could not find discharge information for this patient. Please contact support.')
          setIsLoadingData(false)
        }
      } catch (error) {
        console.error('[Patient Portal] Error fetching compositionId:', error)
        alert('Could not load discharge information. Please try again or contact support.')
        setIsLoadingData(false)
      }
    }

    fetchCompositionId()
  }, [patientId, compositionId, token, tenant])

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
        // Fetch patient name from FHIR Patient resource
        const getBackendUrl = () => {
          if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
            return 'http://localhost:3000'
          }
          return 'https://patient-discharge-backend-qnzythtpnq-uc.a.run.app'
        }

        const patientResponse = await fetch(
          `${getBackendUrl()}/google/fhir/Patient/${patientId}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
              'X-Tenant-ID': tenant.id,
            },
          }
        )

        if (patientResponse.ok) {
          const patientResource = await patientResponse.json()
          console.log('[Patient Portal] Patient resource fetched:', patientResource)
          
          // Extract patient name from FHIR Patient resource
          if (patientResource.name && patientResource.name.length > 0) {
            const name = patientResource.name[0]
            const fullName = name.text || `${name.given?.join(' ') || ''} ${name.family || ''}`.trim()
            setPatientName(fullName)
            console.log('[Patient Portal] Patient name:', fullName)
          }
        } else {
          console.warn('[Patient Portal] Failed to fetch patient resource:', patientResponse.statusText)
        }

        // Fetch discharge summary and instructions
        const details = await getPatientDetails(
          patientId,
          compositionId,
          token,
          tenant.id
        )
        console.log('[Patient Portal] Patient details fetched successfully')

        // Set discharge summary and instructions
        const summaryText = details.simplifiedSummary?.text || details.rawSummary?.text || ""
        const instructionsText = details.simplifiedInstructions?.text || details.rawInstructions?.text || ""
        
        setDischargeSummary(summaryText)
        setDischargeInstructions(instructionsText)

        // Parse the simplified instructions into structured sections
        console.log('[Patient Portal] Parsing discharge instructions into sections...')
        const sections = parseDischargeIntoSections(instructionsText)
        setParsedSections(sections)
        
        // Extract structured medications and appointments
        if (sections.medications) {
          const meds = extractMedications(sections.medications)
          setStructuredMedications(meds)
          console.log('[Patient Portal] Extracted medications:', meds.length)
        }
        
        if (sections.appointments) {
          const appts = extractAppointments(sections.appointments)
          setStructuredAppointments(appts)
          console.log('[Patient Portal] Extracted appointments:', appts.length)
        }

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
    name: patientName || user?.name || "Patient",
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
                <CardTitle className="font-heading text-2xl">
                  Welcome back, {patientData.name}
                </CardTitle>
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
          <TabsList className="grid w-full grid-cols-6 h-auto p-1">
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
            <TabsTrigger value="chat" className="flex flex-col gap-1 py-3">
              <MessageCircle className="h-4 w-4" />
              <span className="text-xs">Chat</span>
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Recovery Summary Card */}
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 mt-1">
                    <div className="h-12 w-12 rounded-full bg-purple-100 flex items-center justify-center">
                      <Heart className="h-6 w-6 text-purple-600" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <h3 className="font-heading text-xl font-semibold text-gray-900">{t.recoverySummary}</h3>
                    <TenantBadge tenantVariant="light">
                      AI Generated
                    </TenantBadge>
                      {preferredLanguage && preferredLanguage !== 'en' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setViewTranslated(!viewTranslated)}
                        >
                          <Globe className="h-4 w-4 mr-2" />
                          {viewTranslated ? 'View Original' : `View ${SUPPORTED_LANGUAGES.find(l => l.code === preferredLanguage)?.name}`}
                        </Button>
                      )}
                  </div>
                    
                    <div className="space-y-4">
                      {/* Reasons for Hospital Stay */}
                      <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                        <h4 className="text-sm font-semibold text-purple-900 mb-2 flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4" />
                          Reasons for Hospital Stay
                        </h4>
                        <div className="text-sm text-gray-900 leading-relaxed prose prose-sm max-w-none">
                          {viewTranslated && translatedSummary ? (
                            <div dangerouslySetInnerHTML={{ __html: translatedSummary.split('What happened during your stay')[0].replace(/\n/g, '<br />') }} />
                          ) : (
                            <div dangerouslySetInnerHTML={{ __html: dischargeSummary.split('What happened during your stay')[0].replace(/\n/g, '<br />') }} />
                          )}
                  </div>
                      </div>

                      {/* What Happened During Your Stay */}
                      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                        <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          What Happened During Your Stay
                        </h4>
                        <div className="text-sm text-gray-900 leading-relaxed prose prose-sm max-w-none">
                          {viewTranslated && translatedSummary ? (
                            <div dangerouslySetInnerHTML={{ __html: (translatedSummary.split('What happened during your stay')[1] || translatedSummary).replace(/\n/g, '<br />') }} />
                          ) : (
                            <div dangerouslySetInnerHTML={{ __html: (dischargeSummary.split('What happened during your stay')[1] || dischargeSummary).replace(/\n/g, '<br />') }} />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  </div>
                </CardContent>
              </Card>

            {/* Quick Actions Card */}
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 mt-1">
                    <div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center">
                      <MessageCircle className="h-6 w-6 text-gray-600" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-heading text-xl font-semibold text-gray-900 mb-4">{t.quickActions}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Button
                        className="w-full justify-start"
                    variant="outline"
                    onClick={() => setActiveTab("medications")}
                  >
                    <Pill className="h-4 w-4 mr-2" />
                    {t.viewTodaysMeds}
                  </Button>
                  <Button
                        className="w-full justify-start"
                    variant="outline"
                    onClick={() => setActiveTab("appointments")}
                  >
                    <Calendar className="h-4 w-4 mr-2" />
                    {t.nextAppointment}
                  </Button>
                      <Button className="w-full justify-start" variant="outline">
                    <Phone className="h-4 w-4 mr-2" />
                    {t.callNurse}
                  </Button>
                  <Button
                        className="w-full justify-start"
                    variant="outline"
                        onClick={() => setActiveTab("chat")}
                  >
                    <MessageCircle className="h-4 w-4 mr-2" />
                    {t.askQuestion}
                  </Button>
                    </div>
                  </div>
                </div>
                </CardContent>
              </Card>
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

            {structuredMedications.length > 0 ? (
            <div className="grid gap-4">
                {structuredMedications.map((med, index) => (
                  <Card key={`med-${index}`} className="hover:shadow-md transition-shadow">
                  <CardContent className="pt-6">
                      <div className="flex items-start gap-4">
                        <div className="flex-shrink-0 mt-1">
                          <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                            <Pill className="h-6 w-6 text-blue-600" />
                        </div>
                          </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-3">
                            <h3 className="font-heading text-xl font-semibold text-gray-900">{med.name}</h3>
                            {med.dose && (
                              <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200 text-sm font-medium px-3 py-1">
                                {med.dose}
                              </Badge>
                            )}
                          </div>
                          
                          {/* Medication Details */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                            {med.frequency && (
                              <div className="flex items-center gap-2 text-sm">
                                <Clock className="h-4 w-4 text-gray-500" />
                                <span className="text-gray-700"><strong>Frequency:</strong> {med.frequency}</span>
                        </div>
                            )}
                            {med.howToTake && (
                              <div className="flex items-center gap-2 text-sm">
                                <Pill className="h-4 w-4 text-gray-500" />
                                <span className="text-gray-700"><strong>How:</strong> {med.howToTake}</span>
                        </div>
                          )}
                        </div>
                          
                          {/* Full Instructions */}
                          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                            <p className="text-sm font-semibold text-gray-700 mb-2">Complete Instructions:</p>
                            <p className="text-sm text-gray-900 leading-relaxed">{med.instructions}</p>
                          </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            ) : parsedSections.medications ? (
              <Card>
                <CardContent className="pt-6">
                  <div className="prose prose-sm max-w-none whitespace-pre-wrap">
                    {parsedSections.medications}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-muted-foreground">No medication information available</p>
                </CardContent>
              </Card>
            )}
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

            {structuredAppointments.length > 0 ? (
            <div className="grid gap-4">
                {structuredAppointments.map((apt, index) => (
                <Card key={index} className="hover:shadow-md transition-shadow">
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 mt-1">
                        <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                          <Calendar className="h-5 w-5 text-green-600" />
                      </div>
                    </div>
                      <div className="flex-1 min-w-0">
                        {apt.specialty && (
                          <h3 className="font-heading text-xl font-semibold text-gray-900 mb-2">
                            {apt.specialty}
                          </h3>
                        )}
                        <div className="flex flex-wrap items-center gap-2 mb-3">
                          {apt.date && (
                            <Badge className="bg-green-100 text-green-700 hover:bg-green-200 text-sm font-medium px-3 py-1">
                              <Clock className="h-3 w-3 mr-1" />
                              In {apt.date}
                            </Badge>
                          )}
                          {apt.location && (
                            <Badge variant="outline" className="text-sm">
                              📍 {apt.location}
                            </Badge>
                          )}
                      </div>
                        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                          <p className="text-sm text-gray-900 leading-relaxed whitespace-pre-line">{apt.rawText}</p>
                      </div>
                    </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            ) : parsedSections.appointments ? (
              <Card>
                <CardContent className="pt-6">
                  <div className="prose prose-sm max-w-none whitespace-pre-wrap">
                    {parsedSections.appointments}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-muted-foreground">No appointment information available</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Diet & Activity Tab */}
          <TabsContent value="diet-activity" className="space-y-6">
            <h2 className="font-heading text-2xl">{t.dietActivityGuidelines}</h2>

            {parsedSections.dietActivity ? (
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 mt-1">
                      <div className="h-12 w-12 rounded-full bg-orange-100 flex items-center justify-center">
                        <Utensils className="h-6 w-6 text-orange-600" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-heading text-xl font-semibold text-gray-900 mb-4">Your Diet & Activity Plan</h3>
                      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                        <div className="prose prose-sm max-w-none whitespace-pre-line text-gray-900">
                          {parsedSections.dietActivity}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
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
            )}
          </TabsContent>

          {/* Warning Signs Tab */}
          <TabsContent value="warnings" className="space-y-6">
            <h2 className="font-heading text-2xl">{t.whenToSeekHelp}</h2>

            {parsedSections.warningsSigns ? (
              <Card className="hover:shadow-md transition-shadow border-red-200">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 mt-1">
                      <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
                        <AlertTriangle className="h-6 w-6 text-red-600" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-heading text-xl font-semibold text-gray-900 mb-4">When to Call for Help</h3>
                      <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                        <div className="prose prose-sm max-w-none whitespace-pre-line text-gray-900">
                          {parsedSections.warningsSigns}
                        </div>
                      </div>
                      <div className="mt-4 flex gap-3">
                        <Badge className="bg-red-600 text-white hover:bg-red-700">
                          <Phone className="h-3 w-3 mr-1" />
                          Call 911 for emergencies
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
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
            </>
            )}
          </TabsContent>

          {/* Chat Tab */}
          <TabsContent value="chat" className="space-y-6">
            <PatientChatbot 
              isOpen={true} 
              onClose={() => setActiveTab("overview")} 
              patientData={patientData}
              dischargeSummary={dischargeSummary}
              dischargeInstructions={dischargeInstructions}
              compositionId={compositionId || ''}
              patientId={patientId || ''}
            />
          </TabsContent>
        </Tabs>
      </div>
      
      <CommonFooter />
      </div>
      </AuthGuard>
    </ErrorBoundary>
  )
}
