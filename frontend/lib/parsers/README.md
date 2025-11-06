# Discharge Summary Parser System

A flexible, tenant-specific parsing system for discharge summary documents that supports multiple formats and can be extended for different hospital systems.

## Architecture

### Components

1. **Base Parser** (`base-parser.ts`)
   - Abstract class defining the parser interface
   - Common parsing utilities (text extraction, section parsing, list parsing)
   - Validation framework
   - Support for PDF, DOC, DOCX, and TXT files

2. **Default Parser** (`default-parser.ts`)
   - Implementation for standard discharge summary formats
   - Parses all common sections (patient info, diagnoses, medications, etc.)
   - Confidence scoring based on successfully parsed fields
   - Handles various text patterns and formats

3. **Parser Registry** (`parser-registry.ts`)
   - Manages multiple parser types
   - Singleton pattern for global access
   - Tenant configuration management
   - Parser factory for easy instantiation

4. **Tenant Configuration** (`tenant-configs.ts`)
   - Central configuration for all tenants
   - Maps tenants to parser types
   - Custom settings per tenant

## Usage

### Basic Usage

```typescript
import { ParserFactory } from '@/lib/parsers';

// Get parser for a specific tenant
const parser = ParserFactory.getParser('hospital-a');

// Parse a discharge summary
const result = await parser.parse(fileBuffer, 'application/pdf');

// Access parsed data
console.log(result.patientName);
console.log(result.medications);
console.log(result.confidence); // 0-1 score
```

### API Integration

The upload API route automatically uses tenant-specific parsers:

```typescript
// In /api/discharge-summary/upload/route.ts
const parser = ParserFactory.getParser(tenantId);
const parsedSummary = await parser.parse(buffer, file.type);
```

## Adding a Custom Parser for a New Tenant

### Option 1: Use Default Parser with Custom Settings

```typescript
// In tenant-configs.ts
ParserFactory.configureTenant('my-hospital', 'default', {
  dateFormat: 'MM/DD/YYYY',
  strictValidation: true,
  requireMedications: true,
});
```

### Option 2: Create a Custom Parser

1. **Create a new parser class:**

```typescript
// lib/parsers/epic-parser.ts
import { DischargeSummaryParser, ParsedDischargeSummary, ParserConfig } from './base-parser';

export class EpicDischargeSummaryParser extends DischargeSummaryParser {
  constructor(config: ParserConfig) {
    super({
      ...config,
      parserType: 'epic',
      version: '1.0.0',
    });
  }

  async parse(file: Buffer, fileType: string): Promise<ParsedDischargeSummary> {
    // Custom parsing logic for Epic format
    const text = await this.extractTextFromPDF(file);

    // Use Epic-specific patterns
    const result: ParsedDischargeSummary = {
      patientName: this.parseEpicPatientName(text),
      medications: this.parseEpicMedications(text),
      // ... other Epic-specific parsing
    };

    return result;
  }

  private parseEpicPatientName(text: string): string | undefined {
    // Epic-specific patient name pattern
    const match = text.match(/Patient:\s*([^\n]+)/);
    return match ? match[1].trim() : undefined;
  }

  private parseEpicMedications(text: string): ParsedDischargeSummary['medications'] {
    // Epic-specific medication parsing
    // ...
  }
}
```

2. **Register the parser:**

```typescript
// In parser-registry.ts or tenant-configs.ts
import { EpicDischargeSummaryParser } from './epic-parser';

ParserRegistry.getInstance().registerParser('epic', EpicDischargeSummaryParser);
```

3. **Configure tenant to use it:**

```typescript
// In tenant-configs.ts
ParserFactory.configureTenant('epic-hospital', 'epic', {
  // Epic-specific settings
});
```

### Option 3: Use a Completely Custom Parser Instance

```typescript
// For one-off custom implementations
import { MyCustomParser } from './my-custom-parser';

ParserFactory.registerCustomParser('special-hospital', MyCustomParser, {
  customSetting: 'value',
});
```

## Parsed Data Structure

```typescript
interface ParsedDischargeSummary {
  // Patient Information
  patientName?: string;
  mrn?: string;
  dob?: string;
  admitDate?: string;
  dischargeDate?: string;
  attendingPhysician?: { name: string; id?: string };
  service?: string;
  unit?: string;
  room?: string;

  // Clinical Information
  admittingDiagnosis?: string[];
  dischargeDiagnosis?: string[];
  hospitalCourse?: string;
  procedures?: string[];

  // Results
  labResults?: Array<{ name: string; value: string; unit?: string; date?: string }>;
  imagingResults?: string[];
  vitalSigns?: {
    temperature?: string;
    heartRate?: string;
    bloodPressure?: string;
    respiratoryRate?: string;
    oxygenSaturation?: string;
  };

  // Discharge Information
  conditionAtDischarge?: string;
  medications?: Array<{
    name: string;
    dose: string;
    frequency: string;
    instructions?: string;
    isNew?: boolean;
    isStopped?: boolean;
  }>;
  followUpAppointments?: Array<{
    provider: string;
    specialty?: string;
    timeframe: string;
    notes?: string;
  }>;
  dietInstructions?: string;
  activityRestrictions?: string;
  patientInstructions?: string;
  returnPrecautions?: string[];

  // Metadata
  rawText?: string;
  confidence?: number; // 0-1 score
  warnings?: string[];
  parserVersion?: string;
}
```

## Validation

Each parser includes automatic validation:

```typescript
const parser = ParserFactory.getParser(tenantId);
const result = await parser.parse(buffer, fileType);

// Validate parsed data
const validation = parser.validate(result);
if (!validation.valid) {
  console.warn('Validation errors:', validation.errors);
}
```

## Error Handling

The parser system is designed to be fault-tolerant:

- Parsing errors are caught and logged
- Partial data is still returned
- Confidence score reflects parsing success
- Warnings array contains any issues encountered

```typescript
try {
  const result = await parser.parse(buffer, fileType);

  if (result.confidence < 0.5) {
    console.warn('Low confidence parsing:', result.warnings);
  }
} catch (error) {
  // Parser initialization failed
  console.error('Parser error:', error);
}
```

## Testing

To test a parser with your discharge summary:

```typescript
import { ParserFactory } from '@/lib/parsers';
import fs from 'fs';

// Read your test file
const buffer = fs.readFileSync('path/to/test-discharge-summary.pdf');

// Parse it
const parser = ParserFactory.getParser('your-tenant-id');
const result = await parser.parse(buffer, 'application/pdf');

// Inspect results
console.log('Patient:', result.patientName);
console.log('Medications:', result.medications);
console.log('Confidence:', result.confidence);
console.log('Warnings:', result.warnings);
```

## Extending Base Parser Utilities

The base parser provides helpful utilities you can use in custom parsers:

```typescript
// Extract section by header
const medicationsText = this.extractSection(
  fullText,
  /Medications:/i,
  [/Follow-Up:/i, /Diet:/i]
);

// Parse bullet lists
const items = this.parseList(medicationsText);

// Clean text
const cleaned = this.cleanText(rawText);
```

## Configuration Management

View current configurations:

```typescript
import { getTenantParserInfo, listConfiguredTenants } from '@/lib/parsers';

// Get info for specific tenant
const info = getTenantParserInfo('hospital-a');
console.log(info);
// { tenantId: 'hospital-a', parserType: 'default', hasCustomParser: false, settings: {...} }

// List all configured tenants
const tenants = listConfiguredTenants();
console.log(tenants);
// ['default-tenant', 'hospital-a', 'hospital-b', ...]
```

## Future Enhancements

- [ ] ML-based parsing for unstructured documents
- [ ] OCR support for scanned PDFs
- [ ] HL7/FHIR format support
- [ ] Multi-language support
- [ ] Parser performance metrics
- [ ] Admin UI for parser configuration
- [ ] Parser testing framework
- [ ] Automatic parser selection based on document format detection
