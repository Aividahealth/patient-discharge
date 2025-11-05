4.1 Authentication APIs

 POST /api/auth/login

  Simple password-based login for any user

  Request:
  {
    "tenantId": "demo",
    "username": "patient",
    "password": "Adyar2Austin"
  }

  Response (Success - 200):
  {
    "success": true,
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 86400,
    "user": {
      "id": "user-demo-patient",
      "tenantId": "demo",
      "username": "patient",
      "name": "John Smith",
      "role": "patient",
      "linkedPatientId": "patient-demo-001"
    },
    "tenant": {
      "id": "demo",
      "name": "Demo Hospital",
      "branding": {
        "logo": "https://storage.googleapis.com/logos/demo.png",
        "primaryColor": "#3b82f6",
        "secondaryColor": "#60a5fa"
      }
    }
  }


4.2 Tenant Configuration APIs

  GET /api/config

  Get tenant configuration and branding for the tenant specified in X-Tenant-ID header

  Request Headers:
  Authorization: Bearer <token>
  X-Tenant-ID: demo

  Response (200):
  {
    "success": true,
    "tenant": {
      "id": "demo",
      "name": "Demo Hospital",
      "status": "active",
      "type": "demo",

      "branding": {
        "logo": "https://storage.googleapis.com/aivida-assets/logos/demo.png",
        "favicon": "https://storage.googleapis.com/aivida-assets/favicons/demo.ico",
        "primaryColor": "#3b82f6",
        "secondaryColor": "#60a5fa",
        "accentColor": "#1e40af"
      },

      "features": {
        "aiGeneration": true,
        "multiLanguage": true,
        "supportedLanguages": ["en", "es", "hi", "vi", "fr"],
        "fileUpload": true,
        "expertPortal": true,
        "clinicianPortal": true,
        "adminPortal": true
      },

      "config": {
        "simplificationEnabled": true,
        "translationEnabled": true,
        "defaultLanguage": "en"
      }
    }
  }

  Response (Error - 404):
  {
    "success": false,
    "error": "Tenant not found"
  }

  GET http://localhost:3000/google/fhir/Composition/22036570-3dc8-4f2f-bf03-43b561af09b9/binaries

header name: X-Tenant-ID schema: { type: string } 
Response:
{
    "success": true,
    "compositionId": "bc78e867-19ab-449c-8bda-bd4281b23c71",
    "dischargeSummaries": [
        {
            "id": "9b213b27-c77e-4820-ad14-ac1aff798a2f",
            "contentType": "text/plain",
            "size": 0,
            "text": "Simplified doc text…",
            "category": "discharge-summary",
            "tags": [
                {
                    "code": "discharge-summary",
                    "display": "Discharge Summary",
                    "system": "http://aivida.com/fhir/tags"
                },
                {
                    "code": "simplified-content",
                    "display": "Simplified Content",
                    "system": "http://aivida.com/fhir/tags"
                }
            ]
        }
    ],
    "dischargeInstructions": [
        {
            "id": "c74db8d3-014d-4681-898f-67a7e8f78b42",
            "contentType": "text/plain",
            "size": 0,
            "text": "Simplified discharge instructions text...",
            "category": "discharge-instructions",
            "tags": [
                {
                    "code": "discharge-instructions",
                    "display": "Discharge Instructions",
                    "system": "http://aivida.com/fhir/tags"
                }
            ]
        }
    ],
    "totalBinaries": 5,
    "processedBinaries": 2,
    "timestamp": "2025-11-02T02:34:55.061Z",
    "tenantId": "default"
}

