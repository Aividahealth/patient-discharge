# Discharge Summaries Frontend Integration

This document describes the integration between the frontend clinician portal and the backend discharge summaries API.

## What We Built

### 1. API Client Library
**File:** `/lib/discharge-summaries.ts`

A TypeScript client library that provides typed functions to interact with the backend API:

- `listDischargeSummaries()` - List all discharge summaries with filtering and pagination
- `getDischargeSummaryMetadata()` - Get metadata for a specific summary
- `getDischargeSummaryContent()` - Get full content (raw, simplified, or translated)
- `getDischargeSummariesStats()` - Get statistics overview
- `syncAllDischargeSummaries()` - Trigger full sync
- `syncDischargeSummaryFile()` - Sync a single file

### 2. Reusable Components

#### DischargeSummariesList Component
**File:** `/components/discharge-summaries-list.tsx`

A component that displays a list of discharge summaries with:
- Search functionality (by patient name)
- Status badges (Raw Only, Simplified, Translated, etc.)
- Patient information (MRN, discharge date, diagnosis)
- Selectable items
- Loading and error states

#### DischargeSummaryViewer Component
**File:** `/components/discharge-summary-viewer.tsx`

A component that displays the content of a discharge summary with:
- Tab-based interface to toggle between raw and simplified versions
- Download functionality
- Refresh capability
- Markdown content rendering
- File metadata (size, last modified)
- Loading and error states

### 3. Clinician Dashboard Page
**File:** `/app/clinician/discharge-summaries/page.tsx`

A complete page that integrates both components in a two-column layout:
- Left column: List of discharge summaries
- Right column: Selected summary viewer
- Full authentication guard
- Responsive design

## Setup Instructions

### 1. Environment Configuration

Create a `.env.local` file in the frontend directory:

```bash
# Copy the example file
cp .env.example .env.local
```

Edit `.env.local` and set the backend URL:

```env
NEXT_PUBLIC_API_URL=http://localhost:3000
```

For production, update this to your deployed backend URL.

### 2. Start the Backend

```bash
cd backend
npm run start:dev
```

The backend should start on `http://localhost:3000`

### 3. Start the Frontend

```bash
cd frontend
npm install  # if you haven't already
npm run dev
```

The frontend should start on `http://localhost:3001` (or the next available port)

### 4. Access the Discharge Summaries Page

Navigate to: `http://localhost:3001/clinician/discharge-summaries`

## Features

### Raw and Simplified Versions

The viewer component automatically loads both versions:
- **Raw Version**: Original medical documentation as written by clinical staff
- **Simplified Version**: AI-simplified version at a high school reading level

Users can toggle between versions using tabs.

### Status Indicators

Discharge summaries are marked with status badges:
- **Raw Only**: Only the original version is available
- **Simplified**: Simplified version is available
- **Translated**: Translated versions are available
- **Processing**: Currently being processed
- **Error**: Processing error occurred

### Search and Filter

The list component includes a search bar that filters summaries by patient name with a 300ms debounce for better performance.

## Architecture

```
┌─────────────────────────────────────────────────┐
│  Frontend (Next.js)                             │
│                                                 │
│  ┌─────────────────────────────────────────┐   │
│  │  /clinician/discharge-summaries/page    │   │
│  │                                         │   │
│  │  ┌──────────────┐  ┌─────────────────┐ │   │
│  │  │ Summaries    │  │ Summary         │ │   │
│  │  │ List         │  │ Viewer          │ │   │
│  │  │              │  │                 │ │   │
│  │  │ - Search     │  │ - Raw Version   │ │   │
│  │  │ - Filter     │  │ - Simplified    │ │   │
│  │  │ - Selection  │  │ - Download      │ │   │
│  │  └──────────────┘  └─────────────────┘ │   │
│  └─────────────────────────────────────────┘   │
│                      │                          │
│                      │                          │
│  ┌──────────────────▼──────────────────────┐   │
│  │  API Client (lib/discharge-summaries)   │   │
│  └──────────────────┬──────────────────────┘   │
└───────────────────────┬──────────────────────────┘
                        │ HTTP/REST
                        │
┌───────────────────────▼──────────────────────────┐
│  Backend (NestJS)                                │
│                                                  │
│  /discharge-summaries/*                          │
│                                                  │
│  ┌──────────────┐         ┌──────────────┐      │
│  │  Firestore   │         │  GCS Buckets │      │
│  │  (Metadata)  │         │  (Content)   │      │
│  └──────────────┘         └──────────────┘      │
└──────────────────────────────────────────────────┘
```

## API Endpoints Used

- `GET /discharge-summaries` - List summaries
- `GET /discharge-summaries/:id` - Get metadata
- `GET /discharge-summaries/:id/content?version=raw|simplified|translated&language=es` - Get content
- `GET /discharge-summaries/stats/overview` - Get statistics
- `POST /discharge-summaries/sync/all` - Sync all files
- `POST /discharge-summaries/sync/file?bucket=X&file=Y` - Sync single file

## Data Flow

1. **Initial Load**
   - User navigates to `/clinician/discharge-summaries`
   - `DischargeSummariesList` component loads and fetches summaries from API
   - Summaries are displayed in the left column

2. **Summary Selection**
   - User clicks on a summary in the list
   - `DischargeSummaryViewer` component receives the summary ID
   - Component fetches both raw and simplified content in parallel
   - Content is displayed in tabs

3. **Version Switching**
   - User clicks on a tab (Raw or Simplified)
   - Component switches the displayed content
   - No additional API calls needed (content already loaded)

4. **Search**
   - User types in the search box
   - After 300ms debounce, new API request is made with search query
   - List is updated with filtered results

## Type Safety

All API responses are fully typed using TypeScript interfaces:

```typescript
interface DischargeSummaryMetadata {
  id: string
  patientName?: string
  mrn?: string
  status: 'raw_only' | 'simplified' | 'translated' | 'processing' | 'error'
  files: {
    raw?: string
    simplified?: string
    translated?: Record<string, string>
  }
  // ... more fields
}
```

## Error Handling

Both components include comprehensive error handling:
- Network errors
- API errors
- Missing content
- Loading states
- Retry functionality

## Performance Optimizations

1. **Parallel Loading**: Raw and simplified versions are fetched in parallel
2. **Debounced Search**: Search input is debounced to reduce API calls
3. **Conditional Rendering**: Only selected summary content is loaded
4. **Error Recovery**: Users can retry failed requests

## Next Steps

### Potential Enhancements

1. **Pagination**: Add pagination for large lists of summaries
2. **Advanced Filters**: Filter by status, date range, department, etc.
3. **Translation Support**: Add language selection for translated versions
4. **Edit Capability**: Allow clinicians to edit simplified versions
5. **Export**: Bulk export or print functionality
6. **Analytics**: Track which versions are viewed most
7. **Notifications**: Real-time updates when new summaries are available
8. **Caching**: Cache API responses for better performance

## Troubleshooting

### Backend Not Connecting

If the frontend can't connect to the backend:

1. Check that the backend is running on port 3000
2. Verify `NEXT_PUBLIC_API_URL` in `.env.local`
3. Check browser console for CORS errors
4. Ensure the backend has CORS enabled for the frontend URL

### No Summaries Showing

If the list is empty:

1. Check that discharge summaries exist in Firestore
2. Run the sync command: `npm run sync-discharge-summaries`
3. Check backend logs for errors
4. Verify GCS bucket permissions

### Content Not Loading

If content doesn't display:

1. Check that files exist in GCS buckets
2. Verify the status field in Firestore metadata
3. Check backend logs for file access errors
4. Ensure service account has GCS read permissions

## Resources

- Backend API Documentation: `/backend/DISCHARGE_SUMMARIES_API.md`
- Backend Setup Guide: `/backend/SETUP_DISCHARGE_SUMMARIES.md`
- Frontend Components: `/frontend/components/`
- API Client: `/frontend/lib/discharge-summaries.ts`
