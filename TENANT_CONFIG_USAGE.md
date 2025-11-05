# Tenant Configuration Usage Guide

## Overview

The system now automatically fetches and applies tenant-specific configuration on login and page load. The tenant config includes branding, features, and settings that can be used to customize the UI.

## When Config is Loaded

The tenant config is fetched automatically in two scenarios:

1. **During Login** - After successful authentication, the full tenant config is fetched
2. **On Page Load** - When the app loads and finds existing auth data, it refreshes the tenant config

## Tenant Config Structure

```typescript
{
  id: "demo",
  name: "Demo Hospital",
  status: "active" | "inactive" | "suspended",
  type: "demo" | "production",
  branding: {
    logo: "https://...",
    favicon: "https://...",
    primaryColor: "#3b82f6",
    secondaryColor: "#60a5fa",
    accentColor: "#1e40af"
  },
  features: {
    aiGeneration: true,
    multiLanguage: true,
    supportedLanguages: ["en", "es", "hi", "vi", "fr"],
    fileUpload: true,
    expertPortal: true,
    clinicianPortal: true,
    adminPortal: true
  },
  config: {
    simplificationEnabled: true,
    translationEnabled: true,
    defaultLanguage: "en"
  }
}
```

## Using Tenant Config in Components

### Method 1: Using the Tenant Context Hook

```typescript
'use client'

import { useTenant } from '@/contexts/tenant-context'

export function MyComponent() {
  const { tenant, user, tenantId } = useTenant()

  // Access branding
  const primaryColor = tenant?.branding.primaryColor
  const logo = tenant?.branding.logo

  // Check features
  const canUseAI = tenant?.features.aiGeneration
  const supportedLanguages = tenant?.features.supportedLanguages

  // Check config
  const isSimplificationEnabled = tenant?.config.simplificationEnabled

  return (
    <div>
      {tenant && (
        <>
          <img src={logo} alt={tenant.name} />
          <h1 style={{ color: primaryColor }}>{tenant.name}</h1>

          {canUseAI && <AIFeatureButton />}

          {tenant.features.multiLanguage && (
            <LanguageSelector languages={supportedLanguages} />
          )}
        </>
      )}
    </div>
  )
}
```

### Method 2: Using Specialized Hooks

```typescript
'use client'

import {
  useTenantBranding,
  useTenantFeatures,
  useTenantConfig
} from '@/components/tenant-branding'

export function MyComponent() {
  const branding = useTenantBranding()
  const features = useTenantFeatures()
  const config = useTenantConfig()

  return (
    <div>
      {branding && (
        <div style={{
          backgroundColor: branding.primaryColor,
          color: 'white'
        }}>
          Tenant-styled header
        </div>
      )}

      {features?.expertPortal && (
        <Link href="/demo/expert">Expert Portal</Link>
      )}

      {config?.simplificationEnabled && (
        <SimplificationToggle />
      )}
    </div>
  )
}
```

### Method 3: Automatic Branding with TenantBranding Component

Add this to your layout to automatically apply tenant colors:

```typescript
import { TenantBranding } from '@/components/tenant-branding'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <TenantProvider>
          <TenantBranding /> {/* Applies tenant colors automatically */}
          {children}
        </TenantProvider>
      </body>
    </html>
  )
}
```

This automatically:
- Sets CSS variables: `--tenant-primary`, `--tenant-secondary`, `--tenant-accent`
- Updates the favicon
- Logs color values to console

Then use in your CSS:

```css
.my-button {
  background-color: var(--tenant-primary);
}

.my-link {
  color: var(--tenant-accent);
}
```

## Conditional Rendering Based on Features

### Example: Show/Hide Features

```typescript
'use client'

import { useTenant } from '@/contexts/tenant-context'

export function PortalNavigation() {
  const { tenant } = useTenant()

  if (!tenant) return null

  return (
    <nav>
      <Link href={`/${tenant.id}/patient`}>Patient Portal</Link>

      {tenant.features.clinicianPortal && (
        <Link href={`/${tenant.id}/clinician`}>Clinician Portal</Link>
      )}

      {tenant.features.adminPortal && (
        <Link href={`/${tenant.id}/admin`}>Admin Portal</Link>
      )}

      {tenant.features.expertPortal && (
        <Link href={`/${tenant.id}/expert`}>Expert Portal</Link>
      )}
    </nav>
  )
}
```

### Example: Language Support

```typescript
'use client'

import { useTenant } from '@/contexts/tenant-context'

export function LanguageSelector() {
  const { tenant } = useTenant()
  const [language, setLanguage] = useState('en')

  if (!tenant?.features.multiLanguage) {
    return null // Don't show if multi-language not enabled
  }

  return (
    <select
      value={language}
      onChange={(e) => setLanguage(e.target.value)}
    >
      {tenant.features.supportedLanguages.map(lang => (
        <option key={lang} value={lang}>
          {lang.toUpperCase()}
        </option>
      ))}
    </select>
  )
}
```

### Example: AI Features

```typescript
'use client'

import { useTenant } from '@/contexts/tenant-context'

export function DischargeSummary() {
  const { tenant } = useTenant()

  return (
    <div>
      <h2>Discharge Summary</h2>

      {tenant?.features.aiGeneration && (
        <button onClick={generateWithAI}>
          Generate with AI
        </button>
      )}

      {tenant?.config.simplificationEnabled && (
        <button onClick={simplifyText}>
          Simplify Language
        </button>
      )}

      {tenant?.config.translationEnabled && (
        <button onClick={translateText}>
          Translate
        </button>
      )}
    </div>
  )
}
```

## Console Logging

Watch the browser console for tenant config logs:

```
[TenantContext] Loaded tenant config: { id: 'demo', name: 'Demo Hospital', ... }
[TenantContext] Fetched tenant config: { id: 'demo', ... }
[TenantBranding] Applied tenant colors: { primary: '#3b82f6', ... }
```

## Updating Tenant Config

To update tenant config dynamically:

```typescript
'use client'

import { useTenant } from '@/contexts/tenant-context'

export function AdminPanel() {
  const { tenant, updateTenant } = useTenant()

  const handleUpdateBranding = async () => {
    const updatedTenant = {
      ...tenant,
      branding: {
        ...tenant.branding,
        primaryColor: '#ff0000' // New color
      }
    }

    updateTenant(updatedTenant)
  }

  return <button onClick={handleUpdateBranding}>Change Color</button>
}
```

## Backend Configuration

The tenant config is returned by `GET /api/config` endpoint:

```typescript
// Backend: src/auth/auth.controller.ts

@Get('config')
async getTenantConfig(@TenantContext() ctx: TenantContextType) {
  // Fetch from database in production
  return {
    success: true,
    tenant: {
      id: ctx.tenantId,
      name: 'Demo Hospital',
      branding: { ... },
      features: { ... },
      config: { ... }
    }
  }
}
```

## Best Practices

1. **Always Check if Tenant Exists**
   ```typescript
   if (!tenant) return null
   ```

2. **Use Optional Chaining**
   ```typescript
   const color = tenant?.branding.primaryColor
   ```

3. **Provide Fallbacks**
   ```typescript
   const logo = tenant?.branding.logo || '/default-logo.png'
   ```

4. **Feature Flags**
   ```typescript
   {tenant?.features.aiGeneration && <AIButton />}
   ```

5. **Loading States**
   ```typescript
   const { tenant, isLoading } = useTenant()
   if (isLoading) return <Spinner />
   ```

## Example: Complete Portal Page

```typescript
'use client'

import { useTenant } from '@/contexts/tenant-context'
import { AuthGuard } from '@/components/auth-guard'

export default function PatientPortal() {
  const { tenant, user, isLoading } = useTenant()

  if (isLoading) {
    return <LoadingSpinner />
  }

  return (
    <AuthGuard>
      <div>
        {/* Header with tenant branding */}
        <header style={{
          backgroundColor: tenant?.branding.primaryColor
        }}>
          <img src={tenant?.branding.logo} alt={tenant?.name} />
          <h1>{tenant?.name} - Patient Portal</h1>
        </header>

        {/* Welcome message */}
        <h2>Welcome, {user?.name}!</h2>

        {/* Conditional features */}
        {tenant?.features.fileUpload && (
          <FileUploadSection />
        )}

        {tenant?.config.simplificationEnabled && (
          <SimplifiedInstructions />
        )}

        {tenant?.features.multiLanguage && (
          <LanguageSelector
            languages={tenant.features.supportedLanguages}
            defaultLanguage={tenant.config.defaultLanguage}
          />
        )}
      </div>
    </AuthGuard>
  )
}
```

## Testing Different Tenant Configs

In development, you can modify the backend response to test different configs:

```typescript
// backend/src/auth/auth.controller.ts

@Get('config')
async getTenantConfig(@TenantContext() ctx: TenantContextType) {
  return {
    success: true,
    tenant: {
      id: ctx.tenantId,
      name: ctx.tenantId === 'demo' ? 'Demo Hospital' : 'Test Hospital',
      branding: {
        primaryColor: ctx.tenantId === 'demo' ? '#3b82f6' : '#10b981',
        // ... different colors per tenant
      },
      features: {
        aiGeneration: ctx.tenantId === 'demo',
        multiLanguage: true,
        // ... different features per tenant
      }
    }
  }
}
```

Then test with different tenant IDs: `demo`, `hospital1`, `hospital2`, etc.
