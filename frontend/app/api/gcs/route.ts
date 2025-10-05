import { NextRequest, NextResponse } from 'next/server';

// Mock GCS API for development - replace with actual GCS integration when needed
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const bucket = searchParams.get('bucket');
    const prefix = searchParams.get('prefix') || '';
    const limit = parseInt(searchParams.get('limit') || '50');

    if (!bucket) {
      return NextResponse.json(
        { error: 'Bucket parameter is required' },
        { status: 400 }
      );
    }

    // Mock file list for development
    const mockFiles = [
      {
        name: 'sample-discharge-summary-1.md',
        size: '2048',
        contentType: 'text/markdown',
        timeCreated: new Date().toISOString(),
        updated: new Date().toISOString(),
        downloadUrl: `https://storage.googleapis.com/${bucket}/sample-discharge-summary-1.md`,
      },
      {
        name: 'sample-discharge-summary-2.md',
        size: '1536',
        contentType: 'text/markdown',
        timeCreated: new Date().toISOString(),
        updated: new Date().toISOString(),
        downloadUrl: `https://storage.googleapis.com/${bucket}/sample-discharge-summary-2.md`,
      },
    ];

    return NextResponse.json({
      files: mockFiles,
      bucket,
      prefix,
      count: mockFiles.length,
    });
  } catch (error) {
    console.error('Error listing GCS files:', error);
    return NextResponse.json(
      { error: 'Failed to list files' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { bucket, fileName } = await request.json();

    if (!bucket || !fileName) {
      return NextResponse.json(
        { error: 'Bucket and fileName are required' },
        { status: 400 }
      );
    }

    // Mock file content for development
    const mockContent = `# Sample Discharge Summary

## Patient Information
- Name: John Doe
- Date of Discharge: ${new Date().toLocaleDateString()}
- Discharge Diagnosis: Acute myocardial infarction

## Medications
- Aspirin 81mg daily
- Metoprolol 25mg twice daily
- Atorvastatin 20mg at bedtime

## Follow-up Instructions
- Follow up with cardiologist in 1 week
- Call 911 if chest pain returns
- Take medications as prescribed

## Activity Restrictions
- No heavy lifting for 2 weeks
- Gradual return to normal activities
- Cardiac rehabilitation recommended`;

    return NextResponse.json({
      content: mockContent,
      fileName,
      bucket,
      size: mockContent.length,
    });
  } catch (error) {
    console.error('Error reading GCS file:', error);
    return NextResponse.json(
      { error: 'Failed to read file' },
      { status: 500 }
    );
  }
}
