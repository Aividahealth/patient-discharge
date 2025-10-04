import { NextRequest, NextResponse } from 'next/server';
import { Storage } from '@google-cloud/storage';

// Initialize GCS client
const storage = new Storage({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
});

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

    // List files in the bucket
    const [files] = await storage.bucket(bucket).getFiles({
      prefix,
      maxResults: limit,
    });

    const fileList = await Promise.all(
      files.map(async (file) => {
        const [metadata] = await file.getMetadata();
        return {
          name: file.name,
          size: metadata.size,
          contentType: metadata.contentType,
          timeCreated: metadata.timeCreated,
          updated: metadata.updated,
          downloadUrl: `https://storage.googleapis.com/${bucket}/${file.name}`,
        };
      })
    );

    return NextResponse.json({
      files: fileList,
      bucket,
      prefix,
      count: fileList.length,
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

    // Get file content
    const file = storage.bucket(bucket).file(fileName);
    const [content] = await file.download();
    const textContent = content.toString('utf-8');

    return NextResponse.json({
      content: textContent,
      fileName,
      bucket,
      size: content.length,
    });
  } catch (error) {
    console.error('Error reading GCS file:', error);
    return NextResponse.json(
      { error: 'Failed to read file' },
      { status: 500 }
    );
  }
}
