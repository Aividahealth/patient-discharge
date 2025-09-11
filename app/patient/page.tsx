"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { PatientChatbot } from "@/components/patient-chatbot"
import { FeedbackButton } from "@/components/feedback-button"
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
} from "lucide-react"

export default function PatientDashboard() {
  const [language, setLanguage] = useState("en")
  const [checkedMeds, setCheckedMeds] = useState<Record<string, boolean>>({})
  const [showChat, setShowChat] = useState(false)
  const [activeTab, setActiveTab] = useState("overview")

  const patientData = {
    name: "John Smith",
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

  const downloadPDF = () => {
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
    },
  }

  const t = translations[language as keyof typeof translations]

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Heart className="h-5 w-5" />
              </div>
              <div>
                <h1 className="font-heading text-xl font-semibold text-foreground">Aivida</h1>
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
                  {Object.entries(languages).map(([code, name]) => (
                    <option key={code} value={code}>
                      {name}
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
                <Button variant="outline" size="sm" onClick={() => window.print()}>
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
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2">{t.reasonForStay}</h4>
                    <p className="text-muted-foreground">{t.reasonText}</p>
                  </div>
                  <Separator />
                  <div>
                    <h4 className="font-medium mb-2">{t.whatHappened}</h4>
                    <p className="text-muted-foreground">{t.whatHappenedText}</p>
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
                  instructions: "Take with food. Do not stop suddenly.",
                  morning: true,
                  evening: true,
                },
                {
                  id: "med2",
                  name: "Atorvastatin",
                  dose: "20mg",
                  frequency: t.onceDaily,
                  timing: t.evening,
                  instructions: "Take at bedtime. Avoid grapefruit.",
                  evening: true,
                },
                {
                  id: "med3",
                  name: "Aspirin",
                  dose: "81mg",
                  frequency: t.onceDaily,
                  timing: t.morning,
                  instructions: "Take with food to prevent stomach upset.",
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
                  preparation: "Bring your medication list and blood pressure log",
                },
                {
                  date: "April 5, 2024",
                  time: "2:00 PM",
                  doctor: "Dr. Michael Chen",
                  specialty: "Primary Care Check-up",
                  location: "Family Medicine Clinic",
                  address: "456 Health Plaza, Building A",
                  preparation: "Fasting required - no food or drink after midnight",
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
                      <li>• Fresh fruits and vegetables</li>
                      <li>• Whole grains (brown rice, oats)</li>
                      <li>• Lean proteins (fish, chicken, beans)</li>
                      <li>• Low-fat dairy products</li>
                      <li>• Nuts and seeds (unsalted)</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-medium text-red-700 mb-2 flex items-center gap-2">
                      <X className="h-4 w-4" />
                      {t.foodsToLimit}
                    </h4>
                    <ul className="text-sm space-y-1 text-muted-foreground ml-6">
                      <li>• High-sodium foods (processed meats, canned soups)</li>
                      <li>• Fried and fast foods</li>
                      <li>• Sugary drinks and desserts</li>
                      <li>• Excessive alcohol</li>
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
                      <li>• Walking 20-30 minutes daily</li>
                      <li>• Light stretching or yoga</li>
                      <li>• Swimming (after incision heals)</li>
                      <li>• Household chores (light cleaning)</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-medium text-red-700 mb-2 flex items-center gap-2">
                      <X className="h-4 w-4" />
                      {t.activitiesToAvoid}
                    </h4>
                    <ul className="text-sm space-y-1 text-muted-foreground ml-6">
                      <li>• Heavy lifting (over 10 pounds)</li>
                      <li>• Intense exercise or running</li>
                      <li>• Driving for 2 weeks</li>
                      <li>• Contact sports</li>
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
                    <span>Severe chest pain or pressure</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>Difficulty breathing or shortness of breath</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>Sudden weakness or numbness</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>Loss of consciousness</span>
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
                  <li>• Increased swelling in legs or feet</li>
                  <li>• Rapid weight gain (3+ pounds in 2 days)</li>
                  <li>• Persistent cough or wheezing</li>
                  <li>• Dizziness or lightheadedness</li>
                  <li>• Unusual fatigue or weakness</li>
                  <li>• Signs of infection at incision site</li>
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

      <PatientChatbot isOpen={showChat} onClose={() => setShowChat(false)} patientData={patientData} />
    </div>
  )
}
