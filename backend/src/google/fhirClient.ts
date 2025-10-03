import axios, { AxiosInstance } from 'axios';
import { getGoogleAccessToken, getGoogleAuthClient } from './auth.js';

const FHIR_SCOPE = 'https://www.googleapis.com/auth/cloud-healthcare';

export async function createFhirAxiosClient(baseUrl: string): Promise<AxiosInstance> {
  if (!baseUrl) {
    throw new Error('Missing FHIR baseUrl');
  }
  const instance = axios.create({
    baseURL: baseUrl,
    headers: {
      'Content-Type': 'application/fhir+json',
      Accept: 'application/fhir+json',
    },
    timeout: 30000,
  });
  const authClient = await getGoogleAuthClient([FHIR_SCOPE]);
  instance.interceptors.request.use(async (config) => {
    const token = await authClient.getAccessToken();
    const bearer = token?.token;
    if (bearer) {
      config.headers = config.headers ?? {};
      (config.headers as any).Authorization = `Bearer ${bearer}`;
    }
    return config;
  });
  return instance;
}


