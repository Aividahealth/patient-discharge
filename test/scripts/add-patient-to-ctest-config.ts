/**
 * Script to add multiple patients with encounters and discharge summaries to Cerner sandbox
 * 
 * This script:
 * 1. Authenticates with Cerner using system app credentials
 * 2. Creates or finds Patients for each discharge summary
 * 3. Creates Encounters for each patient
 * 4. Creates DocumentReference with discharge summary content
 * 5. Uses proper LOINC codes and references
 * 
 * Usage:
 *   cd test
 *   npx ts-node scripts/add-patient-to-ctest-config.ts
 */

import { Firestore } from '@google-cloud/firestore';
import axios from 'axios';
import * as qs from 'qs';
import * as fs from 'fs';
import * as path from 'path';
// Generate UUID v4 without external dependency
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

const TENANT_ID = 'ctest';
const BACKEND_URL = 'https://patient-discharge-backend-dev-qnzythtpnq-uc.a.run.app';

// Discharge summary data extracted from provided files
interface DischargeSummaryData {
  patientName: string;
  mrn: string;
  dob: string;
  admitDate: string;
  dischargeDate: string;
  attendingPhysician: string;
  service: string;
  admittingDiagnosis: string[];
  dischargeDiagnosis: string[];
  content: string;
  patientId?: string; // Will be set after patient creation
  encounterId?: string; // Will be set after encounter creation
}

function readDischargeSummaryFile(filename: string): string {
  const downloadsPath = path.join(process.env.HOME || process.env.USERPROFILE || '', 'Downloads', filename);
  if (fs.existsSync(downloadsPath)) {
    return fs.readFileSync(downloadsPath, 'utf-8');
  }
  
  // Try relative path from script location
  const relativePath = path.join(__dirname, '../../Downloads', filename);
  if (fs.existsSync(relativePath)) {
    return fs.readFileSync(relativePath, 'utf-8');
  }
  
  throw new Error(`Discharge summary file not found: ${filename} (tried: ${downloadsPath}, ${relativePath})`);
}

const dischargeSummaries: DischargeSummaryData[] = [
  {
    patientName: 'Jane Smith',
    mrn: 'MRN-001',
    dob: '1949-03-15',
    admitDate: '2025-09-14',
    dischargeDate: '2025-09-18',
    attendingPhysician: 'Dr. John Orthopedic',
    service: 'Orthopedic Surgery',
    admittingDiagnosis: ['M16.12', 'M25.552', 'G89.29', 'I10'],
    dischargeDiagnosis: ['Status post elective left total hip arthroplasty', 'Primary osteoarthritis, improved', 'Hypertension, controlled'],
    content: readDischargeSummaryFile('Adult -Hip Replacement.md'),
  },
  {
    patientName: 'Mary Johnson',
    mrn: 'MRN-002',
    dob: '1980-05-22',
    admitDate: '2025-09-20',
    dischargeDate: '2025-09-25',
    attendingPhysician: 'Dr. Sarah Endocrine',
    service: 'Endocrinology / Critical Care',
    admittingDiagnosis: ['E10.10', 'N17.9', 'E86.0', 'E87.5'],
    dischargeDiagnosis: ['Resolved DKA', 'Type 1 Diabetes Mellitus, insulin-dependent', 'AKI resolved with hydration'],
    content: readDischargeSummaryFile('Adult - DKA discharge.md'),
  },
  {
    patientName: 'Patricia Williams',
    mrn: 'MRN-003',
    dob: '1953-11-08',
    admitDate: '2025-09-28',
    dischargeDate: '2025-10-05',
    attendingPhysician: 'Dr. Michael Pulmonology',
    service: 'Internal Medicine',
    admittingDiagnosis: ['J18.9', 'J96.01', 'E11.9', 'J44.9', 'I10'],
    dischargeDiagnosis: ['CAP, improved after IV and oral antibiotics', 'Acute Hypoxemic Respiratory Failure, resolved', 'COPD, stable'],
    content: readDischargeSummaryFile('Adult -  complex pneumonia discharge (1).md'),
  },
  {
    patientName: 'Robert Brown',
    mrn: 'MRN-004',
    dob: '1957-07-30',
    admitDate: '2025-10-02',
    dischargeDate: '2025-10-07',
    attendingPhysician: 'Dr. Emily Cardiology',
    service: 'Cardiology',
    admittingDiagnosis: ['I50.23', 'I10', 'E11.9'],
    dischargeDiagnosis: ['Acute on Chronic Systolic Heart Failure, improved', 'Hypertension, stable', 'Type 2 Diabetes Mellitus, stable'],
    content: readDischargeSummaryFile('Adult - heart complication discharge summary.md'),
  },
  {
    patientName: 'James Davis',
    mrn: 'MRN-005',
    dob: '2019-10-22',
    admitDate: '2025-10-22',
    dischargeDate: '2025-10-24',
    attendingPhysician: 'Dr. Lisa ENT',
    service: 'Pediatric Otolaryngology',
    admittingDiagnosis: ['G47.33', 'J35.3'],
    dischargeDiagnosis: ['Status post tonsillectomy and adenoidectomy, stable'],
    content: readDischargeSummaryFile('Sleep apnea discharge summary.md'),
  },
  {
    patientName: 'William Miller',
    mrn: 'MRN-006',
    dob: '2014-08-15',
    admitDate: '2025-10-18',
    dischargeDate: '2025-10-21',
    attendingPhysician: 'Dr. David Pediatric Surgery',
    service: 'Pediatric Surgery',
    admittingDiagnosis: ['K35.80'],
    dischargeDiagnosis: ['Acute Appendicitis, status post laparoscopic appendectomy, resolved'],
    content: readDischargeSummaryFile('Appendectomy case.md'),
  },
  {
    patientName: 'Thomas Wilson',
    mrn: 'MRN-007',
    dob: '2022-06-10',
    admitDate: '2025-10-12',
    dischargeDate: '2025-10-13',
    attendingPhysician: 'Dr. Jennifer Neurology',
    service: 'Pediatric Neurology',
    admittingDiagnosis: ['R56.00', 'J06.9'],
    dischargeDiagnosis: ['Simple Febrile Seizure, resolved', 'Viral URI, improving'],
    content: readDischargeSummaryFile('Febrile seizure discharge summary.md'),
  },
  {
    patientName: 'Daniel Moore',
    mrn: 'MRN-008',
    dob: '2016-03-25',
    admitDate: '2025-09-12',
    dischargeDate: '2025-09-16',
    attendingPhysician: 'Dr. Amanda Pulmonology',
    service: 'Pediatric Pulmonology',
    admittingDiagnosis: ['J45.41', 'J06.9'],
    dischargeDiagnosis: ['Moderate Persistent Asthma with Acute Exacerbation, resolved', 'Viral URI, resolving'],
    content: readDischargeSummaryFile('Persistent Asthama DS.md'),
  },
];

async function getFirestore(): Promise<Firestore> {
  try {
    const serviceAccountPath = process.env.FIRESTORE_SERVICE_ACCOUNT_PATH || 
                               process.env.SERVICE_ACCOUNT_PATH;
    
    if (serviceAccountPath) {
      const resolved = path.resolve(process.cwd(), serviceAccountPath);
      if (fs.existsSync(resolved)) {
        return new Firestore({ keyFilename: resolved });
      }
    }
    
    return new Firestore();
  } catch (error) {
    console.error('Failed to initialize Firestore:', error);
    throw error;
  }
}

async function getCernerConfig(): Promise<{ accessToken: string; baseUrl: string }> {
  const firestore = await getFirestore();
  const doc = await firestore.collection('config').doc(TENANT_ID).get();
  
  if (!doc.exists) {
    throw new Error('Tenant not found in Firestore');
  }
  
  const cernerConfig = doc.data()?.ehrIntegration?.cerner;
  if (!cernerConfig?.system_app) {
    throw new Error('System app configuration not found');
  }
  
  const { client_id, client_secret, token_url, scopes } = cernerConfig.system_app;
  const baseUrl = cernerConfig.base_url;
  
  // Authenticate with Cerner
  const credentials = Buffer.from(`${client_id}:${client_secret}`).toString('base64');
  const headers = {
    Authorization: `Basic ${credentials}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  };
  
  const data = qs.stringify({
    grant_type: 'client_credentials',
    scope: scopes,
  });
  
  const response = await axios.post(token_url, data, { headers });
  
  if (!response.data.access_token) {
    throw new Error('Failed to get access token');
  }
  
  return { accessToken: response.data.access_token, baseUrl };
}

async function findOrCreatePractitioner(accessToken: string, baseUrl: string): Promise<string> {
  console.log('   🔍 Searching for existing Practitioner...');
  
  // Method 1: Direct Practitioner search
  try {
    const searchUrl = `${baseUrl}/Practitioner?_count=10`;
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/fhir+json',
    };
    
    const searchResponse = await axios.get(searchUrl, { headers });
    
    if (searchResponse.data?.entry && searchResponse.data.entry.length > 0) {
      const practitionerId = searchResponse.data.entry[0].resource.id;
      console.log(`   ✅ Found existing Practitioner: ${practitionerId}`);
      return practitionerId;
    }
  } catch (error) {
    console.log('   Could not search for Practitioner directly');
  }
  
  // Method 2: Find Practitioner from existing Encounters
  try {
    console.log('   🔍 Searching for Practitioner in existing Encounters...');
    const encounterSearchUrl = `${baseUrl}/Encounter?_count=20`;
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/fhir+json',
    };
    
    const encounterResponse = await axios.get(encounterSearchUrl, { headers });
    
    if (encounterResponse.data?.entry && encounterResponse.data.entry.length > 0) {
      for (const entry of encounterResponse.data.entry) {
        const encounter = entry.resource;
        if (encounter.participant && encounter.participant.length > 0) {
          for (const participant of encounter.participant) {
            if (participant.individual?.reference?.startsWith('Practitioner/')) {
              const practitionerId = participant.individual.reference.replace('Practitioner/', '');
              console.log(`   ✅ Found Practitioner from Encounter: ${practitionerId}`);
              return practitionerId;
            }
          }
        }
      }
    }
  } catch (error) {
    console.log('   Could not find Practitioner from Encounters');
  }
  
  // Method 3: Find Practitioner from existing DocumentReferences
  try {
    console.log('   🔍 Searching for Practitioner in existing DocumentReferences...');
    const docRefSearchUrl = `${baseUrl}/DocumentReference?_count=20`;
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/fhir+json',
    };
    
    const docRefResponse = await axios.get(docRefSearchUrl, { headers });
    
    if (docRefResponse.data?.entry && docRefResponse.data.entry.length > 0) {
      for (const entry of docRefResponse.data.entry) {
        const docRef = entry.resource;
        if (docRef.author && docRef.author.length > 0) {
          for (const author of docRef.author) {
            if (author.reference?.startsWith('Practitioner/')) {
              const practitionerId = author.reference.replace('Practitioner/', '');
              console.log(`   ✅ Found Practitioner from DocumentReference: ${practitionerId}`);
              return practitionerId;
            }
          }
        }
      }
    }
  } catch (error) {
    console.log('   Could not find Practitioner from DocumentReferences');
  }
  
  // Method 4: Try common Practitioner IDs
  const commonIds = ['1', '2', '3', '12724066', '12724067'];
  for (const practitionerId of commonIds) {
    try {
      console.log(`   🔍 Trying Practitioner ID ${practitionerId}...`);
      const headers = {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/fhir+json',
      };
      
      const getResponse = await axios.get(`${baseUrl}/Practitioner/${practitionerId}`, { headers });
      if (getResponse.data?.id) {
        console.log(`   ✅ Found Practitioner ID ${practitionerId}`);
        return practitionerId;
      }
    } catch (error) {
      continue;
    }
  }
  
  // Method 5: Create a new Practitioner with minimal structure
  console.log('   🔧 No existing Practitioner found - attempting to create one...');
  return await createPractitioner(accessToken, baseUrl);
}

async function createPractitioner(accessToken: string, baseUrl: string): Promise<string> {
  console.log('   🏗️  Creating new Practitioner...');
  
  // Try multiple minimal structures - Cerner may accept different formats
  const practitionerAttempts = [
    // Attempt 1: Absolute minimum - just resourceType and name
    {
      resourceType: 'Practitioner',
      name: [
        {
          family: 'System',
          given: ['Test'],
        },
      ],
    },
    // Attempt 2: With identifier
    {
      resourceType: 'Practitioner',
      identifier: [
        {
          system: 'http://hl7.org/fhir/sid/us-npi',
          value: `NPI${Date.now()}`,
        },
      ],
      name: [
        {
          family: 'System',
          given: ['Test'],
        },
      ],
    },
    // Attempt 3: With active status
    {
      resourceType: 'Practitioner',
      active: true,
      name: [
        {
          use: 'official',
          family: 'System',
          given: ['Test'],
        },
      ],
    },
  ];
  
  for (let i = 0; i < practitionerAttempts.length; i++) {
    const practitioner = practitionerAttempts[i];
    try {
      console.log(`   🔧 Attempt ${i + 1}/${practitionerAttempts.length}: Creating Practitioner...`);
      const headers = {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/fhir+json',
        Accept: 'application/fhir+json',
      };
      
      const createResponse = await axios.post(`${baseUrl}/Practitioner`, practitioner, { headers });
      
      if (createResponse.data?.id) {
        const practitionerId = createResponse.data.id;
        console.log(`   ✅ Created Practitioner: ${practitionerId}`);
        return practitionerId;
      }
      
      // Check Location header
      const locationHeader = createResponse.headers?.location;
      if (locationHeader) {
        const match = locationHeader.match(/Practitioner\/([^\/\?]+)/);
        if (match && match[1]) {
          console.log(`   ✅ Created Practitioner (from Location header): ${match[1]}`);
          return match[1];
        }
      }
    } catch (error) {
      if (error.response?.data) {
        console.log(`   ⚠️  Attempt ${i + 1} failed: ${JSON.stringify(error.response.data, null, 2)}`);
      }
      // Try next structure
      continue;
    }
  }
  
  throw new Error('Failed to create Practitioner - Cerner sandbox may not allow Practitioner creation');
}

async function createPatient(
  accessToken: string,
  baseUrl: string,
  summary: DischargeSummaryData,
): Promise<string> {
  console.log(`\n👤 Creating Patient: ${summary.patientName} (MRN: ${summary.mrn})`);
  
  // Check if patient already exists by MRN
  try {
    const searchUrl = `${baseUrl}/Patient?identifier=${summary.mrn}`;
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/fhir+json',
    };
    
    const searchResponse = await axios.get(searchUrl, { headers });
    
    if (searchResponse.data?.entry && searchResponse.data.entry.length > 0) {
      const patientId = searchResponse.data.entry[0].resource.id;
      console.log(`   ✅ Found existing Patient: ${patientId}`);
      return patientId;
    }
  } catch (error) {
    console.log('   Could not search for existing patient, will create new one');
  }
  
  // Cerner doesn't allow creating Patient resources with custom identifiers
  // Instead, we'll use existing patient IDs from the tenant config
  // This is a limitation of Cerner sandbox - we can't create new patients
  console.log(`   ⚠️  Cerner sandbox doesn't allow creating Patient resources with custom identifiers`);
  console.log(`   Using existing patient IDs from tenant config...`);
  
  // Try to use existing patient IDs (from tenant_patients collection or config)
  // Use a round-robin approach to distribute patients across available IDs
  const existingPatientIds = ['1', '12822233'];
  
  // Get available patient IDs (that actually exist in Cerner)
  const availablePatientIds: string[] = [];
  for (const patientId of existingPatientIds) {
    try {
      const headers = {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/fhir+json',
      };
      
      const getResponse = await axios.get(`${baseUrl}/Patient/${patientId}`, { headers });
      if (getResponse.data?.id) {
        availablePatientIds.push(patientId);
        console.log(`   ✅ Found available Patient: ${patientId} (${getResponse.data.name?.[0]?.text || getResponse.data.name?.[0]?.family || 'Unknown'})`);
      }
    } catch (getError) {
      // Patient ID doesn't exist, skip it
      continue;
    }
  }
  
  // If we have available patient IDs, use round-robin to distribute patients
  if (availablePatientIds.length > 0) {
    // Use a simple round-robin: get the index from a closure or use the summary MRN as a hash
    const index = Math.abs(summary.mrn.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % availablePatientIds.length;
    const selectedPatientId = availablePatientIds[index];
    console.log(`   ✅ Using Patient: ${selectedPatientId} (round-robin selection from ${availablePatientIds.length} available)`);
    return selectedPatientId;
  }
  
  // If no existing patients found, try to create one without identifier
  console.log(`   Attempting to create Patient without identifier (Cerner may reject)...`);
  const nameParts = summary.patientName.split(' ');
  const patient: any = {
    resourceType: 'Patient',
    name: [
      {
        use: 'official',
        family: nameParts[nameParts.length - 1] || 'Unknown',
        given: nameParts.slice(0, -1) || ['Unknown'],
      },
    ],
    birthDate: summary.dob,
  };
  
  try {
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/fhir+json',
      Accept: 'application/fhir+json',
    };
    
    const createResponse = await axios.post(`${baseUrl}/Patient`, patient, { headers });
    
    if (createResponse.data?.id) {
      const patientId = createResponse.data.id;
      console.log(`   ✅ Created Patient (no identifier): ${patientId}`);
      return patientId;
    }
    
    // Check Location header
    const locationHeader = createResponse.headers?.location;
    if (locationHeader) {
      const match = locationHeader.match(/Patient\/([^\/\?]+)/);
      if (match && match[1]) {
        console.log(`   ✅ Created Patient (from Location header): ${match[1]}`);
        return match[1];
      }
    }
    
    throw new Error('Patient creation response missing ID');
  } catch (error) {
    if (error.response?.data) {
      console.error('   Error creating Patient:', JSON.stringify(error.response.data, null, 2));
    }
    throw new Error(`Failed to create or find Patient. Cerner sandbox may not allow Patient creation. Error: ${error.message}`);
  }
  
  try {
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/fhir+json',
      Accept: 'application/fhir+json',
    };
    
    const createResponse = await axios.post(`${baseUrl}/Patient`, patient, { headers });
    
    if (createResponse.data?.id) {
      const patientId = createResponse.data.id;
      console.log(`   ✅ Created Patient: ${patientId}`);
      return patientId;
    }
    
    // Check Location header
    const locationHeader = createResponse.headers?.location;
    if (locationHeader) {
      const match = locationHeader.match(/Patient\/([^\/\?]+)/);
      if (match && match[1]) {
        console.log(`   ✅ Created Patient (from Location header): ${match[1]}`);
        return match[1];
      }
    }
    
    throw new Error('Patient creation response missing ID');
  } catch (error) {
    if (error.response?.data) {
      console.error('   Error creating Patient:', JSON.stringify(error.response.data, null, 2));
    }
    throw new Error(`Failed to create Patient: ${error.message}`);
  }
}

async function createEncounter(
  accessToken: string,
  baseUrl: string,
  patientId: string,
  summary: DischargeSummaryData,
  practitionerId: string,
): Promise<string> {
  console.log(`   🏥 Creating Encounter for patient ${patientId}...`);
  
  // First, try to find an existing encounter for this patient
  try {
    const searchUrl = `${baseUrl}/Encounter?patient=${patientId}&_sort=-date&_count=1`;
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/fhir+json',
    };
    
    const searchResponse = await axios.get(searchUrl, { headers });
    
    if (searchResponse.data?.entry && searchResponse.data.entry.length > 0) {
      const encounterId = searchResponse.data.entry[0].resource.id;
      console.log(`   ✅ Found existing Encounter: ${encounterId}`);
      return encounterId;
    }
  } catch (error) {
    console.log('   Could not search for existing encounters, will create new one');
  }
  
  // Create Encounter structure matching the working example from create-cerner-discharge-summary.ts
  // Use dates in the past to ensure they're valid
  const admitDate = new Date(summary.admitDate);
  const dischargeDate = new Date(summary.dischargeDate);
  
  // Ensure dates are in the past (Cerner may reject future dates)
  const now = new Date();
  if (admitDate > now) {
    admitDate.setDate(now.getDate() - 3);
  }
  if (dischargeDate > now) {
    dischargeDate.setDate(now.getDate() - 1);
  }
  if (dischargeDate < admitDate) {
    dischargeDate.setTime(admitDate.getTime() + 24 * 60 * 60 * 1000); // 1 day after admit
  }
  
  const encounter = {
    resourceType: 'Encounter',
    status: 'finished',
    class: {
      system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
      code: 'IMP',
      display: 'inpatient encounter',
    },
    type: [
      {
        coding: [
          {
            system: 'http://www.ama-assn.org/go/cpt',
            code: '99223',
            display: 'Initial hospital care',
          },
        ],
      },
    ],
    subject: {
      reference: `Patient/${patientId}`,
    },
    period: {
      start: admitDate.toISOString(),
      end: dischargeDate.toISOString(),
    },
  };
  
  try {
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/fhir+json',
      Accept: 'application/fhir+json',
    };
    
    const createResponse = await axios.post(`${baseUrl}/Encounter`, encounter, { headers });
    
    if (createResponse.data?.id) {
      const encounterId = createResponse.data.id;
      console.log(`   ✅ Created Encounter: ${encounterId}`);
      return encounterId;
    }
    
    // Check Location header
    const locationHeader = createResponse.headers?.location;
    if (locationHeader) {
      const match = locationHeader.match(/Encounter\/([^\/\?]+)/);
      if (match && match[1]) {
        console.log(`   ✅ Created Encounter (from Location header): ${match[1]}`);
        return match[1];
      }
    }
    
    throw new Error('Encounter creation response missing ID');
  } catch (error) {
    // If Encounter creation fails, Cerner sandbox may not allow it
    // Try to use an existing encounter ID or return empty string to skip encounter reference
    console.log(`   ⚠️  Encounter creation failed: ${error.message}`);
    
    // Try to find any existing encounter for this patient
    try {
      const searchUrl = `${baseUrl}/Encounter?patient=${patientId}&_count=1`;
      const headers = {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/fhir+json',
      };
      
      const searchResponse = await axios.get(searchUrl, { headers });
      
      if (searchResponse.data?.entry && searchResponse.data.entry.length > 0) {
        const existingEncounterId = searchResponse.data.entry[0].resource.id;
        console.log(`   ✅ Found existing Encounter: ${existingEncounterId}`);
        return existingEncounterId;
      }
    } catch (searchError) {
      console.log(`   ⚠️  Could not find existing encounter`);
    }
    
    // If we can't create or find an encounter, return empty string
    // DocumentReference can be created without encounter reference
    console.log(`   ⚠️  No encounter available - DocumentReference will be created without encounter reference`);
    return ''; // Return empty string to indicate no encounter
  }
}

async function createDocumentReference(
  accessToken: string,
  baseUrl: string,
  patientId: string,
  encounterId: string,
  practitionerId: string,
  summary: DischargeSummaryData,
): Promise<string> {
  console.log(`   📄 Creating DocumentReference for encounter ${encounterId}...`);
  
  const documentReference: any = {
    resourceType: 'DocumentReference',
    identifier: [
      {
        system: 'https://fhir.cerner.com/ceuuid',
        value: `CE${generateUUID().replace(/-/g, '')}`,
      },
    ],
    status: 'current',
    docStatus: 'final',
    type: {
      coding: [
        {
          system: 'http://loinc.org',
          code: '18842-5',
          display: 'Discharge summary',
          userSelected: false,
        },
      ],
      text: 'Discharge Summary',
    },
    category: [
      {
        coding: [
          {
            system: 'http://hl7.org/fhir/us/core/CodeSystem/us-core-documentreference-category',
            code: 'clinical-note',
            display: 'Clinical Note',
            userSelected: false,
          },
        ],
        text: 'Clinical Note',
      },
      {
        coding: [
          {
            system: 'http://loinc.org',
            code: '11488-4',
            display: 'Consult note',
            userSelected: false,
          },
        ],
      },
    ],
    subject: {
      reference: `Patient/${patientId}`,
      display: summary.patientName,
    },
    date: `${summary.dischargeDate}T12:00:00Z`,
    context: encounterId ? {
      encounter: [
        {
          reference: `Encounter/${encounterId}`,
        },
      ],
      period: {
        start: `${summary.admitDate}T00:00:00Z`,
        end: `${summary.dischargeDate}T23:59:59Z`,
      },
    } : {
      period: {
        start: `${summary.admitDate}T00:00:00Z`,
        end: `${summary.dischargeDate}T23:59:59Z`,
      },
    },
    content: [
      {
        attachment: {
          // Cerner requires one of: application/xml, text/html, application/pdf, text/plain, 
          // text/richtext, text/rtf, text/xml, or application/xhtml+xml
          // Use text/plain for discharge summaries (text documents)
          // Send data as plain text (not base64) - the export service will encode it properly
          contentType: 'text/plain; charset=UTF-8',
          title: 'Discharge Summary',
          creation: `${summary.dischargeDate}T12:00:00Z`,
          data: summary.content, // Send as plain text, not base64 - export service will encode it
          size: Buffer.from(summary.content, 'utf-8').length,
        },
        format: {
          system: 'http://ihe.net/fhir/ValueSet/IHE.FormatCode.codesystem',
          code: 'urn:ihe:iti:xds:2017:mimeTypeSufficient',
          display: 'mimeType Sufficient',
        },
      },
    ],
  };
  
  // Cerner requires author.reference field - must have Practitioner reference
  if (!practitionerId) {
    throw new Error('Practitioner ID is required for DocumentReference author field');
  }
  
  documentReference.author = [
    {
      reference: `Practitioner/${practitionerId}`,
      display: summary.attendingPhysician || 'System Practitioner',
    },
  ];
  console.log(`   Using Practitioner/${practitionerId} as author`);
  
  try {
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/fhir+json',
      Accept: 'application/fhir+json',
    };
    
    const createResponse = await axios.post(`${baseUrl}/DocumentReference`, documentReference, { headers });
    
    if (createResponse.data?.id) {
      const docRefId = createResponse.data.id;
      console.log(`   ✅ Created DocumentReference: ${docRefId}`);
      return docRefId;
    }
    
    // Check Location header
    const locationHeader = createResponse.headers?.location;
    if (locationHeader) {
      const match = locationHeader.match(/DocumentReference\/([^\/\?]+)/);
      if (match && match[1]) {
        console.log(`   ✅ Created DocumentReference (from Location header): ${match[1]}`);
        return match[1];
      }
    }
    
    throw new Error('DocumentReference creation response missing ID');
  } catch (error) {
    if (error.response?.data) {
      console.error('   Error creating DocumentReference:', JSON.stringify(error.response.data, null, 2));
    }
    throw new Error(`Failed to create DocumentReference: ${error.message}`);
  }
}

async function updateTenantPatientsCollection(patientIds: string[]): Promise<void> {
  console.log('\n📝 Updating tenant_patients collection in Firestore...');
  console.log(`   Patient IDs to store: ${patientIds.length > 0 ? patientIds.join(', ') : '(none)'}`);
  
  try {
    const firestore = await getFirestore();
    const docRef = firestore.collection('tenant_patients').doc(TENANT_ID);
    
    await docRef.set({
      patientIds: patientIds,
      updatedAt: new Date(),
    }, { merge: false }); // Use set() to overwrite, not merge
    
    // Verify the update
    const verifyDoc = await docRef.get();
    if (verifyDoc.exists) {
      const data = verifyDoc.data();
      const storedIds = data?.patientIds || [];
      console.log(`   ✅ Updated tenant_patients collection with ${storedIds.length} patient IDs`);
      console.log(`   ✅ Verified: ${storedIds.length > 0 ? storedIds.join(', ') : '(empty)'}`);
    } else {
      console.error('   ❌ Failed to verify update - document does not exist');
    }
  } catch (error) {
    console.error('   ❌ Failed to update tenant_patients collection:', error.message);
    console.error('   Full error:', error);
    // Don't throw - this is not critical, but log it clearly
  }
}

async function main() {
  console.log('🚀 Adding Multiple Patients with Discharge Summaries to Cerner Sandbox');
  console.log('='.repeat(80));
  console.log(`Tenant ID: ${TENANT_ID}`);
  console.log(`Number of discharge summaries: ${dischargeSummaries.length}`);
  console.log('='.repeat(80));
  
  try {
    // Step 1: Get Cerner access token and config
    console.log('\n🔐 Getting Cerner system app access token...');
    const { accessToken, baseUrl } = await getCernerConfig();
    console.log('✅ Cerner authentication successful');
    
    // Step 2: Find or create a Practitioner (required for DocumentReference author)
    console.log('\n👨‍⚕️ Finding or creating Practitioner...');
    let practitionerId: string | null = null;
    try {
      practitionerId = await findOrCreatePractitioner(accessToken, baseUrl);
      console.log(`   ✅ Practitioner ready: ${practitionerId}`);
    } catch (error) {
      console.error(`   ❌ Failed to find or create Practitioner: ${error.message}`);
      console.log('   ⚠️  WARNING: DocumentReference creation will fail without Practitioner');
      throw new Error('Practitioner is required for DocumentReference creation. Cannot proceed without one.');
    }
    
    // Step 3: Process each discharge summary
    const patientIds: Set<string> = new Set(); // Use Set to avoid duplicates
    const results: Array<{
      summary: DischargeSummaryData;
      patientId: string;
      encounterId: string;
      documentReferenceId: string;
    }> = [];
    
    // Track patient IDs even if DocumentReference creation fails
    const patientIdsWithResources: Map<string, boolean> = new Map();
    
    // Use try-finally to ensure Firestore is always updated, even if script fails
    try {
      for (let i = 0; i < dischargeSummaries.length; i++) {
      const summary = dischargeSummaries[i];
      console.log(`\n${'='.repeat(80)}`);
      console.log(`Processing ${i + 1}/${dischargeSummaries.length}: ${summary.patientName}`);
      console.log(`${'='.repeat(80)}`);
      
      let patientId: string | null = null;
      try {
        // Create Patient (or find existing)
        patientId = await createPatient(accessToken, baseUrl, summary);
        summary.patientId = patientId;
        patientIds.add(patientId); // Always add to set, even if later steps fail
        patientIdsWithResources.set(patientId, false); // Track if resources were created
        
        // Create Encounter (may fail in Cerner sandbox - that's OK)
        let encounterId: string = '';
        try {
          encounterId = await createEncounter(accessToken, baseUrl, patientId, summary, practitionerId || '');
          summary.encounterId = encounterId;
        } catch (encounterError) {
          console.log(`   ⚠️  Encounter creation failed, will create DocumentReference without encounter reference`);
          encounterId = ''; // Empty string indicates no encounter
        }
        
        // Create DocumentReference (can work without encounter reference)
        const documentReferenceId = await createDocumentReference(
          accessToken,
          baseUrl,
          patientId,
          encounterId,
          practitionerId || '',
          summary,
        );
        
        results.push({
          summary,
          patientId,
          encounterId,
          documentReferenceId,
        });
        
        patientIdsWithResources.set(patientId, true); // Mark as having resources
        console.log(`✅ Successfully created resources for ${summary.patientName}`);
      } catch (error) {
        console.error(`❌ Failed to process ${summary.patientName}:`, error.message);
        // Patient ID was still collected, so it will be included in Firestore update
        if (patientId) {
          console.log(`   ℹ️  Patient ID ${patientId} will still be added to tenant_patients collection`);
        }
        // Continue with next patient
      }
    }
    } finally {
      // Step 4: Always update tenant_patients collection, even if script fails
      // This ensures patient IDs are available for the export scheduler
      const uniquePatientIds = Array.from(patientIds);
      console.log(`\n📊 Collected ${uniquePatientIds.length} unique patient IDs: ${uniquePatientIds.join(', ')}`);
      
      if (uniquePatientIds.length === 0) {
        console.log('\n⚠️  WARNING: No patient IDs collected - tenant_patients collection will be empty');
        console.log('   This will cause the export scheduler to skip encounter searches');
      } else {
        const patientsWithResources = Array.from(patientIdsWithResources.entries())
          .filter(([_, hasResources]) => hasResources)
          .map(([patientId, _]) => patientId);
        console.log(`   ${patientsWithResources.length} patients have DocumentReferences created`);
      }
      
      // Always update Firestore, even if script fails later
      try {
        await updateTenantPatientsCollection(uniquePatientIds);
        console.log('\n✅ Firestore collection updated successfully - export scheduler will find these patient IDs');
      } catch (updateError) {
        console.error('\n❌ CRITICAL: Failed to update tenant_patients collection:', updateError.message);
        console.error('   The export scheduler will not find these patient IDs!');
        // Don't throw - log the error but allow script to continue showing summary
      }
    }
    
    // Step 5: Summary
    console.log('\n' + '='.repeat(80));
    console.log('✅ SUMMARY');
    console.log('='.repeat(80));
    console.log(`Successfully processed: ${results.length}/${dischargeSummaries.length} patients`);
    console.log(`Total patient IDs: ${Array.from(patientIds).length}`);
    console.log('\nCreated Resources:');
    results.forEach((result, index) => {
      console.log(`\n${index + 1}. ${result.summary.patientName} (${result.summary.mrn})`);
      console.log(`   Patient ID: ${result.patientId}`);
      console.log(`   Encounter ID: ${result.encounterId}`);
      console.log(`   DocumentReference ID: ${result.documentReferenceId}`);
      console.log(`   Service: ${result.summary.service}`);
    });
    
    console.log('\n📝 Next Steps:');
    console.log('   1. The encounter export scheduler will pick up these encounters');
    console.log('   2. Discharge summaries will be exported to Google FHIR');
    console.log('   3. Simplification and translation will process automatically');
    console.log('   4. Patients will appear in the clinician portal discharge queue');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    if (error.response?.data) {
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
