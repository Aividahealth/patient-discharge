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
import { FeedbackButton } from "@/components/feedback-button"
import { CommonHeader } from "@/components/common-header"
import { CommonFooter } from "@/components/common-footer"
import { AuthGuard } from "@/components/auth-guard"
import { FileUploadModal } from "@/components/file-upload-modal"
import { MarkdownRenderer, markdownToHtml } from "@/components/markdown-renderer"
import { useTenant } from "@/contexts/tenant-context"
import jsPDF from "jspdf"
import html2canvas from "html2canvas"
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
  const { user } = useTenant()
  const [selectedPatient, setSelectedPatient] = useState<string | null>("patient-1")
  const [editMode, setEditMode] = useState(false)
  const [language, setLanguage] = useState("en")
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)
  
  // Section approvals with audit trail (timestamp and clinician info)
  const [sectionApprovals, setSectionApprovals] = useState<{
    medications: {
      approved: boolean;
      approvedAt: string | null;
      approvedBy: { id: string; name: string } | null;
    };
    appointments: {
      approved: boolean;
      approvedAt: string | null;
      approvedBy: { id: string; name: string } | null;
    };
    dietActivity: {
      approved: boolean;
      approvedAt: string | null;
      approvedBy: { id: string; name: string } | null;
    };
  }>({
    medications: {
      approved: false,
      approvedAt: null,
      approvedBy: null,
    },
    appointments: {
      approved: false,
      approvedAt: null,
      approvedBy: null,
    },
    dietActivity: {
      approved: false,
      approvedAt: null,
      approvedBy: null,
    },
  })

  // Additional clarifications
  const [additionalClarifications, setAdditionalClarifications] = useState("")

  // Redaction preferences
  const [redactionPreferences, setRedactionPreferences] = useState({
    redactRoomNumber: false,
    redactMRN: false,
    redactInsuranceInfo: false,
  })

  // Legacy approvalStatus for UI compatibility (derived from sectionApprovals)
  const approvalStatus = {
    medications: sectionApprovals.medications.approved,
    appointments: sectionApprovals.appointments.approved,
    dietActivity: sectionApprovals.dietActivity.approved,
  }
  const [patientsList, setPatientsList] = useState([
    {
      id: "patient-1",
      name: "John Smith",
      mrn: "MRN-12345",
      room: "Room 302",
      dischargeDate: "2024-03-15",
      status: "pending-review",
      diagnosis: "Chest pain, rule out acute coronary syndrome",
      specialty: "Cardiology Unit",
      attendingPhysician: "Dr. Sarah Johnson, MD",
    },
    {
      id: "patient-2",
      name: "Priya Sharma",
      mrn: "MRN-23456",
      room: "Room 415",
      dischargeDate: "2024-03-16",
      status: "pending-review",
      diagnosis: "Type 2 diabetes mellitus with diabetic ketoacidosis",
      specialty: "Endocrinology Unit",
      attendingPhysician: "Dr. Raj Patel, MD",
    },
    {
      id: "patient-3",
      name: "Nguyen Minh Duc",
      mrn: "MRN-34567",
      room: "Room 128",
      dischargeDate: "2024-03-17",
      status: "pending-review",
      diagnosis: "Acute appendicitis, status post laparoscopic appendectomy",
      specialty: "General Surgery Unit",
      attendingPhysician: "Dr. Michael Chen, MD",
    },
    {
      id: "patient-4",
      name: "Maria Garcia",
      mrn: "MRN-67890",
      room: "Room 205",
      dischargeDate: "2024-03-16",
      status: "approved",
      diagnosis: "Pneumonia, community-acquired",
      specialty: "Pulmonology Unit",
      attendingPhysician: "Dr. Emily Rodriguez, MD",
    },
  ])

  const handleUploadSuccess = (data: any) => {
    // Add the new patient to the list
    const newPatient = {
      id: data.id,
      name: data.name,
      mrn: data.mrn,
      room: data.room,
      dischargeDate: data.dischargeDate,
      status: data.status || "pending-review",
      diagnosis: "Pending review of uploaded discharge summary",
      specialty: data.unit || "General",
      attendingPhysician: data.attendingPhysician?.name || "Unknown",
    }
    setPatientsList((prev) => [newPatient, ...prev])
    setSelectedPatient(newPatient.id)
    setShowUploadModal(false)
  }

  const patients = patientsList

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

  const patientMedicalData = {
    "patient-1": {
      name: "John Smith",
      mrn: "MRN-12345",
      room: "Room 302",
      specialty: "Cardiology Unit",
      attendingPhysician: "Dr. Sarah Johnson, MD",
      dischargeDate: "March 15, 2024",
      originalSummary: {
        diagnosis: {
          en: "CHEST PAIN, RULE OUT ACUTE CORONARY SYNDROME",
          es: "DOLOR TORÁCICO, DESCARTAR SÍNDROME CORONARIO AGUDO",
          hi: "छाती में दर्द, तीव्र कोरोनरी सिंड्रोम का नियम बाहर",
          vi: "ĐAU NGỰC, LOẠI TRỪ HỘI CHỨNG MẠCH VÀNH CẤP TÍNH",
          fr: "DOULEUR THORACIQUE, ÉLIMINER LE SYNDROME CORONARIEN AIGU"
        },
        diagnosisText: {
          en: "Patient presented with acute onset substernal chest pain radiating to left arm, associated with diaphoresis and mild dyspnea. Initial EKG showed ST-T wave changes in leads II, III, aVF. Troponin I elevated at 0.8 ng/mL (normal <0.04). Emergency cardiac catheterization performed via right radial approach revealed no significant coronary artery disease. Left anterior descending artery with 20% stenosis, circumflex with 15% stenosis, right coronary artery patent. Left ventricular ejection fraction 55% by ventriculography. No acute intervention required.",
          es: "El paciente presentó dolor torácico subesternal de inicio agudo que se irradia al brazo izquierdo, asociado con diaforesis y disnea leve. El EKG inicial mostró cambios en la onda ST-T en las derivaciones II, III, aVF. Troponina I elevada a 0.8 ng/mL (normal <0.04). Se realizó cateterismo cardíaco de emergencia vía acceso radial derecho que reveló enfermedad coronaria no significativa. Arteria descendente anterior izquierda con 20% de estenosis, circunfleja con 15% de estenosis, arteria coronaria derecha permeable. Fracción de eyección del ventrículo izquierdo 55% por ventriculografía. No se requirió intervención aguda.",
          hi: "रोगी ने तीव्र शुरुआत के साथ सबस्टर्नल छाती के दर्द की शिकायत की जो बाएं हाथ में फैल रहा था, जो डायाफोरेसिस और हल्की डिस्पेनिया के साथ जुड़ा था। प्रारंभिक ईकेजी ने लीड II, III, aVF में ST-T तरंग परिवर्तन दिखाए। ट्रोपोनिन I 0.8 ng/mL (सामान्य <0.04) पर उठा हुआ। दाएं रेडियल दृष्टिकोण के माध्यम से आपातकालीन कार्डियक कैथेटेराइजेशन किया गया जिसमें कोई महत्वपूर्ण कोरोनरी धमनी रोग नहीं दिखा। बाएं अग्रवर्ती अवरोही धमनी में 20% स्टेनोसिस, सर्कमफ्लेक्स में 15% स्टेनोसिस, दाएं कोरोनरी धमनी पेटेंट। वेंट्रिकुलोग्राफी द्वारा बाएं वेंट्रिकुलर इजेक्शन फ्रैक्शन 55%। कोई तीव्र हस्तक्षेप आवश्यक नहीं।",
          vi: "Bệnh nhân có cơn đau ngực dưới xương ức khởi phát cấp tính lan ra cánh tay trái, kèm theo vã mồ hôi và khó thở nhẹ. Điện tâm đồ ban đầu cho thấy thay đổi sóng ST-T ở các chuyển đạo II, III, aVF. Troponin I tăng cao ở mức 0.8 ng/mL (bình thường <0.04). Thông tim khẩn cấp qua đường động mạch quay phải cho thấy không có bệnh động mạch vành đáng kể. Động mạch xuống trước trái có hẹp 20%, động mạch mũ có hẹp 15%, động mạch vành phải thông. Phân suất tống máu thất trái 55% qua thất đồ. Không cần can thiệp cấp cứu.",
          fr: "Le patient a présenté une douleur thoracique sous-sternale d'apparition aiguë irradiant vers le bras gauche, associée à une diaphorèse et une dyspnée légère. L'ECG initial a montré des modifications de l'onde ST-T dans les dérivations II, III, aVF. Troponine I élevée à 0.8 ng/mL (normal <0.04). Un cathétérisme cardiaque d'urgence a été effectué via l'approche radiale droite révélant aucune maladie coronarienne significative. Artère descendante antérieure gauche avec 20% de sténose, circonflexe avec 15% de sténose, artère coronaire droite perméable. Fraction d'éjection ventriculaire gauche de 55% par ventriculographie. Aucune intervention aiguë requise."
        },
        medications: {
          en: "1. Metoprolol tartrate 25mg PO BID - for blood pressure control and heart rate management\n2. Atorvastatin 20mg PO QHS - for cardiovascular risk reduction\n3. Aspirin 81mg PO daily - for primary prevention of cardiovascular events\n4. Nitroglycerin 0.4mg SL PRN chest pain - patient instructed on proper use",
          es: "1. Tartrato de metoprolol 25mg VO BID - para control de presión arterial y frecuencia cardíaca\n2. Atorvastatina 20mg VO QHS - para reducción del riesgo cardiovascular\n3. Aspirina 81mg VO diaria - para prevención primaria de eventos cardiovasculares\n4. Nitroglicerina 0.4mg SL PRN dolor torácico - paciente instruido en uso adecuado",
          hi: "1. मेटोप्रोलोल टार्ट्रेट 25mg PO BID - रक्तचाप नियंत्रण और हृदय गति प्रबंधन के लिए\n2. एटोरवास्टेटिन 20mg PO QHS - हृदय संबंधी जोखिम कम करने के लिए\n3. एस्पिरिन 81mg PO दैनिक - हृदय संबंधी घटनाओं की प्राथमिक रोकथाम के लिए\n4. नाइट्रोग्लिसरीन 0.4mg SL PRN छाती का दर्द - रोगी को उचित उपयोग की सलाह दी गई",
          vi: "1. Metoprolol tartrate 25mg PO BID - để kiểm soát huyết áp và nhịp tim\n2. Atorvastatin 20mg PO QHS - để giảm nguy cơ tim mạch\n3. Aspirin 81mg PO hàng ngày - để phòng ngừa chính các biến cố tim mạch\n4. Nitroglycerin 0.4mg SL PRN đau ngực - bệnh nhân được hướng dẫn sử dụng đúng cách",
          fr: "1. Tartrate de métoprolol 25mg PO BID - pour le contrôle de la pression artérielle et de la fréquence cardiaque\n2. Atorvastatine 20mg PO QHS - pour la réduction du risque cardiovasculaire\n3. Aspirine 81mg PO quotidienne - pour la prévention primaire des événements cardiovasculaires\n4. Nitroglycérine 0.4mg SL PRN douleur thoracique - patient instruit sur l'utilisation appropriée"
        },
        followUp: {
          en: "1. Cardiology clinic follow-up in 1 week (March 22, 2024) - Dr. Sarah Johnson\n2. Primary care physician follow-up in 2 weeks (March 29, 2024)\n3. Patient instructed to monitor blood pressure daily and maintain log\n4. Return to ED if chest pain recurs or worsens",
          es: "1. Seguimiento en clínica de cardiología en 1 semana (22 de marzo de 2024) - Dr. Sarah Johnson\n2. Seguimiento con médico de atención primaria en 2 semanas (29 de marzo de 2024)\n3. Paciente instruido para monitorear presión arterial diariamente y mantener registro\n4. Regresar a urgencias si el dolor torácico recurre o empeora",
          hi: "1. 1 सप्ताह में कार्डियोलॉजी क्लिनिक फॉलो-अप (22 मार्च, 2024) - डॉ. सारा जॉनसन\n2. 2 सप्ताह में प्राथमिक देखभाल चिकित्सक फॉलो-अप (29 मार्च, 2024)\n3. रोगी को दैनिक रक्तचाप की निगरानी करने और लॉग बनाए रखने की सलाह दी गई\n4. यदि छाती का दर्द फिर से हो या बिगड़े तो आपातकालीन विभाग में वापस आएं",
          vi: "1. Theo dõi tại phòng khám tim mạch trong 1 tuần (22 tháng 3, 2024) - Bác sĩ Sarah Johnson\n2. Theo dõi với bác sĩ chăm sóc chính trong 2 tuần (29 tháng 3, 2024)\n3. Bệnh nhân được hướng dẫn theo dõi huyết áp hàng ngày và ghi chép\n4. Quay lại khoa cấp cứu nếu đau ngực tái phát hoặc nặng hơn",
          fr: "1. Suivi en clinique de cardiologie dans 1 semaine (22 mars 2024) - Dr Sarah Johnson\n2. Suivi avec le médecin de soins primaires dans 2 semaines (29 mars 2024)\n3. Patient instruit pour surveiller la pression artérielle quotidiennement et tenir un journal\n4. Retourner aux urgences si la douleur thoracique réapparaît ou s'aggrave"
        },
        activity: {
          en: "1. No lifting >10 pounds for 2 weeks post-catheterization\n2. Gradual return to normal activities as tolerated\n3. Walking 20-30 minutes daily encouraged\n4. No driving for 48 hours post-procedure\n5. Sexual activity may resume in 1 week if asymptomatic",
          es: "1. No levantar >10 libras por 2 semanas post-cateterización\n2. Retorno gradual a actividades normales según tolerancia\n3. Caminar 20-30 minutos diarios recomendado\n4. No conducir por 48 horas post-procedimiento\n5. Actividad sexual puede reanudarse en 1 semana si asintomático",
          hi: "1. कैथेटेराइजेशन के बाद 2 सप्ताह तक 10 पाउंड से अधिक न उठाएं\n2. सहनशीलता के अनुसार सामान्य गतिविधियों में धीरे-धीरे वापसी\n3. दैनिक 20-30 मिनट चलने की सलाह\n4. प्रक्रिया के बाद 48 घंटे तक गाड़ी न चलाएं\n5. यदि लक्षण नहीं हैं तो 1 सप्ताह में यौन गतिविधि फिर से शुरू कर सकते हैं",
          vi: "1. Không nâng >10 pound trong 2 tuần sau thông tim\n2. Từ từ trở lại hoạt động bình thường theo khả năng chịu đựng\n3. Khuyến khích đi bộ 20-30 phút hàng ngày\n4. Không lái xe trong 48 giờ sau thủ thuật\n5. Hoạt động tình dục có thể tiếp tục sau 1 tuần nếu không có triệu chứng",
          fr: "1. Pas de levage >10 livres pendant 2 semaines post-cathétérisme\n2. Retour progressif aux activités normales selon la tolérance\n3. Marche de 20-30 minutes quotidienne encouragée\n4. Pas de conduite pendant 48 heures post-procédure\n5. L'activité sexuelle peut reprendre dans 1 semaine si asymptomatique"
        }
      },
      patientFriendly: {
        overview: {
          en: "You came to the hospital because you had chest pain. We did tests to check your heart and found that your heart is healthy. The procedure we did (cardiac catheterization) showed no blockages in your heart arteries.",
          es: "Viniste al hospital porque tenías dolor en el pecho. Hicimos pruebas para revisar tu corazón y encontramos que tu corazón está sano. El procedimiento que hicimos (cateterismo cardíaco) mostró que no hay bloqueos en las arterias de tu corazón.",
          hi: "आप अस्पताल आए क्योंकि आपको छाती में दर्द था। हमने आपके दिल की जांच के लिए टेस्ट किए और पाया कि आपका दिल स्वस्थ है। जो प्रक्रिया हमने की (कार्डियक कैथेटेराइजेशन) ने दिखाया कि आपकी दिल की धमनियों में कोई रुकावट नहीं है।",
          vi: "Bạn đến bệnh viện vì bị đau ngực. Chúng tôi đã làm các xét nghiệm để kiểm tra tim của bạn và phát hiện tim của bạn khỏe mạnh. Thủ thuật chúng tôi thực hiện (thông tim) cho thấy không có tắc nghẽn trong động mạch tim của bạn.",
          fr: "Vous êtes venu à l'hôpital parce que vous aviez des douleurs thoraciques. Nous avons fait des tests pour vérifier votre cœur et avons trouvé que votre cœur est en bonne santé. La procédure que nous avons effectuée (cathétérisme cardiaque) a montré qu'il n'y a pas de blocages dans les artères de votre cœur."
        },
        medications: {
          en: "Take these medications exactly as prescribed:\n• Metoprolol 25mg - twice daily with food (helps your heart)\n• Atorvastatin 20mg - once daily at bedtime (helps prevent heart problems)\n• Aspirin 81mg - once daily with food (helps prevent blood clots)\n• Nitroglycerin - only if you have chest pain (place under tongue)",
          es: "Toma estos medicamentos exactamente como se prescribieron:\n• Metoprolol 25mg - dos veces al día con comida (ayuda a tu corazón)\n• Atorvastatina 20mg - una vez al día a la hora de dormir (ayuda a prevenir problemas del corazón)\n• Aspirina 81mg - una vez al día con comida (ayuda a prevenir coágulos de sangre)\n• Nitroglicerina - solo si tienes dolor en el pecho (coloca debajo de la lengua)",
          hi: "इन दवाओं को बिल्कुल निर्धारित अनुसार लें:\n• मेटोप्रोलोल 25mg - भोजन के साथ दिन में दो बार (आपके दिल की मदद करता है)\n• एटोरवास्टेटिन 20mg - सोने से पहले दिन में एक बार (दिल की समस्याओं को रोकने में मदद करता है)\n• एस्पिरिन 81mg - भोजन के साथ दिन में एक बार (खून के थक्के रोकने में मदद करता है)\n• नाइट्रोग्लिसरीन - केवल अगर आपको छाती में दर्द हो (जीभ के नीचे रखें)",
          vi: "Uống những loại thuốc này đúng như đã kê đơn:\n• Metoprolol 25mg - hai lần một ngày với thức ăn (giúp tim của bạn)\n• Atorvastatin 20mg - một lần một ngày trước khi ngủ (giúp ngăn ngừa vấn đề tim)\n• Aspirin 81mg - một lần một ngày với thức ăn (giúp ngăn ngừa cục máu đông)\n• Nitroglycerin - chỉ khi bạn bị đau ngực (đặt dưới lưỡi)",
          fr: "Prenez ces médicaments exactement comme prescrit:\n• Métoprolol 25mg - deux fois par jour avec de la nourriture (aide votre cœur)\n• Atorvastatine 20mg - une fois par jour au coucher (aide à prévenir les problèmes cardiaques)\n• Aspirine 81mg - une fois par jour avec de la nourriture (aide à prévenir les caillots sanguins)\n• Nitroglycérine - seulement si vous avez des douleurs thoraciques (placez sous la langue)"
        },
        appointments: {
          en: "• Cardiology follow-up: March 22, 2024 at 10:30 AM with Dr. Johnson\n• Primary care check-up: March 29, 2024 at 2:00 PM\n• Check your blood pressure daily and write it down",
          es: "• Seguimiento de cardiología: 22 de marzo de 2024 a las 10:30 AM con Dr. Johnson\n• Revisión de atención primaria: 29 de marzo de 2024 a las 2:00 PM\n• Revisa tu presión arterial diariamente y anótala",
          hi: "• कार्डियोलॉजी फॉलो-अप: 22 मार्च, 2024 को सुबह 10:30 बजे डॉ. जॉनसन के साथ\n• प्राथमिक देखभाल जांच: 29 मार्च, 2024 को दोपहर 2:00 बजे\n• अपने रक्तचाप की दैनिक जांच करें और लिखकर रखें",
          vi: "• Theo dõi tim mạch: 22 tháng 3, 2024 lúc 10:30 sáng với Bác sĩ Johnson\n• Kiểm tra chăm sóc chính: 29 tháng 3, 2024 lúc 2:00 chiều\n• Kiểm tra huyết áp hàng ngày và ghi chép lại",
          fr: "• Suivi cardiologie: 22 mars 2024 à 10h30 avec Dr Johnson\n• Contrôle de soins primaires: 29 mars 2024 à 14h00\n• Vérifiez votre tension artérielle quotidiennement et notez-la"
        },
        activity: {
          en: "• No lifting over 10 pounds for 2 weeks\n• Walk 20-30 minutes daily\n• No driving for 2 days\n• You can return to normal activities slowly",
          es: "• No levantar más de 10 libras por 2 semanas\n• Camina 20-30 minutos diariamente\n• No conducir por 2 días\n• Puedes regresar a actividades normales lentamente",
          hi: "• 2 सप्ताह तक 10 पाउंड से अधिक न उठाएं\n• दैनिक 20-30 मिनट चलें\n• 2 दिन तक गाड़ी न चलाएं\n• आप धीरे-धीरे सामान्य गतिविधियों में वापस आ सकते हैं",
          vi: "• Không nâng hơn 10 pound trong 2 tuần\n• Đi bộ 20-30 phút hàng ngày\n• Không lái xe trong 2 ngày\n• Bạn có thể từ từ trở lại hoạt động bình thường",
          fr: "• Pas de levage de plus de 10 livres pendant 2 semaines\n• Marchez 20-30 minutes quotidiennement\n• Pas de conduite pendant 2 jours\n• Vous pouvez reprendre lentement les activités normales"
        }
      }
    },
    "patient-2": {
      name: "Priya Sharma",
      mrn: "MRN-23456",
      room: "Room 415",
      specialty: "Endocrinology Unit",
      attendingPhysician: "Dr. Raj Patel, MD",
      dischargeDate: "March 16, 2024",
      originalSummary: {
        diagnosis: {
          en: "TYPE 2 DIABETES MELLITUS WITH DIABETIC KETOACIDOSIS",
          es: "DIABETES MELLITUS TIPO 2 CON CETOACIDOSIS DIABÉTICA",
          hi: "टाइप 2 डायबिटीज मेलिटस डायबिटिक कीटोएसिडोसिस के साथ",
          vi: "ĐÁI THÁO ĐƯỜNG TÝP 2 VỚI NHIỄM TOAN CETON",
          fr: "DIABÈTE MELLITUS TYPE 2 AVEC ACIDOCÉTOSE DIABÉTIQUE"
        },
        diagnosisText: {
          en: "Patient presented with 3-day history of polyuria, polydipsia, and progressive weakness. Initial labs revealed: glucose 485 mg/dL, pH 7.18, HCO3 12 mEq/L, anion gap 22, beta-hydroxybutyrate 4.2 mmol/L. Patient was started on insulin drip and DKA protocol. Blood glucose normalized within 12 hours. Patient has history of poorly controlled Type 2 DM, HbA1c 12.8% on admission. No evidence of infection. Patient education provided regarding diabetes management, insulin administration, and sick day rules.",
          es: "Paciente presentó historia de 3 días de poliuria, polidipsia y debilidad progresiva. Laboratorios iniciales revelaron: glucosa 485 mg/dL, pH 7.18, HCO3 12 mEq/L, brecha aniónica 22, beta-hidroxibutirato 4.2 mmol/L. Paciente fue iniciado en goteo de insulina y protocolo de CAD. Glucosa en sangre normalizada dentro de 12 horas. Paciente tiene historia de DM tipo 2 mal controlada, HbA1c 12.8% al ingreso. Sin evidencia de infección. Educación del paciente proporcionada respecto al manejo de diabetes, administración de insulina y reglas de días de enfermedad.",
          hi: "रोगी ने 3 दिन के पॉलीयूरिया, पॉलीडिप्सिया और प्रगतिशील कमजोरी के इतिहास के साथ प्रस्तुत किया। प्रारंभिक लैब ने खुलासा किया: ग्लूकोज 485 mg/dL, pH 7.18, HCO3 12 mEq/L, एनियन गैप 22, बीटा-हाइड्रॉक्सीब्यूटिरेट 4.2 mmol/L। रोगी को इंसुलिन ड्रिप और DKA प्रोटोकॉल पर शुरू किया गया। 12 घंटे के भीतर रक्त ग्लूकोज सामान्य हो गया। रोगी का खराब नियंत्रित टाइप 2 DM का इतिहास है, प्रवेश पर HbA1c 12.8%। संक्रमण का कोई सबूत नहीं। मधुमेह प्रबंधन, इंसुलिन प्रशासन और बीमार दिनों के नियमों के संबंध में रोगी शिक्षा प्रदान की गई।",
          vi: "Bệnh nhân có tiền sử 3 ngày đa niệu, đa khát và yếu dần. Xét nghiệm ban đầu cho thấy: glucose 485 mg/dL, pH 7.18, HCO3 12 mEq/L, khoảng trống anion 22, beta-hydroxybutyrate 4.2 mmol/L. Bệnh nhân được bắt đầu truyền insulin và giao thức DKA. Glucose máu bình thường hóa trong vòng 12 giờ. Bệnh nhân có tiền sử đái tháo đường type 2 kiểm soát kém, HbA1c 12.8% khi nhập viện. Không có bằng chứng nhiễm trùng. Đã cung cấp giáo dục bệnh nhân về quản lý đái tháo đường, sử dụng insulin và quy tắc ngày bệnh.",
          fr: "Le patient a présenté une histoire de 3 jours de polyurie, polydipsie et faiblesse progressive. Les laboratoires initiaux ont révélé: glucose 485 mg/dL, pH 7.18, HCO3 12 mEq/L, écart anionique 22, bêta-hydroxybutyrate 4.2 mmol/L. Le patient a été mis sous perfusion d'insuline et protocole CAD. La glycémie s'est normalisée en 12 heures. Le patient a des antécédents de diabète de type 2 mal contrôlé, HbA1c 12.8% à l'admission. Aucune preuve d'infection. Éducation du patient fournie concernant la gestion du diabète, l'administration d'insuline et les règles des jours de maladie."
        },
        medications: {
          en: "1. Insulin glargine 20 units SQ daily - basal insulin\n2. Insulin lispro sliding scale - before meals and at bedtime\n3. Metformin 1000mg PO BID - for glycemic control\n4. Lisinopril 10mg PO daily - for renal protection in diabetes\n5. Atorvastatin 40mg PO daily - for cardiovascular risk reduction",
          es: "1. Insulina glargina 20 unidades SC diaria - insulina basal\n2. Insulina lispro escala deslizante - antes de comidas y al acostarse\n3. Metformina 1000mg VO BID - para control glucémico\n4. Lisinopril 10mg VO diario - para protección renal en diabetes\n5. Atorvastatina 40mg VO diaria - para reducción del riesgo cardiovascular",
          hi: "1. इंसुलिन ग्लार्जिन 20 यूनिट SQ दैनिक - बेसल इंसुलिन\n2. इंसुलिन लिस्प्रो स्लाइडिंग स्केल - भोजन से पहले और सोने से पहले\n3. मेटफॉर्मिन 1000mg PO BID - ग्लाइसेमिक नियंत्रण के लिए\n4. लिसिनोप्रिल 10mg PO दैनिक - मधुमेह में गुर्दे की सुरक्षा के लिए\n5. एटोरवास्टेटिन 40mg PO दैनिक - हृदय संबंधी जोखिम कम करने के लिए",
          vi: "1. Insulin glargine 20 đơn vị SQ hàng ngày - insulin nền\n2. Insulin lispro thang trượt - trước bữa ăn và trước khi ngủ\n3. Metformin 1000mg PO BID - để kiểm soát đường huyết\n4. Lisinopril 10mg PO hàng ngày - để bảo vệ thận trong đái tháo đường\n5. Atorvastatin 40mg PO hàng ngày - để giảm nguy cơ tim mạch",
          fr: "1. Insuline glargine 20 unités SC quotidienne - insuline basale\n2. Insuline lispro échelle glissante - avant les repas et au coucher\n3. Metformine 1000mg PO BID - pour le contrôle glycémique\n4. Lisinopril 10mg PO quotidien - pour la protection rénale dans le diabète\n5. Atorvastatine 40mg PO quotidienne - pour la réduction du risque cardiovasculaire"
        },
        followUp: {
          en: "1. Endocrinology follow-up in 1 week (March 23, 2024) - Dr. Raj Patel\n2. Diabetes educator appointment in 2 weeks\n3. Primary care follow-up in 1 month\n4. Ophthalmology screening in 3 months\n5. Podiatry evaluation in 6 months",
          es: "1. Seguimiento de endocrinología en 1 semana (23 de marzo de 2024) - Dr. Raj Patel\n2. Cita con educador de diabetes en 2 semanas\n3. Seguimiento de atención primaria en 1 mes\n4. Evaluación oftalmológica en 3 meses\n5. Evaluación podológica en 6 meses",
          hi: "1. 1 सप्ताह में एंडोक्रिनोलॉजी फॉलो-अप (23 मार्च, 2024) - डॉ. राज पटेल\n2. 2 सप्ताह में मधुमेह शिक्षक अपॉइंटमेंट\n3. 1 महीने में प्राथमिक देखभाल फॉलो-अप\n4. 3 महीने में नेत्र विज्ञान स्क्रीनिंग\n5. 6 महीने में पोडियाट्री मूल्यांकन",
          vi: "1. Theo dõi nội tiết trong 1 tuần (23 tháng 3, 2024) - Bác sĩ Raj Patel\n2. Hẹn với giáo viên đái tháo đường trong 2 tuần\n3. Theo dõi chăm sóc chính trong 1 tháng\n4. Sàng lọc nhãn khoa trong 3 tháng\n5. Đánh giá chuyên khoa chân trong 6 tháng",
          fr: "1. Suivi endocrinologie dans 1 semaine (23 mars 2024) - Dr Raj Patel\n2. Rendez-vous avec éducateur diabète dans 2 semaines\n3. Suivi soins primaires dans 1 mois\n4. Dépistage ophtalmologique dans 3 mois\n5. Évaluation podiatrique dans 6 mois"
        },
        activity: {
          en: "1. Regular exercise 30 minutes daily, 5 days per week\n2. Blood glucose monitoring 4 times daily (before meals and bedtime)\n3. Maintain regular meal schedule\n4. Avoid prolonged fasting\n5. Exercise caution with driving if blood glucose <100 mg/dL",
          es: "1. Ejercicio regular 30 minutos diarios, 5 días por semana\n2. Monitoreo de glucosa en sangre 4 veces diarias (antes de comidas y al acostarse)\n3. Mantener horario regular de comidas\n4. Evitar ayunos prolongados\n5. Ejercer precaución al conducir si glucosa en sangre <100 mg/dL",
          hi: "1. नियमित व्यायाम 30 मिनट दैनिक, सप्ताह में 5 दिन\n2. दैनिक 4 बार रक्त ग्लूकोज निगरानी (भोजन से पहले और सोने से पहले)\n3. नियमित भोजन कार्यक्रम बनाए रखें\n4. लंबे उपवास से बचें\n5. यदि रक्त ग्लूकोज <100 mg/dL है तो गाड़ी चलाते समय सावधानी बरतें",
          vi: "1. Tập thể dục thường xuyên 30 phút hàng ngày, 5 ngày mỗi tuần\n2. Theo dõi glucose máu 4 lần hàng ngày (trước bữa ăn và trước khi ngủ)\n3. Duy trì lịch ăn uống đều đặn\n4. Tránh nhịn ăn kéo dài\n5. Thận trọng khi lái xe nếu glucose máu <100 mg/dL",
          fr: "1. Exercice régulier 30 minutes quotidiennes, 5 jours par semaine\n2. Surveillance de la glycémie 4 fois par jour (avant les repas et au coucher)\n3. Maintenir un horaire de repas régulier\n4. Éviter le jeûne prolongé\n5. Faire preuve de prudence en conduisant si glycémie <100 mg/dL"
        }
      },
      patientFriendly: {
        overview: {
          en: "You came to the hospital because your diabetes was not well controlled and you had a serious condition called diabetic ketoacidosis. We treated this with insulin and fluids. Your blood sugar is now under control.",
          es: "Viniste al hospital porque tu diabetes no estaba bien controlada y tenías una condición seria llamada cetoacidosis diabética. Tratamos esto con insulina y fluidos. Tu azúcar en sangre ahora está bajo control.",
          hi: "आप अस्पताल आए क्योंकि आपका मधुमेह अच्छी तरह से नियंत्रित नहीं था और आपको डायबिटिक कीटोएसिडोसिस नामक एक गंभीर स्थिति थी। हमने इसे इंसुलिन और तरल पदार्थों से इलाज किया। आपका रक्त शर्करा अब नियंत्रण में है।",
          vi: "Bạn đến bệnh viện vì bệnh đái tháo đường của bạn không được kiểm soát tốt và bạn bị một tình trạng nghiêm trọng gọi là nhiễm toan ceton. Chúng tôi đã điều trị bằng insulin và dịch truyền. Đường huyết của bạn hiện đã được kiểm soát.",
          fr: "Vous êtes venu à l'hôpital parce que votre diabète n'était pas bien contrôlé et vous aviez une condition grave appelée acidocétose diabétique. Nous avons traité cela avec de l'insuline et des fluides. Votre glycémie est maintenant sous contrôle."
        },
        medications: {
          en: "Take these medications exactly as prescribed:\n• Insulin glargine 20 units - once daily (long-acting insulin)\n• Insulin lispro - before each meal and at bedtime (short-acting insulin)\n• Metformin 1000mg - twice daily with food (helps control blood sugar)\n• Lisinopril 10mg - once daily (protects your kidneys)\n• Atorvastatin 40mg - once daily (protects your heart)",
          es: "Toma estos medicamentos exactamente como se prescribieron:\n• Insulina glargina 20 unidades - una vez al día (insulina de acción prolongada)\n• Insulina lispro - antes de cada comida y al acostarse (insulina de acción corta)\n• Metformina 1000mg - dos veces al día con comida (ayuda a controlar el azúcar en sangre)\n• Lisinopril 10mg - una vez al día (protege tus riñones)\n• Atorvastatina 40mg - una vez al día (protege tu corazón)",
          hi: "इन दवाओं को बिल्कुल निर्धारित अनुसार लें:\n• इंसुलिन ग्लार्जिन 20 यूनिट - दिन में एक बार (लंबे समय तक काम करने वाली इंसुलिन)\n• इंसुलिन लिस्प्रो - हर भोजन से पहले और सोने से पहले (कम समय तक काम करने वाली इंसुलिन)\n• मेटफॉर्मिन 1000mg - भोजन के साथ दिन में दो बार (रक्त शर्करा नियंत्रण में मदद करता है)\n• लिसिनोप्रिल 10mg - दिन में एक बार (आपके गुर्दे की रक्षा करता है)\n• एटोरवास्टेटिन 40mg - दिन में एक बार (आपके दिल की रक्षा करता है)",
          vi: "Uống những loại thuốc này đúng như đã kê đơn:\n• Insulin glargine 20 đơn vị - một lần mỗi ngày (insulin tác dụng dài)\n• Insulin lispro - trước mỗi bữa ăn và trước khi ngủ (insulin tác dụng ngắn)\n• Metformin 1000mg - hai lần mỗi ngày với thức ăn (giúp kiểm soát đường huyết)\n• Lisinopril 10mg - một lần mỗi ngày (bảo vệ thận của bạn)\n• Atorvastatin 40mg - một lần mỗi ngày (bảo vệ tim của bạn)",
          fr: "Prenez ces médicaments exactement comme prescrit:\n• Insuline glargine 20 unités - une fois par jour (insuline à action prolongée)\n• Insuline lispro - avant chaque repas et au coucher (insuline à action courte)\n• Metformine 1000mg - deux fois par jour avec de la nourriture (aide à contrôler la glycémie)\n• Lisinopril 10mg - une fois par jour (protège vos reins)\n• Atorvastatine 40mg - une fois par jour (protège votre cœur)"
        },
        appointments: {
          en: "• Endocrinology follow-up: March 23, 2024 at 9:00 AM with Dr. Patel\n• Diabetes educator: March 30, 2024 at 11:00 AM\n• Primary care follow-up: April 16, 2024\n• Check your blood sugar 4 times daily",
          es: "• Seguimiento de endocrinología: 23 de marzo de 2024 a las 9:00 AM con Dr. Patel\n• Educador de diabetes: 30 de marzo de 2024 a las 11:00 AM\n• Seguimiento de atención primaria: 16 de abril de 2024\n• Revisa tu azúcar en sangre 4 veces diarias",
          hi: "• एंडोक्रिनोलॉजी फॉलो-अप: 23 मार्च, 2024 को सुबह 9:00 बजे डॉ. पटेल के साथ\n• मधुमेह शिक्षक: 30 मार्च, 2024 को सुबह 11:00 बजे\n• प्राथमिक देखभाल फॉलो-अप: 16 अप्रैल, 2024\n• दैनिक 4 बार अपने रक्त शर्करा की जांच करें",
          vi: "• Theo dõi nội tiết: 23 tháng 3, 2024 lúc 9:00 sáng với Bác sĩ Patel\n• Giáo viên đái tháo đường: 30 tháng 3, 2024 lúc 11:00 sáng\n• Theo dõi chăm sóc chính: 16 tháng 4, 2024\n• Kiểm tra đường huyết 4 lần mỗi ngày",
          fr: "• Suivi endocrinologie: 23 mars 2024 à 9h00 avec Dr Patel\n• Éducateur diabète: 30 mars 2024 à 11h00\n• Suivi soins primaires: 16 avril 2024\n• Vérifiez votre glycémie 4 fois par jour"
        },
        activity: {
          en: "• Exercise 30 minutes daily, 5 days per week\n• Check blood sugar before meals and at bedtime\n• Eat meals at regular times\n• Don't skip meals\n• Be careful driving if blood sugar is low",
          es: "• Ejercita 30 minutos diarios, 5 días por semana\n• Revisa el azúcar en sangre antes de comidas y al acostarse\n• Come comidas a horas regulares\n• No te saltes comidas\n• Ten cuidado al conducir si el azúcar en sangre está baja",
          hi: "• सप्ताह में 5 दिन दैनिक 30 मिनट व्यायाम करें\n• भोजन से पहले और सोने से पहले रक्त शर्करा की जांच करें\n• नियमित समय पर भोजन करें\n• भोजन न छोड़ें\n• यदि रक्त शर्करा कम है तो गाड़ी चलाते समय सावधान रहें",
          vi: "• Tập thể dục 30 phút hàng ngày, 5 ngày mỗi tuần\n• Kiểm tra đường huyết trước bữa ăn và trước khi ngủ\n• Ăn uống đúng giờ\n• Không bỏ bữa\n• Cẩn thận khi lái xe nếu đường huyết thấp",
          fr: "• Exercice 30 minutes quotidiennes, 5 jours par semaine\n• Vérifiez la glycémie avant les repas et au coucher\n• Mangez à heures régulières\n• Ne sautez pas de repas\n• Soyez prudent en conduisant si la glycémie est basse"
        }
      }
    },
    "patient-3": {
      name: "Nguyen Minh Duc",
      mrn: "MRN-34567",
      room: "Room 128",
      specialty: "General Surgery Unit",
      attendingPhysician: "Dr. Michael Chen, MD",
      dischargeDate: "March 17, 2024",
      originalSummary: {
        diagnosis: "ACUTE APPENDICITIS, STATUS POST LAPAROSCOPIC APPENDECTOMY",
        diagnosisText: "Patient presented with 18-hour history of periumbilical pain migrating to RLQ, associated with nausea, vomiting, and low-grade fever. Physical exam revealed McBurney's point tenderness with positive Rovsing's sign. CT abdomen/pelvis showed acute appendicitis with mild periappendiceal fat stranding. Patient underwent uncomplicated laparoscopic appendectomy. Appendix was inflamed but not perforated. No complications during procedure. Patient tolerated diet advancement well post-operatively.",
        medications: "1. Oxycodone 5mg PO Q6H PRN pain - for post-operative pain control\n2. Ibuprofen 600mg PO TID - for anti-inflammatory and pain management\n3. Ondansetron 4mg PO Q8H PRN nausea - for post-operative nausea\n4. Docusate sodium 100mg PO BID - stool softener for constipation prevention\n5. Cefazolin 1g IV Q8H x 24 hours - perioperative antibiotic prophylaxis",
        followUp: "1. General surgery follow-up in 1 week (March 24, 2024) - Dr. Michael Chen\n2. Primary care follow-up in 2 weeks\n3. Return to ED if fever >101.5°F, severe abdominal pain, or signs of infection\n4. Wound care instructions provided\n5. Activity restrictions as outlined below",
        activity: "1. No heavy lifting >15 pounds for 4 weeks\n2. No driving for 1 week post-operatively\n3. Gradual return to normal activities over 2-3 weeks\n4. Keep surgical sites clean and dry\n5. Avoid swimming or soaking in water for 2 weeks"
      },
      patientFriendly: {
        overview: "You came to the hospital because you had appendicitis (inflammation of your appendix). We removed your appendix using a minimally invasive surgery called laparoscopy. The surgery went well and you are recovering nicely.",
        medications: "Take these medications exactly as prescribed:\n• Oxycodone 5mg - every 6 hours as needed for pain\n• Ibuprofen 600mg - three times daily for pain and swelling\n• Ondansetron 4mg - every 8 hours if you feel nauseous\n• Docusate sodium 100mg - twice daily to prevent constipation\n• You will finish your antibiotics at home",
        appointments: "• Surgery follow-up: March 24, 2024 at 2:00 PM with Dr. Chen\n• Primary care follow-up: March 31, 2024\n• Call if you have fever over 101.5°F or severe pain\n• Keep your incisions clean and dry",
        activity: "• No lifting over 15 pounds for 4 weeks\n• No driving for 1 week\n• Return to normal activities slowly over 2-3 weeks\n• Keep surgical sites clean and dry\n• No swimming for 2 weeks"
      }
    },
    "patient-4": {
      name: "Maria Garcia",
      mrn: "MRN-67890",
      room: "Room 205",
      specialty: "Pulmonology Unit",
      attendingPhysician: "Dr. Emily Rodriguez, MD",
      dischargeDate: "March 16, 2024",
      originalSummary: {
        diagnosis: "PNEUMONIA, COMMUNITY-ACQUIRED",
        diagnosisText: "Patient presented with 5-day history of productive cough with purulent sputum, fever up to 102°F, and dyspnea on exertion. Chest X-ray revealed right lower lobe consolidation. Blood cultures negative. Sputum culture positive for Streptococcus pneumoniae. Patient treated with ceftriaxone and azithromycin. Clinical improvement noted with resolution of fever and decreased cough. Oxygen saturation improved from 88% on room air to 96% at discharge.",
        medications: "1. Amoxicillin-clavulanate 875mg PO BID x 7 days - for pneumonia treatment\n2. Azithromycin 500mg PO daily x 5 days - for atypical coverage\n3. Albuterol inhaler 2 puffs Q6H PRN - for bronchospasm\n4. Guaifenesin 600mg PO TID - for expectorant effect\n5. Acetaminophen 650mg PO Q6H PRN fever/pain",
        followUp: "1. Primary care follow-up in 1 week (March 23, 2024) - Dr. Emily Rodriguez\n2. Chest X-ray in 4-6 weeks to ensure resolution\n3. Return to ED if symptoms worsen or fever returns\n4. Complete full course of antibiotics\n5. Smoking cessation counseling provided",
        activity: "1. Rest as needed, gradual increase in activity\n2. Deep breathing exercises 3 times daily\n3. Avoid smoking and secondhand smoke\n4. Adequate fluid intake (8-10 glasses daily)\n5. Return to work when fever-free for 24 hours"
      },
      patientFriendly: {
        overview: "You came to the hospital because you had pneumonia (lung infection). We treated you with antibiotics and you are feeling much better. Your breathing has improved and your fever is gone.",
        medications: "Take these medications exactly as prescribed:\n• Amoxicillin-clavulanate 875mg - twice daily for 7 days (antibiotic)\n• Azithromycin 500mg - once daily for 5 days (antibiotic)\n• Albuterol inhaler - 2 puffs every 6 hours if you have trouble breathing\n• Guaifenesin 600mg - three times daily to help with cough\n• Acetaminophen - every 6 hours if you have fever or pain",
        appointments: "• Primary care follow-up: March 23, 2024 at 10:00 AM with Dr. Rodriguez\n• Chest X-ray in 4-6 weeks to make sure infection is gone\n• Call if symptoms get worse or fever comes back\n• Finish all your antibiotics",
        activity: "• Rest as needed, slowly increase your activity\n• Do deep breathing exercises 3 times daily\n• Don't smoke and avoid secondhand smoke\n• Drink plenty of fluids (8-10 glasses daily)\n• You can return to work when you have no fever for 24 hours"
      }
    }
  }

  const getCurrentPatientData = () => {
    return selectedPatient ? patientMedicalData[selectedPatient as keyof typeof patientMedicalData] : null
  }

  const currentPatient = getCurrentPatientData()

  const toggleApproval = (section: 'medications' | 'appointments' | 'dietActivity') => {
    setSectionApprovals((prev) => {
      const currentApproval = prev[section].approved
      const newApproval = !currentApproval
      
      return {
        ...prev,
        [section]: {
          approved: newApproval,
          approvedAt: newApproval ? new Date().toISOString() : null,
          approvedBy: newApproval && user ? {
            id: user.id,
            name: user.name,
          } : null,
        },
      }
    })
  }

  const handlePublish = async () => {
    const currentPatient = patients.find(p => p.id === selectedPatient)
    if (!currentPatient || !currentPatient.compositionId) {
      console.error('[ClinicianPortal] Missing compositionId for publish')
      alert('Cannot publish: Patient composition ID not found.')
      return
    }

    // For generic page, we may not have token/tenantId/user
    // This is a demo/mock page, so we'll show a message
    if (!user) {
      alert('Please log in to publish discharge summaries.')
      return
    }

    // Validate all sections are approved
    if (!sectionApprovals.medications.approved || 
        !sectionApprovals.appointments.approved || 
        !sectionApprovals.dietActivity.approved) {
      alert('Please approve all required sections before publishing.')
      return
    }

    setIsPublishing(true)

    try {
      // Note: Generic page may not have full API setup
      // In a real scenario, this would call the API endpoint
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || ''
      const clarificationsText = additionalClarifications.trim() || "None"

      const requestBody = {
        additionalClarifications: clarificationsText,
        publish: true,
        sectionApprovals: {
          medications: {
            approved: sectionApprovals.medications.approved,
            approvedAt: sectionApprovals.medications.approvedAt!,
            approvedBy: sectionApprovals.medications.approvedBy!,
          },
          appointments: {
            approved: sectionApprovals.appointments.approved,
            approvedAt: sectionApprovals.appointments.approvedAt!,
            approvedBy: sectionApprovals.appointments.approvedBy!,
          },
          dietActivity: {
            approved: sectionApprovals.dietActivity.approved,
            approvedAt: sectionApprovals.dietActivity.approvedAt!,
            approvedBy: sectionApprovals.dietActivity.approvedBy!,
          },
        },
        redactionPreferences: {
          redactRoomNumber: redactionPreferences.redactRoomNumber,
          redactMRN: redactionPreferences.redactMRN,
          redactInsuranceInfo: redactionPreferences.redactInsuranceInfo,
        },
        clinician: {
          id: user.id,
          name: user.name,
          email: user.username, // Using username as email if available
        },
      }

      // For demo purposes, just log the request
      console.log('[ClinicianPortal] Publish request:', requestBody)
      alert('Publish functionality requires full authentication. This is a demo page.')
    } catch (error) {
      console.error('[ClinicianPortal] Failed to publish:', error)
      alert(error instanceof Error ? error.message : 'Failed to publish discharge summary. Please try again.')
    } finally {
      setIsPublishing(false)
    }
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

MEDICATIONS (Simplified):
${currentPatient.patientFriendly?.medications?.[language as keyof typeof currentPatient.patientFriendly.medications] || 'N/A'}

APPOINTMENTS (Simplified):
${currentPatient.patientFriendly?.appointments?.[language as keyof typeof currentPatient.patientFriendly.appointments] || 'N/A'}

ACTIVITY GUIDELINES (Simplified):
${currentPatient.patientFriendly?.activity?.[language as keyof typeof currentPatient.patientFriendly.activity] || 'N/A'}

IMPORTANT: The patient-friendly content has been simplified using artificial intelligence for better patient understanding.
    `
    
    // Create a new window for printing
    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Discharge Summary - ${currentPatient.name}</title>
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
            .original {
              background-color: #f1f5f9;
              padding: 15px;
              border-left: 4px solid #64748b;
              margin-bottom: 20px;
            }
            .simplified {
              background-color: #f0f9ff;
              padding: 15px;
              border-left: 4px solid #0ea5e9;
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
          <h1>DISCHARGE SUMMARY</h1>
          <div class="patient-info">
            <strong>Patient:</strong> ${currentPatient.name}<br>
            <strong>MRN:</strong> ${currentPatient.mrn}<br>
            <strong>Discharge Date:</strong> ${currentPatient.dischargeDate}<br>
            <strong>Attending Physician:</strong> ${currentPatient.attendingPhysician}
          </div>
          
          <div class="original">
            <h2>ORIGINAL DISCHARGE SUMMARY</h2>
            <h3>Diagnosis:</h3>
            <p>${currentPatient.originalSummary?.diagnosis?.[language as keyof typeof currentPatient.originalSummary.diagnosis] || 'N/A'}</p>
            
            <h3>History & Examination:</h3>
            <p>${currentPatient.originalSummary?.diagnosisText?.[language as keyof typeof currentPatient.originalSummary.diagnosisText] || 'N/A'}</p>
            
            <h3>Medications:</h3>
            <p>${currentPatient.originalSummary?.medications?.[language as keyof typeof currentPatient.originalSummary.medications] || 'N/A'}</p>
            
            <h3>Follow-up:</h3>
            <p>${currentPatient.originalSummary?.followUp?.[language as keyof typeof currentPatient.originalSummary.followUp] || 'N/A'}</p>
            
            <h3>Activity:</h3>
            <p>${currentPatient.originalSummary?.activity?.[language as keyof typeof currentPatient.originalSummary.activity] || 'N/A'}</p>
          </div>
          
          <div class="simplified">
            <h2>PATIENT-FRIENDLY VERSION</h2>
            <h3>Overview:</h3>
            <div>${markdownToHtml(currentPatient.patientFriendly?.overview?.[language as keyof typeof currentPatient.patientFriendly.overview] || '')}</div>

            <h3>Medications:</h3>
            <div>${markdownToHtml(currentPatient.patientFriendly?.medications?.[language as keyof typeof currentPatient.patientFriendly.medications] || '')}</div>

            <h3>Appointments:</h3>
            <div>${markdownToHtml(currentPatient.patientFriendly?.appointments?.[language as keyof typeof currentPatient.patientFriendly.appointments] || '')}</div>

            <h3>Activity Guidelines:</h3>
            <div>${markdownToHtml(currentPatient.patientFriendly?.activity?.[language as keyof typeof currentPatient.patientFriendly.activity] || '')}</div>
          </div>
          
          <div class="disclaimer">
            <strong>IMPORTANT:</strong> The patient-friendly content has been simplified using artificial intelligence for better patient understanding.
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
    if (!currentPatient) return
    
    try {
      // Get the current language translations
      const t = translations[language as keyof typeof translations]
      
      // Create a comprehensive discharge summary content
      const content = `
DISCHARGE SUMMARY - ${currentPatient.name}
MRN: ${currentPatient.mrn}
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

MEDICATIONS (Simplified):
${currentPatient.patientFriendly?.medications?.[language as keyof typeof currentPatient.patientFriendly.medications] || 'N/A'}

APPOINTMENTS (Simplified):
${currentPatient.patientFriendly?.appointments?.[language as keyof typeof currentPatient.patientFriendly.appointments] || 'N/A'}

ACTIVITY GUIDELINES (Simplified):
${currentPatient.patientFriendly?.activity?.[language as keyof typeof currentPatient.patientFriendly.activity] || 'N/A'}

IMPORTANT: The patient-friendly content has been simplified using artificial intelligence for better patient understanding.
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
      pdf.text("DISCHARGE SUMMARY", margin, 30)
      
      // Add patient info
      pdf.setFontSize(12)
      pdf.setFont("helvetica", "normal")
      pdf.text(`${currentPatient.name}`, margin, 45)
      pdf.text(`MRN: ${currentPatient.mrn}`, margin, 55)
      pdf.text(`Discharge Date: ${currentPatient.dischargeDate}`, margin, 65)
      pdf.text(`Attending Physician: ${currentPatient.attendingPhysician}`, margin, 75)
      
      // Add content with word wrapping
      const lines = pdf.splitTextToSize(content, maxWidth)
      let yPosition = 90
      
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
      pdf.text("The patient-friendly content has been simplified using artificial intelligence for better patient understanding.", margin, yPosition + 10)
      
      // Save the PDF
      pdf.save(`discharge-summary-${currentPatient.name.replace(" ", "-").toLowerCase()}.pdf`)
    } catch (error) {
      console.error("Error generating PDF:", error)
      // Fallback to text download
      const content = `
DISCHARGE SUMMARY - ${currentPatient.name}
MRN: ${currentPatient.mrn}
Discharge Date: ${currentPatient.dischargeDate}
Attending Physician: ${currentPatient.attendingPhysician}

ORIGINAL DISCHARGE SUMMARY:
${currentPatient.originalSummary?.diagnosis?.[language as keyof typeof currentPatient.originalSummary.diagnosis] || 'N/A'}

MEDICATIONS:
${currentPatient.originalSummary?.medications?.[language as keyof typeof currentPatient.originalSummary.medications] || 'N/A'}

FOLLOW-UP:
${currentPatient.originalSummary?.followUp?.[language as keyof typeof currentPatient.originalSummary.followUp] || 'N/A'}
      `
      const blob = new Blob([content], { type: "text/plain" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `discharge-summary-${currentPatient.name.replace(" ", "-").toLowerCase()}.txt`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }
  }

  return (
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
                    <option key={code} value={code}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
              <FeedbackButton userType="clinician" />
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
                        {patient.status === "approved" ? t.approved : t.review}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground space-y-1">
                      <p>{patient.room}</p>
                      <p>{t.discharge}: {patient.dischargeDate}</p>
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
                        <Button variant="outline" size="sm">
                          <RefreshCw className="h-4 w-4 mr-2" />
                          {t.regenerate}
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
                        {t.originalDischargeSummary}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="bg-muted/30 p-4 rounded-lg text-sm space-y-4 max-h-96 overflow-y-auto">
                        <div>
                          <h4 className="font-medium mb-2">{t.dischargeDiagnosis}</h4>
                          <p className="text-muted-foreground">
                            {currentPatient?.originalSummary?.diagnosis?.[language as keyof typeof currentPatient.originalSummary.diagnosis] || 'N/A'}
                          </p>
                        </div>
                        <div>
                          <h4 className="font-medium mb-2">{t.historyExamination}</h4>
                          <p className="text-muted-foreground">
                            {currentPatient?.originalSummary?.diagnosisText?.[language as keyof typeof currentPatient.originalSummary.diagnosisText] || 'N/A'}
                          </p>
                        </div>
                        <div>
                          <h4 className="font-medium mb-2">{t.medications}</h4>
                          <p className="text-muted-foreground">
                            {(() => {
                              const medications = currentPatient?.originalSummary?.medications?.[language as keyof typeof currentPatient.originalSummary.medications];
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
                              const followUp = currentPatient?.originalSummary?.followUp?.[language as keyof typeof currentPatient.originalSummary.followUp];
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
                              const activity = currentPatient?.originalSummary?.activity?.[language as keyof typeof currentPatient.originalSummary.activity];
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
                    </CardContent>
                  </Card>

                  {/* Simplified Patient Version */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="font-heading text-lg flex items-center gap-2">
                        <User className="h-5 w-5" />
                        {t.patientFriendlyVersion}
                        {editMode && <Badge variant="secondary">{t.editingMode}</Badge>}
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
                            <h4 className="font-medium mb-2">{t.whatHappenedDuringStay}</h4>
                            <MarkdownRenderer
                              content={currentPatient?.patientFriendly?.overview?.[language as keyof typeof currentPatient.patientFriendly.overview] || ''}
                            />
                          </div>
                          <div>
                            <h4 className="font-medium mb-2">{t.yourMedications}</h4>
                            <MarkdownRenderer
                              content={currentPatient?.patientFriendly?.medications?.[language as keyof typeof currentPatient.patientFriendly.medications] || ''}
                            />
                          </div>
                          <div>
                            <h4 className="font-medium mb-2">{t.yourAppointments}</h4>
                            <MarkdownRenderer
                              content={currentPatient?.patientFriendly?.appointments?.[language as keyof typeof currentPatient.patientFriendly.appointments] || ''}
                            />
                          </div>
                          <div>
                            <h4 className="font-medium mb-2">{t.activityGuidelines}</h4>
                            <MarkdownRenderer
                              content={currentPatient?.patientFriendly?.activity?.[language as keyof typeof currentPatient.patientFriendly.activity] || ''}
                            />
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Review Sections */}
                <Card>
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
                            <p className="text-xs text-muted-foreground">
                              {(() => {
                                const medCount = currentPatient?.originalInstructionsParsed?.dischargeMedications
                                  ? (currentPatient.originalInstructionsParsed.dischargeMedications.new?.length || 0) +
                                    (currentPatient.originalInstructionsParsed.dischargeMedications.continued?.length || 0)
                                  : 0;
                                return `${medCount} ${t.medicationsListed}`;
                              })()}
                            </p>
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
                            <p className="text-xs text-muted-foreground">
                              {(() => {
                                const apptCount = currentPatient?.originalInstructionsParsed?.followUpAppointments?.length || 0;
                                return `${apptCount} ${t.appointmentsScheduled}`;
                              })()}
                            </p>
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
                <Card>
                  <CardHeader>
                    <CardTitle className="font-heading text-lg">{t.additionalOptions}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="sensitive-info">{t.redactSensitiveInfo}</Label>
                        <div className="mt-2 space-y-2">
                          <div className="flex items-center space-x-2">
                            <Switch 
                              id="redact-room" 
                              checked={redactionPreferences.redactRoomNumber}
                              onCheckedChange={(checked) => 
                                setRedactionPreferences(prev => ({ ...prev, redactRoomNumber: checked }))
                              }
                            />
                            <Label htmlFor="redact-room" className="text-sm">
                              {t.roomNumber}
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Switch 
                              id="redact-mrn" 
                              checked={redactionPreferences.redactMRN}
                              onCheckedChange={(checked) => 
                                setRedactionPreferences(prev => ({ ...prev, redactMRN: checked }))
                              }
                            />
                            <Label htmlFor="redact-mrn" className="text-sm">
                              {t.medicalRecordNumber}
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Switch 
                              id="redact-insurance" 
                              checked={redactionPreferences.redactInsuranceInfo}
                              onCheckedChange={(checked) => 
                                setRedactionPreferences(prev => ({ ...prev, redactInsuranceInfo: checked }))
                              }
                            />
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
                          value={additionalClarifications}
                          onChange={(e) => setAdditionalClarifications(e.target.value)}
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
                      disabled={!Object.values(approvalStatus).every(Boolean) || isPublishing}
                      onClick={handlePublish}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <Send className="h-4 w-4 mr-2" />
                      {isPublishing ? 'Publishing...' : t.publishToPatient}
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
              </div>
            ) : (
              <Card className="h-96 flex items-center justify-center">
                <div className="text-center">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="font-heading text-lg font-medium mb-2">{t.selectPatient}</h3>
                  <p className="text-muted-foreground">
                    {t.choosePatient}
                  </p>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
      
      <CommonFooter />
      
      {/* File Upload Modal */}
      <FileUploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onUploadSuccess={handleUploadSuccess}
      />
      </div>
    </AuthGuard>
  )
}
