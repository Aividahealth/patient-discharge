const fs = require('fs');
const path = require('path');

// Generate 4 different versions
for (let i = 1; i <= 4; i++) {
  console.log(`\n=== Generating Version ${i} ===`);
  
  // Read the discharge_instructions file for this version
  const instructionsPath = path.join(__dirname, `discharge_instructions-${i}.txt`);
  const instructionsContent = fs.readFileSync(instructionsPath, 'utf8');
  
  // Read the discharge_summaries file for this version
  const summariesPath = path.join(__dirname, `discharge-summaries-${i}.txt`);
  const summariesContent = fs.readFileSync(summariesPath, 'utf8');

  // Convert to base64
  const instructionsBase64 = Buffer.from(instructionsContent, 'utf8').toString('base64');
  const summariesBase64 = Buffer.from(summariesContent, 'utf8').toString('base64');

  // Create DocumentReference for Discharge Instructions
  const instructionsDocumentReference = {
    "resourceType": "DocumentReference",
    "identifier": [
      {
        "system": "https://fhir.cerner.com/ceuuid",
        "value": `CE87caf4b7-9397-4667-707e-218-2sd02ad12asdsd0sdf-${i}`
      }
    ],
    "status": "current",
    "docStatus": "final",
    "type": {
      "coding": [
        {
          "system": "http://loinc.org",
          "code": "74213-0",
          "display": "Discharge instructions",
          "userSelected": false
        }
      ],
      "text": "Discharge Instructions"
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
          "title": "Discharge Instructions",
          "creation": "2025-07-28T12:01:10.000Z",
          "data": instructionsBase64
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

  // Create DocumentReference for Discharge Summary
  const summariesDocumentReference = {
    "resourceType": "DocumentReference",
    "identifier": [
      {
        "system": "https://fhir.cerner.com/ceuuid",
        "value": `CE87caf4b7-9397-4667-707e-218-2sd02ad12asdsd0sdf-summary-${i}`
      }
    ],
    "status": "current",
    "docStatus": "final",
    "type": {
      "coding": [
        {
          "system": "http://loinc.org",
          "code": "18842-5",
          "display": "Discharge summary",
          "userSelected": false
        }
      ],
      "text": "Discharge Summary"
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
          "data": summariesBase64
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

  // Save both payloads
  const instructionsOutputPath = path.join(__dirname, `document-reference-instructions-${i}.json`);
  const summariesOutputPath = path.join(__dirname, `document-reference-summaries-${i}.json`);
  
  fs.writeFileSync(instructionsOutputPath, JSON.stringify(instructionsDocumentReference, null, 2));
  fs.writeFileSync(summariesOutputPath, JSON.stringify(summariesDocumentReference, null, 2));

  console.log(`✅ Generated Discharge Instructions payload: ${instructionsOutputPath}`);
  console.log(`✅ Generated Discharge Summary payload: ${summariesOutputPath}`);

  // Create curl commands
  const instructionsCurl = `curl -X POST "http://localhost:3000/cerner/document-reference" \\
  -H "Content-Type: application/json" \\
  -H "X-Tenant-ID: default" \\
  -d @${instructionsOutputPath}`;

  const summariesCurl = `curl -X POST "http://localhost:3000/cerner/document-reference" \\
  -H "Content-Type: application/json" \\
  -H "X-Tenant-ID: default" \\
  -d @${summariesOutputPath}`;

  console.log(`\n📋 Curl Commands for Version ${i}:`);
  console.log(`\nDischarge Instructions:`);
  console.log(instructionsCurl);
  console.log(`\nDischarge Summary:`);
  console.log(summariesCurl);
}

console.log(`\n🎉 Generated 4 versions of both Discharge Instructions and Discharge Summaries!`);