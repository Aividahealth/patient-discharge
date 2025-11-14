# Scheduler Service

## Overview

The Scheduler Service provides scheduled background jobs for automated data export and processing. It uses NestJS scheduling to run periodic tasks.

## Business Logic

### Scheduled Jobs

1. **Document Export Scheduler**: Checks for new documents and exports them
2. **Encounter Export Scheduler**: Checks for new encounters and exports complete data

### Scheduling Strategy

- **Cron-based**: Uses `@Cron` decorator for scheduled execution
- **Multi-tenant**: Processes all configured tenants
- **Session-aware**: Uses provider app sessions when available, falls back to system app
- **Pub/Sub Integration**: Publishes events for async processing

### Processing Logic

1. Get all tenants from configuration
2. For each tenant:
   - Check for active provider app sessions
   - Use provider app if available (user context)
   - Fall back to system app if no sessions
   - Process configured patients
   - Publish events to Pub/Sub

## API Endpoints

### POST /scheduler/trigger-document-export

Manually trigger document export check.

**Query Parameters:**
- `tenantId`: Optional, specific tenant ID (processes all tenants if omitted)

**Response (200 OK):**
```json
{
  "message": "Document export check triggered for tenant: demo",
  "success": true
}
```

**Error Responses:**
- **500 Internal Server Error**: Failed to trigger export check

## Scheduled Jobs

### Document Export Scheduler

**Schedule**: Every 10 minutes (currently commented out)
- Checks for new DocumentReference records in Cerner
- Filters by document type (Consultation Note Generic)
- Exports to Google FHIR Store
- Publishes events to Pub/Sub

**Processing Flow:**
1. Get all tenants from config
2. For each tenant:
   - Get active provider app sessions
   - Process documents for each user session
   - Or process with system app if no sessions
3. For each patient:
   - Search for new documents
   - Export if found
   - Publish export event

### Encounter Export Scheduler

**Schedule**: Every 10 minutes
- Checks for new encounters in Cerner
- Exports complete encounter data
- Publishes events to Pub/Sub

**Processing Flow:**
1. Get all tenants from config
2. For each tenant:
   - Get active provider app sessions
   - Process encounters for each user session
   - Or process with system app if no sessions
3. For each patient:
   - Search for encounters
   - Export encounter data
   - Publish export event

## Business Rules

1. **Tenant Processing**: All configured tenants processed sequentially
2. **Session Priority**: Provider app sessions preferred over system app
3. **Patient List**: Only processes patients configured in tenant config
4. **Error Handling**: Errors logged but don't stop processing for other tenants
5. **Pub/Sub Events**: Export events published for async processing

## Configuration

Schedulers require:
- Tenant configuration with patient lists
- Cerner authentication (system or provider app)
- Google FHIR store access
- Pub/Sub topic configuration

## Manual Triggers

Schedulers can be manually triggered via API:
- Useful for testing
- Immediate processing without waiting for cron
- Tenant-specific or all tenants

