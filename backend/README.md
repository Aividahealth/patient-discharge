# Patient Discharge Backend

A NestJS backend server that provides FHIR CRUD operations for both Google Cloud Healthcare and Cerner EHR systems.

## Features

- **Google Cloud Healthcare FHIR Store Integration**
  - Generic CRUD operations for all FHIR resource types
  - Automatic token caching and refresh
  - Configurable resource type restrictions

- **Cerner EHR Integration**
  - Generic CRUD operations for FHIR resources
  - Automatic token caching and refresh
  - Discharge summary creation
  - Comprehensive scope support

- **Configuration Management**
  - YAML-based configuration
  - Environment-specific settings
  - Secure credential management

## Prerequisites

- Node.js 18+ 
- npm or yarn
- Google Cloud service account (for FHIR store)
- Cerner API credentials

## Installation

```bash
# Install dependencies
npm install

# Copy and configure settings
cp .settings.dev/config.yaml.example .settings.dev/config.yaml
# Edit .settings.dev/config.yaml with your credentials

# Place your Google service account JSON
# .settings.dev/fhir_store_sa.json
```

## Configuration

Edit `.settings.dev/config.yaml`:

```yaml
# Google Cloud Healthcare FHIR Store
service_account_path: /path/to/your/service-account.json
fhir_base_url: "https://healthcare.googleapis.com/v1/projects/PROJECT/locations/LOCATION/datasets/DATASET/fhirStores/STORE/fhir"

# Cerner EHR
cerner:
  base_url: "https://fhir-ehr-code.cerner.com/r4/TENANT_ID"
  client_id: "your-client-id"
  client_secret: "your-client-secret"
  token_url: "https://authorization.cerner.com/tenants/TENANT_ID/hosts/fhir-ehr-code.cerner.com/protocols/oauth2/profiles/smart-v1/token"
  scopes: "system/Patient.read system/Patient.write ..."

# Resource type restrictions (use ["*"] for all)
resource_types:
  - "*"
```

## Running the Application

```bash
# Development
npm run start:dev

# Production
npm run build
npm run start:prod
```

The server will start on `http://localhost:3000` by default.

## API Endpoints

### Google Cloud Healthcare FHIR Store

All endpoints are prefixed with `/google/fhir/`

#### Generic CRUD Operations

```bash
# Create resource
POST /google/fhir/{resourceType}
Content-Type: application/fhir+json
{
  "resourceType": "Patient",
  "name": [{"family": "Smith", "given": ["John"]}]
}

# Read resource
GET /google/fhir/{resourceType}/{id}

# Update resource
PUT /google/fhir/{resourceType}/{id}
Content-Type: application/fhir+json
{
  "resourceType": "Patient",
  "id": "123",
  "active": true
}

# Delete resource
DELETE /google/fhir/{resourceType}/{id}

# Search resources
GET /google/fhir/{resourceType}?name=Smith&_count=10
```

#### Google Auth Utilities

```bash
# Get access token
GET /google/token

# Impersonate user (placeholder)
POST /google/impersonate/{email}
{
  "scopes": ["https://www.googleapis.com/auth/cloud-platform"]
}
```

### Cerner EHR

All endpoints are prefixed with `/cerner/`

#### Generic CRUD Operations

```bash
# Create resource
POST /cerner/{resourceType}
Content-Type: application/fhir+json

# Read resource
GET /cerner/{resourceType}/{id}

# Update resource
PUT /cerner/{resourceType}/{id}
Content-Type: application/fhir+json

# Delete resource
DELETE /cerner/{resourceType}/{id}

# Search resources
GET /cerner/{resourceType}?name=Smith&_count=10
```

#### Specialized Operations

```bash
# Create discharge summary
POST /cerner/discharge-summary
Content-Type: application/json
{
  "patientId": "123",
  "encounterId": "456",
  "summaryData": {
    "patient_name": "John Smith",
    "mrn": "MRN123",
    "admission_date": "2024-01-01",
    "discharge_date": "2024-01-05",
    "chief_complaint": "Chest pain",
    "hospital_course": "Patient admitted for evaluation",
    "discharge_diagnosis": "Acute myocardial infarction",
    "author": "Dr. Smith"
  }
}

# Test token reuse
GET /cerner/test/token-reuse

# Search discharge summaries for a patient
GET /cerner/discharge-summaries/{patientId}

# Fetch binary document content
GET /cerner/binary/{binaryId}?accept=application/pdf

# Parse DocumentReference structure
POST /cerner/parse-document-reference
Content-Type: application/json
{
  "resourceType": "DocumentReference",
  "id": "123",
  "status": "current",
  "type": {
    "coding": [{
      "system": "http://loinc.org",
      "code": "18842-5",
      "display": "Discharge summary"
    }]
  }
}

# Test complete discharge summary pipeline
GET /cerner/test/discharge-summary-pipeline/{patientId}
```

## Error Handling

The API returns proper HTTP status codes and FHIR OperationOutcome resources for errors:

```json
{
  "statusCode": 400,
  "message": {
    "resourceType": "OperationOutcome",
    "issue": [
      {
        "severity": "error",
        "code": "not-found",
        "details": {
          "text": "Resource not found"
        }
      }
    ]
  },
  "error": "Bad Request"
}
```

## Discharge Summary Pipeline

The backend implements a complete discharge summary processing pipeline:

### 1. Document Discovery
- Searches for DocumentReference with LOINC code `18842-5` (Discharge Summary)
- Falls back to Composition search if no DocumentReference found
- Extracts key metadata (patient ID, encounter ID, authors, dates)

### 2. Document Retrieval
- Fetches Binary resources for PDF/XML content
- Supports multiple content types (application/pdf, application/xml, text/plain)
- Handles both URL-based and inline base64 content

### 3. Document Parsing
- Extracts structured data from DocumentReference
- Identifies content type and size
- Maps FHIR fields to standardized format

### 4. Audit Logging
- Logs all FHIR requests with timestamps and metadata
- Tracks document processing stages
- Records clinician approval actions
- Maintains immutable audit trail

### 5. Acceptance Testing
- Complete pipeline test endpoint
- Validates end-to-end functionality
- Returns structured test results

## Authentication & Token Management

Both Google and Cerner integrations use automatic token caching:

- **Google**: Uses service account credentials with automatic refresh
- **Cerner**: Uses client credentials with 45-minute token expiry and 1-minute refresh buffer

Tokens are automatically refreshed when expired. Check server logs to see token reuse vs refresh:

```
[Nest] INFO [CernerService] Reusing existing Cerner access token
[Nest] INFO [CernerService] Cerner access token expired or missing, fetching new token
```

## Supported FHIR Resource Types

### Google Cloud Healthcare
- All FHIR R4 resource types (configurable via `resource_types` in config)

### Cerner EHR
- Patient, Encounter, Observation, DiagnosticReport
- MedicationRequest, Procedure, Condition, AllergyIntolerance
- Immunization, CarePlan, Goal, ServiceRequest
- Specimen, ImagingStudy, DocumentReference
- Organization, Practitioner, Location

## Development

### Project Structure

```
src/
├── config/           # Configuration management
├── cerner/           # Cerner EHR integration
├── google/           # Google Cloud Healthcare integration
├── app.module.ts     # Main application module
└── main.ts          # Application bootstrap
```

### Adding New Features

1. **New FHIR Resource Support**: Add to Cerner scopes in config.yaml
2. **New Endpoints**: Add to respective controllers
3. **Configuration**: Update DevConfig type and config.yaml

### Testing

```bash
# Run tests
npm run test

# Run e2e tests
npm run test:e2e

# Test coverage
npm run test:cov
```

## Environment Variables

- `PORT`: Server port (default: 3000)
- `SERVICE_ACCOUNT_PATH`: Override service account path

## Security Notes

- Service account JSON files are gitignored
- Configuration files contain sensitive data - keep secure
- Tokens are cached in memory only
- All API calls use HTTPS

## Troubleshooting

### Common Issues

1. **Authentication Errors**
   - Verify service account JSON path
   - Check Cerner credentials in config.yaml
   - Ensure proper scopes are configured

2. **Token Issues**
   - Check server logs for token reuse/refresh messages
   - Verify token expiry settings
   - Test with `/cerner/test/token-reuse` endpoint

3. **FHIR Resource Errors**
   - Check resource type is supported
   - Verify FHIR JSON format
   - Review OperationOutcome error details

### Logs

Enable debug logging by setting log level in your environment or checking the console output for detailed error messages.

## License

[Add your license information here]