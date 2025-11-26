# How to Update Default Tenant to Manual EHR Integration

This guide shows you how to update the "default" tenant in Firestore to use "Manual" EHR integration, which will prevent the scheduler from attempting EHR patient discovery.

## Why This Change?

When a tenant is set to "Manual" EHR integration:
- The scheduler will skip that tenant entirely
- No EHR API calls will be attempted
- The tenant will only use manual file uploads
- This prevents errors and unnecessary processing

## Step-by-Step: Update Default Tenant in Firestore

### Step 1: Open Firestore in Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select your project: `simtran-474018`
3. Navigate to **Firestore** → **Data**
4. Find the `config` collection
5. Click on the `default` document

### Step 2: Update the ehrIntegration Field

1. In the document editor, find the `ehrIntegration` field
2. If it doesn't exist, click **Add field** and create it
3. Set the structure as follows:

```json
{
  "ehrIntegration": {
    "type": "Manual"
  }
}
```

**Important:** 
- Field name: `ehrIntegration` (type: Map/Object)
- Inside `ehrIntegration`, add:
  - Field: `type` (type: string)
  - Value: `Manual` (exactly as shown, case-sensitive)

### Step 3: Remove Cerner Configuration (if present)

If the `ehrIntegration` object has a `cerner` field, you can either:
- **Option A**: Remove the `cerner` field entirely (recommended)
- **Option B**: Leave it but ensure `type` is set to `Manual`

The `type: "Manual"` setting will override any Cerner config.

### Step 4: Update the updatedAt Field

1. Find the `updatedAt` field
2. Update it to the current timestamp

### Step 5: Save the Document

1. Click **Save** (or **Update**)
2. Confirm the changes

### Step 6: Verify the Structure

Your document should look something like this:

```json
{
  "name": "Default Tenant",
  "ehrIntegration": {
    "type": "Manual"
  },
  "updatedAt": "2025-11-25T00:00:00Z",
  ...
}
```

## Verification

After updating:

1. **Wait for the next scheduler run** (every 10 minutes)
2. **Check the logs** - you should see:
   ```
   ⏭️  Skipping tenant default - no EHR integration configured (Manual tenant)
   ```

3. **No EHR errors** - The scheduler will skip the default tenant entirely

## Alternative: Using System Admin UI

If you have access to the System Admin Portal:

1. Log into the System Admin Portal
2. Navigate to **Tenant Management**
3. Select the `default` tenant
4. Go to **EHR Integration** section
5. Select **Manual** from the dropdown
6. Click **Save**

## What Happens After This Change

- ✅ Scheduler will skip the default tenant
- ✅ No EHR API calls will be attempted
- ✅ No patient discovery will run for default tenant
- ✅ Only tenants with Cerner/EPIC integration will be processed
- ✅ Cleaner logs with fewer errors

## Troubleshooting

### If you see errors after updating:
- Verify the `type` field is exactly `"Manual"` (case-sensitive)
- Check that `ehrIntegration` is a Map/Object, not a string
- Ensure the document was saved successfully

### If the scheduler still tries to process:
- Wait a few minutes for the config cache to refresh
- Check logs to see if the skip message appears
- Verify the tenant ID is exactly `default` (lowercase)

