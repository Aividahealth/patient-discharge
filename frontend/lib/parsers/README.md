# Discharge Summary Parser System

A tenant-specific parsing system for discharge summary documents. Each tenant can have its own parser implementation that understands their specific document format.

## Architecture

### Components

1. **Parser Registry** (`parser-registry.ts`)
   - Central registry that manages tenant-specific parsers
   - Auto-detects which parser can handle a given document
   - Provides the main `parseDischargeDocument()` function
   - Supports multiple parsers per tenant (tries each until one succeeds)

2. **Tenant Parsers** (`tenants/{tenantId}/`)
   - Each tenant has its own parser implementation
   - Parsers are organized in tenant-specific folders
   - Example: `tenants/demo/demo-parser.ts` for the demo tenant

3. **Demo Parser** (`tenants/demo/demo-parser.ts`)
   - Implementation for the demo tenant
   - Parses standard discharge summary format with sections:
     - Admitting Diagnosis
     - Discharge Diagnosis
     - Hospital Course
     - Pertinent Results
     - Condition at Discharge
   - Also parses discharge instructions:
     - Discharge Medications (new, continued, stopped)
     - Follow-Up Appointments
     - Diet and Lifestyle
     - Patient Instructions
     - Return Precautions

## Usage

### Basic Usage

```typescript
import { parseDischargeDocument } from '@/lib/parsers/parser-registry';

// Parse discharge summary and instructions
const result = parseDischargeDocument(
  tenantId,        // e.g., 'demo'
  rawSummary,      // Raw text from discharge summary document
  rawInstructions  // Raw text from discharge instructions document
);

if (result.parserUsed) {
  console.log('Parsed summary:', result.parsedSummary);
  console.log('Parsed instructions:', result.parsedInstructions);
} else {
  console.log('No parser could handle this document');
}
```

### In Components

```typescript
// Example: In a file upload handler
import { parseDischargeDocument } from '@/lib/parsers/parser-registry';

const handleFileUpload = async (file: File, tenantId: string) => {
  // Extract text from file (PDF, DOC, etc.)
  const fileText = await extractTextFromFile(file);
  
  // Parse both summary and instructions (using same text for both if needed)
  const parseResult = parseDischargeDocument(tenantId, fileText, fileText);
  
  if (parseResult.parserUsed && parseResult.parsedSummary) {
    // Use parsed data
    const { admittingDiagnosis, dischargeDiagnosis, hospitalCourse } = parseResult.parsedSummary;
    // ... process parsed data
  }
};
```

## Adding a Custom Parser for a New Tenant

### Step 1: Create Parser Directory

Create a new folder for your tenant:
```
lib/parsers/tenants/{tenantId}/
```

### Step 2: Create Parser Class

Create a parser file (e.g., `{tenantId}-parser.ts`):

```typescript
// lib/parsers/tenants/stanford/stanford-parser.ts

export interface ParsedDischargeSummary {
  // Define your tenant-specific structure
  patientName?: string;
  mrn?: string;
  diagnoses?: string[];
  medications?: string[];
  // ... other fields
}

export interface ParsedDischargeInstructions {
  // Define your tenant-specific structure
  medications?: string[];
  followUp?: string[];
  // ... other fields
}

export class StanfordParser {
  /**
   * Detect if this parser can handle the given text
   * Return true if the document matches this tenant's format
   */
  canParse(text: string): boolean {
    // Check for Stanford-specific markers
    return /Stanford.*Hospital/i.test(text) || 
           /STANFORD.*DISCHARGE/i.test(text);
  }

  /**
   * Parse the raw discharge summary text
   */
  parseDischargeSummary(text: string): ParsedDischargeSummary {
    // Implement parsing logic for Stanford format
    return {
      patientName: this.extractPatientName(text),
      mrn: this.extractMRN(text),
      diagnoses: this.extractDiagnoses(text),
      // ... parse other fields
    };
  }

  /**
   * Parse the raw discharge instructions text
   */
  parseDischargeInstructions(text: string): ParsedDischargeInstructions {
    // Implement parsing logic for Stanford instructions
    return {
      medications: this.extractMedications(text),
      followUp: this.extractFollowUp(text),
      // ... parse other fields
    };
  }

  // Helper methods
  private extractPatientName(text: string): string | undefined {
    const match = text.match(/Patient:\s*([^\n]+)/i);
    return match?.[1]?.trim();
  }

  // ... other helper methods
}
```

### Step 3: Register Parser in Registry

Update `parser-registry.ts` to include your new parser:

```typescript
// In parser-registry.ts
import { StanfordParser, ParsedDischargeSummary, ParsedDischargeInstructions } from './tenants/stanford/stanford-parser';

function getTenantParsers(tenantId: string): DischargeParser[] {
  const parsers: DischargeParser[] = [];

  if (tenantId === 'demo') {
    parsers.push(new DemoParser());
  }

  // Add your new tenant parser
  if (tenantId === 'stanford') {
    parsers.push(new StanfordParser());
  }

  return parsers;
}
```

## Parser Interface

All parsers must implement the `DischargeParser` interface:

```typescript
export interface DischargeParser {
  /**
   * Check if this parser can handle the given document
   * @param text - Raw text from the document
   * @returns true if this parser can parse the document
   */
  canParse(text: string): boolean;

  /**
   * Parse the discharge summary section
   * @param text - Raw text from discharge summary
   * @returns Parsed discharge summary data
   */
  parseDischargeSummary(text: string): ParsedDischargeSummary;

  /**
   * Parse the discharge instructions section
   * @param text - Raw text from discharge instructions
   * @returns Parsed discharge instructions data
   */
  parseDischargeInstructions(text: string): ParsedDischargeInstructions;
}
```

## Parse Result Structure

The `parseDischargeDocument()` function returns:

```typescript
export interface ParseResult {
  /**
   * Whether a parser successfully handled the document
   */
  parserUsed: boolean;

  /**
   * Parsed discharge summary data (null if parsing failed)
   */
  parsedSummary: ParsedDischargeSummary | null;

  /**
   * Parsed discharge instructions data (null if parsing failed)
   */
  parsedInstructions: ParsedDischargeInstructions | null;
}
```

## Demo Parser Data Structures

### ParsedDischargeSummary

```typescript
interface ParsedDischargeSummary {
  admittingDiagnosis: string[];
  dischargeDiagnosis: string[];
  hospitalCourse: string[];
  pertinentResults: string[];
  conditionAtDischarge: string[];
}
```

### ParsedDischargeInstructions

```typescript
interface ParsedDischargeInstructions {
  dischargeMedications: {
    new: string[];
    continued: string[];
    stopped: string[];
  };
  followUpAppointments: string[];
  dietAndLifestyle: string[];
  patientInstructions: string[];
  returnPrecautions: string[];
}
```

## Error Handling

The parser system is designed to be fault-tolerant:

- If no parser can handle the document, `parserUsed` will be `false`
- Parsers should handle errors gracefully and return partial data when possible
- The registry tries each registered parser until one succeeds
- Console logging provides detailed information about parsing attempts

```typescript
const result = parseDischargeDocument(tenantId, summaryText, instructionsText);

if (!result.parserUsed) {
  console.warn('No parser could handle this document');
  // Handle fallback case
} else {
  // Use parsed data
  if (result.parsedSummary) {
    // Process summary
  }
  if (result.parsedInstructions) {
    // Process instructions
  }
}
```

## Testing

To test a parser with your discharge summary:

```typescript
import { parseDischargeDocument } from '@/lib/parsers/parser-registry';
import fs from 'fs';

// Read your test file
const summaryText = fs.readFileSync('path/to/test-summary.txt', 'utf-8');
const instructionsText = fs.readFileSync('path/to/test-instructions.txt', 'utf-8');

// Parse it
const result = parseDischargeDocument('demo', summaryText, instructionsText);

// Inspect results
if (result.parserUsed) {
  console.log('Summary:', result.parsedSummary);
  console.log('Instructions:', result.parsedInstructions);
} else {
  console.log('Parser could not handle this document');
}
```

## Best Practices

1. **Auto-Detection**: Implement robust `canParse()` methods that accurately detect your tenant's format
2. **Error Handling**: Handle edge cases and malformed documents gracefully
3. **Logging**: Use console logging to help debug parsing issues
4. **Text Cleaning**: Clean up extracted text (remove file paths, normalize whitespace, etc.)
5. **Flexible Patterns**: Use regex patterns that handle variations in formatting
6. **Documentation**: Document your parser's expected format and any special handling

## Future Enhancements

- [ ] ML-based parsing for unstructured documents
- [ ] OCR support for scanned PDFs
- [ ] HL7/FHIR format support
- [ ] Multi-language support
- [ ] Parser performance metrics
- [ ] Admin UI for parser configuration
- [ ] Parser testing framework
- [ ] Automatic parser selection based on document format detection
- [ ] Support for multiple file formats (PDF, DOCX, TXT) with automatic text extraction
