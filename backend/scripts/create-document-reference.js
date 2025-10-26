const fs = require('fs');
const path = require('path');

// Read the discharge_instructions.txt file
const filePath = path.join(__dirname, 'discharge_instructions.txt');
const fileContent = fs.readFileSync(filePath, 'utf8');

// Convert to base64
const base64Content = Buffer.from(fileContent, 'utf8').toString('base64');

// Create the DocumentReference payload
const documentReference = {
  "resourceType": "DocumentReference",
  "identifier": [
    {
      "system": "https://fhir.cerner.com/ceuuid",
      "value": "CE87caf4b7-9397-4667-707e-218-2sd02ad12asdsd0sdf"
    }
  ],
  "status": "current",
  "docStatus": "final",
  "type": {
    "coding": [
      {
        "system": "http://loinc.org",
        "code": "11488-4",
        "display": "Consult note",
        "userSelected": false
      }
    ],
    "text": "Consultation Note Generic"
  },
  "category": [
    {
      "coding": [
        {
          "system": "http://hl7.org/fhir/us/core/CodeSystem/us-core-documentreference-category",
          "code": "clinical-note",
          "display": "Clinical Note",
          "userSelected": false
        }
      ],
      "text": "Clinical Note"
    },
    {
      "coding": [
        {
          "system": "http://loinc.org",
          "code": "11488-4",
          "display": "Consult note",
          "userSelected": false
        }
      ]
    }
  ],
  "subject": {
    "reference": "Patient/1",
    "display": "Harry, Potter"
  },
  "date": "2025-07-28T12:01:11Z",
  "author": [
    {
      "reference": "Practitioner/1",
      "display": "SYSTEM, SYSTEM Cerner"
    }
  ],
  "authenticator": {
    "reference": "Practitioner/1",
    "display": "SYSTEM, SYSTEM Cerner"
  },
  "custodian": {
    "reference": "Organization/685844",
    "display": "Model Clinic 1"
  },
  "content": [
    {
      "attachment": {
        "contentType": "text/plain",
        "title": "Discharge Summary",
        "creation": "2025-07-28T12:01:10.000Z",
        "data": base64Content
      },
      "format": {
        "system": "http://ihe.net/fhir/ValueSet/IHE.FormatCode.codesystem",
        "code": "urn:ihe:iti:xds:2017:mimeTypeSufficient",
        "display": "mimeType Sufficient"
      }
    }
  ],
  "context": {
    "encounter": [
      {
        "reference": "Encounter/97958647"
      }
    ],
    "period": {
      "start": "2025-07-28T12:01:10Z",
      "end": "2025-07-28T12:01:10Z"
    }
  }
};

// Output the complete payload
console.log('=== DocumentReference Payload ===');
console.log(JSON.stringify(documentReference, null, 2));

// Output base64 content info
console.log('\n=== Base64 Content Info ===');
console.log(`Original file size: ${fileContent.length} characters`);
console.log(`Base64 size: ${base64Content.length} characters`);
console.log(`Base64 content (first 100 chars): ${base64Content.substring(0, 100)}...`);

// Save to file for easy testing
const outputPath = path.join(__dirname, 'document-reference-payload.json');
fs.writeFileSync(outputPath, JSON.stringify(documentReference, null, 2));
console.log(`\n=== Payload saved to: ${outputPath} ===`);

// Create curl command
const curlCommand = `curl -X POST "http://localhost:3000/cerner/document-reference" \\
  -H "Content-Type: application/json" \\
  -H "X-Tenant-ID: default" \\
  -d @${outputPath}`;

console.log('\n=== Curl Command ===');
console.log(curlCommand);
