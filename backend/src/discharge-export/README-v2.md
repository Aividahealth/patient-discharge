# Discharge Summaries Export V2

## Overview

The V2 export system provides comprehensive encounter data export from Cerner FHIR to Google FHIR Store. Unlike V1 which focuses on individual DocumentReference exports, V2 exports complete encounter bundles including all related resources.

## Architecture

### Key Components

1. **`DischargeSummariesExportService`** - Main service for encounter data export
2. **`EncounterExportScheduler`** - Automated cron job for continuous processing
3. **`DischargeSummariesExportController`** - API endpoints for manual exports
4. **`EncounterExportSchedulerController`** - API endpoints for scheduler management

### Export Flow

```
Patient ID → Recent Encounters → Related Resources → Google FHIR Bundle
```

## Resources Exported

### Primary Resources
- **Encounter** - Main encounter record
- **DocumentReference** - All documents related to the encounter
- **Binary** - PDF/document content from DocumentReferences
- **MedicationRequest** - All medications for the encounter
- **Appointment** - Follow-up appointments

### Resource Relationships
```
Encounter
├── DocumentReference (encounter=encounterId)
│   └── Binary (from DocumentReference.content.attachment.url)
├── MedicationRequest (encounter=encounterId)
└── Appointment (patient=patientId, date>=currentTime)
```

## API Endpoints

### Manual Export
```bash
# Export encounter data for a patient
POST /discharge-summaries-v2/export-encounter-data/{patientId}

# Export via POST body
POST /discharge-summaries-v2/export-encounter-data
{
  "patientId": "123"
}

# Check export status
GET /discharge-summaries-v2/export-status/{patientId}

# Health check
GET /discharge-summaries-v2/health
```

### Scheduler Management
```bash
# Trigger manual encounter export
POST /scheduler/encounter-export/trigger?tenantId=optional

# Trigger for all tenants
POST /scheduler/encounter-export/trigger
```

## Configuration

### Cerner Scopes Required
The system requires comprehensive FHIR scopes for both system and provider apps:

```yaml
system_app:
  scopes: "system/Account.read system/AllergyIntolerance.read system/AllergyIntolerance.write system/Appointment.read system/Appointment.write system/Basic.write system/Binary.read system/CarePlan.read system/CareTeam.read system/ChargeItem.read system/Communication.read system/Communication.write system/Condition.read system/Condition.write system/Consent.read system/Coverage.read system/Device.read system/DiagnosticReport.read system/DiagnosticReport.write system/DocumentReference.read system/DocumentReference.write system/Encounter.read system/Encounter.write system/FamilyMemberHistory.read system/FamilyMemberHistory.write system/FinancialTransaction.write system/Goal.read system/Immunization.read system/Immunization.write system/InsurancePlan.read system/Location.read system/Media.read system/MedicationAdministration.read system/MedicationDispense.read system/MedicationRequest.read system/MedicationRequest.write system/NutritionOrder.read system/Observation.read system/Observation.write system/Organization.read system/Organization.write system/Patient.read system/Patient.write system/Person.read system/Practitioner.read system/Practitioner.write system/Procedure.read system/Procedure.write system/Provenance.read system/Provenance.write system/Questionnaire.read system/QuestionnaireResponse.read system/QuestionnaireResponse.write system/RelatedPerson.read system/RelatedPerson.write system/Schedule.read system/ServiceRequest.read system/Slot.read system/Specimen.read"

provider_app:
  scopes: "launch patient/Account.read patient/AllergyIntolerance.read patient/AllergyIntolerance.write patient/Appointment.read patient/Appointment.write patient/Basic.write patient/Binary.read patient/CarePlan.read patient/CareTeam.read patient/ChargeItem.read patient/Communication.read patient/Communication.write patient/Condition.read patient/Condition.write patient/Consent.read patient/Coverage.read patient/Device.read patient/DiagnosticReport.read patient/DiagnosticReport.write patient/DocumentReference.read patient/DocumentReference.write patient/Encounter.read patient/Encounter.write patient/FamilyMemberHistory.read patient/FamilyMemberHistory.write patient/FinancialTransaction.write patient/Goal.read patient/Immunization.read patient/Immunization.write patient/InsurancePlan.read patient/Location.read patient/Media.read patient/MedicationAdministration.read patient/MedicationDispense.read patient/MedicationRequest.read patient/MedicationRequest.write patient/NutritionOrder.read patient/Observation.read patient/Observation.write patient/Organization.read patient/Organization.write patient/Patient.read patient/Patient.write patient/Person.read patient/Practitioner.read patient/Practitioner.write patient/Procedure.read patient/Procedure.write patient/Provenance.read patient/Provenance.write patient/Questionnaire.read patient/QuestionnaireResponse.read patient/QuestionnaireResponse.write patient/RelatedPerson.read patient/RelatedPerson.write patient/Schedule.read patient/ServiceRequest.read patient/Slot.read patient/Specimen.read"
```

## Automated Processing

### Cron Schedule
- **Frequency**: Every 15 minutes
- **Scope**: All configured tenants and patients
- **Authentication**: System app (fallback to provider app if sessions exist)

### Processing Logic
1. **Tenant Discovery**: Get all tenants from config
2. **Patient Processing**: For each tenant, process all configured patients
3. **Encounter Discovery**: Find recent encounters (last 60 minutes, status=finished)
4. **Duplicate Check**: Verify encounter not already exported
5. **Resource Collection**: Gather all related resources
6. **Bundle Creation**: Create FHIR bundle with proper references
7. **Google FHIR Storage**: Store all resources in Google FHIR
8. **Event Publishing**: Publish success/failure events to Pub/Sub

## Data Transformation

### Cerner to Google FHIR Mapping
- **Patient References**: Updated to use Google FHIR patient IDs
- **Encounter References**: Updated to use new Google FHIR encounter IDs
- **Binary References**: Updated to use new Google FHIR binary IDs
- **Tags**: Added `original-cerner-id` tags for duplicate detection

### Duplicate Prevention
- **Encounter Level**: Check Google FHIR for existing encounter with `_tag: original-cerner-id-{cernerId}`
- **Patient Level**: Reuse existing patient mapping logic
- **Resource Level**: All resources tagged with original Cerner IDs

## Error Handling

### Comprehensive Error Management
- **Authentication Errors**: Graceful fallback between system and provider apps
- **Resource Errors**: Individual resource failures don't stop entire export
- **Network Errors**: Retry logic and detailed error logging
- **Validation Errors**: Data validation before Google FHIR storage

### Audit Trail
- **Export Logging**: Complete audit trail of all exports
- **Resource Tracking**: Track number of resources processed per export
- **Error Logging**: Detailed error information for debugging

## Pub/Sub Integration

### Event Publishing
All successful and failed exports publish events to Pub/Sub with:
- **Encounter ID**: Original Cerner encounter ID
- **Patient ID**: Patient identifier
- **Resource Counts**: Number of each resource type exported
- **Export Timestamp**: When the export occurred
- **Status**: Success/failure status

### Event Structure
```json
{
  "documentReferenceId": "encounter-export-{patientId}",
  "tenantId": "tenant-id",
  "patientId": "patient-id",
  "exportTimestamp": "2025-01-12T10:00:00Z",
  "status": "success",
  "metadata": {
    "resourcesProcessed": 15,
    "encounterIds": ["encounter-123"],
    "exportType": "encounter-data"
  }
}
```

## Testing

### Manual Testing
```bash
# Test patient export
curl -X POST "http://localhost:3000/discharge-summaries-v2/export-encounter-data/1" \
  -H "X-Tenant-ID: default"

# Test scheduler trigger
curl -X POST "http://localhost:3000/scheduler/encounter-export/trigger"

# Check health
curl "http://localhost:3000/discharge-summaries-v2/health"
```

### Automated Testing
- **Unit Tests**: Individual service method testing
- **Integration Tests**: End-to-end export flow testing
- **Scheduler Tests**: Cron job execution testing

## Monitoring

### Key Metrics
- **Export Success Rate**: Percentage of successful exports
- **Resource Processing Rate**: Average resources processed per export
- **Processing Time**: Time taken for complete export
- **Error Rate**: Frequency of export failures

### Logging
- **Structured Logging**: JSON-formatted logs for easy parsing
- **Error Context**: Detailed error information with context
- **Performance Metrics**: Processing time and resource counts

## Migration from V1

### Coexistence
- V1 and V2 systems run independently
- No impact on existing V1 functionality
- Separate API endpoints and schedulers

### Gradual Migration
1. **Parallel Running**: Run both V1 and V2 systems
2. **Validation**: Compare V2 exports with V1 exports
3. **Gradual Cutover**: Switch tenants one by one
4. **V1 Deprecation**: Eventually deprecate V1 system

## Future Enhancements

### Planned Features
- **Condition Export**: Add Condition resource export
- **Observation Export**: Add Observation resource export
- **Incremental Sync**: Only export changed resources
- **Batch Processing**: Process multiple patients in parallel
- **Resource Filtering**: Configurable resource type selection

### Performance Optimizations
- **Parallel Processing**: Concurrent resource fetching
- **Caching**: Cache patient mappings and configurations
- **Connection Pooling**: Optimize database connections
- **Memory Management**: Efficient memory usage for large exports
