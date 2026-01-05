import { getDatabase } from './database.js';
import { hashToken, generateAuthorizationCode, verifyCodeChallenge, generateId } from '../utils/crypto.js';
import { auditLog, getLogger } from '../utils/logger.js';
import { getConfig } from '../config/index.js';
import type { OAuthClient, AuthorizationCode, GrantType } from '../types/index.js';

export async function findClientById(clientId: string): Promise<OAuthClient | null> {
  const db = getDatabase();

  const [client] = await db<OAuthClient[]>`
    SELECT
      id,
      client_id as "clientId",
      client_secret_hash as "clientSecretHash",
      name,
      redirect_uris as "redirectUris",
      allowed_scopes as "allowedScopes",
      allowed_grant_types as "allowedGrantTypes",
      is_confidential as "isConfidential",
      created_at as "createdAt",
      updated_at as "updatedAt"
    FROM oauth_clients
    WHERE client_id = ${clientId}
  `;

  return client ?? null;
}

export async function validateClientCredentials(
  clientId: string,
  clientSecret: string
): Promise<OAuthClient | null> {
  const db = getDatabase();
  const secretHash = hashToken(clientSecret);

  const [client] = await db<OAuthClient[]>`
    SELECT
      id,
      client_id as "clientId",
      client_secret_hash as "clientSecretHash",
      name,
      redirect_uris as "redirectUris",
      allowed_scopes as "allowedScopes",
      allowed_grant_types as "allowedGrantTypes",
      is_confidential as "isConfidential",
      created_at as "createdAt",
      updated_at as "updatedAt"
    FROM oauth_clients
    WHERE client_id = ${clientId}
      AND client_secret_hash = ${secretHash}
  `;

  return client ?? null;
}

export function validateRedirectUri(client: OAuthClient, redirectUri: string): boolean {
  return client.redirectUris.includes(redirectUri);
}

export function validateScopes(client: OAuthClient, requestedScopes: string[]): boolean {
  return requestedScopes.every((scope) => client.allowedScopes.includes(scope));
}

export function validateGrantType(client: OAuthClient, grantType: GrantType): boolean {
  return client.allowedGrantTypes.includes(grantType);
}

export interface CreateAuthCodeInput {
  clientId: string;
  userId: string;
  redirectUri: string;
  scope: string[];
  codeChallenge?: string;
  codeChallengeMethod?: 'S256' | 'plain';
}

export async function createAuthorizationCode(input: CreateAuthCodeInput): Promise<string> {
  const db = getDatabase();
  const config = getConfig();
  const logger = getLogger();

  const code = generateAuthorizationCode();
  const codeHash = hashToken(code);
  const expiresAt = new Date(Date.now() + config.AUTH_CODE_TTL * 1000);

  await db`
    INSERT INTO authorization_codes (
      code_hash,
      client_id,
      user_id,
      redirect_uri,
      scope,
      code_challenge,
      code_challenge_method,
      expires_at
    )
    VALUES (
      ${codeHash},
      ${input.clientId},
      ${input.userId},
      ${input.redirectUri},
      ${input.scope},
      ${input.codeChallenge ?? null},
      ${input.codeChallengeMethod ?? null},
      ${expiresAt}
    )
  `;

  logger.debug({ clientId: input.clientId, userId: input.userId }, 'Authorization code created');

  auditLog({
    eventType: 'authorization_granted',
    userId: input.userId,
    clientId: input.clientId,
    ipAddress: null,
    userAgent: null,
    success: true,
    metadata: { scope: input.scope },
  });

  return code;
}

export interface RedeemAuthCodeResult {
  success: boolean;
  authCode?: AuthorizationCode & { userId: string };
  error?: string;
}

export async function redeemAuthorizationCode(
  code: string,
  clientId: string,
  redirectUri: string,
  codeVerifier?: string
): Promise<RedeemAuthCodeResult> {
  const db = getDatabase();
  const codeHash = hashToken(code);

  const [authCode] = await db<(AuthorizationCode & { userId: string })[]>`
    SELECT
      code_hash as "code",
      client_id as "clientId",
      user_id as "userId",
      redirect_uri as "redirectUri",
      scope,
      code_challenge as "codeChallenge",
      code_challenge_method as "codeChallengeMethod",
      expires_at as "expiresAt",
      used_at as "usedAt"
    FROM authorization_codes
    WHERE code_hash = ${codeHash}
  `;

  if (authCode === undefined) {
    return { success: false, error: 'invalid_grant' };
  }

  if (authCode.clientId !== clientId) {
    return { success: false, error: 'invalid_grant' };
  }

  if (authCode.redirectUri !== redirectUri) {
    return { success: false, error: 'invalid_grant' };
  }

  if (authCode.usedAt !== null) {
    await db`
      DELETE FROM refresh_tokens
      WHERE user_id = ${authCode.userId}
        AND client_id = ${clientId}
    `;
    return { success: false, error: 'invalid_grant' };
  }

  if (new Date() > authCode.expiresAt) {
    return { success: false, error: 'invalid_grant' };
  }

  if (authCode.codeChallenge !== null && authCode.codeChallengeMethod !== null) {
    if (codeVerifier === undefined) {
      return { success: false, error: 'invalid_grant' };
    }

    const isValid = verifyCodeChallenge(
      codeVerifier,
      authCode.codeChallenge,
      authCode.codeChallengeMethod
    );

    if (!isValid) {
      return { success: false, error: 'invalid_grant' };
    }
  }

  await db`
    UPDATE authorization_codes
    SET used_at = NOW()
    WHERE code_hash = ${codeHash}
  `;

  return { success: true, authCode };
}

export interface CreateRefreshTokenInput {
  userId: string;
  clientId: string;
  scope: string[];
  userAgent?: string;
  ipAddress?: string;
}

export async function createRefreshToken(input: CreateRefreshTokenInput): Promise<string> {
  const db = getDatabase();
  const config = getConfig();

  const token = generateAuthorizationCode();
  const tokenHash = hashToken(token);
  const id = generateId();
  const expiresAt = new Date(Date.now() + config.JWT_REFRESH_TOKEN_TTL * 1000);

  await db`
    INSERT INTO refresh_tokens (
      id,
      token_hash,
      user_id,
      client_id,
      scope,
      user_agent,
      ip_address,
      expires_at
    )
    VALUES (
      ${id},
      ${tokenHash},
      ${input.userId},
      ${input.clientId},
      ${input.scope},
      ${input.userAgent ?? null},
      ${input.ipAddress ?? null},
      ${expiresAt}
    )
  `;

  return token;
}

export interface RefreshTokenData {
  id: string;
  userId: string;
  clientId: string;
  scope: string[];
  expiresAt: Date;
}

export async function validateRefreshToken(
  token: string,
  clientId: string
): Promise<RefreshTokenData | null> {
  const db = getDatabase();
  const tokenHash = hashToken(token);

  const [refreshToken] = await db<RefreshTokenData[]>`
    SELECT
      id,
      user_id as "userId",
      client_id as "clientId",
      scope,
      expires_at as "expiresAt"
    FROM refresh_tokens
    WHERE token_hash = ${tokenHash}
      AND client_id = ${clientId}
      AND revoked_at IS NULL
      AND expires_at > NOW()
  `;

  return refreshToken ?? null;
}

export async function rotateRefreshToken(
  oldTokenId: string,
  input: CreateRefreshTokenInput
): Promise<string> {
  const db = getDatabase();

  await db`
    UPDATE refresh_tokens
    SET revoked_at = NOW()
    WHERE id = ${oldTokenId}
  `;

  return createRefreshToken(input);
}

export async function revokeRefreshToken(token: string): Promise<void> {
  const db = getDatabase();
  const tokenHash = hashToken(token);

  await db`
    UPDATE refresh_tokens
    SET revoked_at = NOW()
    WHERE token_hash = ${tokenHash}
  `;
}

export async function revokeAllUserTokens(userId: string, clientId?: string): Promise<void> {
  const db = getDatabase();

  if (clientId !== undefined) {
    await db`
      UPDATE refresh_tokens
      SET revoked_at = NOW()
      WHERE user_id = ${userId}
        AND client_id = ${clientId}
        AND revoked_at IS NULL
    `;
  } else {
    await db`
      UPDATE refresh_tokens
      SET revoked_at = NOW()
      WHERE user_id = ${userId}
        AND revoked_at IS NULL
    `;
  }
}
