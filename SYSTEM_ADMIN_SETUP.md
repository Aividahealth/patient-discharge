# System Admin Setup Guide

This guide explains how to set up and use the System Admin portal for multi-tenant management.

## Overview

The System Admin portal allows you to:
- View aggregated metrics across all tenants
- Onboard new tenants
- Manage tenant configurations
- Create tenant admin users
- View per-tenant metrics and analytics

## Initial Setup

### 1. Create the First System Admin User

To create your first system admin user, you need to manually add a user to Firestore with the `system_admin` role.

#### Using Firestore Console:

1. Go to the [Firebase Console](https://console.firebase.google.com/)
2. Navigate to Firestore Database
3. Go to the `users` collection
4. Click "Add document"
5. Use the following structure:

```json
{
  "tenantId": "system",
  "username": "sysadmin",
  "passwordHash": "<bcrypt-hash-of-password>",
  "name": "System Administrator",
  "role": "system_admin",
  "createdAt": "<current-timestamp>",
  "updatedAt": "<current-timestamp>"
}
```

#### Generating a Password Hash:

You can use the following Node.js script to generate a bcrypt password hash:

```javascript
const bcrypt = require('bcryptjs');

async function generateHash(password) {
  const hash = await bcrypt.hash(password, 10);
  console.log('Password hash:', hash);
}

generateHash('your-secure-password');
```

Or use the backend's auth service in a temporary script:

```typescript
// create-sysadmin.ts (place in backend/src/scripts/)
import { Firestore } from '@google-cloud/firestore';
import * as bcrypt from 'bcryptjs';

async function createSystemAdmin() {
  const firestore = new Firestore();
  const passwordHash = await bcrypt.hash('YourSecurePassword123!', 10);

  await firestore.collection('users').add({
    tenantId: 'system',
    username: 'sysadmin',
    passwordHash,
    name: 'System Administrator',
    role: 'system_admin',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  console.log('System admin created successfully!');
}

createSystemAdmin();
```

### 2. Access the System Admin Portal

Once you've created a system admin user:

1. Navigate to `/system-admin/login`
2. Enter your username (e.g., `sysadmin`)
3. Enter your password
4. Click "Sign In"

You'll be redirected to the System Admin portal at `/system-admin`

## Features

### Dashboard

The dashboard shows aggregated metrics across all tenants:
- Total number of tenants
- Total users across all tenants
- Total discharge summaries
- Average feedback rating
- Per-tenant breakdown table

### Tenants

View and manage all tenants:
- List all tenants with their configurations
- View detailed metrics for each tenant
- Delete tenants (⚠️ This is permanent!)

### Onboarding

Create new tenants with the onboarding form:
- **Tenant ID**: Unique identifier (e.g., `hospital-a`)
- **Tenant Name**: Display name (e.g., "Hospital A")
- **Branding**: Logo URL and color scheme
- **Features**: Enable/disable portals and features

### Tenant Admins

Create admin users for specific tenants:
- Select the tenant from the dropdown
- Enter username, full name, and password
- The tenant admin will be able to log in at `/login` with their tenant ID

## Workflow

### Typical Onboarding Flow:

1. **System Admin** creates a new tenant via the Onboarding tab
2. **System Admin** creates a tenant admin user via the Tenant Admins tab
3. **Tenant Admin** logs in at `/login` using their tenant ID and credentials
4. **Tenant Admin** creates users (clinicians, patients, etc.) in their tenant's admin portal at `/:tenantId/admin`

## Security Considerations

- System admin users have access to ALL tenant data
- Only create system admin accounts for trusted personnel
- Use strong passwords for system admin accounts
- Consider enabling MFA in production (not implemented in this version)
- Regularly audit system admin access logs

## API Endpoints

The system admin portal uses these API endpoints:

- `GET /system-admin/tenants` - List all tenants
- `GET /system-admin/tenants/:tenantId` - Get a specific tenant
- `POST /system-admin/tenants` - Create a new tenant
- `PUT /system-admin/tenants/:tenantId` - Update a tenant
- `DELETE /system-admin/tenants/:tenantId` - Delete a tenant
- `POST /system-admin/tenant-admins` - Create a tenant admin user
- `GET /system-admin/metrics/aggregated` - Get aggregated metrics
- `GET /system-admin/metrics/tenants/:tenantId` - Get tenant-specific metrics

All endpoints require:
- `Authorization: Bearer <token>` header with a valid system admin JWT
- The user must have `role: 'system_admin'`

## Troubleshooting

### Cannot Login
- Verify your user document has `role: 'system_admin'`
- Verify `tenantId: 'system'` is set correctly
- Check that the password hash is valid

### Access Denied
- Ensure the JWT token contains `role: 'system_admin'`
- Check browser console for detailed error messages

### Tenant Not Found
- Verify the tenant exists in the `config` collection in Firestore
- Check that the tenant ID is correct (case-sensitive)

## Migration Notes

If you already have existing tenants in the YAML config:
- The system will recognize them for authentication
- To manage them via the system admin portal, migrate them to Firestore's `config` collection
- Follow the same structure as created by the onboarding form

## Future Enhancements

Potential improvements for the system admin portal:
- Audit logs for all system admin actions
- Bulk tenant operations
- Tenant usage reports and billing
- Multi-factor authentication
- Role-based access control for system admins
- Tenant data export/import
- System health monitoring
