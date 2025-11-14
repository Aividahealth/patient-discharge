# Service Token cURL Examples

## Basic Format

```bash
curl -X <METHOD> http://localhost:3000/api/<endpoint> \
  -H "Authorization: Bearer <YOUR_ID_TOKEN>" \
  -H "X-Tenant-ID: <tenant-id>" \
  -H "Content-Type: application/json"
```

## Step 1: Generate a Service Token

```bash
cd backend
npm run generate-service-token -- --tenant-id demo
```

This will output a token like:
```
eyJhbGciOiJSUzI1NiIsImtpZCI6IjRmZWI0NGYwZjdhN2UyN2M3YzQwMzM3OWFmZjIwYWY1YzhjZjUyZGMiLCJ0eXAiOiJKV1QifQ.eyJhdWQiOiIxMDU4MzMwODMyODUwMDc5MjEzNDQiLCJhenAiOiJkaXNjaGFyZ2UtZXhwb3J0LXByb2Nlc3Nvci1zYUBzaW10cmFuLTQ3NDAxOC5pYW0uZ3NlcnZpY2VhY2NvdW50LmNvbSIsImVtYWlsIjoiZGlzY2hhcmdlLWV4cG9ydC1wcm9jZXNzb3Itc2FAc2ltdHJhbi00NzQwMTguaWFtLmdzZXJ2aWNlYWNjb3VudC5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwiZXhwIjoxNzYzMDk2MzYwLCJpYXQiOjE3NjMwOTI3NjAsImlzcyI6Imh0dHBzOi8vYWNjb3VudHMuZ29vZ2xlLmNvbSIsInN1YiI6IjEwNTgzMzA4MzI4NTAwNzkyMTM0NCJ9.COLWP8oHChLM002DzWXl1iZunEa6DUopn0kq5XX3UZWvK8V-hsxMVICc4_X5YkCEXesjeEMS3MgW34emp6EJRIwEbNwOi1ehiIrXtX1V4C99WCW1wUjgS5wv50tgXv9LWGqxQUUh2QqQ7PeZUh_dn7r1Wn9WhGPi9ND-sx52FGnZA3VMnnKxOtKsgs7LFOd5NX5_JVigBE8yXYhtUAuos1SMuMM18zb1UXZ761nkIFtlZu3zpAWiUkxcM_fwz7D1NvBTebWG9Exgz_8hZgduZ5dT2DvXrwjZtu8RU34Xjo0Y2Dka_d3gAda_eO9Ozj2iu5NNrdYB75NV4fc6EQ918g
```

## Step 2: Use the Token in cURL Requests

### Example 1: GET Request (Discharge Queue)

```bash
curl -X GET http://localhost:3000/api/patients/discharge-queue \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIsImtpZCI6IjRmZWI0NGYwZjdhN2UyN2M3YzQwMzM3OWFmZjIwYWY1YzhjZjUyZGMiLCJ0eXAiOiJKV1QifQ.eyJhdWQiOiIxMDU4MzMwODMyODUwMDc5MjEzNDQiLCJhenAiOiJkaXNjaGFyZ2UtZXhwb3J0LXByb2Nlc3Nvci1zYUBzaW10cmFuLTQ3NDAxOC5pYW0uZ3NlcnZpY2VhY2NvdW50LmNvbSIsImVtYWlsIjoiZGlzY2hhcmdlLWV4cG9ydC1wcm9jZXNzb3Itc2FAc2ltdHJhbi00NzQwMTguaWFtLmdzZXJ2aWNlYWNjb3VudC5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwiZXhwIjoxNzYzMDk2MzYwLCJpYXQiOjE3NjMwOTI3NjAsImlzcyI6Imh0dHBzOi8vYWNjb3VudHMuZ29vZ2xlLmNvbSIsInN1YiI6IjEwNTgzMzA4MzI4NTAwNzkyMTM0NCJ9.COLWP8oHChLM002DzWXl1iZunEa6DUopn0kq5XX3UZWvK8V-hsxMVICc4_X5YkCEXesjeEMS3MgW34emp6EJRIwEbNwOi1ehiIrXtX1V4C99WCW1wUjgS5wv50tgXv9LWGqxQUUh2QqQ7PeZUh_dn7r1Wn9WhGPi9ND-sx52FGnZA3VMnnKxOtKsgs7LFOd5NX5_JVigBE8yXYhtUAuos1SMuMM18zb1UXZ761nkIFtlZu3zpAWiUkxcM_fwz7D1NvBTebWG9Exgz_8hZgduZ5dT2DvXrwjZtu8RU34Xjo0Y2Dka_d3gAda_eO9Ozj2iu5NNrdYB75NV4fc6EQ918g" \
  -H "X-Tenant-ID: demo"
```

### Example 2: Using Environment Variable

```bash
# Set token as environment variable
export SERVICE_TOKEN="eyJhbGciOiJSUzI1NiIsImtpZCI6IjRmZWI0NGYwZjdhN2UyN2M3YzQwMzM3OWFmZjIwYWY1YzhjZjUyZGMiLCJ0eXAiOiJKV1QifQ.eyJhdWQiOiIxMDU4MzMwODMyODUwMDc5MjEzNDQiLCJhenAiOiJkaXNjaGFyZ2UtZXhwb3J0LXByb2Nlc3Nvci1zYUBzaW10cmFuLTQ3NDAxOC5pYW0uZ3NlcnZpY2VhY2NvdW50LmNvbSIsImVtYWlsIjoiZGlzY2hhcmdlLWV4cG9ydC1wcm9jZXNzb3Itc2FAc2ltdHJhbi00NzQwMTguaWFtLmdzZXJ2aWNlYWNjb3VudC5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwiZXhwIjoxNzYzMDk2MzYwLCJpYXQiOjE3NjMwOTI3NjAsImlzcyI6Imh0dHBzOi8vYWNjb3VudHMuZ29vZ2xlLmNvbSIsInN1YiI6IjEwNTgzMzA4MzI4NTAwNzkyMTM0NCJ9.COLWP8oHChLM002DzWXl1iZunEa6DUopn0kq5XX3UZWvK8V-hsxMVICc4_X5YkCEXesjeEMS3MgW34emp6EJRIwEbNwOi1ehiIrXtX1V4C99WCW1wUjgS5wv50tgXv9LWGqxQUUh2QqQ7PeZUh_dn7r1Wn9WhGPi9ND-sx52FGnZA3VMnnKxOtKsgs7LFOd5NX5_JVigBE8yXYhtUAuos1SMuMM18zb1UXZ761nkIFtlZu3zpAWiUkxcM_fwz7D1NvBTebWG9Exgz_8hZgduZ5dT2DvXrwjZtu8RU34Xjo0Y2Dka_d3gAda_eO9Ozj2iu5NNrdYB75NV4fc6EQ918g"

# Use in curl
curl -X GET http://localhost:3000/api/patients/discharge-queue \
  -H "Authorization: Bearer $SERVICE_TOKEN" \
  -H "X-Tenant-ID: demo"
```

### Example 3: POST Request with Body

```bash
curl -X POST http://localhost:3000/api/expert/feedback \
  -H "Authorization: Bearer $SERVICE_TOKEN" \
  -H "X-Tenant-ID: demo" \
  -H "Content-Type: application/json" \
  -d '{
    "dischargeSummaryId": "9f0d413e-8d13-4736-b961-5df1bc71582d",
    "reviewType": "simplification",
    "reviewerName": "Dr. Jane Smith",
    "overallRating": 4,
    "hasHallucination": false,
    "hasMissingInfo": false
  }'
```

### Example 4: Pretty Print Response

```bash
curl -X GET http://localhost:3000/api/patients/discharge-queue \
  -H "Authorization: Bearer $SERVICE_TOKEN" \
  -H "X-Tenant-ID: demo" \
  | jq .
```

## Required Headers

1. **Authorization**: `Bearer <your-id-token>`
   - Must start with "Bearer " (with space)
   - Token must be a valid Google OIDC ID token

2. **X-Tenant-ID**: `<tenant-id>`
   - Required for all authenticated requests
   - Example: `demo`, `tenant1`, etc.

3. **Content-Type**: `application/json` (for POST/PUT requests with body)

## Important Notes

- **Token Expiration**: Service tokens expire in 1 hour. Regenerate as needed.
- **Token Format**: Must be a valid JWT with 3 segments (header.payload.signature)
- **Case Sensitivity**: Header names are case-insensitive, but `Bearer` must be capitalized
- **No Spaces**: Ensure no extra spaces in the Authorization header value

## Troubleshooting

### Error: "Missing Authorization header"
- Make sure the header is named `Authorization` (or `authorization`)
- Check that the header value starts with `Bearer ` (with space)

### Error: "Invalid token format"
- Token must have exactly 3 segments separated by dots
- Ensure the token is not truncated or modified

### Error: "jwt malformed"
- Token might be expired (regenerate)
- Token might not be a valid JWT format
- Check that you're using the full token from the generation script

### Error: "Missing X-Tenant-ID header"
- Always include `X-Tenant-ID` header with your tenant ID

