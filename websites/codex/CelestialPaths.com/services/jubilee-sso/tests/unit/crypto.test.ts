import { describe, it, expect } from 'vitest';
import {
  generateId,
  generateSecureToken,
  generateCodeVerifier,
  generateCodeChallenge,
  verifyCodeChallenge,
  hashToken,
  timingSafeCompare,
  computeAtHash,
} from '../../src/utils/crypto.js';

describe('Crypto Utils', () => {
  describe('generateId', () => {
    it('should generate a 21-character ID by default', () => {
      const id = generateId();
      expect(id).toHaveLength(21);
    });

    it('should generate IDs of custom length', () => {
      const id = generateId(32);
      expect(id).toHaveLength(32);
    });

    it('should generate unique IDs', () => {
      const ids = new Set(Array.from({ length: 100 }, () => generateId()));
      expect(ids.size).toBe(100);
    });
  });

  describe('generateSecureToken', () => {
    it('should generate a base64url encoded token', () => {
      const token = generateSecureToken();
      expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('should generate tokens of appropriate length', () => {
      const token = generateSecureToken(32);
      // 32 bytes in base64url is about 43 characters
      expect(token.length).toBeGreaterThan(40);
    });
  });

  describe('PKCE', () => {
    it('should generate a valid code verifier', () => {
      const verifier = generateCodeVerifier();
      expect(verifier.length).toBeGreaterThanOrEqual(43);
      expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('should generate a valid code challenge', () => {
      const verifier = generateCodeVerifier();
      const challenge = generateCodeChallenge(verifier);
      expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('should verify S256 code challenge correctly', () => {
      const verifier = generateCodeVerifier();
      const challenge = generateCodeChallenge(verifier);

      expect(verifyCodeChallenge(verifier, challenge, 'S256')).toBe(true);
      expect(verifyCodeChallenge('wrong-verifier', challenge, 'S256')).toBe(false);
    });

    it('should verify plain code challenge correctly', () => {
      const verifier = 'test-verifier';
      expect(verifyCodeChallenge(verifier, verifier, 'plain')).toBe(true);
      expect(verifyCodeChallenge('wrong', verifier, 'plain')).toBe(false);
    });
  });

  describe('hashToken', () => {
    it('should generate consistent hashes', () => {
      const token = 'test-token';
      const hash1 = hashToken(token);
      const hash2 = hashToken(token);

      expect(hash1).toBe(hash2);
    });

    it('should generate different hashes for different tokens', () => {
      const hash1 = hashToken('token1');
      const hash2 = hashToken('token2');

      expect(hash1).not.toBe(hash2);
    });

    it('should generate 64-character hex hashes', () => {
      const hash = hashToken('test');
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[a-f0-9]+$/);
    });
  });

  describe('timingSafeCompare', () => {
    it('should return true for equal strings', () => {
      expect(timingSafeCompare('test', 'test')).toBe(true);
    });

    it('should return false for different strings', () => {
      expect(timingSafeCompare('test', 'other')).toBe(false);
    });

    it('should return false for different length strings', () => {
      expect(timingSafeCompare('short', 'longer-string')).toBe(false);
    });
  });

  describe('computeAtHash', () => {
    it('should compute at_hash for RS256', () => {
      const accessToken = 'test-access-token';
      const atHash = computeAtHash(accessToken, 'RS256');

      expect(atHash).toBeDefined();
      expect(atHash.length).toBeGreaterThan(0);
      expect(atHash).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('should compute consistent at_hash', () => {
      const accessToken = 'test-access-token';
      const atHash1 = computeAtHash(accessToken, 'RS256');
      const atHash2 = computeAtHash(accessToken, 'RS256');

      expect(atHash1).toBe(atHash2);
    });
  });
});
