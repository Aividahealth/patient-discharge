"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog"
import {
  Upload,
  FileText,
  X,
  CheckCircle,
  AlertCircle,
  Loader2
} from "lucide-react"
import { useTenant } from "@/contexts/tenant-context"
import { createApiClient } from "@/lib/api-client"
import { parseDischargeDocument } from "@/lib/parsers/parser-registry"

/**
 * Load PDF.js library from CDN
 */
async function loadPDFJS() {
  // Check if already loaded
  if ((window as any).pdfjsLib) {
    return (window as any).pdfjsLib
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
    script.async = true
    script.onload = () => {
      const pdfjsLib = (window as any).pdfjsLib
      if (pdfjsLib) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
        resolve(pdfjsLib)
      } else {
        reject(new Error('PDF.js failed to load'))
      }
    }
    script.onerror = () => reject(new Error('Failed to load PDF.js script'))
    document.head.appendChild(script)
  })
}

/**
 * Extract text from PDF file
 */
async function extractTextFromPDF(file: File): Promise<string> {
  try {
    const pdfjsLib = await loadPDFJS()
    const arrayBuffer = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({
      data: arrayBuffer,
      // Provide CMap and standard font data to improve text extraction on some PDFs
      cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
      cMapPacked: true,
      standardFontDataUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/standard_fonts/'
    }).promise

    let fullText = ''

    // Extract text from each page
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const textContent = await page.getTextContent()
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ')
      fullText += pageText + '\n\n'
    }

    const trimmed = fullText.trim()
    if (!trimmed) {
      // Likely an image-only (scanned) PDF with no text layer
      throw new Error(
        'This PDF does not contain extractable text (likely a scanned image). ' +
        'Please upload a .txt/.md version, or use an OCR-processed PDF.'
      )
    }
    return trimmed
  } catch (error) {
    console.error('[PDF Extraction] Error:', error)
    throw new Error(`Failed to extract text from PDF: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Extract text content from various file types
 */
async function extractTextFromFile(file: File): Promise<string> {
  const fileName = file.name.toLowerCase()

  console.log('[FileUpload] Extracting text from:', fileName)

  // Handle text files
  if (fileName.endsWith('.txt')) {
    const text = await file.text()
    console.log('[FileUpload] Extracted from TXT:', { length: text.length })
    return text
  }

  // Handle markdown files
  if (fileName.endsWith('.md')) {
    const text = await file.text()
    console.log('[FileUpload] Extracted from Markdown:', { length: text.length })
    return text
  }

  // Handle PDF files
  if (fileName.endsWith('.pdf')) {
    const text = await extractTextFromPDF(file)
    console.log('[FileUpload] Extracted from PDF:', { length: text.length, pages: text.split('\n\n').length })
    return text
  }

  // Unsupported file type
  throw new Error(`Unsupported file type. Please upload .txt, .md, or .pdf files only.`)
}

interface FileUploadModalProps {
  isOpen: boolean
  onClose: () => void
  onUploadSuccess?: (data: any) => void
}

interface UploadFile {
  id: string
  file: File
  status: 'pending' | 'uploading' | 'success' | 'error'
  progress: number
  error?: string
  patientData?: PatientData
}

interface PatientData {
  mrn: string
  name: string
  room?: string
  unit?: string
  dischargeDate?: string
  attendingPhysician?: {
    name: string
    id?: string
  }
  preferredLanguage?: string
}

export function FileUploadModal({ isOpen, onClose, onUploadSuccess }: FileUploadModalProps) {
  const { tenantId, token } = useTenant()
  const [selectedFiles, setSelectedFiles] = useState<UploadFile[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [currentFileIndex, setCurrentFileIndex] = useState<number | null>(null)
  const [patientFormData, setPatientFormData] = useState<PatientData>({
    mrn: '',
    name: '',
    room: '',
    unit: '',
    dischargeDate: new Date().toISOString().split('T')[0],
    attendingPhysician: {
      name: '',
    },
    preferredLanguage: 'es', // Default to Spanish
  })

  const handleFileSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return

    // Only allow one file at a time
    const file = files[0]

    const newFile: UploadFile = {
      id: Math.random().toString(36).substr(2, 9),
      file,
      status: 'pending',
      progress: 0,
    }

    // Replace any existing file with the new one
    setSelectedFiles([newFile])
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
    handleFileSelect(e.dataTransfer.files)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
  }

  const removeFile = (fileId: string) => {
    setSelectedFiles((prev) => prev.filter((file) => file.id !== fileId))
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getFileIcon = (fileName: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase()
    switch (extension) {
      case 'pdf':
        return '📄'
      case 'doc':
      case 'docx':
        return '📝'
      case 'txt':
        return '📄'
      default:
        return '📄'
    }
  }

  const handleUpload = async () => {
    // Validate patient data
    if (!patientFormData.mrn || !patientFormData.name) {
      alert('Please fill in required patient information (MRN and Name)');
      return;
    }

    // Validate tenant context
    if (!tenantId || !token) {
      alert('Session expired. Please log in again.');
      return;
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📤 FILE UPLOAD - Starting Upload');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('👤 Patient Form Data:', JSON.stringify(patientFormData, null, 2));
    console.log('📁 Files to upload:', selectedFiles.length);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    setIsUploading(true)

    // Upload each file
    for (let i = 0; i < selectedFiles.length; i++) {
      const fileItem = selectedFiles[i];
      if (fileItem.status === 'pending') {
        setCurrentFileIndex(i);
        setSelectedFiles((prev) =>
          prev.map((f) =>
            f.id === fileItem.id
              ? { ...f, status: 'uploading' as const, progress: 50 }
              : f
          )
        )

        try {
          // Extract text from file
          const fileText = await extractTextFromFile(fileItem.file);

          if (!fileText || fileText.trim().length === 0) {
            throw new Error('Could not extract text from file. Please ensure the file contains readable text.');
          }

          console.log('[FileUpload] Extracted text from file:', {
            fileName: fileItem.file.name,
            textLength: fileText.length,
            preview: fileText.substring(0, 200) + '...'
          });

          // Parse the document using tenant-specific parser
          console.log('[FileUpload] Parsing document using tenant parser...');
          const parseResult = parseDischargeDocument(tenantId || 'demo', fileText, fileText);

          // Prepare request body matching API spec
          const requestBody = {
            id: `patient-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            mrn: patientFormData.mrn,
            name: patientFormData.name,
            room: patientFormData.room || undefined,
            unit: patientFormData.unit || undefined,
            dischargeDate: patientFormData.dischargeDate,
            rawDischargeSummary: fileText,
            rawDischargeInstructions: fileText, // Using same text for now
            // Add parsed data if parser was successful
            parsedDischargeSummary: parseResult.parserUsed ? parseResult.parsedSummary : null,
            parsedDischargeInstructions: parseResult.parserUsed ? parseResult.parsedInstructions : null,
            status: 'review',
            attendingPhysician: {
              name: patientFormData.attendingPhysician?.name || '',
              id: patientFormData.attendingPhysician?.id || `physician-${Date.now()}`
            },
            preferredLanguage: patientFormData.preferredLanguage || undefined,
            avatar: undefined // Optional field
          };

          console.log('[FileUpload] Sending request:', {
            url: `${process.env.NEXT_PUBLIC_API_URL}/api/discharge-summary/upload`,
            body: {
              ...requestBody,
              rawDischargeSummary: `${requestBody.rawDischargeSummary.substring(0, 100)}... (${requestBody.rawDischargeSummary.length} chars)`,
              rawDischargeInstructions: `${requestBody.rawDischargeInstructions.substring(0, 100)}... (${requestBody.rawDischargeInstructions.length} chars)`
            },
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer [REDACTED]',
              'X-Tenant-ID': tenantId
            }
          });

          // Upload with JSON body
          const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/discharge-summary/upload`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
              'X-Tenant-ID': tenantId,
            },
            body: JSON.stringify(requestBody),
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({
              success: false,
              error: `Server error: ${response.status} ${response.statusText}`
            }));
            console.error('[FileUpload] Upload failed:', {
              status: response.status,
              statusText: response.statusText,
              error: errorData
            });
            throw new Error(errorData.error || errorData.message || 'Upload failed');
          }

          const result = await response.json();

          if (!result.parserUsed) {
            console.warn('[FileUpload] Parser could not detect document format. The document may not have the expected section headers.');
          }

          // Update file status to success
          setSelectedFiles((prev) =>
            prev.map((f) =>
              f.id === fileItem.id
                ? {
                    ...f,
                    status: 'success' as const,
                    progress: 100,
                    patientData: result.data || result.patient,
                  }
                : f
            )
          );

          // Fetch composition data with the binaries
          try {
            const compositionResponse = await fetch(
              `${process.env.NEXT_PUBLIC_API_URL}/google/fhir/Composition/${result.compositionId}/binaries`,
              {
                method: 'GET',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`,
                  'X-Tenant-ID': tenantId,
                },
              }
            );

            if (compositionResponse.ok) {
              const compositionData = await compositionResponse.json();

              // Call success callback with composition data
              if (onUploadSuccess) {
                const enrichedData = {
                  patientId: result.patientId,
                  compositionId: result.compositionId,
                  patientInfo: patientFormData,
                  composition: compositionData,
                  rawText: fileText,
                };

                onUploadSuccess(enrichedData);
              }
            } else {
              console.warn('[FileUpload] Failed to fetch composition data:', compositionResponse.status);
              // Still call success callback with basic data
              if (onUploadSuccess) {
                onUploadSuccess({
                  patientId: result.patientId,
                  compositionId: result.compositionId,
                  patientInfo: patientFormData,
                  rawText: fileText,
                });
              }
            }
          } catch (compositionError) {
            console.error('[FileUpload] Error fetching composition:', compositionError);
            // Still call success callback with basic data
            if (onUploadSuccess) {
              onUploadSuccess({
                patientId: result.patientId,
                compositionId: result.compositionId,
                patientInfo: patientFormData,
                rawText: fileText,
              });
            }
          }
        } catch (error) {
          console.error('[FileUpload] Upload error:', error);
          const errorMessage = error instanceof Error ? error.message : 'Upload failed. Please try again.';

          setSelectedFiles((prev) =>
            prev.map((f) =>
              f.id === fileItem.id
                ? {
                    ...f,
                    status: 'error' as const,
                    progress: 0,
                    error: errorMessage,
                  }
                : f
            )
          );
        }
      }
    }

    setIsUploading(false);
    setCurrentFileIndex(null);
  }

  const handleClose = () => {
    setSelectedFiles([])
    setIsUploading(false)
    setCurrentFileIndex(null)
    setPatientFormData({
      mrn: '',
      name: '',
      room: '',
      unit: '',
      dischargeDate: new Date().toISOString().split('T')[0],
      attendingPhysician: {
        name: '',
      },
    })
    onClose()
  }

  const allFilesUploaded = selectedFiles.length > 0 && selectedFiles.every(f => f.status === 'success')
  const hasErrors = selectedFiles.some(f => f.status === 'error')

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Discharge Summaries
          </DialogTitle>
          <DialogDescription>
            Select one or more discharge summary files to upload. Supported formats: PDF, TXT
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Patient Information Form */}
          <Card className="border-opacity-50 relative overflow-hidden" style={{ borderColor: 'var(--tenant-primary)' }}>
            <span className="absolute inset-0 -z-10" style={{ backgroundColor: 'var(--tenant-primary)', opacity: 0.1 }} />
            <CardHeader>
              <CardTitle className="text-base">Patient Information</CardTitle>
              <CardDescription>
                Fill in patient details for the discharge summary
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="mrn">
                    MRN <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="mrn"
                    placeholder="MRN-12345"
                    value={patientFormData.mrn}
                    onChange={(e) => setPatientFormData({ ...patientFormData, mrn: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">
                    Patient Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="name"
                    placeholder="John Smith"
                    value={patientFormData.name}
                    onChange={(e) => setPatientFormData({ ...patientFormData, name: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="room">Room</Label>
                  <Input
                    id="room"
                    placeholder="302"
                    value={patientFormData.room}
                    onChange={(e) => setPatientFormData({ ...patientFormData, room: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="unit">Unit</Label>
                  <Input
                    id="unit"
                    placeholder="Cardiology Unit"
                    value={patientFormData.unit}
                    onChange={(e) => setPatientFormData({ ...patientFormData, unit: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="dischargeDate">Discharge Date</Label>
                  <Input
                    id="dischargeDate"
                    type="date"
                    value={patientFormData.dischargeDate}
                    onChange={(e) => setPatientFormData({ ...patientFormData, dischargeDate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="physician">Attending Physician</Label>
                  <Input
                    id="physician"
                    placeholder="Dr. Sarah Johnson, MD"
                    value={patientFormData.attendingPhysician?.name || ''}
                    onChange={(e) => setPatientFormData({
                      ...patientFormData,
                      attendingPhysician: { name: e.target.value }
                    })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="preferredLanguage">Preferred Language</Label>
                  <select
                    id="preferredLanguage"
                    className="w-full border rounded-md h-9 px-3 text-sm"
                    value={patientFormData.preferredLanguage || 'es'}
                    onChange={(e) => setPatientFormData({ ...patientFormData, preferredLanguage: e.target.value })}
                  >
                    <option value="en">English</option>
                    <option value="es">Spanish</option>
                    <option value="vi">Vietnamese</option>
                    <option value="fr">French</option>
                    <option value="hi">Hindi</option>
                    <option value="zh">Mandarin</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* File Drop Zone */}
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragActive
                ? 'border-primary bg-primary/5'
                : 'border-muted-foreground/25 hover:border-primary/50'
            }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Drop file here or click to browse</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Select one discharge summary file to upload
            </p>
            <input
              type="file"
              accept=".pdf,.txt,.md"
              onChange={(e) => handleFileSelect(e.target.files)}
              className="hidden"
              id="file-upload"
            />
            <Button
              variant="outline"
              onClick={() => document.getElementById('file-upload')?.click()}
            >
              <Upload className="h-4 w-4 mr-2" />
              Choose Files
            </Button>
          </div>

          {/* Selected File */}
          {selectedFiles.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-medium">Selected File</h4>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {selectedFiles.map((fileItem) => (
                  <Card key={fileItem.id} className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <span className="text-2xl">{getFileIcon(fileItem.file.name)}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{fileItem.file.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatFileSize(fileItem.file.size)}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {fileItem.status === 'pending' && (
                          <Badge variant="outline">Pending</Badge>
                        )}
                        {fileItem.status === 'uploading' && (
                          <div className="flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span className="text-xs">{fileItem.progress}%</span>
                          </div>
                        )}
                        {fileItem.status === 'success' && (
                          <div className="flex items-center gap-2 text-green-600">
                            <CheckCircle className="h-4 w-4" />
                            <span className="text-xs">Success</span>
                          </div>
                        )}
                        {fileItem.status === 'error' && (
                          <div className="flex items-center gap-2 text-red-600">
                            <AlertCircle className="h-4 w-4" />
                            <span className="text-xs">Error</span>
                          </div>
                        )}
                        
                        {fileItem.status === 'pending' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeFile(fileItem.id)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                    
                    {fileItem.status === 'uploading' && (
                      <Progress value={fileItem.progress} className="mt-2" />
                    )}
                    
                    {fileItem.error && (
                      <p className="text-xs text-red-600 mt-1">{fileItem.error}</p>
                    )}
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Upload Actions */}
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="text-sm text-muted-foreground">
              {selectedFiles.length > 0 && selectedFiles[0].status === 'success' && (
                <span>File uploaded successfully</span>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              
              {selectedFiles.length > 0 && (
                <Button
                  onClick={handleUpload}
                  disabled={isUploading || selectedFiles.every(f => f.status !== 'pending')}
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Files
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>

          {/* Success Message */}
          {allFilesUploaded && (
            <Card className="border-green-200 bg-green-50">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-green-800">
                  <CheckCircle className="h-5 w-5" />
                  <span className="font-medium">Upload Complete!</span>
                </div>
                <p className="text-sm text-green-700 mt-1">
                  The discharge summary has been successfully uploaded and is being processed. You can now review it in the main panel.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Error Message */}
          {hasErrors && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-red-800">
                  <AlertCircle className="h-5 w-5" />
                  <span className="font-medium">Some uploads failed</span>
                </div>
                <p className="text-sm text-red-700 mt-1">
                  Please check the files with errors and try uploading again.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

