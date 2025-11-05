# User Seeding Script

This script creates sample users in Firestore with hashed passwords for testing the authentication API.

## Usage

```bash
cd /root/patient-discharge/backend
npm run seed-users
```

Or with a specific environment:

```bash
NODE_ENV=dev npm run seed-users
```

## Sample Users Created

The script creates the following users in the `demo` tenant:

1. **patient** (Patient role)
   - Username: `patient`
   - Password: `Adyar2Austin`
   - Name: John Smith
   - Linked Patient ID: `patient-demo-001`

2. **clinician** (Clinician role)
   - Username: `clinician`
   - Password: `Demo123!`
   - Name: Dr. Jane Doe

3. **expert** (Expert role)
   - Username: `expert`
   - Password: `Demo123!`
   - Name: Dr. Expert Review

4. **admin** (Admin role)
   - Username: `admin`
   - Password: `Admin123!`
   - Name: System Administrator

## Features

- ✅ Automatically hashes passwords using bcrypt (10 salt rounds)
- ✅ Checks for existing users to avoid duplicates
- ✅ Uses Firestore configuration from `.settings.{env}/config.yaml`
- ✅ Falls back to Application Default Credentials if no service account found

## Testing the Login API

After seeding users, you can test the login endpoint:

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "demo",
    "username": "patient",
    "password": "Adyar2Austin"
  }'
```

## Customizing Users

To add or modify users, edit the `sampleUsers` array in `scripts/seed-users.ts`:

```typescript
const sampleUsers: UserSeed[] = [
  {
    tenantId: 'demo',
    username: 'your-username',
    password: 'your-password',
    name: 'Your Name',
    role: 'patient', // or 'clinician', 'expert', 'admin'
    linkedPatientId: 'optional-patient-id', // Only for patient role
  },
  // ... more users
];
```

## Notes

- Passwords are stored as bcrypt hashes in Firestore
- The script skips users that already exist (by tenantId + username)
- Make sure your Firestore service account has write permissions
- The `demo` tenant should exist in your `config.yaml` or the script will still work but the login may fail if the tenant config is missing

