import { Hono } from 'hono';
import { z } from 'zod';
import { HTTPException } from 'hono/http-exception';
import {
  findClientById,
  validateClientCredentials,
  validateRedirectUri,
  validateScopes,
  validateGrantType,
  createAuthorizationCode,
  redeemAuthorizationCode,
  createRefreshToken,
  validateRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
} from '../services/oauth.js';
import { authenticateUser, findUserById } from '../services/user.js';
import { signAccessToken, signIdToken } from '../services/jwt.js';
import { getConfig } from '../config/index.js';
import { auditLog } from '../utils/logger.js';
import { getClientIp } from '../middleware/request-logger.js';
import type { TokenResponse } from '../types/index.js';

const oauth = new Hono();

const authorizeQuerySchema = z.object({
  response_type: z.enum(['code']),
  client_id: z.string().min(1),
  redirect_uri: z.string().url(),
  scope: z.string().optional(),
  state: z.string().optional(),
  code_challenge: z.string().optional(),
  code_challenge_method: z.enum(['S256', 'plain']).optional(),
  nonce: z.string().optional(),
});

oauth.get('/oauth/authorize', async (c) => {
  const query = authorizeQuerySchema.safeParse(c.req.query());

  if (!query.success) {
    throw new HTTPException(400, { message: 'Invalid authorization request' });
  }

  const { response_type, client_id, redirect_uri, scope, state, code_challenge, code_challenge_method } = query.data;

  const client = await findClientById(client_id);

  if (client === null) {
    throw new HTTPException(400, { message: 'Unknown client' });
  }

  if (!validateRedirectUri(client, redirect_uri)) {
    throw new HTTPException(400, { message: 'Invalid redirect_uri' });
  }

  const requestedScopes = scope?.split(' ').filter(Boolean) ?? ['openid'];
  if (!validateScopes(client, requestedScopes)) {
    return redirectWithError(redirect_uri, 'invalid_scope', 'Requested scope is not allowed', state);
  }

  if (!validateGrantType(client, 'authorization_code')) {
    return redirectWithError(redirect_uri, 'unauthorized_client', 'Client not authorized for this grant type', state);
  }

  if (code_challenge !== undefined && code_challenge_method === undefined) {
    return redirectWithError(redirect_uri, 'invalid_request', 'code_challenge_method required when code_challenge is provided', state);
  }

  return c.html(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Jubilee SSO - Login</title>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        body { font-family: system-ui, sans-serif; max-width: 400px; margin: 50px auto; padding: 20px; }
        h1 { text-align: center; color: #333; }
        form { display: flex; flex-direction: column; gap: 15px; }
        input { padding: 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 16px; }
        button { padding: 12px; background: #4a90d9; color: white; border: none; border-radius: 4px; font-size: 16px; cursor: pointer; }
        button:hover { background: #357abd; }
        .error { color: #d32f2f; text-align: center; }
        .client-info { background: #f5f5f5; padding: 10px; border-radius: 4px; margin-bottom: 20px; }
      </style>
    </head>
    <body>
      <h1>Jubilee SSO</h1>
      <div class="client-info">
        <strong>${escapeHtml(client.name)}</strong> is requesting access to your account.
      </div>
      <form method="POST" action="/oauth/authorize">
        <input type="hidden" name="client_id" value="${escapeHtml(client_id)}">
        <input type="hidden" name="redirect_uri" value="${escapeHtml(redirect_uri)}">
        <input type="hidden" name="scope" value="${escapeHtml(scope ?? 'openid')}">
        <input type="hidden" name="state" value="${escapeHtml(state ?? '')}">
        <input type="hidden" name="code_challenge" value="${escapeHtml(code_challenge ?? '')}">
        <input type="hidden" name="code_challenge_method" value="${escapeHtml(code_challenge_method ?? '')}">
        <input type="hidden" name="response_type" value="${escapeHtml(response_type)}">

        <input type="email" name="email" placeholder="Email" required autocomplete="email">
        <input type="password" name="password" placeholder="Password" required autocomplete="current-password">
        <button type="submit">Sign In</button>
      </form>
    </body>
    </html>
  `);
});

oauth.post('/oauth/authorize', async (c) => {
  const body = await c.req.parseBody();

  const client_id = String(body['client_id'] ?? '');
  const redirect_uri = String(body['redirect_uri'] ?? '');
  const scope = String(body['scope'] ?? 'openid');
  const state = String(body['state'] ?? '');
  const code_challenge = String(body['code_challenge'] ?? '') || undefined;
  const code_challenge_method = String(body['code_challenge_method'] ?? '') || undefined;
  const email = String(body['email'] ?? '');
  const password = String(body['password'] ?? '');

  const client = await findClientById(client_id);
  if (client === null) {
    throw new HTTPException(400, { message: 'Unknown client' });
  }

  if (!validateRedirectUri(client, redirect_uri)) {
    throw new HTTPException(400, { message: 'Invalid redirect_uri' });
  }

  const ipAddress = getClientIp(c);
  const userAgent = c.req.header('user-agent');

  const authResult = await authenticateUser(email, password, ipAddress ?? undefined, userAgent);

  if (!authResult.success || authResult.user === undefined) {
    return c.html(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Jubilee SSO - Login Failed</title>
        <meta charset="utf-8">
        <style>
          body { font-family: system-ui, sans-serif; max-width: 400px; margin: 50px auto; padding: 20px; }
          .error { color: #d32f2f; text-align: center; margin-bottom: 20px; }
          a { display: block; text-align: center; color: #4a90d9; }
        </style>
      </head>
      <body>
        <p class="error">Invalid email or password. Please try again.</p>
        <a href="${escapeHtml(c.req.url)}">Back to login</a>
      </body>
      </html>
    `, 401);
  }

  const scopes = scope.split(' ').filter(Boolean);
  const code = await createAuthorizationCode({
    clientId: client_id,
    userId: authResult.user.id,
    redirectUri: redirect_uri,
    scope: scopes,
    codeChallenge: code_challenge,
    codeChallengeMethod: code_challenge_method as 'S256' | 'plain' | undefined,
  });

  const redirectUrl = new URL(redirect_uri);
  redirectUrl.searchParams.set('code', code);
  if (state !== '') {
    redirectUrl.searchParams.set('state', state);
  }

  return c.redirect(redirectUrl.toString());
});

const tokenBodySchema = z.object({
  grant_type: z.enum(['authorization_code', 'refresh_token', 'client_credentials']),
  code: z.string().optional(),
  redirect_uri: z.string().optional(),
  refresh_token: z.string().optional(),
  code_verifier: z.string().optional(),
  scope: z.string().optional(),
});

oauth.post('/oauth/token', async (c) => {
  const contentType = c.req.header('content-type');
  if (!contentType?.includes('application/x-www-form-urlencoded')) {
    throw new HTTPException(400, { message: 'Content-Type must be application/x-www-form-urlencoded' });
  }

  const body = await c.req.parseBody();
  const parsed = tokenBodySchema.safeParse(body);

  if (!parsed.success) {
    throw new HTTPException(400, { message: 'Invalid token request' });
  }

  const { grant_type, code, redirect_uri, refresh_token, code_verifier, scope } = parsed.data;

  const clientCredentials = extractClientCredentials(c, body);
  if (clientCredentials === null) {
    throw new HTTPException(401, { message: 'Client authentication required' });
  }

  const { clientId, clientSecret } = clientCredentials;

  let client = await findClientById(clientId);

  if (client?.isConfidential === true) {
    if (clientSecret === undefined) {
      throw new HTTPException(401, { message: 'Client secret required' });
    }
    client = await validateClientCredentials(clientId, clientSecret);
  }

  if (client === null) {
    throw new HTTPException(401, { message: 'Invalid client credentials' });
  }

  const config = getConfig();

  if (grant_type === 'authorization_code') {
    if (code === undefined || redirect_uri === undefined) {
      throw new HTTPException(400, { message: 'code and redirect_uri required' });
    }

    const result = await redeemAuthorizationCode(code, clientId, redirect_uri, code_verifier);

    if (!result.success || result.authCode === undefined) {
      throw new HTTPException(400, { message: result.error ?? 'Invalid authorization code' });
    }

    const user = await findUserById(result.authCode.userId);
    if (user === null) {
      throw new HTTPException(400, { message: 'User not found' });
    }

    const scopes = result.authCode.scope;
    const includeRefresh = scopes.includes('offline_access');
    const includeIdToken = scopes.includes('openid');

    const accessToken = await signAccessToken({
      subject: user.id,
      audience: clientId,
      scope: scopes.join(' '),
      clientId,
    });

    const tokenResponse: TokenResponse = {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: config.JWT_ACCESS_TOKEN_TTL,
      scope: scopes.join(' '),
    };

    if (includeRefresh) {
      tokenResponse.refresh_token = await createRefreshToken({
        userId: user.id,
        clientId,
        scope: scopes,
        ipAddress: getClientIp(c) ?? undefined,
        userAgent: c.req.header('user-agent'),
      });
    }

    if (includeIdToken) {
      tokenResponse.id_token = await signIdToken({
        subject: user.id,
        audience: clientId,
        email: scopes.includes('email') ? user.email : undefined,
        emailVerified: scopes.includes('email') ? user.emailVerified : undefined,
        name: scopes.includes('profile') ? user.displayName ?? undefined : undefined,
        accessToken,
      });
    }

    auditLog({
      eventType: 'token_issued',
      userId: user.id,
      clientId,
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
      success: true,
      metadata: { grant_type, scopes },
    });

    return c.json(tokenResponse);
  }

  if (grant_type === 'refresh_token') {
    if (refresh_token === undefined) {
      throw new HTTPException(400, { message: 'refresh_token required' });
    }

    const tokenData = await validateRefreshToken(refresh_token, clientId);
    if (tokenData === null) {
      throw new HTTPException(400, { message: 'Invalid refresh token' });
    }

    const user = await findUserById(tokenData.userId);
    if (user === null) {
      throw new HTTPException(400, { message: 'User not found' });
    }

    const scopes = tokenData.scope;

    const accessToken = await signAccessToken({
      subject: user.id,
      audience: clientId,
      scope: scopes.join(' '),
      clientId,
    });

    const newRefreshToken = await rotateRefreshToken(tokenData.id, {
      userId: user.id,
      clientId,
      scope: scopes,
      ipAddress: getClientIp(c) ?? undefined,
      userAgent: c.req.header('user-agent'),
    });

    const tokenResponse: TokenResponse = {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: config.JWT_ACCESS_TOKEN_TTL,
      refresh_token: newRefreshToken,
      scope: scopes.join(' '),
    };

    if (scopes.includes('openid')) {
      tokenResponse.id_token = await signIdToken({
        subject: user.id,
        audience: clientId,
        email: scopes.includes('email') ? user.email : undefined,
        emailVerified: scopes.includes('email') ? user.emailVerified : undefined,
        name: scopes.includes('profile') ? user.displayName ?? undefined : undefined,
        accessToken,
      });
    }

    auditLog({
      eventType: 'token_refreshed',
      userId: user.id,
      clientId,
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
      success: true,
    });

    return c.json(tokenResponse);
  }

  if (grant_type === 'client_credentials') {
    if (!validateGrantType(client, 'client_credentials')) {
      throw new HTTPException(400, { message: 'Client not authorized for client_credentials grant' });
    }

    const requestedScopes = scope?.split(' ').filter(Boolean) ?? [];
    if (!validateScopes(client, requestedScopes)) {
      throw new HTTPException(400, { message: 'Invalid scope' });
    }

    const accessToken = await signAccessToken({
      subject: clientId,
      audience: clientId,
      scope: requestedScopes.join(' '),
      clientId,
    });

    const tokenResponse: TokenResponse = {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: config.JWT_ACCESS_TOKEN_TTL,
      scope: requestedScopes.join(' '),
    };

    auditLog({
      eventType: 'token_issued',
      userId: null,
      clientId,
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
      success: true,
      metadata: { grant_type },
    });

    return c.json(tokenResponse);
  }

  throw new HTTPException(400, { message: 'Unsupported grant type' });
});

oauth.post('/oauth/revoke', async (c) => {
  const body = await c.req.parseBody();
  const token = String(body['token'] ?? '');

  if (token === '') {
    return c.json({});
  }

  await revokeRefreshToken(token);

  auditLog({
    eventType: 'token_revoked',
    userId: null,
    clientId: null,
    ipAddress: getClientIp(c),
    userAgent: c.req.header('user-agent') ?? null,
    success: true,
  });

  return c.json({});
});

oauth.get('/oauth/userinfo', async (c) => {
  const auth = c.req.header('authorization');
  if (auth === undefined || !auth.startsWith('Bearer ')) {
    throw new HTTPException(401, { message: 'Bearer token required' });
  }

  throw new HTTPException(501, { message: 'Userinfo endpoint not yet implemented' });
});

function extractClientCredentials(
  c: { req: { header: (name: string) => string | undefined } },
  body: Record<string, string | File>
): { clientId: string; clientSecret?: string } | null {
  const authHeader = c.req.header('authorization');

  if (authHeader !== undefined && authHeader.startsWith('Basic ')) {
    const encoded = authHeader.slice(6);
    const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
    const colonIndex = decoded.indexOf(':');

    if (colonIndex === -1) {
      return null;
    }

    const clientId = decodeURIComponent(decoded.slice(0, colonIndex));
    const clientSecret = decodeURIComponent(decoded.slice(colonIndex + 1));

    return { clientId, clientSecret: clientSecret !== '' ? clientSecret : undefined };
  }

  const clientId = body['client_id'];
  if (typeof clientId !== 'string' || clientId === '') {
    return null;
  }

  const clientSecret = body['client_secret'];

  return {
    clientId,
    clientSecret: typeof clientSecret === 'string' && clientSecret !== '' ? clientSecret : undefined,
  };
}

function redirectWithError(
  redirectUri: string,
  error: string,
  description: string,
  state?: string
): Response {
  const url = new URL(redirectUri);
  url.searchParams.set('error', error);
  url.searchParams.set('error_description', description);
  if (state !== undefined && state !== '') {
    url.searchParams.set('state', state);
  }
  return Response.redirect(url.toString(), 302);
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export { oauth };
