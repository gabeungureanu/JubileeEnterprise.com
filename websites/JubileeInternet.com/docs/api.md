# API Reference

This document describes the Jubilee SSO API endpoints.

## Base URL

| Environment | URL |
|-------------|-----|
| Local | `https://localhost:3000` |
| Staging | `https://sso-staging.jubilee.com` |
| Production | `https://sso.jubilee.com` |

## OpenID Connect Discovery

### GET /.well-known/openid-configuration

Returns OpenID Connect configuration.

**Response:**
```json
{
  "issuer": "https://sso.jubilee.com",
  "authorization_endpoint": "https://sso.jubilee.com/oauth/authorize",
  "token_endpoint": "https://sso.jubilee.com/oauth/token",
  "userinfo_endpoint": "https://sso.jubilee.com/oauth/userinfo",
  "jwks_uri": "https://sso.jubilee.com/.well-known/jwks.json",
  "scopes_supported": ["openid", "profile", "email", "offline_access"],
  "response_types_supported": ["code", "token", "id_token"],
  "grant_types_supported": ["authorization_code", "refresh_token", "client_credentials"],
  "subject_types_supported": ["public"],
  "id_token_signing_alg_values_supported": ["RS256"],
  "code_challenge_methods_supported": ["S256", "plain"]
}
```

### GET /.well-known/jwks.json

Returns JSON Web Key Set for token verification.

**Response:**
```json
{
  "keys": [
    {
      "kty": "RSA",
      "use": "sig",
      "alg": "RS256",
      "kid": "key-id",
      "n": "...",
      "e": "AQAB"
    }
  ]
}
```

## OAuth 2.0 Endpoints

### GET /oauth/authorize

Initiates the authorization flow.

**Query Parameters:**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `response_type` | Yes | Must be `code` |
| `client_id` | Yes | The OAuth client ID |
| `redirect_uri` | Yes | Callback URL (must be registered) |
| `scope` | No | Space-separated scopes (default: `openid`) |
| `state` | Recommended | CSRF protection token |
| `code_challenge` | Recommended | PKCE code challenge |
| `code_challenge_method` | With challenge | `S256` or `plain` |
| `nonce` | For OIDC | OpenID Connect nonce |

**Example:**
```
GET /oauth/authorize?
  response_type=code&
  client_id=jubilee-browser&
  redirect_uri=https://browser.jubilee.com/callback&
  scope=openid%20profile%20email&
  state=abc123&
  code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM&
  code_challenge_method=S256
```

**Success Response:**
Redirects to `redirect_uri` with authorization code:
```
https://browser.jubilee.com/callback?code=AUTH_CODE&state=abc123
```

**Error Response:**
Redirects to `redirect_uri` with error:
```
https://browser.jubilee.com/callback?error=access_denied&error_description=User%20denied%20access&state=abc123
```

### POST /oauth/token

Exchanges authorization code or refresh token for access token.

**Content-Type:** `application/x-www-form-urlencoded`

**Authentication:**
- Basic Auth: `Authorization: Basic base64(client_id:client_secret)`
- Or body parameters: `client_id` and `client_secret`

#### Authorization Code Grant

**Request:**
```
POST /oauth/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code&
code=AUTH_CODE&
redirect_uri=https://browser.jubilee.com/callback&
code_verifier=dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk
```

**Response:**
```json
{
  "access_token": "eyJ...",
  "token_type": "Bearer",
  "expires_in": 900,
  "refresh_token": "dGhpcyBpcyBhIHJlZnJlc2ggdG9rZW4...",
  "id_token": "eyJ...",
  "scope": "openid profile email"
}
```

#### Refresh Token Grant

**Request:**
```
POST /oauth/token
Content-Type: application/x-www-form-urlencoded

grant_type=refresh_token&
refresh_token=dGhpcyBpcyBhIHJlZnJlc2ggdG9rZW4...
```

**Response:**
```json
{
  "access_token": "eyJ...",
  "token_type": "Bearer",
  "expires_in": 900,
  "refresh_token": "bmV3IHJlZnJlc2ggdG9rZW4...",
  "scope": "openid profile email"
}
```

#### Client Credentials Grant

**Request:**
```
POST /oauth/token
Content-Type: application/x-www-form-urlencoded
Authorization: Basic base64(client_id:client_secret)

grant_type=client_credentials&
scope=openid
```

**Response:**
```json
{
  "access_token": "eyJ...",
  "token_type": "Bearer",
  "expires_in": 900,
  "scope": "openid"
}
```

### POST /oauth/revoke

Revokes a refresh token.

**Request:**
```
POST /oauth/revoke
Content-Type: application/x-www-form-urlencoded

token=REFRESH_TOKEN
```

**Response:** `200 OK` with empty body

### GET /oauth/userinfo

Returns authenticated user information.

**Request:**
```
GET /oauth/userinfo
Authorization: Bearer ACCESS_TOKEN
```

**Response:**
```json
{
  "sub": "user-id",
  "email": "user@example.com",
  "email_verified": true,
  "name": "User Name"
}
```

## Health Endpoints

### GET /health

Returns service health status.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-01-01T00:00:00.000Z",
  "checks": {
    "database": "ok"
  }
}
```

### GET /ready

Returns readiness status for load balancers.

**Response (Ready):**
```json
{
  "ready": true
}
```

**Response (Not Ready):**
```json
{
  "ready": false,
  "reason": "database not available"
}
```

### GET /live

Returns liveness status.

**Response:**
```json
{
  "alive": true
}
```

## Error Responses

All error responses follow this format:

```json
{
  "error": "error_code",
  "error_description": "Human-readable description"
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `invalid_request` | 400 | Malformed request |
| `unauthorized` | 401 | Authentication required |
| `access_denied` | 403 | Permission denied |
| `not_found` | 404 | Resource not found |
| `invalid_grant` | 400 | Invalid authorization code or refresh token |
| `invalid_client` | 401 | Invalid client credentials |
| `invalid_scope` | 400 | Requested scope not allowed |
| `server_error` | 500 | Internal server error |

## Token Claims

### Access Token

```json
{
  "sub": "user-id",
  "iss": "https://sso.jubilee.com",
  "aud": "client-id",
  "exp": 1234567890,
  "iat": 1234567890,
  "scope": "openid profile email",
  "client_id": "jubilee-browser"
}
```

### ID Token

```json
{
  "sub": "user-id",
  "iss": "https://sso.jubilee.com",
  "aud": "client-id",
  "exp": 1234567890,
  "iat": 1234567890,
  "auth_time": 1234567890,
  "nonce": "nonce-value",
  "email": "user@example.com",
  "email_verified": true,
  "name": "User Name",
  "at_hash": "access-token-hash"
}
```

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| `/oauth/authorize` | 10 req/s per IP |
| `/oauth/token` | 10 req/s per IP |
| `/.well-known/*` | 100 req/s per IP |

Responses include rate limit headers:
```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 9
X-RateLimit-Reset: 1234567890
```

## SDK Usage

### JavaScript/TypeScript

```typescript
import { TokenValidator } from '@jubilee/shared/auth';

const validator = new TokenValidator({
  issuer: 'https://sso.jubilee.com',
  jwksUri: 'https://sso.jubilee.com/.well-known/jwks.json',
  audience: 'your-client-id',
});

const result = await validator.validateAccessToken(token);
if (result.valid) {
  console.log('User ID:', result.payload.sub);
}
```
