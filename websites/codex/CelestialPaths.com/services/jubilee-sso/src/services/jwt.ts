import * as jose from 'jose';
import { getConfig } from '../config/index.js';
import { computeAtHash } from '../utils/crypto.js';
import type { TokenPayload, IdTokenPayload } from '../types/index.js';

let privateKey: jose.KeyLike | null = null;
let publicKey: jose.KeyLike | null = null;
let jwks: jose.JSONWebKeySet | null = null;

export async function initializeKeys(): Promise<void> {
  const config = getConfig();

  privateKey = await jose.importPKCS8(config.JWT_SIGNING_KEY, config.JWT_ALGORITHM);
  publicKey = await jose.importSPKI(config.JWT_PUBLIC_KEY, config.JWT_ALGORITHM);

  const publicJwk = await jose.exportJWK(publicKey);
  publicJwk.use = 'sig';
  publicJwk.alg = config.JWT_ALGORITHM;
  publicJwk.kid = await generateKeyId(publicJwk);

  jwks = {
    keys: [publicJwk],
  };
}

async function generateKeyId(jwk: jose.JWK): Promise<string> {
  const thumbprint = await jose.calculateJwkThumbprint(jwk, 'sha256');
  return thumbprint;
}

export function getJWKS(): jose.JSONWebKeySet {
  if (jwks === null) {
    throw new Error('Keys not initialized. Call initializeKeys() first.');
  }
  return jwks;
}

export interface SignAccessTokenOptions {
  subject: string;
  audience: string | string[];
  scope?: string;
  clientId?: string;
}

export async function signAccessToken(options: SignAccessTokenOptions): Promise<string> {
  if (privateKey === null) {
    throw new Error('Keys not initialized');
  }

  const config = getConfig();
  const now = Math.floor(Date.now() / 1000);

  const payload: TokenPayload = {
    sub: options.subject,
    iss: config.ISSUER_URL,
    aud: options.audience,
    exp: now + config.JWT_ACCESS_TOKEN_TTL,
    iat: now,
    scope: options.scope,
    client_id: options.clientId,
  };

  const token = await new jose.SignJWT(payload as unknown as jose.JWTPayload)
    .setProtectedHeader({
      alg: config.JWT_ALGORITHM,
      typ: 'at+jwt',
      kid: jwks?.keys[0]?.kid,
    })
    .sign(privateKey);

  return token;
}

export interface SignIdTokenOptions {
  subject: string;
  audience: string;
  nonce?: string;
  email?: string;
  emailVerified?: boolean;
  name?: string;
  authTime?: number;
  accessToken?: string;
}

export async function signIdToken(options: SignIdTokenOptions): Promise<string> {
  if (privateKey === null) {
    throw new Error('Keys not initialized');
  }

  const config = getConfig();
  const now = Math.floor(Date.now() / 1000);

  const payload: IdTokenPayload = {
    sub: options.subject,
    iss: config.ISSUER_URL,
    aud: options.audience,
    exp: now + config.JWT_ID_TOKEN_TTL,
    iat: now,
    auth_time: options.authTime ?? now,
    nonce: options.nonce,
    email: options.email,
    email_verified: options.emailVerified,
    name: options.name,
    at_hash: options.accessToken !== undefined
      ? computeAtHash(options.accessToken, config.JWT_ALGORITHM)
      : undefined,
  };

  const token = await new jose.SignJWT(payload as unknown as jose.JWTPayload)
    .setProtectedHeader({
      alg: config.JWT_ALGORITHM,
      typ: 'JWT',
      kid: jwks?.keys[0]?.kid,
    })
    .sign(privateKey);

  return token;
}

export interface VerifyTokenOptions {
  audience?: string | string[];
  requiredClaims?: string[];
}

export async function verifyAccessToken(
  token: string,
  options: VerifyTokenOptions = {}
): Promise<TokenPayload> {
  if (publicKey === null) {
    throw new Error('Keys not initialized');
  }

  const config = getConfig();

  const { payload } = await jose.jwtVerify(token, publicKey, {
    issuer: config.ISSUER_URL,
    audience: options.audience,
    requiredClaims: options.requiredClaims,
    typ: 'at+jwt',
  });

  return payload as unknown as TokenPayload;
}

export async function verifyIdToken(
  token: string,
  options: VerifyTokenOptions = {}
): Promise<IdTokenPayload> {
  if (publicKey === null) {
    throw new Error('Keys not initialized');
  }

  const config = getConfig();

  const { payload } = await jose.jwtVerify(token, publicKey, {
    issuer: config.ISSUER_URL,
    audience: options.audience,
    requiredClaims: options.requiredClaims,
  });

  return payload as unknown as IdTokenPayload;
}

export function generateRefreshToken(): string {
  return jose.base64url.encode(crypto.getRandomValues(new Uint8Array(32)));
}
