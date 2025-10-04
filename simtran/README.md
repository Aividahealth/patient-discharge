# Discharge Summary Processing Backend

This backend contains two Cloud Functions for processing medical discharge summaries:

1. **Simplification Function** - Simplifies complex medical discharge summaries using Vertex AI
2. **Translation Function** - Translates simplified summaries into multiple languages using Google Translate

## Directory Structure

```
backend/
├── common/                    # Shared components
│   ├── types/                 # TypeScript type definitions
│   ├── utils/                 # Utility functions (config, logger, prompts)
│   └── package.json           # Shared dependencies
├── simplification/            # Simplification Cloud Function
│   ├── index.ts              # Main function entry point
│   ├── simplification.service.ts
│   ├── gcs.service.ts
│   ├── deploy.sh             # Deployment script
│   ├── package.json          # Function-specific dependencies
│   └── tsconfig.json         # TypeScript configuration
├── translation/               # Translation Cloud Function
│   ├── translation-function.ts # Main function entry point
│   ├── translation.service.ts
│   ├── gcs.service.ts
│   ├── deploy-translation.sh  # Deployment script
│   ├── TRANSLATION_README.md  # Translation-specific documentation
│   ├── package.json          # Function-specific dependencies
│   └── tsconfig.json         # TypeScript configuration
└── README.md                 # This file
```

## Architecture

```
Raw Discharge Summary
        ↓
[Simplification Function]
        ↓
Simplified Discharge Summary (English)
        ↓
[Translation Function]
        ↓
Translated Discharge Summary (Multiple Languages)
```

## Quick Start

### 1. Install Dependencies

```bash
# Install common dependencies
cd common && npm install

# Install simplification dependencies
cd ../simplification && npm install

# Install translation dependencies
cd ../translation && npm install
```

### 2. Deploy Functions

```bash
# Deploy simplification function
cd simplification
export PROJECT_ID=your-project-id
export LOCATION=us-central1
export MODEL_NAME=gemini-1.5-pro
./deploy.sh

# Deploy translation function
cd ../translation
export PROJECT_ID=your-project-id
export LOCATION=us-central1
./deploy-translation.sh
```

### 3. Test the Pipeline

```bash
# Upload a test file to trigger simplification
gsutil cp test-discharge.md gs://discharge-summaries-raw/

# Check simplified output
gsutil ls gs://discharge-summaries-simplified/

# Check translated output
gsutil ls gs://discharge-summaries-translated/
```

## Configuration

### Environment Variables

- `PROJECT_ID`: Google Cloud Project ID
- `LOCATION`: Google Cloud region (default: us-central1)
- `MODEL_NAME`: Vertex AI model name (default: gemini-1.5-pro)

### Buckets

- **Input**: `discharge-summaries-raw` (raw discharge summaries)
- **Simplified**: `discharge-summaries-simplified` (English simplified summaries)
- **Translated**: `discharge-summaries-translated` (multi-language translations)

## Development

### Building

```bash
# Build common components
cd common && npm run build

# Build simplification function
cd ../simplification && npm run build

# Build translation function
cd ../translation && npm run build
```

### Local Development

```bash
# Run simplification function locally
cd simplification
npm run dev

# Run translation function locally
cd ../translation
npm run dev
```

## Monitoring

### View Logs

```bash
# Simplification function logs
gcloud functions logs read discharge-summary-simplifier \
  --region=us-central1 \
  --limit=20

# Translation function logs
gcloud functions logs read discharge-summary-translator \
  --region=us-central1 \
  --limit=20
```

## Features

### Simplification Function
- **Vertex AI Integration**: Uses Gemini 1.5 Pro for medical content simplification
- **Anti-Hallucination**: Zero tolerance for adding information not in original
- **Structured Output**: Organized into clear sections (Overview, Medications, etc.)
- **Temperature 0.0**: Completely deterministic output
- **Retry Logic**: Built-in retry mechanism for failed API calls

### Translation Function
- **Google Translate**: Supports 100+ languages
- **Automatic Detection**: Triggers on simplified summaries
- **Batch Processing**: Can process multiple languages
- **Error Handling**: Comprehensive error handling and logging
- **Content Validation**: Validates simplified content structure

## Security

- **IAM Permissions**: Minimal required permissions
- **Data Encryption**: All data encrypted in transit and at rest
- **Access Control**: Bucket-level access controls
- **No Data Persistence**: Functions don't store data locally

## Cost Optimization

- **Efficient Processing**: Only processes relevant files
- **Retry Logic**: Prevents unnecessary API calls
- **Error Handling**: Graceful failure handling
- **Resource Limits**: Appropriate memory and timeout settings

## Troubleshooting

### Common Issues

1. **Permission Errors**: Check IAM roles and bucket permissions
2. **API Quotas**: Monitor Google Cloud API quotas
3. **Function Timeouts**: Adjust timeout settings for large files
4. **Build Failures**: Check TypeScript compilation errors

### Debug Steps

1. Check function logs for detailed error messages
2. Verify bucket permissions and existence
3. Test with small files first
4. Check API quotas and billing status
5. Validate environment variables and configuration

## Support

For issues and questions:
- Check the individual function READMEs
- Review Google Cloud documentation
- Check function logs for detailed error information