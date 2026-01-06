import type { Context, Next } from 'hono';
import * as jose from 'jose';
import { getConfig } from '../config/index.js';
import type { JubileeUser, AuthenticatedContext } from '../types/index.js';

let jwks: jose.JWTVerifyGetKey | null = null;

async function getJWKS(): Promise<jose.JWTVerifyGetKey> {
  if (jwks !== null) {
    return jwks;
  }

  const config = getConfig();
  const jwksUrl = config.SSO_JWKS_URL ?? `${config.SSO_ISSUER_URL}/.well-known/jwks.json`;

  jwks = jose.createRemoteJWKSet(new URL(jwksUrl));
  return jwks;
}

export interface AuthState {
  user: JubileeUser;
  accessToken: string;
  scopes: string[];
}

export async function authMiddleware(c: Context, next: Next): Promise<Response | void> {
  const authHeader = c.req.header('authorization');

  if (authHeader === undefined || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'unauthorized', error_description: 'Bearer token required' }, 401);
  }

  const token = authHeader.slice(7);

  try {
    const config = getConfig();
    const verifyKey = await getJWKS();

    const { payload } = await jose.jwtVerify(token, verifyKey, {
      issuer: config.SSO_ISSUER_URL,
      audience: config.SSO_CLIENT_ID,
    });

    const user: JubileeUser = {
      id: payload.sub as string,
      email: (payload['email'] as string) ?? '',
      emailVerified: (payload['email_verified'] as boolean) ?? false,
      displayName: (payload['name'] as string) ?? null,
    };

    const scopes = ((payload['scope'] as string) ?? '').split(' ').filter(Boolean);

    c.set('auth', {
      user,
      accessToken: token,
      scopes,
    } satisfies AuthState);

    await next();
  } catch (error) {
    console.error('Token verification failed:', error);
    return c.json({ error: 'unauthorized', error_description: 'Invalid or expired token' }, 401);
  }
}

export function getAuth(c: Context): AuthState {
  const auth = c.get('auth') as AuthState | undefined;
  if (auth === undefined) {
    throw new Error('Auth state not found. Is authMiddleware applied?');
  }
  return auth;
}

export function optionalAuth(c: Context): AuthState | null {
  return (c.get('auth') as AuthState | undefined) ?? null;
}

export async function optionalAuthMiddleware(c: Context, next: Next): Promise<void> {
  const authHeader = c.req.header('authorization');

  if (authHeader === undefined || !authHeader.startsWith('Bearer ')) {
    await next();
    return;
  }

  const token = authHeader.slice(7);

  try {
    const config = getConfig();
    const verifyKey = await getJWKS();

    const { payload } = await jose.jwtVerify(token, verifyKey, {
      issuer: config.SSO_ISSUER_URL,
      audience: config.SSO_CLIENT_ID,
    });

    const user: JubileeUser = {
      id: payload.sub as string,
      email: (payload['email'] as string) ?? '',
      emailVerified: (payload['email_verified'] as boolean) ?? false,
      displayName: (payload['name'] as string) ?? null,
    };

    const scopes = ((payload['scope'] as string) ?? '').split(' ').filter(Boolean);

    c.set('auth', {
      user,
      accessToken: token,
      scopes,
    } satisfies AuthState);
  } catch {
    // Token invalid, continue without auth
  }

  await next();
}
