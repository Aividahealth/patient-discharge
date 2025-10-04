import { promises as fs } from 'node:fs';
import path from 'node:path';
import { GoogleAuth } from 'google-auth-library';
import type { AuthClient } from 'google-auth-library';

export type GoogleServiceAccount = {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri?: string;
  token_uri?: string;
  auth_provider_x509_cert_url?: string;
  client_x509_cert_url?: string;
  universe_domain?: string;
};

const DEFAULT_SERVICE_ACCOUNT_ABS = '/root/patient-discharge/backend/.settings.dev/fhir_store_sa.json';

export async function readServiceAccount(
  filePath?: string,
): Promise<GoogleServiceAccount> {
  const resolvedPath = filePath
    || process.env.SERVICE_ACCOUNT_PATH
    || DEFAULT_SERVICE_ACCOUNT_ABS;
  const raw = await fs.readFile(path.resolve(resolvedPath), 'utf8');
  const parsed = JSON.parse(raw);
  return parsed as GoogleServiceAccount;
}

let cachedClients: Map<string, Promise<AuthClient>> = new Map();

export async function getGoogleAuthClient(scopes: string[]): Promise<AuthClient> {
  const key = scopes.sort().join(' ');
  const existing = cachedClients.get(key);
  if (existing) return existing;

  const ready = (async () => {
    const creds = await readServiceAccount();
    const auth = new GoogleAuth({
      credentials: {
        client_email: creds.client_email,
        private_key: creds.private_key,
      },
      scopes,
    });
    return auth.getClient();
  })();

  cachedClients.set(key, ready);
  return ready;
}

export async function getGoogleAccessToken(scopes: string[]): Promise<string> {
  const client = await getGoogleAuthClient(scopes);
  const token = await client.getAccessToken();
  if (!token || !token.token) {
    throw new Error('Failed to obtain Google access token');
  }
  return token.token;
}


