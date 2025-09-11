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
  const [selectedPatient, setSelectedPatient] = useState<string | null>("patient-1")
  const [editMode, setEditMode] = useState(false)
  const [language, setLanguage] = useState("en")
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
  ]

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
        diagnosis: "CHEST PAIN, RULE OUT ACUTE CORONARY SYNDROME",
        diagnosisText: "Patient presented with acute onset substernal chest pain radiating to left arm, associated with diaphoresis and mild dyspnea. Initial EKG showed ST-T wave changes in leads II, III, aVF. Troponin I elevated at 0.8 ng/mL (normal <0.04). Emergency cardiac catheterization performed via right radial approach revealed no significant coronary artery disease. Left anterior descending artery with 20% stenosis, circumflex with 15% stenosis, right coronary artery patent. Left ventricular ejection fraction 55% by ventriculography. No acute intervention required.",
        medications: "MEDICATIONS:\n1. Metoprolol tartrate 25mg PO BID - for blood pressure control and heart rate management\n2. Atorvastatin 20mg PO QHS - for cardiovascular risk reduction\n3. Aspirin 81mg PO daily - for primary prevention of cardiovascular events\n4. Nitroglycerin 0.4mg SL PRN chest pain - patient instructed on proper use",
        followUp: "FOLLOW-UP:\n1. Cardiology clinic follow-up in 1 week (March 22, 2024) - Dr. Sarah Johnson\n2. Primary care physician follow-up in 2 weeks (March 29, 2024)\n3. Patient instructed to monitor blood pressure daily and maintain log\n4. Return to ED if chest pain recurs or worsens",
        activity: "ACTIVITY:\n1. No lifting >10 pounds for 2 weeks post-catheterization\n2. Gradual return to normal activities as tolerated\n3. Walking 20-30 minutes daily encouraged\n4. No driving for 48 hours post-procedure\n5. Sexual activity may resume in 1 week if asymptomatic"
      },
      patientFriendly: {
        overview: "You came to the hospital because you had chest pain. We did tests to check your heart and found that your heart is healthy. The procedure we did (cardiac catheterization) showed no blockages in your heart arteries.",
        medications: "Take these medications exactly as prescribed:\n• Metoprolol 25mg - twice daily with food (helps your heart)\n• Atorvastatin 20mg - once daily at bedtime (helps prevent heart problems)\n• Aspirin 81mg - once daily with food (helps prevent blood clots)\n• Nitroglycerin - only if you have chest pain (place under tongue)",
        appointments: "• Cardiology follow-up: March 22, 2024 at 10:30 AM with Dr. Johnson\n• Primary care check-up: March 29, 2024 at 2:00 PM\n• Check your blood pressure daily and write it down",
        activity: "• No lifting over 10 pounds for 2 weeks\n• Walk 20-30 minutes daily\n• No driving for 2 days\n• You can return to normal activities slowly"
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
        diagnosis: "TYPE 2 DIABETES MELLITUS WITH DIABETIC KETOACIDOSIS",
        diagnosisText: "Patient presented with 3-day history of polyuria, polydipsia, and progressive weakness. Initial labs revealed: glucose 485 mg/dL, pH 7.18, HCO3 12 mEq/L, anion gap 22, beta-hydroxybutyrate 4.2 mmol/L. Patient was started on insulin drip and DKA protocol. Blood glucose normalized within 12 hours. Patient has history of poorly controlled Type 2 DM, HbA1c 12.8% on admission. No evidence of infection. Patient education provided regarding diabetes management, insulin administration, and sick day rules.",
        medications: "MEDICATIONS:\n1. Insulin glargine 20 units SQ daily - basal insulin\n2. Insulin lispro sliding scale - before meals and at bedtime\n3. Metformin 1000mg PO BID - for glycemic control\n4. Lisinopril 10mg PO daily - for renal protection in diabetes\n5. Atorvastatin 40mg PO daily - for cardiovascular risk reduction",
        followUp: "FOLLOW-UP:\n1. Endocrinology follow-up in 1 week (March 23, 2024) - Dr. Raj Patel\n2. Diabetes educator appointment in 2 weeks\n3. Primary care follow-up in 1 month\n4. Ophthalmology screening in 3 months\n5. Podiatry evaluation in 6 months",
        activity: "ACTIVITY:\n1. Regular exercise 30 minutes daily, 5 days per week\n2. Blood glucose monitoring 4 times daily (before meals and bedtime)\n3. Maintain regular meal schedule\n4. Avoid prolonged fasting\n5. Exercise caution with driving if blood glucose <100 mg/dL"
      },
      patientFriendly: {
        overview: "You came to the hospital because your diabetes was not well controlled and you had a serious condition called diabetic ketoacidosis. We treated this with insulin and fluids. Your blood sugar is now under control.",
        medications: "Take these medications exactly as prescribed:\n• Insulin glargine 20 units - once daily (long-acting insulin)\n• Insulin lispro - before each meal and at bedtime (short-acting insulin)\n• Metformin 1000mg - twice daily with food (helps control blood sugar)\n• Lisinopril 10mg - once daily (protects your kidneys)\n• Atorvastatin 40mg - once daily (protects your heart)",
        appointments: "• Endocrinology follow-up: March 23, 2024 at 9:00 AM with Dr. Patel\n• Diabetes educator: March 30, 2024 at 11:00 AM\n• Primary care follow-up: April 16, 2024\n• Check your blood sugar 4 times daily",
        activity: "• Exercise 30 minutes daily, 5 days per week\n• Check blood sugar before meals and at bedtime\n• Eat meals at regular times\n• Don't skip meals\n• Be careful driving if blood sugar is low"
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
        medications: "MEDICATIONS:\n1. Oxycodone 5mg PO Q6H PRN pain - for post-operative pain control\n2. Ibuprofen 600mg PO TID - for anti-inflammatory and pain management\n3. Ondansetron 4mg PO Q8H PRN nausea - for post-operative nausea\n4. Docusate sodium 100mg PO BID - stool softener for constipation prevention\n5. Cefazolin 1g IV Q8H x 24 hours - perioperative antibiotic prophylaxis",
        followUp: "FOLLOW-UP:\n1. General surgery follow-up in 1 week (March 24, 2024) - Dr. Michael Chen\n2. Primary care follow-up in 2 weeks\n3. Return to ED if fever >101.5°F, severe abdominal pain, or signs of infection\n4. Wound care instructions provided\n5. Activity restrictions as outlined below",
        activity: "ACTIVITY:\n1. No heavy lifting >15 pounds for 4 weeks\n2. No driving for 1 week post-operatively\n3. Gradual return to normal activities over 2-3 weeks\n4. Keep surgical sites clean and dry\n5. Avoid swimming or soaking in water for 2 weeks"
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
        medications: "MEDICATIONS:\n1. Amoxicillin-clavulanate 875mg PO BID x 7 days - for pneumonia treatment\n2. Azithromycin 500mg PO daily x 5 days - for atypical coverage\n3. Albuterol inhaler 2 puffs Q6H PRN - for bronchospasm\n4. Guaifenesin 600mg PO TID - for expectorant effect\n5. Acetaminophen 650mg PO Q6H PRN fever/pain",
        followUp: "FOLLOW-UP:\n1. Primary care follow-up in 1 week (March 23, 2024) - Dr. Emily Rodriguez\n2. Chest X-ray in 4-6 weeks to ensure resolution\n3. Return to ED if symptoms worsen or fever returns\n4. Complete full course of antibiotics\n5. Smoking cessation counseling provided",
        activity: "ACTIVITY:\n1. Rest as needed, gradual increase in activity\n2. Deep breathing exercises 3 times daily\n3. Avoid smoking and secondhand smoke\n4. Adequate fluid intake (8-10 glasses daily)\n5. Return to work when fever-free for 24 hours"
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
                <Button className="w-full justify-start bg-transparent" variant="outline">
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
                            {currentPatient?.originalSummary?.diagnosis || 'N/A'}
                          </p>
                        </div>
                        <div>
                          <h4 className="font-medium mb-2">HISTORY & EXAMINATION:</h4>
                          <p className="text-muted-foreground">
                            {currentPatient?.originalSummary?.diagnosisText || 'N/A'}
                          </p>
                        </div>
                        <div>
                          <h4 className="font-medium mb-2">{t.medications}</h4>
                          <p className="text-muted-foreground">
                            {currentPatient?.originalSummary?.medications?.split('\n').map((line, index) => (
                              <span key={index}>
                                {line}
                                {index < (currentPatient?.originalSummary?.medications?.split('\n').length || 0) - 1 && <br />}
                              </span>
                            )) || 'N/A'}
                          </p>
                        </div>
                        <div>
                          <h4 className="font-medium mb-2">{t.followUp}</h4>
                          <p className="text-muted-foreground">
                            {currentPatient?.originalSummary?.followUp?.split('\n').map((line, index) => (
                              <span key={index}>
                                {line}
                                {index < (currentPatient?.originalSummary?.followUp?.split('\n').length || 0) - 1 && <br />}
                              </span>
                            )) || 'N/A'}
                          </p>
                        </div>
                        <div>
                          <h4 className="font-medium mb-2">{t.activity}</h4>
                          <p className="text-muted-foreground">
                            {currentPatient?.originalSummary?.activity?.split('\n').map((line, index) => (
                              <span key={index}>
                                {line}
                                {index < (currentPatient?.originalSummary?.activity?.split('\n').length || 0) - 1 && <br />}
                              </span>
                            )) || 'N/A'}
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
                              {currentPatient?.patientFriendly?.overview || 'N/A'}
                            </p>
                          </div>
                          <div>
                            <h4 className="font-medium mb-2">Your medications:</h4>
                            <p className="text-muted-foreground">
                              {currentPatient?.patientFriendly?.medications?.split('\n').map((line, index) => (
                                <span key={index}>
                                  {line}
                                  {index < (currentPatient?.patientFriendly?.medications?.split('\n').length || 0) - 1 && <br />}
                                </span>
                              )) || 'N/A'}
                            </p>
                          </div>
                          <div>
                            <h4 className="font-medium mb-2">Your appointments:</h4>
                            <p className="text-muted-foreground">
                              {currentPatient?.patientFriendly?.appointments?.split('\n').map((line, index) => (
                                <span key={index}>
                                  {line}
                                  {index < (currentPatient?.patientFriendly?.appointments?.split('\n').length || 0) - 1 && <br />}
                                </span>
                              )) || 'N/A'}
                            </p>
                          </div>
                          <div>
                            <h4 className="font-medium mb-2">Activity guidelines:</h4>
                            <p className="text-muted-foreground">
                              {currentPatient?.patientFriendly?.activity?.split('\n').map((line, index) => (
                                <span key={index}>
                                  {line}
                                  {index < (currentPatient?.patientFriendly?.activity?.split('\n').length || 0) - 1 && <br />}
                                </span>
                              )) || 'N/A'}
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
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm">
                      <Save className="h-4 w-4 mr-2" />
                      {t.saveDraft}
                    </Button>
                    <Button variant="outline" size="sm">
                      <Download className="h-4 w-4 mr-2" />
                      {t.generatePDF}
                    </Button>
                    <Button variant="outline" size="sm">
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
    </div>
  )
}
