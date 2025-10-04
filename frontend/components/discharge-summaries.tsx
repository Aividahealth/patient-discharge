'use client';

import { useState } from 'react';
import { useGCSFiles, useGCSFileContent } from '@/lib/hooks/useGCS';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, Download, Eye, Calendar, User } from 'lucide-react';

interface DischargeSummariesProps {
  className?: string;
}

export function DischargeSummaries({ className }: DischargeSummariesProps) {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [selectedBucket, setSelectedBucket] = useState<'raw' | 'simplified'>('raw');

  const bucketName = selectedBucket === 'raw' 
    ? 'discharge-summaries-raw' 
    : 'discharge-summaries-simplified';

  const { files, loading, error } = useGCSFiles(bucketName);
  const { content, loading: contentLoading } = useGCSFileContent(
    bucketName, 
    selectedFile
  );

  const formatFileSize = (bytes: string) => {
    const size = parseInt(bytes);
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getFileType = (fileName: string) => {
    if (fileName.includes('-simplified')) return 'Simplified';
    if (fileName.includes('-translated')) return 'Translated';
    return 'Raw';
  };

  const getFileTypeColor = (fileName: string) => {
    if (fileName.includes('-simplified')) return 'bg-green-100 text-green-800';
    if (fileName.includes('-translated')) return 'bg-blue-100 text-blue-800';
    return 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Loading discharge summaries...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <div className="text-red-600 mb-4">Error loading discharge summaries</div>
        <div className="text-sm text-gray-600">{error}</div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Discharge Summaries</h2>
        <Tabs value={selectedBucket} onValueChange={(value) => setSelectedBucket(value as 'raw' | 'simplified')}>
          <TabsList>
            <TabsTrigger value="raw">Raw Summaries</TabsTrigger>
            <TabsTrigger value="simplified">Simplified Summaries</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* File List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {selectedBucket === 'raw' ? 'Raw' : 'Simplified'} Discharge Summaries
            </CardTitle>
            <CardDescription>
              {files.length} files found in {bucketName}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {files.map((file) => (
                <div
                  key={file.name}
                  className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                    selectedFile === file.name
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setSelectedFile(file.name)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm truncate">
                          {file.name}
                        </span>
                        <Badge className={getFileTypeColor(file.name)}>
                          {getFileType(file.name)}
                        </Badge>
                      </div>
                      <div className="text-xs text-gray-500 space-y-1">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(file.timeCreated)}
                        </div>
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {formatFileSize(file.size)}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1 ml-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(file.downloadUrl, '_blank');
                        }}
                      >
                        <Download className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* File Content */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              {selectedFile ? 'File Content' : 'Select a file to view content'}
            </CardTitle>
            {selectedFile && (
              <CardDescription>
                {selectedFile}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            {selectedFile ? (
              <div className="space-y-4">
                {contentLoading ? (
                  <div className="flex items-center justify-center p-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                    <span className="ml-2">Loading content...</span>
                  </div>
                ) : content ? (
                  <div className="space-y-4">
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => {
                          const blob = new Blob([content], { type: 'text/plain' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = selectedFile;
                          a.click();
                          URL.revokeObjectURL(url);
                        }}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </Button>
                    </div>
                    <div className="border rounded-lg p-4 bg-gray-50 max-h-96 overflow-y-auto">
                      <pre className="text-sm whitespace-pre-wrap font-mono">
                        {content}
                      </pre>
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-gray-500 p-8">
                    Failed to load content
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center text-gray-500 p-8">
                Select a file from the list to view its content
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
