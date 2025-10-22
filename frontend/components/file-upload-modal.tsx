"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
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

interface FileUploadModalProps {
  isOpen: boolean
  onClose: () => void
}

interface UploadFile {
  id: string
  file: File
  status: 'pending' | 'uploading' | 'success' | 'error'
  progress: number
  error?: string
}

export function FileUploadModal({ isOpen, onClose }: FileUploadModalProps) {
  const [selectedFiles, setSelectedFiles] = useState<UploadFile[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)

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
    setIsUploading(true)
    
    // Simulate upload process for each file
    for (const fileItem of selectedFiles) {
      if (fileItem.status === 'pending') {
        setSelectedFiles((prev) =>
          prev.map((f) =>
            f.id === fileId
              ? { ...f, status: 'uploading' as const }
              : f
          )
        )

        // Simulate upload progress
        for (let progress = 0; progress <= 100; progress += 10) {
          await new Promise((resolve) => setTimeout(resolve, 100))
          setSelectedFiles((prev) =>
            prev.map((f) =>
              f.id === fileItem.id
                ? { ...f, progress }
                : f
            )
          )
        }

        // Simulate success (90% chance) or error (10% chance)
        const isSuccess = Math.random() > 0.1
        setSelectedFiles((prev) =>
          prev.map((f) =>
            f.id === fileItem.id
              ? {
                  ...f,
                  status: isSuccess ? 'success' : 'error',
                  error: isSuccess ? undefined : 'Upload failed. Please try again.',
                }
              : f
          )
        )
      }
    }

    setIsUploading(false)
  }

  const handleClose = () => {
    setSelectedFiles([])
    setIsUploading(false)
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
