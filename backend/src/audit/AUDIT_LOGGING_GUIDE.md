# Audit Logging Integration Guide

This guide explains how to integrate audit logging throughout the patient discharge system.

## Overview

The audit logging system tracks:
- **Clinician Activity**: Viewing, editing, publishing, approving, or rejecting discharge summaries
- **Simplifications**: AI-powered simplification of medical text
- **Translations**: Translation of discharge summaries to different languages
- **Chatbot Interactions**: Patient conversations with the AI chatbot

## Setup

The `AuditService` is available throughout the backend via dependency injection.

### 1. Import AuditModule in your module

```typescript
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  // ...
})
export class YourModule {}
```

### 2. Inject AuditService in your service/controller

```typescript
import { AuditService } from '../audit/audit.service';

@Injectable()
export class YourService {
  constructor(private readonly auditService: AuditService) {}
}
```

## Usage Examples

### Logging Clinician Activity

When a clinician views, edits, or publishes a discharge summary:

```typescript
// In discharge-summaries.controller.ts or service
import { AuditService } from '../audit/audit.service';

@Controller('discharge-summaries')
export class DischargeSummariesController {
  constructor(
    private readonly dischargeSummariesService: DischargeSummariesService,
    private readonly auditService: AuditService,
  ) {}

  @Get(':id')
  @UseGuards(AuthGuard)
  async getById(@Param('id') id: string, @Request() req) {
    const summary = await this.dischargeSummariesService.getById(id);

    // Log the view activity
    await this.auditService.logClinicianActivity({
      tenantId: req.user.tenantId,
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'viewed',
      resourceType: 'discharge_summary',
      resourceId: id,
      patientId: summary.patientId,
      patientName: summary.patientName,
    });

    return summary;
  }

  @Put(':id/publish')
  @UseGuards(AuthGuard)
  async publish(@Param('id') id: string, @Request() req) {
    const summary = await this.dischargeSummariesService.publish(id);

    // Log the publish activity
    await this.auditService.logClinicianActivity({
      tenantId: req.user.tenantId,
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'published',
      resourceType: 'discharge_summary',
      resourceId: id,
      patientId: summary.patientId,
      patientName: summary.patientName,
      metadata: {
        version: summary.version,
      },
    });

    return summary;
  }
}
```

### Logging Simplifications

When a discharge summary is simplified:

```typescript
// In simtran/simplification service
import { AuditService } from '../../backend/src/audit/audit.service';

async function simplifyDischargeSummary(
  dischargeSummaryId: string,
  patientId: string,
  patientName: string,
  originalText: string,
  tenantId: string,
  auditService: AuditService,
) {
  const startTime = Date.now();

  // Log start
  await auditService.logSimplification({
    tenantId,
    action: 'started',
    dischargeSummaryId,
    patientId,
    patientName,
    originalLength: originalText.length,
  });

  try {
    const simplifiedText = await callSimplificationAPI(originalText);
    const processingTime = Date.now() - startTime;

    // Log success
    await auditService.logSimplification({
      tenantId,
      action: 'completed',
      dischargeSummaryId,
      patientId,
      patientName,
      originalLength: originalText.length,
      simplifiedLength: simplifiedText.length,
      processingTime,
      aiModel: 'gpt-4',
    });

    return simplifiedText;
  } catch (error) {
    const processingTime = Date.now() - startTime;

    // Log failure
    await auditService.logSimplification({
      tenantId,
      action: 'failed',
      dischargeSummaryId,
      patientId,
      patientName,
      originalLength: originalText.length,
      processingTime,
      metadata: {
        error: error.message,
      },
    });

    throw error;
  }
}
```

### Logging Translations

When a discharge summary is translated:

```typescript
// In simtran/translation service
async function translateDischargeSummary(
  dischargeSummaryId: string,
  patientId: string,
  patientName: string,
  sourceText: string,
  sourceLanguage: string,
  targetLanguage: string,
  tenantId: string,
  auditService: AuditService,
) {
  const startTime = Date.now();

  // Log start
  await auditService.logTranslation({
    tenantId,
    action: 'started',
    dischargeSummaryId,
    patientId,
    patientName,
    sourceLanguage,
    targetLanguage,
    originalLength: sourceText.length,
  });

  try {
    const translatedText = await callTranslationAPI(sourceText, targetLanguage);
    const processingTime = Date.now() - startTime;

    // Log success
    await auditService.logTranslation({
      tenantId,
      action: 'completed',
      dischargeSummaryId,
      patientId,
      patientName,
      sourceLanguage,
      targetLanguage,
      originalLength: sourceText.length,
      translatedLength: translatedText.length,
      processingTime,
      aiModel: 'gpt-4',
    });

    return translatedText;
  } catch (error) {
    const processingTime = Date.now() - startTime;

    // Log failure
    await auditService.logTranslation({
      tenantId,
      action: 'failed',
      dischargeSummaryId,
      patientId,
      patientName,
      sourceLanguage,
      targetLanguage,
      originalLength: sourceText.length,
      processingTime,
      metadata: {
        error: error.message,
      },
    });

    throw error;
  }
}
```

### Logging Chatbot Interactions

When a patient interacts with the chatbot:

```typescript
// In chatbot service/controller
@Post('chat')
@UseGuards(AuthGuard)
async sendMessage(
  @Body() body: { message: string },
  @Request() req,
) {
  const startTime = Date.now();

  // Log the user message
  await this.auditService.logChatbot({
    tenantId: req.user.tenantId,
    userId: req.user.id,
    action: 'message_sent',
    patientId: req.user.linkedPatientId,
    patientName: req.user.name,
    conversationId: req.session.conversationId,
    message: body.message,
  });

  try {
    const response = await this.chatbotService.getResponse(body.message);
    const processingTime = Date.now() - startTime;

    // Log the chatbot response
    await this.auditService.logChatbot({
      tenantId: req.user.tenantId,
      userId: req.user.id,
      action: 'response_received',
      patientId: req.user.linkedPatientId,
      patientName: req.user.name,
      conversationId: req.session.conversationId,
      message: body.message,
      response: response.text,
      processingTime,
      aiModel: 'gpt-4',
    });

    return response;
  } catch (error) {
    // Even on error, log what we tried
    this.logger.error('Chatbot error', error);
    throw error;
  }
}
```

## Best Practices

1. **Always include tenant context**: Every audit log requires a `tenantId` for proper multi-tenant isolation
2. **Log both start and completion**: For long-running operations, log when they start and when they complete
3. **Include patient context**: Always include `patientId` and `patientName` when available
4. **Log failures**: Don't just log successes - failures are important for debugging and compliance
5. **Use metadata for additional context**: The `metadata` field can store any additional information
6. **Don't log sensitive data**: Avoid logging full medical records, passwords, or other sensitive information
7. **Async logging**: Audit logging is async and won't throw errors - it's designed not to break your application

## Querying Audit Logs

Audit logs can be queried via the API:

```bash
# Get all audit logs for a tenant
GET /api/audit/logs

# Filter by type
GET /api/audit/logs?type=clinician_activity

# Filter by user
GET /api/audit/logs?userId=user-123

# Filter by patient
GET /api/audit/logs?patientId=patient-456

# Filter by date range
GET /api/audit/logs?startDate=2024-01-01&endDate=2024-12-31

# Pagination
GET /api/audit/logs?limit=50&offset=100
```

## Frontend Integration

The frontend can display audit logs using the `getAuditLogs` API client:

```typescript
import { getAuditLogs } from '@/lib/api/audit-logs';

const logs = await getAuditLogs(
  {
    type: 'clinician_activity',
    limit: 50,
  },
  tenantId,
  token
);
```

See `/frontend/app/[tenantId]/admin/page.tsx` for a complete example of displaying audit logs in the admin portal.

## Firestore Schema

Audit logs are stored in the `audit_logs` Firestore collection with the following structure:

```typescript
{
  id: string;
  timestamp: Date;
  tenantId: string;
  type: 'clinician_activity' | 'simplification' | 'translation' | 'chatbot';

  // User context
  userId?: string;
  userName?: string;
  userRole?: string;

  // Type-specific fields
  // See audit.service.ts for complete interface definitions
}
```

## Compliance & Retention

- Audit logs are retained for **6 years** (2190 days) to meet compliance requirements
- Logs are automatically indexed by `tenantId`, `type`, `userId`, `patientId`, and `timestamp`
- Logs can be exported in JSON format for external archival or analysis
