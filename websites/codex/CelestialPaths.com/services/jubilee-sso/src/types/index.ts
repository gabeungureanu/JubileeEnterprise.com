import type { Context } from 'hono';

export interface User {
  id: string;
  email: string;
  emailVerified: boolean;
  passwordHash: string;
  displayName: string | null;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
}

export interface Session {
  id: string;
  userId: string;
  refreshToken: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
}

export interface OAuthClient {
  id: string;
  clientId: string;
  clientSecretHash: string | null;
  name: string;
  redirectUris: string[];
  allowedScopes: string[];
  allowedGrantTypes: GrantType[];
  isConfidential: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthorizationCode {
  code: string;
  clientId: string;
  userId: string;
  redirectUri: string;
  scope: string[];
  codeChallenge: string | null;
  codeChallengeMethod: 'S256' | 'plain' | null;
  expiresAt: Date;
  usedAt: Date | null;
}

export interface TokenPayload {
  sub: string;
  iss: string;
  aud: string | string[];
  exp: number;
  iat: number;
  scope?: string;
  client_id?: string;
}

export interface IdTokenPayload extends TokenPayload {
  email?: string;
  email_verified?: boolean;
  name?: string;
  nonce?: string;
  auth_time?: number;
  at_hash?: string;
}

export interface AuditLogEntry {
  id: string;
  eventType: AuditEventType;
  userId: string | null;
  clientId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export type GrantType =
  | 'authorization_code'
  | 'refresh_token'
  | 'client_credentials';

export type AuditEventType =
  | 'login_success'
  | 'login_failure'
  | 'logout'
  | 'token_issued'
  | 'token_refreshed'
  | 'token_revoked'
  | 'password_changed'
  | 'email_verified'
  | 'account_locked'
  | 'account_unlocked'
  | 'client_registered'
  | 'authorization_granted'
  | 'authorization_denied';

export interface JWKSResponse {
  keys: JsonWebKey[];
}

export interface OpenIDConfiguration {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint: string;
  jwks_uri: string;
  registration_endpoint?: string;
  scopes_supported: string[];
  response_types_supported: string[];
  response_modes_supported: string[];
  grant_types_supported: string[];
  subject_types_supported: string[];
  id_token_signing_alg_values_supported: string[];
  token_endpoint_auth_methods_supported: string[];
  claims_supported: string[];
  code_challenge_methods_supported: string[];
}

export interface AppContext extends Context {
  user?: User;
  clientId?: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  refresh_token?: string;
  id_token?: string;
  scope?: string;
}

export interface ErrorResponse {
  error: string;
  error_description?: string;
}
