# Login Flow Guide

## What You'll See Now

When you visit `http://localhost:3001/login`, you'll see:

### 1. **Tenant ID Field** (at the top)
```
┌─────────────────────────────────┐
│ Tenant ID                       │
│ ┌─────────────────────────────┐ │
│ │ demo                        │ │ ← Pre-filled with "demo"
│ └─────────────────────────────┘ │
│ Your organization identifier    │
└─────────────────────────────────┘
```

### 2. **Portal Selection Tabs**
```
┌─────────────────────────────────┐
│ [Patient] [Clinician] [Admin]   │ ← Click any tab
└─────────────────────────────────┘
```

### 3. **Login Buttons**
Each tab has a button to access that portal:
- **Patient Tab:** "Access Patient Portal" button
- **Clinician Tab:** "Access Clinician Portal" button
- **Admin Tab:** "Access Admin Dashboard" button

### 4. **Demo Credentials Box** (at the bottom)
Shows:
- **Tenant ID:** `demo` (highlighted in blue)
- **Password:** `Adyar2Austin`
- **Available Users:** patient, clinician, admin, expert

## How to Login

### Quick Login (Recommended)
1. Make sure Tenant ID says **"demo"** (it's pre-filled)
2. Click any portal button (Patient, Clinician, or Admin)
3. You'll be automatically logged in and redirected!

### What Happens Behind the Scenes
When you click a portal button:
1. Frontend calls `POST /api/auth/login` with:
   ```json
   {
     "tenantId": "demo",
     "username": "patient",  // or "clinician" or "admin"
     "password": "Adyar2Austin"
   }
   ```
2. Backend returns a token and user info
3. Frontend stores it in localStorage
4. You're redirected to `/demo/patient` (or the appropriate portal)

## What Changed from Before

### Before (Old Screen):
```
┌────────────────────────────────┐
│   Access Required              │
│                                │
│   Password                     │
│   [Enter access password]      │
│                                │
│   [Access Platform]            │
└────────────────────────────────┘
```
You had to enter "Adyar2Austin" first, THEN see the login options.

### After (New Screen):
```
┌────────────────────────────────┐
│   Tenant ID                    │
│   [demo] ← Pre-filled          │
│                                │
│   [Patient] [Clinician] [Admin]│
│                                │
│   Click any button to login!   │
│                                │
│   Demo Credentials Box:        │
│   • Tenant ID: demo            │
│   • Password: Adyar2Austin     │
└────────────────────────────────┘
```
Direct access to login - no intermediate password screen!

## Example Flow

### Scenario: Login as Patient

1. **Visit:** `http://localhost:3001/login`
2. **See:** Tenant ID field with "demo" already filled in
3. **Click:** "Access Patient Portal" button
4. **Result:** Redirected to `http://localhost:3001/demo/patient`

### Scenario: Login as Clinician

1. **Visit:** `http://localhost:3001/login`
2. **Verify:** Tenant ID is "demo"
3. **Click:** "Clinician" tab
4. **Click:** "Access Clinician Portal" button
5. **Result:** Redirected to `http://localhost:3001/demo/clinician`

### Scenario: Different Tenant

1. **Visit:** `http://localhost:3001/login`
2. **Change:** Tenant ID from "demo" to "hospital-abc"
3. **Click:** Any portal button
4. **Result:** Login with tenant "hospital-abc" (if it exists)

## Troubleshooting

### "Login failed" Error
- **Check:** Backend is running on `http://localhost:3000`
- **Check:** Tenant ID is not empty
- **Try:** Use "demo" as the tenant ID

### Redirect to Wrong URL
- **Check:** Tenant ID is correct
- **Expected:** URL should be `/demo/patient` not `/undefined/patient`

### Button Disabled
- **Check:** Tenant ID field is not empty
- **Fix:** Enter "demo" in the Tenant ID field

## Browser Console Check

After clicking a portal button, check the browser console (F12) for:
```
POST http://localhost:3000/api/auth/login
Status: 200 OK
Response: { success: true, token: "...", user: {...}, tenant: {...} }
```

## Next Steps

After successful login, you'll be at the portal page and all API calls will include:
```
X-Tenant-ID: demo
Authorization: Bearer eyJ...
```

Check the Network tab (F12) to verify headers are being sent!
