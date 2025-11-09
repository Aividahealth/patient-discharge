"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { FeedbackButton } from "@/components/feedback-button"
import { CommonHeader } from "@/components/common-header"
import { CommonFooter } from "@/components/common-footer"
import { AuthGuard } from "@/components/auth-guard"
import { ErrorBoundary } from "@/components/error-boundary"
import { FileUploadModal } from "@/components/file-upload-modal"
import { useTenant } from "@/contexts/tenant-context"
import { usePDFExport } from "@/hooks/use-pdf-export"
import { getDischargeSummaryRenderer } from "@/components/discharge-renderers/renderer-registry"
import { parseDischargeDocument } from "@/lib/parsers/parser-registry"
import { getDischargeQueue, getPatientDetails, type DischargeQueuePatient } from "@/lib/discharge-summaries"
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
  Globe,
} from "lucide-react"

export default function ClinicianDashboard() {
  const { tenant, tenantId, token, isLoading, isAuthenticated } = useTenant()
  const { exportToPDF } = usePDFExport()
  const router = useRouter()
  const [selectedPatient, setSelectedPatient] = useState<string | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [language, setLanguage] = useState("en")
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isLoadingQueue, setIsLoadingQueue] = useState(true)
  const [isLoadingPatient, setIsLoadingPatient] = useState(false)
  const [approvalStatus, setApprovalStatus] = useState({
    medications: false,
    appointments: false,
    dietActivity: false,
  })

  const [patients, setPatients] = useState<Array<{
    id: string;
    name: string;
    mrn: string;
    room?: string;
    dischargeDate?: string;
    status: string;
    diagnosis?: string;
    specialty?: string;
    attendingPhysician?: string;
    compositionId?: string;
    [key: string]: any;
  }>>([])

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
      clinicianPortal: "Clinician Portal",
      dischargeQueue: "Discharge Queue",
      patientsReady: "Patients ready for discharge review",
      uploadNewSummary: "Upload New Summary",
      review: "Review",
      approved: "Approved",
      discharge: "Discharge",
      
      // Patient Info
      mrn: "MRN",
      cardiologyUnit: "Cardiology Unit",
      dischargeDate: "Discharge Date",
      edit: "Edit",
      preview: "Preview",
      regenerate: "Refresh",
      
      // Content Sections
      originalDischargeSummary: "Original Discharge Summary",
      patientFriendlyVersion: "Patient-Friendly Version",
      editingMode: "Editing Mode",
      dischargeDiagnosis: "DISCHARGE DIAGNOSIS:",
      medications: "MEDICATIONS:",
      followUp: "FOLLOW-UP:",
      activity: "ACTIVITY:",
      historyExamination: "HISTORY & EXAMINATION:",
      whatHappenedDuringStay: "What happened during your stay:",
      yourMedications: "Your medications:",
      yourAppointments: "Your appointments:",
      activityGuidelines: "Activity guidelines:",
      
      // Review Sections
      requiredSectionReview: "Required Section Review",
      reviewAndApprove: "Please review and approve each section before publishing to patient",
      medicationsListed: "medications listed",
      appointmentsScheduled: "appointments scheduled",
      guidelinesProvided: "Guidelines provided",
      
      // Additional Options
      additionalOptions: "Additional Options",
      redactSensitiveInfo: "Redact Sensitive Information",
      roomNumber: "Room number",
      medicalRecordNumber: "Medical record number",
      insuranceInformation: "Insurance information",
      additionalClarifications: "Additional Clarifications",
      addNotes: "Add any additional notes or clarifications for the patient...",
      
      // Action Buttons
      saveDraft: "Save Draft",
      generatePDF: "Generate PDF",
      printHandout: "Print Handout",
      publishToPatient: "Publish to Patient",
      
      // Status Messages
      reviewAllSections: "Please review and approve all required sections before publishing to patient.",
      selectPatient: "Select a Patient",
      choosePatient: "Choose a patient from the discharge queue to review their instructions",
      
      // Content Text
      chestPainText: "Chest pain, rule out acute coronary syndrome. Cardiac catheterization negative for significant coronary artery disease.",
      medicationsText: "1. Metoprolol tartrate 25mg PO BID\n2. Atorvastatin 20mg PO QHS\n3. Aspirin 81mg PO daily",
      followUpText: "Cardiology clinic in 1 week. Primary care in 2 weeks. Patient should monitor BP daily.",
      activityText: "No lifting >10lbs x 2 weeks. Gradual return to normal activity. Walking encouraged.",
      overviewText: "You were treated for chest pain and underwent cardiac catheterization. The procedure was successful and showed no significant blockages.",
      medicationsPatientText: "Take these medications exactly as prescribed:\n• Metoprolol 25mg - twice daily with food\n• Atorvastatin 20mg - once daily at bedtime\n• Aspirin 81mg - once daily with food",
      appointmentsText: "• Cardiology follow-up: March 22, 2024 at 10:30 AM\n• Primary care check-up: April 5, 2024 at 2:00 PM",
      activityGuidelinesText: "• No lifting over 10 pounds for 2 weeks\n• Walking 20-30 minutes daily is encouraged\n• Gradually return to normal activities",
    },
    es: {
      // Header
      clinicianPortal: "Portal del Clínico",
      dischargeQueue: "Cola de Alta",
      patientsReady: "Pacientes listos para revisión de alta",
      uploadNewSummary: "Subir Nuevo Resumen",
      review: "Revisar",
      approved: "Aprobado",
      discharge: "Alta",
      
      // Patient Info
      mrn: "MRN",
      cardiologyUnit: "Unidad de Cardiología",
      dischargeDate: "Fecha de Alta",
      edit: "Editar",
      preview: "Vista Previa",
      regenerate: "Actualizar",
      
      // Content Sections
      originalDischargeSummary: "Resumen de Alta Original",
      patientFriendlyVersion: "Versión Amigable para el Paciente",
      editingMode: "Modo de Edición",
      dischargeDiagnosis: "DIAGNÓSTICO DE ALTA:",
      medications: "MEDICAMENTOS:",
      followUp: "SEGUIMIENTO:",
      activity: "ACTIVIDAD:",
      historyExamination: "HISTORIA Y EXAMEN:",
      whatHappenedDuringStay: "Qué pasó durante su estadía:",
      yourMedications: "Sus medicamentos:",
      yourAppointments: "Sus citas:",
      activityGuidelines: "Pautas de actividad:",
      
      // Review Sections
      requiredSectionReview: "Revisión de Secciones Requeridas",
      reviewAndApprove: "Por favor revise y apruebe cada sección antes de publicar al paciente",
      medicationsListed: "medicamentos listados",
      appointmentsScheduled: "citas programadas",
      guidelinesProvided: "Pautas proporcionadas",
      
      // Additional Options
      additionalOptions: "Opciones Adicionales",
      redactSensitiveInfo: "Redactar Información Sensible",
      roomNumber: "Número de habitación",
      medicalRecordNumber: "Número de registro médico",
      insuranceInformation: "Información del seguro",
      additionalClarifications: "Aclaraciones Adicionales",
      addNotes: "Agregue notas adicionales o aclaraciones para el paciente...",
      
      // Action Buttons
      saveDraft: "Guardar Borrador",
      generatePDF: "Generar PDF",
      printHandout: "Imprimir Folleto",
      publishToPatient: "Publicar al Paciente",
      
      // Status Messages
      reviewAllSections: "Por favor revise y apruebe todas las secciones requeridas antes de publicar al paciente.",
      selectPatient: "Seleccionar un Paciente",
      choosePatient: "Elija un paciente de la cola de alta para revisar sus instrucciones",
      
      // Content Text
      chestPainText: "Dolor torácico, descartar síndrome coronario agudo. Cateterismo cardíaco negativo para enfermedad arterial coronaria significativa.",
      medicationsText: "1. Tartrato de metoprolol 25mg VO BID\n2. Atorvastatina 20mg VO QHS\n3. Aspirina 81mg VO diaria",
      followUpText: "Clínica de cardiología en 1 semana. Atención primaria en 2 semanas. El paciente debe monitorear la PA diariamente.",
      activityText: "No levantar >10lbs x 2 semanas. Retorno gradual a la actividad normal. Se recomienda caminar.",
      overviewText: "Fue tratado por dolor torácico y se sometió a cateterismo cardíaco. El procedimiento fue exitoso y no mostró obstrucciones significativas.",
      medicationsPatientText: "Tome estos medicamentos exactamente como se prescribieron:\n• Metoprolol 25mg - dos veces al día con comida\n• Atorvastatina 20mg - una vez al día al acostarse\n• Aspirina 81mg - una vez al día con comida",
      appointmentsText: "• Seguimiento de cardiología: 22 de marzo de 2024 a las 10:30 AM\n• Chequeo de atención primaria: 5 de abril de 2024 a las 2:00 PM",
      activityGuidelinesText: "• No levantar más de 10 libras por 2 semanas\n• Caminar 20-30 minutos diarios es recomendado\n• Retorno gradual a las actividades normales",
    },
    hi: {
      // Header
      clinicianPortal: "क्लिनिशियन पोर्टल",
      dischargeQueue: "डिस्चार्ज कतार",
      patientsReady: "डिस्चार्ज समीक्षा के लिए तैयार रोगी",
      uploadNewSummary: "नया सारांश अपलोड करें",
      review: "समीक्षा",
      approved: "अनुमोदित",
      discharge: "डिस्चार्ज",
      
      // Patient Info
      mrn: "MRN",
      cardiologyUnit: "कार्डियोलॉजी यूनिट",
      dischargeDate: "डिस्चार्ज की तारीख",
      edit: "संपादित करें",
      preview: "पूर्वावलोकन",
      regenerate: "ताज़ा करें",
      
      // Content Sections
      originalDischargeSummary: "मूल डिस्चार्ज सारांश",
      patientFriendlyVersion: "रोगी-अनुकूल संस्करण",
      editingMode: "संपादन मोड",
      dischargeDiagnosis: "डिस्चार्ज निदान:",
      medications: "दवाएं:",
      followUp: "फॉलो-अप:",
      activity: "गतिविधि:",
      historyExamination: "इतिहास और परीक्षा:",
      whatHappenedDuringStay: "आपके रहने के दौरान क्या हुआ:",
      yourMedications: "आपकी दवाएं:",
      yourAppointments: "आपके अपॉइंटमेंट:",
      activityGuidelines: "गतिविधि दिशानिर्देश:",
      
      // Review Sections
      requiredSectionReview: "आवश्यक अनुभाग समीक्षा",
      reviewAndApprove: "रोगी को प्रकाशित करने से पहले कृपया प्रत्येक अनुभाग की समीक्षा और अनुमोदन करें",
      medicationsListed: "दवाएं सूचीबद्ध",
      appointmentsScheduled: "अपॉइंटमेंट निर्धारित",
      guidelinesProvided: "दिशानिर्देश प्रदान किए गए",
      
      // Additional Options
      additionalOptions: "अतिरिक्त विकल्प",
      redactSensitiveInfo: "संवेदनशील जानकारी को संपादित करें",
      roomNumber: "कमरे का नंबर",
      medicalRecordNumber: "चिकित्सा रिकॉर्ड नंबर",
      insuranceInformation: "बीमा जानकारी",
      additionalClarifications: "अतिरिक्त स्पष्टीकरण",
      addNotes: "रोगी के लिए कोई अतिरिक्त नोट या स्पष्टीकरण जोड़ें...",
      
      // Action Buttons
      saveDraft: "ड्राफ्ट सेव करें",
      generatePDF: "PDF जेनरेट करें",
      printHandout: "हैंडआउट प्रिंट करें",
      publishToPatient: "रोगी को प्रकाशित करें",
      
      // Status Messages
      reviewAllSections: "रोगी को प्रकाशित करने से पहले कृपया सभी आवश्यक अनुभागों की समीक्षा और अनुमोदन करें।",
      selectPatient: "एक रोगी चुनें",
      choosePatient: "उनके निर्देशों की समीक्षा करने के लिए डिस्चार्ज कतार से एक रोगी चुनें",
      
      // Content Text
      chestPainText: "छाती में दर्द, तीव्र कोरोनरी सिंड्रोम को रद्द करें। महत्वपूर्ण कोरोनरी धमनी रोग के लिए कार्डियक कैथेटराइजेशन नकारात्मक।",
      medicationsText: "1. मेटोप्रोलोल टार्ट्रेट 25mg PO BID\n2. एटोरवास्टेटिन 20mg PO QHS\n3. एस्पिरिन 81mg PO दैनिक",
      followUpText: "1 सप्ताह में कार्डियोलॉजी क्लिनिक। 2 सप्ताह में प्राथमिक देखभाल। रोगी को दैनिक बीपी की निगरानी करनी चाहिए।",
      activityText: "2 सप्ताह तक >10lbs न उठाएं। सामान्य गतिविधि में धीरे-धीरे वापसी। चलने की सलाह दी जाती है।",
      overviewText: "आपका सीने में दर्द के लिए इलाज किया गया और कार्डियक कैथेटराइजेशन किया गया। प्रक्रिया सफल रही और कोई महत्वपूर्ण रुकावट नहीं दिखी।",
      medicationsPatientText: "इन दवाओं को बिल्कुल निर्धारित अनुसार लें:\n• मेटोप्रोलोल 25mg - भोजन के साथ दिन में दो बार\n• एटोरवास्टेटिन 20mg - सोने से पहले दिन में एक बार\n• एस्पिरिन 81mg - भोजन के साथ दिन में एक बार",
      appointmentsText: "• कार्डियोलॉजी फॉलो-अप: 22 मार्च, 2024 को सुबह 10:30 बजे\n• प्राथमिक देखभाल जांच: 5 अप्रैल, 2024 को दोपहर 2:00 बजे",
      activityGuidelinesText: "• 2 सप्ताह तक 10 पाउंड से अधिक न उठाएं\n• दैनिक 20-30 मिनट चलना प्रोत्साहित है\n• धीरे-धीरे सामान्य गतिविधियों में वापसी",
    },
    vi: {
      // Header
      clinicianPortal: "Cổng Thông Tin Bác sĩ",
      dischargeQueue: "Hàng đợi Xuất viện",
      patientsReady: "Bệnh nhân sẵn sàng để xem xét xuất viện",
      uploadNewSummary: "Tải lên Tóm tắt Mới",
      review: "Xem xét",
      approved: "Đã phê duyệt",
      discharge: "Xuất viện",
      
      // Patient Info
      mrn: "MRN",
      cardiologyUnit: "Khoa Tim mạch",
      dischargeDate: "Ngày Xuất viện",
      edit: "Chỉnh sửa",
      preview: "Xem trước",
      regenerate: "Làm mới",
      
      // Content Sections
      originalDischargeSummary: "Tóm tắt Xuất viện Gốc",
      patientFriendlyVersion: "Phiên bản Thân thiện với Bệnh nhân",
      editingMode: "Chế độ Chỉnh sửa",
      dischargeDiagnosis: "CHẨN ĐOÁN XUẤT VIỆN:",
      medications: "THUỐC:",
      followUp: "THEO DÕI:",
      activity: "HOẠT ĐỘNG:",
      historyExamination: "TIỀN SỬ VÀ KHÁM:",
      whatHappenedDuringStay: "Điều gì đã xảy ra trong thời gian nằm viện:",
      yourMedications: "Thuốc của bạn:",
      yourAppointments: "Cuộc hẹn của bạn:",
      activityGuidelines: "Hướng dẫn hoạt động:",
      
      // Review Sections
      requiredSectionReview: "Xem xét Các Phần Bắt buộc",
      reviewAndApprove: "Vui lòng xem xét và phê duyệt từng phần trước khi xuất bản cho bệnh nhân",
      medicationsListed: "thuốc được liệt kê",
      appointmentsScheduled: "cuộc hẹn đã lên lịch",
      guidelinesProvided: "Hướng dẫn được cung cấp",
      
      // Additional Options
      additionalOptions: "Tùy chọn Bổ sung",
      redactSensitiveInfo: "Chỉnh sửa Thông tin Nhạy cảm",
      roomNumber: "Số phòng",
      medicalRecordNumber: "Số hồ sơ y tế",
      insuranceInformation: "Thông tin bảo hiểm",
      additionalClarifications: "Làm rõ Bổ sung",
      addNotes: "Thêm bất kỳ ghi chú hoặc làm rõ nào cho bệnh nhân...",
      
      // Action Buttons
      saveDraft: "Lưu Bản nháp",
      generatePDF: "Tạo PDF",
      printHandout: "In Tài liệu",
      publishToPatient: "Xuất bản cho Bệnh nhân",
      
      // Status Messages
      reviewAllSections: "Vui lòng xem xét và phê duyệt tất cả các phần bắt buộc trước khi xuất bản cho bệnh nhân.",
      selectPatient: "Chọn Bệnh nhân",
      choosePatient: "Chọn một bệnh nhân từ hàng đợi xuất viện để xem xét hướng dẫn của họ",
      
      // Content Text
      chestPainText: "Đau ngực, loại trừ hội chứng mạch vành cấp. Thông tim âm tính với bệnh động mạch vành có ý nghĩa.",
      medicationsText: "1. Metoprolol tartrate 25mg PO BID\n2. Atorvastatin 20mg PO QHS\n3. Aspirin 81mg PO hàng ngày",
      followUpText: "Phòng khám tim mạch trong 1 tuần. Chăm sóc chính trong 2 tuần. Bệnh nhân nên theo dõi HA hàng ngày.",
      activityText: "Không nâng >10lbs x 2 tuần. Trở lại hoạt động bình thường dần dần. Khuyến khích đi bộ.",
      overviewText: "Bạn đã được điều trị vì đau ngực và thực hiện thông tim. Thủ thuật thành công và không có tắc nghẽn đáng kể.",
      medicationsPatientText: "Uống những thuốc này chính xác như đã kê:\n• Metoprolol 25mg - hai lần mỗi ngày với thức ăn\n• Atorvastatin 20mg - một lần mỗi ngày trước khi ngủ\n• Aspirin 81mg - một lần mỗi ngày với thức ăn",
      appointmentsText: "• Theo dõi tim mạch: 22 tháng 3, 2024 lúc 10:30 sáng\n• Kiểm tra chăm sóc chính: 5 tháng 4, 2024 lúc 2:00 chiều",
      activityGuidelinesText: "• Không nâng quá 10 pounds trong 2 tuần\n• Đi bộ 20-30 phút mỗi ngày được khuyến khích\n• Trở lại hoạt động bình thường dần dần",
    },
    fr: {
      // Header
      clinicianPortal: "Portail Clinique",
      dischargeQueue: "File de Sortie",
      patientsReady: "Patients prêts pour l'examen de sortie",
      uploadNewSummary: "Télécharger Nouveau Résumé",
      review: "Examiner",
      approved: "Approuvé",
      discharge: "Sortie",
      
      // Patient Info
      mrn: "MRN",
      cardiologyUnit: "Unité de Cardiologie",
      dischargeDate: "Date de Sortie",
      edit: "Modifier",
      preview: "Aperçu",
      regenerate: "Actualiser",
      
      // Content Sections
      originalDischargeSummary: "Résumé de Sortie Original",
      patientFriendlyVersion: "Version Conviviale pour le Patient",
      editingMode: "Mode d'Édition",
      dischargeDiagnosis: "DIAGNOSTIC DE SORTIE:",
      medications: "MÉDICAMENTS:",
      followUp: "SUIVI:",
      activity: "ACTIVITÉ:",
      historyExamination: "HISTORIQUE ET EXAMEN:",
      whatHappenedDuringStay: "Ce qui s'est passé pendant votre séjour:",
      yourMedications: "Vos médicaments:",
      yourAppointments: "Vos rendez-vous:",
      activityGuidelines: "Directives d'activité:",
      
      // Review Sections
      requiredSectionReview: "Examen des Sections Requises",
      reviewAndApprove: "Veuillez examiner et approuver chaque section avant de publier au patient",
      medicationsListed: "médicaments listés",
      appointmentsScheduled: "rendez-vous programmés",
      guidelinesProvided: "Directives fournies",
      
      // Additional Options
      additionalOptions: "Options Supplémentaires",
      redactSensitiveInfo: "Expurger les Informations Sensibles",
      roomNumber: "Numéro de chambre",
      medicalRecordNumber: "Numéro de dossier médical",
      insuranceInformation: "Informations d'assurance",
      additionalClarifications: "Clarifications Supplémentaires",
      addNotes: "Ajoutez des notes ou clarifications supplémentaires pour le patient...",
      
      // Action Buttons
      saveDraft: "Sauvegarder Brouillon",
      generatePDF: "Générer PDF",
      printHandout: "Imprimer Document",
      publishToPatient: "Publier au Patient",
      
      // Status Messages
      reviewAllSections: "Veuillez examiner et approuver toutes les sections requises avant de publier au patient.",
      selectPatient: "Sélectionner un Patient",
      choosePatient: "Choisissez un patient de la file de sortie pour examiner ses instructions",
      
      // Content Text
      chestPainText: "Douleur thoracique, exclure le syndrome coronarien aigu. Cathétérisme cardiaque négatif pour maladie coronarienne significative.",
      medicationsText: "1. Tartrate de métoprolol 25mg PO BID\n2. Atorvastatine 20mg PO QHS\n3. Aspirine 81mg PO quotidien",
      followUpText: "Clinique de cardiologie dans 1 semaine. Soins primaires dans 2 semaines. Le patient doit surveiller la TA quotidiennement.",
      activityText: "Pas de levage >10lbs x 2 semaines. Retour progressif à l'activité normale. Marche encouragée.",
      overviewText: "Vous avez été traité pour des douleurs thoraciques et avez subi un cathétérisme cardiaque. La procédure a été réussie et n'a montré aucun blocage significatif.",
      medicationsPatientText: "Prenez ces médicaments exactement comme prescrit:\n• Métoprolol 25mg - deux fois par jour avec nourriture\n• Atorvastatine 20mg - une fois par jour au coucher\n• Aspirine 81mg - une fois par jour avec nourriture",
      appointmentsText: "• Suivi cardiologie: 22 mars 2024 à 10h30\n• Vérification soins primaires: 5 avril 2024 à 14h00",
      activityGuidelinesText: "• Pas de levage de plus de 10 livres pendant 2 semaines\n• Marche 20-30 minutes quotidienne encouragée\n• Retour progressif aux activités normales",
    },
  }

  const t = translations[language as keyof typeof translations]

  const [patientMedicalData, setPatientMedicalData] = useState<Record<string, any>>({})

  // Helper function to parse simplified instructions text into sections
  const parseSimplifiedInstructions = (instructionsText: string) => {
    if (!instructionsText) {
      return {
        medications: '',
        appointments: '',
        activity: ''
      };
    }

    // Try to parse sections based on common headers (case-insensitive, flexible matching)
    // Match "Your medications:" or "Medications:" followed by content until next section
    const medicationsMatch = instructionsText.match(/(?:Your\s+medications|Medications|Medication):?\s*\n?\s*(.*?)(?=\n?\s*(?:Your\s+appointments|Appointments|Follow-up|Activity|Activity\s+guidelines|$))/is);
    
    // Match "Your appointments:" or "Appointments:" followed by content until activity section
    const appointmentsMatch = instructionsText.match(/(?:Your\s+appointments|Appointments|Follow-up\s+appointments|Follow-up):?\s*\n?\s*(.*?)(?=\n?\s*(?:Activity|Activity\s+guidelines|Diet|$))/is);
    
    // Match "Activity guidelines:" or "Activity:" followed by content until end
    const activityMatch = instructionsText.match(/(?:Activity\s+guidelines|Activity|Diet\s+and\s+activity|Activity\s+restrictions):?\s*\n?\s*(.*?)$/is);

    return {
      medications: medicationsMatch ? medicationsMatch[1].trim() : '',
      appointments: appointmentsMatch ? appointmentsMatch[1].trim() : '',
      activity: activityMatch ? activityMatch[1].trim() : ''
    };
  };

  // Helper function to fetch simplified content from the API
  const fetchSimplifiedContent = async (compositionId: string, token: string, tenantId: string) => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://patient-discharge-backend-dev-qnzythtpnq-uc.a.run.app';
      const simplifiedResponse = await fetch(
        `${apiUrl}/google/fhir/Composition/${compositionId}/simplified`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'X-Tenant-ID': tenantId,
          },
        }
      );

      if (simplifiedResponse.ok) {
        const simplifiedData = await simplifiedResponse.json();
        
        const simplifiedSummary = simplifiedData.dischargeSummaries?.find((summary: any) =>
          summary.tags?.some((tag: any) => tag.code === 'discharge-summary-simplified')
        );

        const simplifiedInstructions = simplifiedData.dischargeInstructions?.find((instr: any) =>
          instr.tags?.some((tag: any) => tag.code === 'discharge-instructions-simplified')
        );

        return {
          summary: simplifiedSummary?.text || '',
          instructions: simplifiedInstructions?.text || ''
        };
      }
    } catch (error) {
      console.error('[ClinicianPortal] Failed to fetch simplified content:', error);
    }
    
    return {
      summary: '',
      instructions: ''
    };
  };

  // Helper function to transform API patient data to component format (reused from file upload)
  const transformPatientData = async (
    queuePatient: DischargeQueuePatient,
    patientDetails: any,
    tenantId: string
  ) => {
    const rawSummary = patientDetails?.rawSummary;
    const rawInstructions = patientDetails?.rawInstructions;
    
    // Fetch simplified content from the new API endpoint
    const simplifiedContent = await fetchSimplifiedContent(
      queuePatient.compositionId,
      token || '',
      tenantId
    );
    
    const simplifiedSummaryText = simplifiedContent.summary;
    const simplifiedInstructionsText = simplifiedContent.instructions;

    // Parse raw text on frontend if parsedData not available from backend
    let parsedSummaryData = rawSummary?.parsedData || null;
    let parsedInstructionsData = rawInstructions?.parsedData || null;

    if (!parsedSummaryData && rawSummary?.text) {
      const parseResult = parseDischargeDocument(
        tenantId || 'demo',
        rawSummary.text,
        rawInstructions?.text || rawSummary.text
      );

      if (parseResult.parserUsed) {
        parsedSummaryData = parseResult.parsedSummary;
        parsedInstructionsData = parseResult.parsedInstructions;
      }
    }

    // Create patient entry matching the expected structure
    const transformedPatient = {
      id: queuePatient.id,
      name: queuePatient.name,
      mrn: queuePatient.mrn,
      room: queuePatient.room,
      dischargeDate: queuePatient.dischargeDate,
      status: queuePatient.status === 'approved' ? 'approved' : 'pending-review',
      diagnosis: rawSummary?.text?.substring(0, 100) || 'Processing...',
      specialty: queuePatient.unit,
      attendingPhysician: queuePatient.attendingPhysician?.name,
      compositionId: queuePatient.compositionId,
      // Add parsed data for structured rendering
      originalSummaryParsed: parsedSummaryData,
      originalInstructionsParsed: parsedInstructionsData,
      // Store AI-simplified content
      aiSimplifiedSummary: simplifiedSummaryText || null,
      aiSimplifiedInstructions: simplifiedInstructionsText || null,
      originalSummary: {
        diagnosis: { en: rawSummary?.text || 'Processing...' },
        diagnosisText: { en: rawSummary?.text || 'Processing...' },
        medications: { en: rawInstructions?.text || 'Processing...' },
        followUp: { en: 'Processing...' },
        activity: { en: 'Processing...' }
      },
      patientFriendly: simplifiedSummaryText ? (() => {
        const parsedInstructions = parseSimplifiedInstructions(simplifiedInstructionsText);
        return {
          overview: { en: simplifiedSummaryText },
          medications: { en: parsedInstructions.medications || 'N/A' },
          appointments: { en: parsedInstructions.appointments || 'N/A' },
          activity: { en: parsedInstructions.activity || 'N/A' }
        };
      })() : undefined
    };

    return transformedPatient;
  };

  // Load discharge queue from API
  const loadDischargeQueue = async () => {
    if (!token || !tenantId) {
      console.warn('[ClinicianPortal] Cannot load queue - missing token or tenantId');
      return;
    }

    setIsLoadingQueue(true);
    try {
      const queueData = await getDischargeQueue(token, tenantId);
      
      // Transform API patients to component format
      const transformedPatients = queueData.patients.map((p: DischargeQueuePatient) => ({
        id: p.id,
        name: p.name,
        mrn: p.mrn,
        room: p.room,
        dischargeDate: p.dischargeDate,
        status: p.status === 'approved' ? 'approved' : 'pending-review',
        specialty: p.unit,
        attendingPhysician: p.attendingPhysician?.name,
        compositionId: p.compositionId,
      }));

      setPatients(transformedPatients);

      // Load details for the first patient if available
      if (transformedPatients.length > 0) {
        const firstPatient = transformedPatients[0];
        // Create queue patient object for transformation
        const queuePatientForTransform: DischargeQueuePatient = {
          id: firstPatient.id,
          mrn: firstPatient.mrn,
          name: firstPatient.name,
          room: firstPatient.room || '',
          unit: firstPatient.specialty || '',
          dischargeDate: firstPatient.dischargeDate || '',
          compositionId: firstPatient.compositionId,
          status: firstPatient.status === 'approved' ? 'approved' : 'review',
          attendingPhysician: {
            name: firstPatient.attendingPhysician || '',
            id: `physician-${firstPatient.id}`
          },
          avatar: null
        };
        await loadPatientDetails(firstPatient.id, firstPatient.compositionId, queuePatientForTransform);
      }
    } catch (error) {
      console.error('[ClinicianPortal] Failed to load discharge queue:', error);
    } finally {
      setIsLoadingQueue(false);
    }
  };

  // Load patient details (original summary and patient-friendly version)
  const loadPatientDetails = async (
    patientId: string, 
    compositionId: string, 
    queuePatientOverride?: DischargeQueuePatient
  ) => {
    if (!token || !tenantId) {
      console.warn('[ClinicianPortal] Cannot load patient details - missing token or tenantId');
      return;
    }

    setIsLoadingPatient(true);
    try {
      // Get queue patient - either from override or find in state
      let queuePatientForTransform: DischargeQueuePatient;
      if (queuePatientOverride) {
        queuePatientForTransform = queuePatientOverride;
      } else {
        const queuePatient = patients.find(p => p.id === patientId);
        if (!queuePatient) {
          console.warn('[ClinicianPortal] Patient not found in queue');
          return;
        }
        queuePatientForTransform = {
          id: queuePatient.id,
          mrn: queuePatient.mrn,
          name: queuePatient.name,
          room: queuePatient.room || '',
          unit: queuePatient.specialty || '',
          dischargeDate: queuePatient.dischargeDate || '',
          compositionId: compositionId,
          status: queuePatient.status === 'approved' ? 'approved' : 'review',
          attendingPhysician: {
            name: queuePatient.attendingPhysician || '',
            id: `physician-${queuePatient.id}`
          },
          avatar: null
        };
      }

      // Fetch patient details from API
      const patientDetails = await getPatientDetails(patientId, compositionId, token, tenantId);
      
      // Transform to component format
      const transformedPatient = await transformPatientData(
        queuePatientForTransform,
        patientDetails,
        tenantId || 'demo'
      );

      // Update patientMedicalData
      setPatientMedicalData((prevData) => ({
        ...prevData,
        [patientId]: transformedPatient
      }));

      // Select this patient
      setSelectedPatient(patientId);
    } catch (error) {
      console.error('[ClinicianPortal] Failed to load patient details:', error);
    } finally {
      setIsLoadingPatient(false);
    }
  };

  // Redirect to login if not authenticated
  useEffect(() => {
    console.log('[ClinicianDashboard] Auth check:', { isLoading, isAuthenticated, tenantId, token })
    if (!isLoading && !isAuthenticated && tenantId) {
      console.log('[ClinicianDashboard] Redirecting to login')
      router.push(`/${tenantId}/login`)
    }
  }, [isLoading, isAuthenticated, tenantId, token, router])

  // Load discharge queue on mount
  useEffect(() => {
    if (token && tenantId) {
      loadDischargeQueue();
    }
  }, [token, tenantId]);

  // Load patient details when a patient is selected from the queue
  useEffect(() => {
    if (selectedPatient && token && tenantId && patients.length > 0) {
      const patient = patients.find(p => p.id === selectedPatient);
      if (patient && patient.compositionId) {
        // Only load if we don't already have the data
        if (!patientMedicalData[selectedPatient]) {
          loadPatientDetails(selectedPatient, patient.compositionId);
        }
      }
    }
  }, [selectedPatient, patients, token, tenantId]);

  const getCurrentPatientData = () => {
    return selectedPatient ? patientMedicalData[selectedPatient] : null
  }

  const currentPatient = getCurrentPatientData()

  const refreshComposition = async () => {
    if (!currentPatient?.compositionId || !tenantId || !token) {
      console.warn('[ClinicianPortal] Cannot refresh - missing required data');
      return;
    }

    setIsRefreshing(true);

    try {
      const compositionResponse = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/google/fhir/Composition/${currentPatient.compositionId}/binaries`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'X-Tenant-ID': tenantId,
          },
        }
      );

      if (!compositionResponse.ok) {
        throw new Error(`Failed to fetch composition: ${compositionResponse.status}`);
      }

      const compositionData = await compositionResponse.json();

      // Find the raw discharge summary (should be the one without simplified tags)
      const rawSummary = compositionData.dischargeSummaries?.find((summary: any) =>
        !summary.tags?.some((tag: any) => tag.code === 'simplified-content')
      );

      const rawInstructions = compositionData.dischargeInstructions?.find((instr: any) =>
        !instr.tags?.some((tag: any) => tag.code === 'simplified-content')
      );

      // Find simplified versions
      const simplifiedSummary = compositionData.dischargeSummaries?.find((summary: any) =>
        summary.tags?.some((tag: any) => tag.code === 'simplified-content')
      );

      const simplifiedInstructions = compositionData.dischargeInstructions?.find((instr: any) =>
        instr.tags?.some((tag: any) => tag.code === 'simplified-content')
      );

      // Fetch AI-simplified content from dedicated endpoint
      const simplifiedContent = await fetchSimplifiedContent(
        currentPatient.compositionId,
        token,
        tenantId
      );
      
      const aiSimplifiedSummaryText = simplifiedContent.summary;
      const aiSimplifiedInstructionsText = simplifiedContent.instructions;

      // Parse raw text on frontend if parsedData not available from backend
      let parsedSummaryData = rawSummary?.parsedData || null;
      let parsedInstructionsData = rawInstructions?.parsedData || null;

      if (!parsedSummaryData && rawSummary?.text) {
        const parseResult = parseDischargeDocument(
          tenantId || 'demo',
          rawSummary.text,
          rawInstructions?.text || rawSummary.text
        );

        if (parseResult.parserUsed) {
          parsedSummaryData = parseResult.parsedSummary;
          parsedInstructionsData = parseResult.parsedInstructions;
        }
      }

      // Update the patient's medical data with the refreshed composition
      const updatedPatientData = {
        ...currentPatient,
        // Add parsed data for structured rendering
        originalSummaryParsed: parsedSummaryData,
        originalInstructionsParsed: parsedInstructionsData,
        // Store AI-simplified content
        aiSimplifiedSummary: aiSimplifiedSummaryText || null,
        aiSimplifiedInstructions: aiSimplifiedInstructionsText || null,
        // Keep raw text as fallback
        originalSummary: {
          diagnosis: { en: rawSummary?.text || currentPatient.originalSummary?.diagnosis?.en || 'Processing...' },
          diagnosisText: { en: rawSummary?.text || currentPatient.originalSummary?.diagnosisText?.en || 'Processing...' },
          medications: { en: rawInstructions?.text || currentPatient.originalSummary?.medications?.en || 'Processing...' },
          followUp: { en: currentPatient.originalSummary?.followUp?.en || 'Processing...' },
          activity: { en: currentPatient.originalSummary?.activity?.en || 'Processing...' }
        },
        patientFriendly: aiSimplifiedSummaryText ? (() => {
          const parsedInstructions = parseSimplifiedInstructions(aiSimplifiedInstructionsText);
          return {
            overview: { en: aiSimplifiedSummaryText },
            medications: { en: parsedInstructions.medications || 'N/A' },
            appointments: { en: parsedInstructions.appointments || 'N/A' },
            activity: { en: parsedInstructions.activity || 'N/A' }
          };
        })() : currentPatient.patientFriendly
      };

      // Update patientMedicalData
      setPatientMedicalData((prevData) => ({
        ...prevData,
        [currentPatient.id]: updatedPatientData
      }));

    } catch (error) {
      console.error('[ClinicianPortal] Failed to refresh composition:', error);
      alert('Failed to refresh composition. Please try again.');
    } finally {
      setIsRefreshing(false);
    }
  };

  const toggleApproval = (section: keyof typeof approvalStatus) => {
    setApprovalStatus((prev) => ({ ...prev, [section]: !prev[section] }))
  }

  const printDischargeSummary = () => {
    if (!currentPatient) return
    
    // Get the current language translations
    const t = translations[language as keyof typeof translations]
    
    // Create a comprehensive discharge summary content for printing
    const content = `
DISCHARGE INSTRUCTIONS - ${currentPatient.name}
Discharge Date: ${currentPatient.dischargeDate}
Attending Physician: ${currentPatient.attendingPhysician}

ORIGINAL DISCHARGE SUMMARY:
${currentPatient.originalSummary?.diagnosis?.[language as keyof typeof currentPatient.originalSummary.diagnosis] || 'N/A'}

${currentPatient.originalSummary?.diagnosisText?.[language as keyof typeof currentPatient.originalSummary.diagnosisText] || 'N/A'}

MEDICATIONS:
${currentPatient.originalSummary?.medications?.[language as keyof typeof currentPatient.originalSummary.medications] || 'N/A'}

FOLLOW-UP:
${currentPatient.originalSummary?.followUp?.[language as keyof typeof currentPatient.originalSummary.followUp] || 'N/A'}

ACTIVITY:
${currentPatient.originalSummary?.activity?.[language as keyof typeof currentPatient.originalSummary.activity] || 'N/A'}

PATIENT-FRIENDLY VERSION:
${currentPatient.patientFriendly?.overview?.[language as keyof typeof currentPatient.patientFriendly.overview] || 'N/A'}

MEDICATIONS:
${currentPatient.patientFriendly?.medications?.[language as keyof typeof currentPatient.patientFriendly.medications] || 'N/A'}

APPOINTMENTS:
${currentPatient.patientFriendly?.appointments?.[language as keyof typeof currentPatient.patientFriendly.appointments] || 'N/A'}

ACTIVITY GUIDELINES:
${currentPatient.patientFriendly?.activity?.[language as keyof typeof currentPatient.patientFriendly.activity] || 'N/A'}
`;

    // Create a new window for printing
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Discharge Summary - ${currentPatient.name}</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; }
              h1 { color: #333; }
              .section { margin-bottom: 20px; }
              .section-title { font-weight: bold; font-size: 16px; margin-bottom: 10px; }
            </style>
          </head>
          <body>
            <pre style="white-space: pre-wrap; font-family: Arial, sans-serif;">${content}</pre>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  }

  const downloadPDF = async () => {
    if (!currentPatient) return

    // Create comprehensive discharge summary content
    const content = `
ORIGINAL DISCHARGE SUMMARY:
${currentPatient.originalSummary?.diagnosis?.[language as keyof typeof currentPatient.originalSummary.diagnosis] || 'N/A'}

${currentPatient.originalSummary?.diagnosisText?.[language as keyof typeof currentPatient.originalSummary.diagnosisText] || 'N/A'}

MEDICATIONS:
${currentPatient.originalSummary?.medications?.[language as keyof typeof currentPatient.originalSummary.medications] || 'N/A'}

FOLLOW-UP:
${currentPatient.originalSummary?.followUp?.[language as keyof typeof currentPatient.originalSummary.followUp] || 'N/A'}

ACTIVITY:
${currentPatient.originalSummary?.activity?.[language as keyof typeof currentPatient.originalSummary.activity] || 'N/A'}

PATIENT-FRIENDLY VERSION:
${currentPatient.patientFriendly?.overview?.[language as keyof typeof currentPatient.patientFriendly.overview] || 'N/A'}

MEDICATIONS (Simplified):
${currentPatient.patientFriendly?.medications?.[language as keyof typeof currentPatient.patientFriendly.medications] || 'N/A'}

APPOINTMENTS (Simplified):
${currentPatient.patientFriendly?.appointments?.[language as keyof typeof currentPatient.patientFriendly.appointments] || 'N/A'}

ACTIVITY GUIDELINES (Simplified):
${currentPatient.patientFriendly?.activity?.[language as keyof typeof currentPatient.patientFriendly.activity] || 'N/A'}
`

    await exportToPDF({
      header: {
        title: 'DISCHARGE SUMMARY',
        patientName: currentPatient.name,
        fields: [
          { label: 'MRN', value: currentPatient.mrn },
          { label: 'Discharge Date', value: currentPatient.dischargeDate },
          { label: 'Attending Physician', value: currentPatient.attendingPhysician }
        ]
      },
      content,
      footer: 'The patient-friendly content has been simplified using artificial intelligence for better patient understanding.',
      filename: `discharge-summary-${currentPatient.name.replace(' ', '-').toLowerCase()}.pdf`
    })
  }

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Don't render anything if not authenticated (redirect is happening)
  if (!isAuthenticated) {
    return null
  }

  return (
    <ErrorBoundary>
      <AuthGuard>
        <div className="min-h-screen bg-background flex flex-col">
      <CommonHeader title="Clinician Portal" />
      
      {/* Clinician Portal Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                <Stethoscope className="h-5 w-5" />
              </div>
              <div>
                <h1 className="font-heading text-xl font-semibold text-foreground">Clinician Portal</h1>
                <p className="text-sm text-muted-foreground">{t.clinicianPortal}</p>
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
                    <option key={code} value={code}>{name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 flex-1">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Discharge Queue */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="font-heading text-lg">{t.dischargeQueue}</CardTitle>
              <CardDescription>{t.patientsReady}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button 
                className="w-full justify-start bg-transparent" 
                variant="outline"
                onClick={() => setShowUploadModal(true)}
              >
                <Upload className="h-4 w-4 mr-2" />
                {t.uploadNewSummary}
              </Button>
              <Separator />
              <div className="flex items-center justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={loadDischargeQueue}
                  disabled={isLoadingQueue}
                >
                  <RefreshCw className={`h-4 w-4 ${isLoadingQueue ? 'animate-spin' : ''}`} />
                </Button>
              </div>
              {isLoadingQueue ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : patients.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">{t.selectPatient}</div>
              ) : (
                <div className="space-y-2">
                  {patients.map((patient) => (
                    <div
                      key={patient.id}
                      onClick={() => setSelectedPatient(patient.id)}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedPatient === patient.id
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-card hover:bg-accent border-border'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback>
                            {patient.name.split(' ').map(n => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{patient.name}</p>
                          <p className="text-sm opacity-80 truncate">{patient.mrn}</p>
                          <p className="text-xs opacity-60 truncate">{patient.specialty}</p>
                        </div>
                        <Badge variant={patient.status === 'approved' ? 'default' : 'secondary'}>
                          {patient.status === 'approved' ? t.approved : t.review}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Patient Details */}
          <div className="lg:col-span-3">
            {isLoadingPatient ? (
              <div className="text-center py-8 text-muted-foreground">Loading patient details...</div>
            ) : !currentPatient ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">{t.selectPatient}</p>
                  <p className="text-sm text-muted-foreground mt-2">{t.choosePatient}</p>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Patient Header */}
                <Card className="mb-6">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src="/patient-avatar.png" />
                          <AvatarFallback>{currentPatient?.name?.split(' ').map(n => n[0]).join('') || 'P'}</AvatarFallback>
                        </Avatar>
                        <div>
                          <CardTitle className="font-heading text-xl">{currentPatient?.name || 'Patient'}</CardTitle>
                          <CardDescription className="text-base">
                            {t.mrn}: {currentPatient?.mrn || 'N/A'} • {currentPatient?.room || 'N/A'} • {currentPatient?.specialty || 'N/A'}
                          </CardDescription>
                          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                            <span>{t.dischargeDate}: {currentPatient?.dischargeDate || 'N/A'}</span>
                            <span>•</span>
                            <span>{currentPatient?.attendingPhysician || 'N/A'}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => setEditMode(!editMode)}>
                          {editMode ? <Eye className="h-4 w-4 mr-2" /> : <Edit3 className="h-4 w-4 mr-2" />}
                          {editMode ? t.preview : t.edit}
                        </Button>
                        <Button variant="outline" size="sm" onClick={refreshComposition} disabled={isRefreshing}>
                          <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                          {t.regenerate}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
                
                {/* Side-by-Side Editor */}
                <div className="grid lg:grid-cols-2 gap-6 mb-6">
                  {/* Original Document */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="font-heading text-lg flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        {t.originalDischargeSummary}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="bg-muted/30 p-4 rounded-lg text-sm max-h-96 overflow-y-auto">
                        {(() => {
                          // Try to use structured renderer if parsed data is available
                          const parsedData = currentPatient.originalSummaryParsed;
                          if (parsedData) {
                            const renderer = getDischargeSummaryRenderer(
                              tenantId || 'demo',
                              null,
                              parsedData,
                              language
                            );
                            if (renderer) {
                              return renderer;
                            }
                          }

                          // Fall back to raw text display if no structured renderer
                          return (
                            <div className="space-y-4">
                              <div>
                                <h4 className="font-medium mb-2">{t.dischargeDiagnosis}</h4>
                                <p className="text-muted-foreground">
                                  {currentPatient.originalSummary?.diagnosis?.[language as keyof typeof currentPatient.originalSummary.diagnosis] || 'N/A'}
                                </p>
                              </div>
                              <div>
                                <h4 className="font-medium mb-2">{t.historyExamination || 'History & Examination'}</h4>
                                <p className="text-muted-foreground">
                                  {currentPatient.originalSummary?.diagnosisText?.[language as keyof typeof currentPatient.originalSummary.diagnosisText] || 'N/A'}
                                </p>
                              </div>
                              <div>
                                <h4 className="font-medium mb-2">{t.medications}</h4>
                                <p className="text-muted-foreground">
                                  {(() => {
                                    const medications = currentPatient.originalSummary?.medications?.[language as keyof typeof currentPatient.originalSummary.medications];
                                    if (!medications || typeof medications !== 'string') return 'N/A';
                                    const lines = (medications as string).split('\n');
                                    return lines.map((line: string, index: number) => (
                                      <span key={index}>
                                        {line}
                                        {index < lines.length - 1 && <br />}
                                      </span>
                                    ));
                                  })()}
                                </p>
                              </div>
                              <div>
                                <h4 className="font-medium mb-2">{t.followUp}</h4>
                                <p className="text-muted-foreground">
                                  {(() => {
                                    const followUp = currentPatient.originalSummary?.followUp?.[language as keyof typeof currentPatient.originalSummary.followUp];
                                    if (!followUp || typeof followUp !== 'string') return 'N/A';
                                    const lines = (followUp as string).split('\n');
                                    return lines.map((line: string, index: number) => (
                                      <span key={index}>
                                        {line}
                                        {index < lines.length - 1 && <br />}
                                      </span>
                                    ));
                                  })()}
                                </p>
                              </div>
                              <div>
                                <h4 className="font-medium mb-2">{t.activity}</h4>
                                <p className="text-muted-foreground">
                                  {(() => {
                                    const activity = currentPatient.originalSummary?.activity?.[language as keyof typeof currentPatient.originalSummary.activity];
                                    if (!activity || typeof activity !== 'string') return 'N/A';
                                    const lines = (activity as string).split('\n');
                                    return lines.map((line: string, index: number) => (
                                      <span key={index}>
                                        {line}
                                        {index < lines.length - 1 && <br />}
                                      </span>
                                    ));
                                  })()}
                                </p>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Simplified Patient Version */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="font-heading text-lg flex items-center gap-2">
                        <User className="h-5 w-5" />
                        {t.patientFriendlyVersion}
                        {editMode && <Badge variant="secondary">{t.editingMode || 'Editing Mode'}</Badge>}
                      </CardTitle>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                          AI Generated
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          This content has been simplified using artificial intelligence
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {editMode ? (
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="overview">{t.whatHappenedDuringStay}</Label>
                            <Textarea
                              id="overview"
                              className="mt-1"
                              rows={3}
                              defaultValue={(() => {
                                const overview = currentPatient?.patientFriendly?.overview;
                                if (!overview) return '';
                                if (typeof overview === 'string') {
                                  return overview;
                                }
                                return overview[language as keyof typeof overview] || overview.en || '';
                              })()}
                            />
                          </div>
                          <div>
                            <Label htmlFor="medications">{t.yourMedications}</Label>
                            <Textarea
                              id="medications"
                              className="mt-1"
                              rows={4}
                              defaultValue={(() => {
                                const medications = currentPatient?.patientFriendly?.medications;
                                if (!medications) return '';
                                if (typeof medications === 'string') {
                                  return medications;
                                }
                                return medications[language as keyof typeof medications] || medications.en || '';
                              })()}
                            />
                          </div>
                          <div>
                            <Label htmlFor="appointments">{t.yourAppointments}</Label>
                            <Textarea
                              id="appointments"
                              className="mt-1"
                              rows={3}
                              defaultValue={(() => {
                                const appointments = currentPatient?.patientFriendly?.appointments;
                                if (!appointments) return '';
                                if (typeof appointments === 'string') {
                                  return appointments;
                                }
                                return appointments[language as keyof typeof appointments] || appointments.en || '';
                              })()}
                            />
                          </div>
                          <div>
                            <Label htmlFor="activity">{t.activityGuidelines}</Label>
                            <Textarea
                              id="activity"
                              className="mt-1"
                              rows={3}
                              defaultValue={(() => {
                                const activity = currentPatient?.patientFriendly?.activity;
                                if (!activity) return '';
                                if (typeof activity === 'string') {
                                  return activity;
                                }
                                return activity[language as keyof typeof activity] || activity.en || '';
                              })()}
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button onClick={() => setEditMode(false)}>
                              <Save className="h-4 w-4 mr-2" />
                              {t.saveDraft}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-muted/30 p-4 rounded-lg text-sm space-y-4 max-h-96 overflow-y-auto">
                          <div>
                            <h4 className="font-medium mb-2">{t.whatHappenedDuringStay}</h4>
                            <p className="text-muted-foreground">
                              {(() => {
                                const overview = currentPatient?.patientFriendly?.overview;
                                if (!overview) return 'N/A';
                                if (typeof overview === 'string') {
                                  return overview;
                                }
                                return overview[language as keyof typeof overview] || overview.en || 'N/A';
                              })()}
                            </p>
                          </div>
                          <div>
                            <h4 className="font-medium mb-2">{t.yourMedications}</h4>
                            <p className="text-muted-foreground">
                              {(() => {
                                const medications = currentPatient?.patientFriendly?.medications;
                                if (!medications || typeof medications !== 'string') return 'N/A';
                                const lines = (medications as string).split('\n');
                                return lines.map((line: string, index: number) => (
                                  <span key={index}>
                                    {line}
                                    {index < lines.length - 1 && <br />}
                                  </span>
                                ));
                              })()}
                            </p>
                          </div>
                          <div>
                            <h4 className="font-medium mb-2">{t.yourAppointments}</h4>
                            <p className="text-muted-foreground">
                              {(() => {
                                const appointments = currentPatient?.patientFriendly?.appointments;
                                if (!appointments || typeof appointments !== 'string') return 'N/A';
                                const lines = (appointments as string).split('\n');
                                return lines.map((line: string, index: number) => (
                                  <span key={index}>
                                    {line}
                                    {index < lines.length - 1 && <br />}
                                  </span>
                                ));
                              })()}
                            </p>
                          </div>
                          <div>
                            <h4 className="font-medium mb-2">{t.activityGuidelines}</h4>
                            <p className="text-muted-foreground">
                              {(() => {
                                const activity = currentPatient?.patientFriendly?.activity;
                                if (!activity || typeof activity !== 'string') return 'N/A';
                                const lines = (activity as string).split('\n');
                                return lines.map((line: string, index: number) => (
                                  <span key={index}>
                                    {line}
                                    {index < lines.length - 1 && <br />}
                                  </span>
                                ));
                              })()}
                            </p>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Review Sections */}
                <Card className="mb-6">
                  <CardHeader>
                    <CardTitle className="font-heading text-lg">{t.requiredSectionReview}</CardTitle>
                    <CardDescription>
                      {t.reviewAndApprove}
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
                            <p className="font-medium text-sm">{t.medications}</p>
                            <p className="text-xs text-muted-foreground">3 {t.medicationsListed}</p>
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
                            <p className="text-xs text-muted-foreground">2 {t.appointmentsScheduled}</p>
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
                            <p className="text-xs text-muted-foreground">{t.guidelinesProvided}</p>
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
                <Card className="mb-6">
                  <CardHeader>
                    <CardTitle className="font-heading text-lg">{t.additionalOptions}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="sensitive-info">{t.redactSensitiveInfo}</Label>
                        <div className="mt-2 space-y-2">
                          <div className="flex items-center space-x-2">
                            <Switch id="redact-room" />
                            <Label htmlFor="redact-room" className="text-sm">
                              {t.roomNumber}
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Switch id="redact-mrn" />
                            <Label htmlFor="redact-mrn" className="text-sm">
                              {t.medicalRecordNumber}
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Switch id="redact-insurance" />
                            <Label htmlFor="redact-insurance" className="text-sm">
                              {t.insuranceInformation}
                            </Label>
                          </div>
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="clarifications">{t.additionalClarifications}</Label>
                        <Textarea
                          id="clarifications"
                          className="mt-2"
                          rows={4}
                          placeholder={t.addNotes}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Action Buttons */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm">
                      <Save className="h-4 w-4 mr-2" />
                      {t.saveDraft}
                    </Button>
                    <Button variant="outline" size="sm" onClick={downloadPDF}>
                      <Download className="h-4 w-4 mr-2" />
                      {t.generatePDF}
                    </Button>
                    <Button variant="outline" size="sm" onClick={printDischargeSummary}>
                      <Print className="h-4 w-4 mr-2" />
                      {t.printHandout}
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      disabled={!Object.values(approvalStatus).every(Boolean)}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <Send className="h-4 w-4 mr-2" />
                      {t.publishToPatient}
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
                          {t.reviewAllSections}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </div>
        </div>
      </main>
      
      <CommonFooter />
        </div>
      </AuthGuard>
      
      {/* File Upload Modal */}
      <FileUploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onUploadSuccess={async (data) => {
          try {
            // Fetch the composition data to get raw and simplified content
            const compositionData = data.composition || await (async () => {
              const response = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL}/google/fhir/Composition/${data.compositionId}/binaries`,
                {
                  method: 'GET',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'X-Tenant-ID': tenantId,
                  },
                }
              );
              if (response.ok) {
                return await response.json();
              }
              return null;
            })();

            if (!compositionData) {
              return;
            }

            // Find raw and simplified content (same logic as refreshComposition)
            const rawSummary = compositionData.dischargeSummaries?.find((summary: any) =>
              !summary.tags?.some((tag: any) => tag.code === 'simplified-content')
            );
            const rawInstructions = compositionData.dischargeInstructions?.find((instr: any) =>
              !instr.tags?.some((tag: any) => tag.code === 'simplified-content')
            );
            const simplifiedSummary = compositionData.dischargeSummaries?.find((summary: any) =>
              summary.tags?.some((tag: any) => tag.code === 'simplified-content')
            );
            const simplifiedInstructions = compositionData.dischargeInstructions?.find((instr: any) =>
              instr.tags?.some((tag: any) => tag.code === 'simplified-content')
            );

            // Fetch AI-simplified content
            const simplifiedContent = await fetchSimplifiedContent(
              data.compositionId,
              token || '',
              tenantId || 'demo'
            );
            
            const aiSimplifiedSummaryText = simplifiedContent.summary;
            const aiSimplifiedInstructionsText = simplifiedContent.instructions;

            // Parse raw text on frontend if parsedData not available from backend
            let parsedSummaryData = rawSummary?.parsedData || null;
            let parsedInstructionsData = rawInstructions?.parsedData || null;

            if (!parsedSummaryData && rawSummary?.text) {
              const parseResult = parseDischargeDocument(
                tenantId || 'demo',
                rawSummary.text,
                rawInstructions?.text || rawSummary.text
              );

              if (parseResult.parserUsed) {
                parsedSummaryData = parseResult.parsedSummary;
                parsedInstructionsData = parseResult.parsedInstructions;
              }
            }

            // Create a new patient entry matching the expected structure (reused from file upload)
            const newPatient = {
              id: data.patientId || `patient-${Date.now()}`,
              name: data.patientInfo?.name || 'Unknown Patient',
              mrn: data.patientInfo?.mrn || 'Unknown',
              room: data.patientInfo?.room || undefined,
              dischargeDate: data.patientInfo?.dischargeDate || undefined,
              status: 'pending-review',
              diagnosis: rawSummary?.text?.substring(0, 100) || 'Processing...',
              specialty: data.patientInfo?.unit || 'General',
              attendingPhysician: data.patientInfo?.attendingPhysician?.name || undefined,
              compositionId: data.compositionId,
              // Add parsed data for structured rendering
              originalSummaryParsed: parsedSummaryData,
              originalInstructionsParsed: parsedInstructionsData,
              // Store AI-simplified content
              aiSimplifiedSummary: aiSimplifiedSummaryText || null,
              aiSimplifiedInstructions: aiSimplifiedInstructionsText || null,
              originalSummary: {
                diagnosis: { en: rawSummary?.text || data.rawText || 'Processing...' },
                diagnosisText: { en: rawSummary?.text || data.rawText || 'Processing...' },
                medications: { en: rawInstructions?.text || 'Processing...' },
                followUp: { en: 'Processing...' },
                activity: { en: 'Processing...' }
              },
              patientFriendly: aiSimplifiedSummaryText ? (() => {
                const parsedInstructions = parseSimplifiedInstructions(aiSimplifiedInstructionsText);
                return {
                  overview: { en: aiSimplifiedSummaryText },
                  medications: { en: parsedInstructions.medications || 'N/A' },
                  appointments: { en: parsedInstructions.appointments || 'N/A' },
                  activity: { en: parsedInstructions.activity || 'N/A' }
                };
              })() : undefined
            };

            // Add the new patient to the patients list
            setPatients((prevPatients) => [newPatient, ...prevPatients]);

            // Add the new patient to patientMedicalData
            setPatientMedicalData((prevData) => ({
              ...prevData,
              [newPatient.id]: newPatient
            }));

            // Select the newly uploaded patient
            setSelectedPatient(newPatient.id);

            // Close the modal
            setShowUploadModal(false);

            // Reload the discharge queue to get updated list
            await loadDischargeQueue();
          } catch (error) {
            console.error('[ClinicianPortal] Failed to process upload success:', error);
          }
        }}
      />
    </ErrorBoundary>
  )
}
