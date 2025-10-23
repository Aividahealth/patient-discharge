export enum AuthType {
  SYSTEM = 'system',
  PROVIDER = 'provider'
}

export interface SystemAppConfig {
  client_id: string;
  client_secret: string;
  token_url: string;
  scopes: string;
}

export interface ProviderAppConfig {
  client_id: string;
  client_secret: string;
  authorization_url: string;
  token_url: string;
  redirect_uri: string;
  scopes: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope?: string;
}

export interface UserSession {
  id: string;
  userId: string;
  tenantId: string;
  authType: AuthType;
  tokens: AuthTokens;
  expiresAt: Date;
  createdAt: Date;
  lastAccessedAt: Date;
}

export interface SSOInitiationRequest {
  redirect_uri?: string;
  state?: string;
  launch?: string;
}

export interface SSOCallbackRequest {
  code: string;
  state: string;
  session_state?: string;
}

export interface AuthContext {
  tenantId: string;
  userId?: string;
  sessionId?: string;
  authType: AuthType;
}
