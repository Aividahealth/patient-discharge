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
import { useTenant } from "@/contexts/tenant-context"
import { login } from "@/lib/api/auth"
import { getPatientDetails, getTranslatedContent } from "@/lib/discharge-summaries"
import jsPDF from "jspdf"
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
  const [patientData, setPatientData] = useState<any>(null)
  const [dischargeSummary, setDischargeSummary] = useState<string>("")
  const [dischargeInstructions, setDischargeInstructions] = useState<string>("")
  const [translatedSummary, setTranslatedSummary] = useState<string>("")
  const [translatedInstructions, setTranslatedInstructions] = useState<string>("")
  const [preferredLanguage, setPreferredLanguage] = useState<string | null>(null)

  // Auto-login with patient credentials if not authenticated
  useEffect(() => {
    const autoLogin = async () => {
      if (!isAuthenticated) {
        try {
          const authData = await login({
            tenantId: 'demo',
            username: 'patient',
            password: 'Adyar2Austin'
          })
          contextLogin(authData)
        } catch (error) {
          console.error('Auto-login failed:', error)
        }
      }
    }
    autoLogin()
  }, [isAuthenticated, contextLogin])

  // Get patientId and compositionId from URL parameters
  useEffect(() => {
    const pid = searchParams.get('patientId')
    const cid = searchParams.get('compositionId')
    const lang = searchParams.get('language')

    if (pid) setPatientId(pid)
    if (cid) setCompositionId(cid)
    if (lang) setPreferredLanguage(lang)
  }, [searchParams])

  // Fetch patient's discharge summary and instructions
  useEffect(() => {
    const fetchPatientData = async () => {
      if (!patientId || !compositionId || !token || !tenant) {
        setIsLoadingData(false)
        return
      }

      setIsLoadingData(true)
      try {
        const details = await getPatientDetails(
          patientId,
          compositionId,
          token,
          tenant.id
        )

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

        setIsLoadingData(false)
      } catch (error) {
        console.error('Failed to fetch patient data:', error)
        setIsLoadingData(false)
      }
    }

    fetchPatientData()
  }, [patientId, compositionId, token, tenant, preferredLanguage])

  // Mock patient data for UI elements (will be replaced with real data later)
  const mockPatientData = {
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
    try {
      // Get the current language translations
      const t = translations[language as keyof typeof translations]
      
      // Create a comprehensive discharge summary content
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

      // Create PDF
      const pdf = new jsPDF()
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const margin = 20
      const maxWidth = pageWidth - (margin * 2)
      
      // Add title
      pdf.setFontSize(18)
      pdf.setFont("helvetica", "bold")
      pdf.text("DISCHARGE INSTRUCTIONS", margin, 30)
      
      // Add patient info
      pdf.setFontSize(12)
      pdf.setFont("helvetica", "normal")
      pdf.text(`${patientData.name}`, margin, 45)
      pdf.text(`Discharge Date: March 15, 2024`, margin, 55)
      pdf.text(`Attending Physician: Dr. Sarah Johnson, MD`, margin, 65)
      
      // Add content with word wrapping
      const lines = pdf.splitTextToSize(content, maxWidth)
      let yPosition = 80
      
      pdf.setFontSize(10)
      for (let i = 0; i < lines.length; i++) {
        if (yPosition > pageHeight - 20) {
          pdf.addPage()
          yPosition = 20
        }
        pdf.text(lines[i], margin, yPosition)
        yPosition += 6
      }
      
      // Add AI disclaimer at the bottom
      pdf.setFontSize(8)
      pdf.setFont("helvetica", "italic")
      pdf.text("This content has been simplified using artificial intelligence for better patient understanding.", margin, yPosition + 10)
      
      // Save the PDF
      pdf.save(`discharge-instructions-${patientData.name.replace(" ", "-").toLowerCase()}.pdf`)
    } catch (error) {
      console.error("Error generating PDF:", error)
      // Fallback to text download
      const content = `
DISCHARGE INSTRUCTIONS - ${patientData.name}
Discharge Date: March 15, 2024
Attending Physician: Dr. Sarah Johnson, MD

MEDICATIONS:
${patientData.medications.map((med) => `- ${med.name} ${med.dose}: ${med.instructions}`).join("\n")}

APPOINTMENTS:
${patientData.appointments.map((apt) => `- ${apt.date}: ${apt.doctor} (${apt.specialty})`).join("\n")}

EMERGENCY CONTACTS:
- 24/7 Nurse Hotline: (555) 999-0000
- Dr. Sarah Johnson: (555) 123-4567
- Emergency: 911
      `
      const blob = new Blob([content], { type: "text/plain" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `discharge-instructions-${patientData.name.replace(" ", "-").toLowerCase()}.txt`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }
  }

  const languages = {
    en: "English",
    es: "Español",
    hi: "हिंदी",
    vi: "Tiếng Việt",
    fr: "Français",
  }

  const translations = {
    en: {
      // Header
      patientPortal: "Patient Portal",
      welcomeBack: "Welcome back, John Smith",
      dischargedFrom: "Discharged from General Hospital - Cardiology Unit",
      dischargeDate: "Discharge Date: March 15, 2024",
      downloadPDF: "Download PDF",
      print: "Print",

      // Tabs
      overview: "Overview",
      medications: "Medications",
      appointments: "Appointments",
      dietActivity: "Diet & Activity",
      warningsSigns: "Warning Signs",

      // Overview
      recoverySummary: "Your Recovery Summary",
      reasonForStay: "Reason for Hospital Stay",
      reasonText:
        "You were treated for chest pain and underwent cardiac catheterization. The procedure was successful and showed no significant blockages.",
      whatHappened: "What Happened During Your Stay",
      whatHappenedText:
        "Your heart was carefully monitored, and tests showed your heart is working well. You received medications to help your heart and prevent future problems.",
      quickActions: "Quick Actions",
      viewTodaysMeds: "View Today's Medications",
      nextAppointment: "Next Appointment: March 22",
      callNurse: "Call Nurse Hotline",
      askQuestion: "Ask a Question",

      // Medications
      yourMedications: "Your Medications",
      printChecklist: "Print Checklist",
      frequency: "Frequency",
      whenToTake: "When to Take",
      specialInstructions: "Special Instructions",
      morning: "Morning",
      evening: "Evening",
      twiceDaily: "Twice daily",
      onceDaily: "Once daily",
      morningEvening: "Morning and Evening",

      // Appointments
      upcomingAppointments: "Upcoming Appointments",
      downloadCalendar: "Download Calendar",
      address: "Address",
      preparationNotes: "Preparation Notes",
      directions: "Directions",
      addToCalendar: "Add to Calendar",

      // Diet & Activity
      dietActivityGuidelines: "Diet & Activity Guidelines",
      dietRecommendations: "Diet Recommendations",
      foodsToInclude: "Foods to Include",
      foodsToLimit: "Foods to Limit",
      activityGuidelines: "Activity Guidelines",
      recommendedActivities: "Recommended Activities",
      activitiesToAvoid: "Activities to Avoid",

      // Warning Signs
      whenToSeekHelp: "When to Seek Help",
      call911: "Call 911 Immediately If You Experience:",
      callDoctor: "Call Your Doctor If You Notice:",
      emergencyContacts: "Emergency Contacts",
      nurseHotline: "24/7 Nurse Hotline",
      nonEmergency: "For non-emergency questions",
      cardiologyOffice: "Cardiology Office",
      callNow: "Call Now",

      // Medication Instructions
      medInstructionTakeWithFood: "Take with food. Do not stop suddenly.",
      medInstructionBedtimeGrapefruit: "Take at bedtime. Avoid grapefruit.",
      medInstructionTakeWithFoodStomach: "Take with food to prevent stomach upset.",

      // Appointment Preparation Notes
      appointmentPrepMedicationList: "Bring your medication list and blood pressure log",
      appointmentPrepFasting: "Fasting required - no food or drink after midnight",

      // Diet & Activity - Foods to Include
      foodIncludeFreshFruits: "Fresh fruits and vegetables",
      foodIncludeWholeGrains: "Whole grains (brown rice, oats)",
      foodIncludeLeanProteins: "Lean proteins (fish, chicken, beans)",
      foodIncludeLowFatDairy: "Low-fat dairy products",
      foodIncludeNutsSeeds: "Nuts and seeds (unsalted)",

      // Diet & Activity - Foods to Limit
      foodLimitHighSodium: "High-sodium foods (processed meats, canned soups)",
      foodLimitFriedFast: "Fried and fast foods",
      foodLimitSugaryDrinks: "Sugary drinks and desserts",
      foodLimitAlcohol: "Excessive alcohol",

      // Diet & Activity - Recommended Activities
      activityRecommendedWalking: "Walking 20-30 minutes daily",
      activityRecommendedStretching: "Light stretching or yoga",
      activityRecommendedSwimming: "Swimming (after incision heals)",
      activityRecommendedChores: "Household chores (light cleaning)",

      // Diet & Activity - Activities to Avoid
      activityAvoidHeavyLifting: "Heavy lifting (over 10 pounds)",
      activityAvoidIntenseExercise: "Intense exercise or running",
      activityAvoidDriving: "Driving for 2 weeks",
      activityAvoidContactSports: "Contact sports",

      // Warning Signs - Call 911
      warning911ChestPain: "Severe chest pain or pressure",
      warning911Breathing: "Difficulty breathing or shortness of breath",
      warning911Weakness: "Sudden weakness or numbness",
      warning911Consciousness: "Loss of consciousness",

      // Warning Signs - Call Doctor
      warningDoctorSwelling: "Increased swelling in legs or feet",
      warningDoctorWeightGain: "Rapid weight gain (3+ pounds in 2 days)",
      warningDoctorCough: "Persistent cough or wheezing",
      warningDoctorDizziness: "Dizziness or lightheadedness",
      warningDoctorFatigue: "Unusual fatigue or weakness",
      warningDoctorInfection: "Signs of infection at incision site",
    },
    es: {
      // Header
      patientPortal: "Portal del Paciente",
      welcomeBack: "Bienvenido de nuevo, John Smith",
      dischargedFrom: "Dado de alta del Hospital General - Unidad de Cardiología",
      dischargeDate: "Fecha de alta: 15 de marzo de 2024",
      downloadPDF: "Descargar PDF",
      print: "Imprimir",

      // Tabs
      overview: "Resumen",
      medications: "Medicamentos",
      appointments: "Citas",
      dietActivity: "Dieta y Actividad",
      warningsSigns: "Señales de Alerta",

      // Overview
      recoverySummary: "Resumen de su Recuperación",
      reasonForStay: "Motivo de la Hospitalización",
      reasonText:
        "Fue tratado por dolor en el pecho y se sometió a un cateterismo cardíaco. El procedimiento fue exitoso y no mostró obstrucciones significativas.",
      whatHappened: "Qué Pasó Durante su Estadía",
      whatHappenedText:
        "Su corazón fue monitoreado cuidadosamente, y las pruebas mostraron que su corazón está funcionando bien. Recibió medicamentos para ayudar a su corazón y prevenir problemas futuros.",
      quickActions: "Acciones Rápidas",
      viewTodaysMeds: "Ver Medicamentos de Hoy",
      nextAppointment: "Próxima Cita: 22 de marzo",
      callNurse: "Llamar Línea de Enfermería",
      askQuestion: "Hacer una Pregunta",

      // Medications
      yourMedications: "Sus Medicamentos",
      printChecklist: "Imprimir Lista",
      frequency: "Frecuencia",
      whenToTake: "Cuándo Tomar",
      specialInstructions: "Instrucciones Especiales",
      morning: "Mañana",
      evening: "Noche",
      twiceDaily: "Dos veces al día",
      onceDaily: "Una vez al día",
      morningEvening: "Mañana y Noche",

      // Appointments
      upcomingAppointments: "Próximas Citas",
      downloadCalendar: "Descargar Calendario",
      address: "Dirección",
      preparationNotes: "Notas de Preparación",
      directions: "Direcciones",
      addToCalendar: "Agregar al Calendario",

      // Diet & Activity
      dietActivityGuidelines: "Guías de Dieta y Actividad",
      dietRecommendations: "Recomendaciones Dietéticas",
      foodsToInclude: "Alimentos a Incluir",
      foodsToLimit: "Alimentos a Limitar",
      activityGuidelines: "Guías de Actividad",
      recommendedActivities: "Actividades Recomendadas",
      activitiesToAvoid: "Actividades a Evitar",

      // Warning Signs
      whenToSeekHelp: "Cuándo Buscar Ayuda",
      call911: "Llame al 911 Inmediatamente Si Experimenta:",
      callDoctor: "Llame a su Médico Si Nota:",
      emergencyContacts: "Contactos de Emergencia",
      nurseHotline: "Línea de Enfermería 24/7",
      nonEmergency: "Para preguntas no urgentes",
      cardiologyOffice: "Oficina de Cardiología",
      callNow: "Llamar Ahora",

      // Medication Instructions
      medInstructionTakeWithFood: "Tome con comida. No deje de tomarlo repentinamente.",
      medInstructionBedtimeGrapefruit: "Tome a la hora de acostarse. Evite la toronja.",
      medInstructionTakeWithFoodStomach: "Tome con comida para prevenir malestar estomacal.",

      // Appointment Preparation Notes
      appointmentPrepMedicationList: "Traiga su lista de medicamentos y registro de presión arterial",
      appointmentPrepFasting: "Ayuno requerido - no comer ni beber después de medianoche",

      // Diet & Activity - Foods to Include
      foodIncludeFreshFruits: "Frutas y verduras frescas",
      foodIncludeWholeGrains: "Granos integrales (arroz integral, avena)",
      foodIncludeLeanProteins: "Proteínas magras (pescado, pollo, frijoles)",
      foodIncludeLowFatDairy: "Productos lácteos bajos en grasa",
      foodIncludeNutsSeeds: "Nueces y semillas (sin sal)",

      // Diet & Activity - Foods to Limit
      foodLimitHighSodium: "Alimentos con alto contenido de sodio (carnes procesadas, sopas enlatadas)",
      foodLimitFriedFast: "Alimentos fritos y comida rápida",
      foodLimitSugaryDrinks: "Bebidas azucaradas y postres",
      foodLimitAlcohol: "Alcohol en exceso",

      // Diet & Activity - Recommended Activities
      activityRecommendedWalking: "Caminar 20-30 minutos diarios",
      activityRecommendedStretching: "Estiramiento ligero o yoga",
      activityRecommendedSwimming: "Natación (después de que cicatrice la incisión)",
      activityRecommendedChores: "Tareas domésticas (limpieza ligera)",

      // Diet & Activity - Activities to Avoid
      activityAvoidHeavyLifting: "Levantar objetos pesados (más de 10 libras)",
      activityAvoidIntenseExercise: "Ejercicio intenso o correr",
      activityAvoidDriving: "Conducir durante 2 semanas",
      activityAvoidContactSports: "Deportes de contacto",

      // Warning Signs - Call 911
      warning911ChestPain: "Dolor o presión severa en el pecho",
      warning911Breathing: "Dificultad para respirar o falta de aliento",
      warning911Weakness: "Debilidad o entumecimiento repentino",
      warning911Consciousness: "Pérdida del conocimiento",

      // Warning Signs - Call Doctor
      warningDoctorSwelling: "Aumento de hinchazón en piernas o pies",
      warningDoctorWeightGain: "Aumento rápido de peso (3+ libras en 2 días)",
      warningDoctorCough: "Tos persistente o sibilancias",
      warningDoctorDizziness: "Mareos o aturdimiento",
      warningDoctorFatigue: "Fatiga o debilidad inusual",
      warningDoctorInfection: "Signos de infección en el sitio de la incisión",
    },
    hi: {
      // Header
      patientPortal: "रोगी पोर्टल",
      welcomeBack: "वापस स्वागत है, जॉन स्मिथ",
      dischargedFrom: "जनरल अस्पताल - कार्डियोलॉजी यूनिट से छुट्टी",
      dischargeDate: "छुट्टी की तारीख: 15 मार्च, 2024",
      downloadPDF: "पीडीएफ डाउनलोड करें",
      print: "प्रिंट करें",

      // Tabs
      overview: "अवलोकन",
      medications: "दवाएं",
      appointments: "अपॉइंटमेंट",
      dietActivity: "आहार और गतिविधि",
      warningsSigns: "चेतावनी के संकेत",

      // Overview
      recoverySummary: "आपकी रिकवरी का सारांश",
      reasonForStay: "अस्पताल में रहने का कारण",
      reasonText:
        "आपका सीने में दर्द के लिए इलाज किया गया और कार्डियक कैथेटराइजेशन किया गया। प्रक्रिया सफल रही और कोई महत्वपूर्ण रुकावट नहीं दिखी।",
      whatHappened: "आपके रहने के दौरान क्या हुआ",
      whatHappenedText:
        "आपके दिल की सावधानीपूर्वक निगरानी की गई, और परीक्षणों से पता चला कि आपका दिल अच्छी तरह से काम कर रहा है। आपको अपने दिल की मदद करने और भविष्य की समस्याओं को रोकने के लिए दवाएं दी गईं।",
      quickActions: "त्वरित कार्य",
      viewTodaysMeds: "आज की दवाएं देखें",
      nextAppointment: "अगला अपॉइंटमेंट: 22 मार्च",
      callNurse: "नर्स हॉटलाइन कॉल करें",
      askQuestion: "प्रश्न पूछें",

      // Medications
      yourMedications: "आपकी दवाएं",
      printChecklist: "चेकलिस्ट प्रिंट करें",
      frequency: "आवृत्ति",
      whenToTake: "कब लें",
      specialInstructions: "विशेष निर्देश",
      morning: "सुबह",
      evening: "शाम",
      twiceDaily: "दिन में दो बार",
      onceDaily: "दिन में एक बार",
      morningEvening: "सुबह और शाम",

      // Appointments
      upcomingAppointments: "आगामी अपॉइंटमेंट",
      downloadCalendar: "कैलेंडर डाउनलोड करें",
      address: "पता",
      preparationNotes: "तैयारी के नोट्स",
      directions: "दिशा-निर्देश",
      addToCalendar: "कैलेंडर में जोड़ें",

      // Diet & Activity
      dietActivityGuidelines: "आहार और गतिविधि दिशानिर्देश",
      dietRecommendations: "आहार सिफारिशें",
      foodsToInclude: "शामिल करने वाले खाद्य पदार्थ",
      foodsToLimit: "सीमित करने वाले खाद्य पदार्थ",
      activityGuidelines: "गतिविधि दिशानिर्देश",
      recommendedActivities: "अनुशंसित गतिविधियां",
      activitiesToAvoid: "बचने वाली गतिविधियां",

      // Warning Signs
      whenToSeekHelp: "कब मदद लें",
      call911: "यदि आप अनुभव करते हैं तो तुरंत 911 पर कॉल करें:",
      callDoctor: "यदि आप नोटिस करते हैं तो अपने डॉक्टर को कॉल करें:",
      emergencyContacts: "आपातकालीन संपर्क",
      nurseHotline: "24/7 नर्स हॉटलाइन",
      nonEmergency: "गैर-आपातकालीन प्रश्नों के लिए",
      cardiologyOffice: "कार्डियोलॉजी कार्यालय",
      callNow: "अभी कॉल करें",

      // Medication Instructions
      medInstructionTakeWithFood: "भोजन के साथ लें। अचानक बंद न करें।",
      medInstructionBedtimeGrapefruit: "सोने से पहले लें। अंगूर से बचें।",
      medInstructionTakeWithFoodStomach: "पेट की परेशानी को रोकने के लिए भोजन के साथ लें।",

      // Appointment Preparation Notes
      appointmentPrepMedicationList: "अपनी दवाओं की सूची और रक्तचाप लॉग लाएं",
      appointmentPrepFasting: "उपवास आवश्यक - आधी रात के बाद कोई भोजन या पेय नहीं",

      // Diet & Activity - Foods to Include
      foodIncludeFreshFruits: "ताजे फल और सब्जियां",
      foodIncludeWholeGrains: "साबुत अनाज (ब्राउन राइस, ओट्स)",
      foodIncludeLeanProteins: "दुबला प्रोटीन (मछली, चिकन, बीन्स)",
      foodIncludeLowFatDairy: "कम वसा वाले डेयरी उत्पाद",
      foodIncludeNutsSeeds: "नट्स और बीज (बिना नमक के)",

      // Diet & Activity - Foods to Limit
      foodLimitHighSodium: "उच्च सोडियम वाले खाद्य पदार्थ (प्रसंस्कृत मांस, डिब्बाबंद सूप)",
      foodLimitFriedFast: "तले हुए और फास्ट फूड",
      foodLimitSugaryDrinks: "मीठे पेय और मिठाई",
      foodLimitAlcohol: "अत्यधिक शराब",

      // Diet & Activity - Recommended Activities
      activityRecommendedWalking: "दैनिक 20-30 मिनट चलना",
      activityRecommendedStretching: "हल्का स्ट्रेचिंग या योग",
      activityRecommendedSwimming: "तैराकी (चीरे के ठीक होने के बाद)",
      activityRecommendedChores: "घरेलू काम (हल्की सफाई)",

      // Diet & Activity - Activities to Avoid
      activityAvoidHeavyLifting: "भारी वजन उठाना (10 पाउंड से अधिक)",
      activityAvoidIntenseExercise: "तीव्र व्यायाम या दौड़ना",
      activityAvoidDriving: "2 सप्ताह तक गाड़ी चलाना",
      activityAvoidContactSports: "संपर्क खेल",

      // Warning Signs - Call 911
      warning911ChestPain: "गंभीर सीने में दर्द या दबाव",
      warning911Breathing: "सांस लेने में कठिनाई या सांस की तकलीफ",
      warning911Weakness: "अचानक कमजोरी या सुन्नता",
      warning911Consciousness: "चेतना की हानि",

      // Warning Signs - Call Doctor
      warningDoctorSwelling: "पैरों या पैरों में सूजन बढ़ना",
      warningDoctorWeightGain: "तेजी से वजन बढ़ना (2 दिनों में 3+ पाउंड)",
      warningDoctorCough: "लगातार खांसी या घरघराहट",
      warningDoctorDizziness: "चक्कर आना या हल्कापन",
      warningDoctorFatigue: "असामान्य थकान या कमजोरी",
      warningDoctorInfection: "चीरे के स्थान पर संक्रमण के संकेत",
    },
    vi: {
      // Header
      patientPortal: "Cổng Thông Tin Bệnh Nhân",
      welcomeBack: "Chào mừng trở lại, John Smith",
      dischargedFrom: "Xuất viện từ Bệnh viện Đa khoa - Khoa Tim mạch",
      dischargeDate: "Ngày xuất viện: 15 tháng 3, 2024",
      downloadPDF: "Tải PDF",
      print: "In",

      // Tabs
      overview: "Tổng quan",
      medications: "Thuốc",
      appointments: "Cuộc hẹn",
      dietActivity: "Chế độ ăn & Hoạt động",
      warningsSigns: "Dấu hiệu cảnh báo",

      // Overview
      recoverySummary: "Tóm tắt Quá trình Hồi phục",
      reasonForStay: "Lý do Nhập viện",
      reasonText:
        "Bạn đã được điều trị vì đau ngực và thực hiện thông tim. Thủ thuật thành công và không có tắc nghẽn đáng kể.",
      whatHappened: "Điều gì Đã xảy ra Trong thời gian Nằm viện",
      whatHappenedText:
        "Tim của bạn đã được theo dõi cẩn thận, và các xét nghiệm cho thấy tim bạn hoạt động tốt. Bạn đã nhận thuốc để giúp tim và ngăn ngừa các vấn đề trong tương lai.",
      quickActions: "Hành động Nhanh",
      viewTodaysMeds: "Xem Thuốc Hôm nay",
      nextAppointment: "Cuộc hẹn Tiếp theo: 22 tháng 3",
      callNurse: "Gọi Đường dây Nóng Y tá",
      askQuestion: "Đặt Câu hỏi",

      // Medications
      yourMedications: "Thuốc của Bạn",
      printChecklist: "In Danh sách Kiểm tra",
      frequency: "Tần suất",
      whenToTake: "Khi nào Uống",
      specialInstructions: "Hướng dẫn Đặc biệt",
      morning: "Sáng",
      evening: "Tối",
      twiceDaily: "Hai lần mỗi ngày",
      onceDaily: "Một lần mỗi ngày",
      morningEvening: "Sáng và Tối",

      // Appointments
      upcomingAppointments: "Cuộc hẹn Sắp tới",
      downloadCalendar: "Tải Lịch",
      address: "Địa chỉ",
      preparationNotes: "Ghi chú Chuẩn bị",
      directions: "Chỉ đường",
      addToCalendar: "Thêm vào Lịch",

      // Diet & Activity
      dietActivityGuidelines: "Hướng dẫn Chế độ ăn & Hoạt động",
      dietRecommendations: "Khuyến nghị Chế độ ăn",
      foodsToInclude: "Thực phẩm Nên ăn",
      foodsToLimit: "Thực phẩm Hạn chế",
      activityGuidelines: "Hướng dẫn Hoạt động",
      recommendedActivities: "Hoạt động Được khuyến nghị",
      activitiesToAvoid: "Hoạt động Nên tránh",

      // Warning Signs
      whenToSeekHelp: "Khi nào Tìm Kiếm Giúp đỡ",
      call911: "Gọi 911 Ngay lập tức Nếu Bạn Gặp:",
      callDoctor: "Gọi Bác sĩ Nếu Bạn Nhận thấy:",
      emergencyContacts: "Liên hệ Khẩn cấp",
      nurseHotline: "Đường dây Nóng Y tá 24/7",
      nonEmergency: "Cho các câu hỏi không khẩn cấp",
      cardiologyOffice: "Văn phòng Tim mạch",
      callNow: "Gọi Ngay",

      // Medication Instructions
      medInstructionTakeWithFood: "Uống với thức ăn. Không ngừng đột ngột.",
      medInstructionBedtimeGrapefruit: "Uống trước khi đi ngủ. Tránh bưởi.",
      medInstructionTakeWithFoodStomach: "Uống với thức ăn để tránh khó chịu dạ dày.",

      // Appointment Preparation Notes
      appointmentPrepMedicationList: "Mang theo danh sách thuốc và nhật ký huyết áp",
      appointmentPrepFasting: "Cần nhịn ăn - không ăn uống sau nửa đêm",

      // Diet & Activity - Foods to Include
      foodIncludeFreshFruits: "Trái cây và rau tươi",
      foodIncludeWholeGrains: "Ngũ cốc nguyên hạt (gạo lứt, yến mạch)",
      foodIncludeLeanProteins: "Chất đạm nạc (cá, gà, đậu)",
      foodIncludeLowFatDairy: "Sản phẩm sữa ít béo",
      foodIncludeNutsSeeds: "Hạt và quả hạch (không muối)",

      // Diet & Activity - Foods to Limit
      foodLimitHighSodium: "Thực phẩm nhiều natri (thịt chế biến, súp đóng hộp)",
      foodLimitFriedFast: "Thực phẩm chiên và thức ăn nhanh",
      foodLimitSugaryDrinks: "Đồ uống có đường và món tráng miệng",
      foodLimitAlcohol: "Rượu quá mức",

      // Diet & Activity - Recommended Activities
      activityRecommendedWalking: "Đi bộ 20-30 phút mỗi ngày",
      activityRecommendedStretching: "Kéo giãn nhẹ hoặc yoga",
      activityRecommendedSwimming: "Bơi lội (sau khi vết mổ lành)",
      activityRecommendedChores: "Việc nhà (dọn dẹp nhẹ)",

      // Diet & Activity - Activities to Avoid
      activityAvoidHeavyLifting: "Nâng vật nặng (trên 10 pound)",
      activityAvoidIntenseExercise: "Tập thể dục cường độ cao hoặc chạy",
      activityAvoidDriving: "Lái xe trong 2 tuần",
      activityAvoidContactSports: "Thể thao tiếp xúc",

      // Warning Signs - Call 911
      warning911ChestPain: "Đau ngực hoặc áp lực nghiêm trọng",
      warning911Breathing: "Khó thở hoặc thở gấp",
      warning911Weakness: "Yếu đột ngột hoặc tê",
      warning911Consciousness: "Mất ý thức",

      // Warning Signs - Call Doctor
      warningDoctorSwelling: "Sưng tăng ở chân hoặc bàn chân",
      warningDoctorWeightGain: "Tăng cân nhanh (3+ pound trong 2 ngày)",
      warningDoctorCough: "Ho dai dẳng hoặc thở khò khè",
      warningDoctorDizziness: "Chóng mặt hoặc choáng váng",
      warningDoctorFatigue: "Mệt mỏi hoặc yếu bất thường",
      warningDoctorInfection: "Dấu hiệu nhiễm trùng tại vị trí vết mổ",
    },
    fr: {
      // Header
      patientPortal: "Portail Patient",
      welcomeBack: "Bon retour, John Smith",
      dischargedFrom: "Sorti de l'Hôpital Général - Unité de Cardiologie",
      dischargeDate: "Date de sortie : 15 mars 2024",
      downloadPDF: "Télécharger PDF",
      print: "Imprimer",

      // Tabs
      overview: "Aperçu",
      medications: "Médicaments",
      appointments: "Rendez-vous",
      dietActivity: "Régime et Activité",
      warningsSigns: "Signes d'Alerte",

      // Overview
      recoverySummary: "Résumé de votre Rétablissement",
      reasonForStay: "Raison de l'Hospitalisation",
      reasonText:
        "Vous avez été traité pour des douleurs thoraciques et avez subi un cathétérisme cardiaque. La procédure a été réussie et n'a montré aucun blocage significatif.",
      whatHappened: "Ce qui s'est Passé Pendant votre Séjour",
      whatHappenedText:
        "Votre cœur a été surveillé attentivement, et les tests ont montré que votre cœur fonctionne bien. Vous avez reçu des médicaments pour aider votre cœur et prévenir les problèmes futurs.",
      quickActions: "Actions Rapides",
      viewTodaysMeds: "Voir les Médicaments d'Aujourd'hui",
      nextAppointment: "Prochain Rendez-vous : 22 mars",
      callNurse: "Appeler la Ligne d'Infirmière",
      askQuestion: "Poser une Question",

      // Medications
      yourMedications: "Vos Médicaments",
      printChecklist: "Imprimer la Liste",
      frequency: "Fréquence",
      whenToTake: "Quand Prendre",
      specialInstructions: "Instructions Spéciales",
      morning: "Matin",
      evening: "Soir",
      twiceDaily: "Deux fois par jour",
      onceDaily: "Une fois par jour",
      morningEvening: "Matin et Soir",

      // Appointments
      upcomingAppointments: "Rendez-vous à Venir",
      downloadCalendar: "Télécharger le Calendrier",
      address: "Adresse",
      preparationNotes: "Notes de Préparation",
      directions: "Directions",
      addToCalendar: "Ajouter au Calendrier",

      // Diet & Activity
      dietActivityGuidelines: "Directives de Régime et d'Activité",
      dietRecommendations: "Recommandations Diététiques",
      foodsToInclude: "Aliments à Inclure",
      foodsToLimit: "Aliments à Limiter",
      activityGuidelines: "Directives d'Activité",
      recommendedActivities: "Activités Recommandées",
      activitiesToAvoid: "Activités à Éviter",

      // Warning Signs
      whenToSeekHelp: "Quand Chercher de l'Aide",
      call911: "Appelez le 911 Immédiatement Si Vous Ressentez :",
      callDoctor: "Appelez votre Médecin Si Vous Remarquez :",
      emergencyContacts: "Contacts d'Urgence",
      nurseHotline: "Ligne d'Infirmière 24/7",
      nonEmergency: "Pour les questions non urgentes",
      cardiologyOffice: "Bureau de Cardiologie",
      callNow: "Appeler Maintenant",

      // Medication Instructions
      medInstructionTakeWithFood: "Prendre avec de la nourriture. Ne pas arrêter brusquement.",
      medInstructionBedtimeGrapefruit: "Prendre au coucher. Éviter le pamplemousse.",
      medInstructionTakeWithFoodStomach: "Prendre avec de la nourriture pour éviter les maux d'estomac.",

      // Appointment Preparation Notes
      appointmentPrepMedicationList: "Apportez votre liste de médicaments et votre journal de tension artérielle",
      appointmentPrepFasting: "Jeûne requis - pas de nourriture ni de boisson après minuit",

      // Diet & Activity - Foods to Include
      foodIncludeFreshFruits: "Fruits et légumes frais",
      foodIncludeWholeGrains: "Céréales complètes (riz brun, avoine)",
      foodIncludeLeanProteins: "Protéines maigres (poisson, poulet, haricots)",
      foodIncludeLowFatDairy: "Produits laitiers allégés",
      foodIncludeNutsSeeds: "Noix et graines (non salées)",

      // Diet & Activity - Foods to Limit
      foodLimitHighSodium: "Aliments riches en sodium (viandes transformées, soupes en conserve)",
      foodLimitFriedFast: "Aliments frits et restauration rapide",
      foodLimitSugaryDrinks: "Boissons sucrées et desserts",
      foodLimitAlcohol: "Alcool excessif",

      // Diet & Activity - Recommended Activities
      activityRecommendedWalking: "Marcher 20-30 minutes par jour",
      activityRecommendedStretching: "Étirements légers ou yoga",
      activityRecommendedSwimming: "Natation (après la guérison de l'incision)",
      activityRecommendedChores: "Tâches ménagères (nettoyage léger)",

      // Diet & Activity - Activities to Avoid
      activityAvoidHeavyLifting: "Soulever des charges lourdes (plus de 10 livres)",
      activityAvoidIntenseExercise: "Exercice intense ou course",
      activityAvoidDriving: "Conduire pendant 2 semaines",
      activityAvoidContactSports: "Sports de contact",

      // Warning Signs - Call 911
      warning911ChestPain: "Douleur thoracique ou pression sévère",
      warning911Breathing: "Difficulté à respirer ou essoufflement",
      warning911Weakness: "Faiblesse ou engourdissement soudain",
      warning911Consciousness: "Perte de conscience",

      // Warning Signs - Call Doctor
      warningDoctorSwelling: "Augmentation du gonflement dans les jambes ou les pieds",
      warningDoctorWeightGain: "Prise de poids rapide (3+ livres en 2 jours)",
      warningDoctorCough: "Toux persistante ou respiration sifflante",
      warningDoctorDizziness: "Vertiges ou étourdissements",
      warningDoctorFatigue: "Fatigue ou faiblesse inhabituelle",
      warningDoctorInfection: "Signes d'infection au site d'incision",
    },
  }

  const t = translations[language as keyof typeof translations]

  // Show loading state while fetching data
  if (isLoadingData) {
    return (
      <AuthGuard>
        <div className="min-h-screen bg-background flex flex-col">
          <CommonHeader title="Patient Portal" />
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
              <p className="text-muted-foreground">Loading your discharge information...</p>
            </div>
          </div>
          <CommonFooter />
        </div>
      </AuthGuard>
    )
  }

  // Get display content based on whether translated view is active
  const displaySummary = (viewTranslated && translatedSummary) ? translatedSummary : dischargeSummary
  const displayInstructions = (viewTranslated && translatedInstructions) ? translatedInstructions : dischargeInstructions

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background flex flex-col">
      <CommonHeader title="Patient Portal" />
      
      {/* Patient Portal Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Heart className="h-5 w-5" />
              </div>
              <div>
                <h1 className="font-heading text-xl font-semibold text-foreground">Patient Portal</h1>
                <p className="text-sm text-muted-foreground">{t.patientPortal}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Language Toggle - only show if translated content is available */}
              {preferredLanguage && preferredLanguage !== 'en' && translatedSummary && (
                <Button
                  variant={viewTranslated ? "default" : "outline"}
                  size="sm"
                  onClick={() => setViewTranslated(!viewTranslated)}
                >
                  <Globe className="h-4 w-4 mr-2" />
                  {viewTranslated ? `Viewing in ${languages[preferredLanguage as keyof typeof languages] || preferredLanguage}` : 'View Translation'}
                </Button>
              )}
              <FeedbackButton userType="patient" />
              <Avatar className="h-8 w-8">
                <AvatarImage src="/patient-avatar.png" />
                <AvatarFallback>{user?.name?.charAt(0) || 'P'}</AvatarFallback>
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
                    <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                      {viewTranslated ? 'AI Translated' : 'AI Simplified'}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {viewTranslated
                        ? 'This content has been translated using artificial intelligence'
                        : 'This content has been simplified using artificial intelligence'
                      }
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {displaySummary ? (
                    <div className="prose prose-sm max-w-none">
                      <div className="whitespace-pre-wrap text-muted-foreground">
                        {displaySummary}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <h4 className="font-medium mb-2">{t.reasonForStay}</h4>
                      <p className="text-muted-foreground">{t.reasonText}</p>
                      <Separator className="my-4" />
                      <h4 className="font-medium mb-2">{t.whatHappened}</h4>
                      <p className="text-muted-foreground">{t.whatHappenedText}</p>
                    </div>
                  )}
                  {displayInstructions && (
                    <>
                      <Separator />
                      <div className="prose prose-sm max-w-none">
                        <h4 className="font-medium mb-2">Discharge Instructions</h4>
                        <div className="whitespace-pre-wrap text-muted-foreground">
                          {displayInstructions}
                        </div>
                      </div>
                    </>
                  )}
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
      <Button className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg" onClick={() => setShowChat(true)}>
        <MessageCircle className="h-6 w-6" />
      </Button>

      <PatientChatbot
        isOpen={showChat}
        onClose={() => setShowChat(false)}
        patientData={mockPatientData}
        dischargeSummary={dischargeSummary}
        dischargeInstructions={dischargeInstructions}
        compositionId={compositionId || ''}
        patientId={patientId || ''}
      />
      
      <CommonFooter />
      </div>
    </AuthGuard>
  )
}
