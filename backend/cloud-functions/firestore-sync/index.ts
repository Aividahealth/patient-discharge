/**
 * Cloud Function to sync GCS uploads to Firestore
 * Triggers when a new file is uploaded to discharge summaries buckets
 */

import { CloudEvent } from '@google-cloud/functions-framework';
import { Firestore } from '@google-cloud/firestore';
import { Storage } from '@google-cloud/storage';

interface StorageObjectData {
  bucket: string;
  name: string;
  generation: string;
}

const firestore = new Firestore();
const storage = new Storage();

const COLLECTION_NAME = 'discharge_summaries';

/**
 * Main Cloud Function handler
 */
export async function syncToFirestore(cloudEvent: CloudEvent<StorageObjectData>) {
  const eventIdParts = cloudEvent.id.split('/');
  const bucketName = eventIdParts[0];
  const fileName = eventIdParts.slice(1, -1).join('/');

  console.log(`Processing file: ${bucketName}/${fileName}`);

  // Only process .md files
  if (!fileName.endsWith('.md')) {
    console.log('Skipping non-markdown file');
    return;
  }

  // Skip test files
  if (fileName.includes('test-')) {
    console.log('Skipping test file');
    return;
  }

  try {
    // Determine version from bucket name
    let version: 'raw' | 'simplified' | 'translated';
    if (bucketName.includes('raw')) {
      version = 'raw';
    } else if (bucketName.includes('simplified')) {
      version = 'simplified';
    } else if (bucketName.includes('translated')) {
      version = 'translated';
    } else {
      console.log(`Unknown bucket: ${bucketName}`);
      return;
    }

    if (version === 'raw') {
      await handleRawFile(fileName);
    } else if (version === 'simplified') {
      await handleSimplifiedFile(fileName);
    } else if (version === 'translated') {
      await handleTranslatedFile(fileName);
    }

    console.log(`Successfully synced: ${fileName}`);
  } catch (error) {
    console.error(`Error syncing file: ${error.message}`, error);
    throw error;
  }
}

/**
 * Handle new raw discharge summary file
 */
async function handleRawFile(fileName: string) {
  console.log(`Handling raw file: ${fileName}`);

  // Check if document already exists
  const existingQuery = await firestore
    .collection(COLLECTION_NAME)
    .where('files.raw', '==', fileName)
    .limit(1)
    .get();

  if (!existingQuery.empty) {
    console.log('Document already exists, skipping');
    return;
  }

  // Parse filename for patient info
  const fileInfo = parseFilename(fileName);

  // Create new Firestore document
  const now = new Date();
  await firestore.collection(COLLECTION_NAME).add({
    patientName: fileInfo.patientName,
    status: 'raw_only',
    files: {
      raw: fileName,
    },
    createdAt: now,
    updatedAt: now,
    metadata: {
      diagnosis: fileInfo.description ? [fileInfo.description] : [],
    },
  });

  console.log(`Created new document for raw file: ${fileName}`);
}

/**
 * Handle simplified discharge summary file
 */
async function handleSimplifiedFile(fileName: string) {
  console.log(`Handling simplified file: ${fileName}`);

  // Find base raw filename
  const baseFileName = fileName.replace(/-simplified\.md$/, '.md');

  // Find existing document
  const existingQuery = await firestore
    .collection(COLLECTION_NAME)
    .where('files.raw', '==', baseFileName)
    .limit(1)
    .get();

  if (existingQuery.empty) {
    console.log('No matching raw file found, creating new document');

    // Create new document with simplified file
    const fileInfo = parseFilename(baseFileName);
    const now = new Date();

    await firestore.collection(COLLECTION_NAME).add({
      patientName: fileInfo.patientName,
      status: 'simplified',
      files: {
        simplified: fileName,
      },
      createdAt: now,
      updatedAt: now,
      simplifiedAt: now,
      metadata: {
        diagnosis: fileInfo.description ? [fileInfo.description] : [],
      },
    });

    return;
  }

  // Update existing document
  const doc = existingQuery.docs[0];
  const data = doc.data();

  await doc.ref.update({
    'files.simplified': fileName,
    status: 'simplified',
    simplifiedAt: new Date(),
    updatedAt: new Date(),
  });

  console.log(`Updated document with simplified file: ${doc.id}`);
}

/**
 * Handle translated discharge summary file
 */
async function handleTranslatedFile(fileName: string) {
  console.log(`Handling translated file: ${fileName}`);

  // Extract language code
  const langMatch = fileName.match(/-simplified-([a-z]{2})\.md$/);
  const language = langMatch ? langMatch[1] : 'es';

  // Find base raw filename
  const baseFileName = fileName.replace(/-simplified-[a-z]{2}\.md$/, '.md');

  // Find existing document
  const existingQuery = await firestore
    .collection(COLLECTION_NAME)
    .where('files.raw', '==', baseFileName)
    .limit(1)
    .get();

  if (existingQuery.empty) {
    // Try to find by simplified file
    const simplifiedFileName = fileName.replace(/-[a-z]{2}\.md$/, '.md');
    const simplifiedQuery = await firestore
      .collection(COLLECTION_NAME)
      .where('files.simplified', '==', simplifiedFileName)
      .limit(1)
      .get();

    if (simplifiedQuery.empty) {
      console.log('No matching document found, creating new');

      const fileInfo = parseFilename(baseFileName);
      const now = new Date();

      await firestore.collection(COLLECTION_NAME).add({
        patientName: fileInfo.patientName,
        status: 'translated',
        files: {
          translated: {
            [language]: fileName,
          },
        },
        createdAt: now,
        updatedAt: now,
        translatedAt: now,
        metadata: {
          diagnosis: fileInfo.description ? [fileInfo.description] : [],
        },
      });

      return;
    }

    // Update document found by simplified file
    const doc = simplifiedQuery.docs[0];
    const data = doc.data();
    const existingTranslated = data.files?.translated || {};

    await doc.ref.update({
      [`files.translated.${language}`]: fileName,
      status: 'translated',
      translatedAt: new Date(),
      updatedAt: new Date(),
    });

    console.log(`Updated document with translated file: ${doc.id}`);
    return;
  }

  // Update existing document
  const doc = existingQuery.docs[0];
  const data = doc.data();
  const existingTranslated = data.files?.translated || {};

  await doc.ref.update({
    [`files.translated.${language}`]: fileName,
    status: 'translated',
    translatedAt: new Date(),
    updatedAt: new Date(),
  });

  console.log(`Updated document with translated file: ${doc.id}`);
}

/**
 * Parse patient information from filename
 */
function parseFilename(fileName: string): {
  patientName?: string;
  description?: string;
} {
  // Remove prefixes like "reprocess-" or "translate-"
  let cleanName = fileName
    .replace(/^(reprocess-|translate-)/, '')
    .replace(/\.md$/, '');

  // Try to parse patient name and description
  const parts = cleanName.split(' - ');

  if (parts.length >= 2) {
    return {
      patientName: parts[0].trim(),
      description: parts.slice(1).join(' - ').trim(),
    };
  }

  return {
    description: cleanName,
  };
}
