# Discharge Summary Translation Service

This Cloud Function automatically translates simplified discharge summaries into multiple languages using Google Translate API.

## Overview

The translation service is triggered when a simplified discharge summary is uploaded to the `discharge-summaries-simplified` bucket. It translates the content to the specified target language and stores the result in the `discharge-summaries-translated` bucket.

## Architecture

```
Simplified Discharge Summary (English)
                ↓
    [Translation Cloud Function]
                ↓
    Translated Discharge Summary (Target Language)
```

## Features

- **Automatic Translation**: Triggers on simplified discharge summaries
- **Multiple Languages**: Supports 100+ languages via Google Translate
- **Retry Logic**: Built-in retry mechanism for failed translations
- **Error Handling**: Comprehensive error handling and logging
- **Content Validation**: Validates that content is a simplified discharge summary

## Supported Languages

The service supports all languages available in Google Translate, including:

- **Spanish (es)**: Español
- **French (fr)**: Français  
- **German (de)**: Deutsch
- **Italian (it)**: Italiano
- **Portuguese (pt)**: Português
- **Russian (ru)**: Русский
- **Japanese (ja)**: 日本語
- **Korean (ko)**: 한국어
- **Chinese (zh)**: 中文
- **Arabic (ar)**: العربية
- **Hindi (hi)**: हिन्दी

## File Naming Convention

### Input Files
- **Pattern**: `filename-simplified.md`
- **Example**: `discharge-2024-01-15-simplified.md`

### Output Files
- **Pattern**: `filename-simplified-{language}.md`
- **Example**: `discharge-2024-01-15-simplified-es.md` (Spanish)

## Configuration

### Environment Variables

- `PROJECT_ID`: Google Cloud Project ID
- `LOCATION`: Google Cloud region (default: us-central1)
- `OUTPUT_BUCKET`: Output bucket for translated files (default: discharge-summaries-translated)

### Language Detection

The service determines the target language from:

1. **Filename pattern**: `filename-simplified-{language}.md`
2. **Default language**: Spanish (es) if no language specified
3. **Metadata**: Future enhancement for user preferences

## Deployment

### Prerequisites

1. Google Cloud Project with billing enabled
2. Google Translate API enabled
3. Cloud Functions API enabled
4. Storage API enabled

### Deploy Translation Function

```bash
# Set environment variables
export PROJECT_ID=your-project-id
export LOCATION=us-central1

# Install dependencies
npm install

# Deploy the function
./deploy-translation.sh
```

### Manual Deployment

```bash
gcloud functions deploy discharge-summary-translator \
  --gen2 \
  --runtime=nodejs20 \
  --region=us-central1 \
  --source=. \
  --entry-point=translateDischargeSummary \
  --trigger-bucket=discharge-summaries-simplified \
  --memory=512MB \
  --timeout=540s \
  --set-env-vars="PROJECT_ID=${PROJECT_ID},OUTPUT_BUCKET=discharge-summaries-translated"
```

## Usage

### Automatic Translation

1. Upload a simplified discharge summary to `gs://discharge-summaries-simplified/`
2. The function automatically detects the file
3. Translates to the target language
4. Stores result in `gs://discharge-summaries-translated/`

### Manual Testing

```bash
# Upload a test file
gsutil cp test-simplified.md gs://discharge-summaries-simplified/

# Check output
gsutil ls gs://discharge-summaries-translated/
gsutil cat gs://discharge-summaries-translated/test-simplified-es.md
```

## Monitoring

### View Logs

```bash
gcloud functions logs read discharge-summary-translator \
  --region=us-central1 \
  --limit=20
```

### Check Function Status

```bash
gcloud functions describe discharge-summary-translator \
  --region=us-central1
```

## Error Handling

The service includes comprehensive error handling:

- **Retry Logic**: Automatic retry for transient failures
- **Validation**: Content validation before translation
- **Logging**: Detailed logging for debugging
- **Graceful Degradation**: Continues processing other files if one fails

## Cost Considerations

- **Google Translate API**: Charged per character translated
- **Cloud Functions**: Charged per invocation and execution time
- **Storage**: Charged for translated file storage

## Security

- **IAM Permissions**: Minimal required permissions
- **Data Encryption**: All data encrypted in transit and at rest
- **Access Control**: Bucket-level access controls

## Troubleshooting

### Common Issues

1. **Translation API Quota**: Check quota limits in Google Cloud Console
2. **Permission Errors**: Ensure service account has Translate API access
3. **Bucket Access**: Verify bucket permissions and existence
4. **Function Timeout**: Increase timeout for large files

### Debug Steps

1. Check function logs for errors
2. Verify bucket permissions
3. Test with small files first
4. Check API quotas and billing

## Future Enhancements

- **Language Detection**: Automatic language detection from user preferences
- **Batch Processing**: Process multiple languages simultaneously
- **Quality Validation**: Post-translation quality checks
- **Custom Models**: Domain-specific translation models
- **Real-time Translation**: Real-time translation capabilities
