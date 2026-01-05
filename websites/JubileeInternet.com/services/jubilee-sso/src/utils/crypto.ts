import bcrypt from 'bcrypt';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { nanoid } from 'nanoid';
import { getConfig } from '../config/index.js';

export async function hashPassword(password: string): Promise<string> {
  const config = getConfig();
  return bcrypt.hash(password, config.BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateId(length = 21): string {
  return nanoid(length);
}

export function generateSecureToken(length = 32): string {
  return randomBytes(length).toString('base64url');
}

export function generateAuthorizationCode(): string {
  return randomBytes(32).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function generateCodeVerifier(): string {
  return randomBytes(32).toString('base64url');
}

export function generateCodeChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

export function verifyCodeChallenge(
  codeVerifier: string,
  codeChallenge: string,
  method: 'S256' | 'plain'
): boolean {
  if (method === 'plain') {
    return timingSafeCompare(codeVerifier, codeChallenge);
  }

  const computed = generateCodeChallenge(codeVerifier);
  return timingSafeCompare(computed, codeChallenge);
}

export function timingSafeCompare(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a, 'utf-8');
    const bufB = Buffer.from(b, 'utf-8');

    if (bufA.length !== bufB.length) {
      return false;
    }

    return timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

export function computeAtHash(accessToken: string, algorithm: string): string {
  let hashAlg: 'sha256' | 'sha384' | 'sha512';

  switch (algorithm) {
    case 'RS256':
    case 'ES256':
      hashAlg = 'sha256';
      break;
    case 'RS384':
    case 'ES384':
      hashAlg = 'sha384';
      break;
    case 'RS512':
    case 'ES512':
      hashAlg = 'sha512';
      break;
    default:
      hashAlg = 'sha256';
  }

  const hash = createHash(hashAlg).update(accessToken).digest();
  const halfLength = hash.length / 2;
  return hash.subarray(0, halfLength).toString('base64url');
}
