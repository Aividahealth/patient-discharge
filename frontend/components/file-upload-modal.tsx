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
  })

  const handleFileSelect = (files: FileList | null) => {
    if (!files) return

    const newFiles: UploadFile[] = Array.from(files).map((file) => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      status: 'pending',
      progress: 0,
    }))

    setSelectedFiles((prev) => [...prev, ...newFiles])
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
          // Prepare form data
          const formData = new FormData();
          formData.append('file', fileItem.file);
          formData.append('patientData', JSON.stringify(patientFormData));

          // Create API client with tenant context
          const apiClient = createApiClient({ tenantId, token });

          // Upload file using FormData (need to use fetch directly for file uploads)
          const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/discharge-summary/upload`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'X-Tenant-ID': tenantId,
            },
            body: formData,
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({
              success: false,
              error: `Server error: ${response.status} ${response.statusText}`
            }));
            throw new Error(errorData.error || errorData.message || 'Upload failed');
          }

          const result = await response.json();

          console.log('[FileUpload] Upload successful:', result);

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

          // Call success callback with the parsed data
          if (onUploadSuccess) {
            const patientData = result.data || result.patient;
            if (patientData) {
              console.log('[FileUpload] Calling onUploadSuccess with:', patientData);
              onUploadSuccess(patientData);
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
            Select one or more discharge summary files to upload. Supported formats: PDF, DOC, DOCX, TXT
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Patient Information Form */}
          <Card className="border-blue-200 bg-blue-50/50">
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
            <h3 className="text-lg font-medium mb-2">Drop files here or click to browse</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Select multiple files to upload discharge summaries
            </p>
            <input
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.txt"
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

          {/* Selected Files List */}
          {selectedFiles.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-medium">Selected Files ({selectedFiles.length})</h4>
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
              {selectedFiles.length > 0 && (
                <span>
                  {selectedFiles.filter(f => f.status === 'success').length} of {selectedFiles.length} files uploaded
                </span>
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
                  All files have been successfully uploaded. The discharge summaries will be processed and available for review shortly.
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

