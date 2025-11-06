import { NextRequest, NextResponse } from 'next/server';
import { ParserFactory, initializeTenantParsers } from '@/lib/parsers';

// Initialize tenant parsers on module load
initializeTenantParsers();

export async function POST(request: NextRequest) {
  try {
    // Get headers
    const authorization = request.headers.get('authorization');
    const tenantId = request.headers.get('x-tenant-id');

    if (!authorization) {
      return NextResponse.json(
        { error: 'Authorization header is required' },
        { status: 401 }
      );
    }

    if (!tenantId) {
      return NextResponse.json(
        { error: 'x-tenant-id header is required' },
        { status: 400 }
      );
    }

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const patientData = formData.get('patientData') as string;

    if (!file) {
      return NextResponse.json(
        { error: 'File is required' },
        { status: 400 }
      );
    }

    if (!patientData) {
      return NextResponse.json(
        { error: 'Patient data is required' },
        { status: 400 }
      );
    }

    let parsedPatientData;
    try {
      parsedPatientData = JSON.parse(patientData);
    } catch (e) {
      return NextResponse.json(
        { error: 'Invalid patient data JSON' },
        { status: 400 }
      );
    }

    // Validate required patient fields
    const requiredFields = ['mrn', 'name'];
    for (const field of requiredFields) {
      if (!parsedPatientData[field]) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    // Validate file type
    const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Allowed types: PDF, DOC, DOCX, TXT' },
        { status: 400 }
      );
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File size exceeds 10MB limit' },
        { status: 400 }
      );
    }

    // Convert file to buffer for processing
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Parse discharge summary using tenant-specific parser
    let parsedSummary;
    try {
      const parser = ParserFactory.getParser(tenantId);
      parsedSummary = await parser.parse(buffer, file.type);

      // Validate parsed data
      const validation = parser.validate(parsedSummary);
      if (!validation.valid) {
        console.warn('Parser validation warnings:', validation.errors);
        // Don't fail the upload, just log warnings
      }
    } catch (parseError) {
      console.error('Parser error:', parseError);
      // Continue with upload even if parsing fails
      parsedSummary = {
        rawText: buffer.toString('utf-8'),
        warnings: [`Parsing failed: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`],
        confidence: 0,
      };
    }

    // TODO: Replace with actual API call to backend
    // For now, we'll simulate the backend processing
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
    const uploadEndpoint = `${backendUrl}/api/discharge-summary/upload`;

    // Prepare form data for backend
    const backendFormData = new FormData();
    backendFormData.append('file', new Blob([buffer], { type: file.type }), file.name);
    backendFormData.append('patientData', patientData);

    try {
      // Make request to backend API
      const response = await fetch(uploadEndpoint, {
        method: 'POST',
        headers: {
          'Authorization': authorization,
          'x-tenant-id': tenantId,
        },
        body: backendFormData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Backend processing failed' }));
        return NextResponse.json(
          { error: errorData.error || 'Backend processing failed' },
          { status: response.status }
        );
      }

      const responseData = await response.json();

      return NextResponse.json({
        success: true,
        message: 'File uploaded successfully',
        data: responseData,
      });
    } catch (backendError) {
      console.error('Backend API error:', backendError);

      // Fallback: Return mock response for development
      // Merge parsed summary data with provided patient data
      const mockResponse = {
        id: `patient-${Date.now()}`,
        mrn: parsedSummary.mrn || parsedPatientData.mrn,
        name: parsedSummary.patientName || parsedPatientData.name,
        room: parsedPatientData.room || parsedSummary.room || 'TBD',
        unit: parsedPatientData.unit || parsedSummary.unit || parsedSummary.service || 'General',
        dischargeDate: parsedSummary.dischargeDate || parsedPatientData.dischargeDate || new Date().toISOString().split('T')[0],
        rawDischargeSummary: `composition-${Date.now()}-summary`,
        rawDischargeInstructions: `composition-${Date.now()}-instructions`,
        status: 'review',
        attendingPhysician: parsedSummary.attendingPhysician || parsedPatientData.attendingPhysician || {
          name: 'Dr. Unknown',
          id: 'physician-unknown',
        },
        avatar: parsedPatientData.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${parsedSummary.patientName || parsedPatientData.name}`,
        fileName: file.name,
        fileSize: file.size,
        uploadedAt: new Date().toISOString(),
        // Include parsed summary data
        parsedSummary: {
          ...parsedSummary,
          parserConfidence: parsedSummary.confidence,
          parserWarnings: parsedSummary.warnings,
        },
      };

      return NextResponse.json({
        success: true,
        message: 'File uploaded and parsed successfully (mock)',
        data: mockResponse,
        parsingMetadata: {
          confidence: parsedSummary.confidence,
          warnings: parsedSummary.warnings,
          parserVersion: parsedSummary.parserVersion,
        },
      });
    }
  } catch (error) {
    console.error('Error uploading discharge summary:', error);
    return NextResponse.json(
      { error: 'Failed to upload discharge summary' },
      { status: 500 }
    );
  }
}
