import { NextRequest, NextResponse } from 'next/server';

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

    // Validate file size (max 3MB)
    const maxSize = 3 * 1024 * 1024; // 3MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File size exceeds 3MB limit' },
        { status: 400 }
      );
    }

    // Convert file to buffer for processing
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Note: Parsing is handled by the backend API
    // Frontend parsing was removed as it used a non-existent parser system
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || (process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : 'https://patient-discharge-backend-dev-647433528821.us-central1.run.app');
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
      const mockResponse = {
        id: `patient-${Date.now()}`,
        mrn: parsedPatientData.mrn,
        name: parsedPatientData.name,
        room: parsedPatientData.room || 'TBD',
        unit: parsedPatientData.unit || 'General',
        dischargeDate: parsedPatientData.dischargeDate || new Date().toISOString().split('T')[0],
        rawDischargeSummary: `composition-${Date.now()}-summary`,
        rawDischargeInstructions: `composition-${Date.now()}-instructions`,
        status: 'review',
        attendingPhysician: parsedPatientData.attendingPhysician || {
          name: 'Dr. Unknown',
          id: 'physician-unknown',
        },
        avatar: parsedPatientData.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${parsedPatientData.name}`,
        fileName: file.name,
        fileSize: file.size,
        uploadedAt: new Date().toISOString(),
      };

      return NextResponse.json({
        success: true,
        message: 'File uploaded successfully (mock)',
        data: mockResponse,
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
