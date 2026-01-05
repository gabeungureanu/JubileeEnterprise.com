# Security Guidelines

This document outlines security requirements and best practices for working with Jubilee SSO.

## Security Posture

Jubilee SSO is **security-critical infrastructure**. It serves as the identity trust boundary for all Jubilee services. A security breach here could compromise:

- All Jubilee user accounts
- All connected services (Jubilee Browser, Jubilee Bible, etc.)
- User personal data

## Security Principles

### 1. Defense in Depth

Multiple layers of security controls:
- Network-level (TLS, firewalls, rate limiting)
- Application-level (input validation, authentication, authorization)
- Data-level (encryption, hashing, access control)

### 2. Least Privilege

- Database users have minimal required permissions
- Service accounts have scoped access
- API endpoints require explicit authorization

### 3. Fail Secure

When in doubt, deny access. Errors should not leak sensitive information.

### 4. Audit Everything

All authentication events are logged for security monitoring.

## Secrets Management

### What Counts as a Secret

- Database credentials
- JWT signing keys
- OAuth client secrets
- API keys
- Session secrets
- TLS private keys

### Handling Secrets

**DO:**
- Store secrets in environment variables
- Use `.env` files for local development (gitignored)
- Use a secrets manager in production (AWS Secrets Manager, HashiCorp Vault, etc.)
- Rotate secrets regularly
- Use different secrets per environment

**DON'T:**
- Commit secrets to version control
- Log secrets (even in debug mode)
- Share secrets via chat/email
- Hardcode secrets in source code
- Use the same secrets across environments

## Code Security

### Input Validation

Always validate and sanitize all input:

```typescript
// Good
const email = emailSchema.parse(input.email);

// Bad
const email = input.email; // Unvalidated
```

### SQL Injection Prevention

Use parameterized queries only:

```typescript
// Good
const [user] = await sql`SELECT * FROM users WHERE email = ${email}`;

// Bad
const [user] = await sql.unsafe(`SELECT * FROM users WHERE email = '${email}'`);
```

### Password Security

- Minimum 8 characters
- Require mixed case, numbers
- Hash with bcrypt (cost factor 12+)
- Never log or expose passwords

### Token Security

- Use cryptographically secure random generators
- Store only hashed tokens in the database
- Implement token expiration
- Support token revocation

## Authentication Security

### Account Lockout

- Lock accounts after 5 failed attempts
- 15-minute lockout duration
- Log all lockout events

### Session Management

- Secure, HTTP-only cookies
- Session timeout after inactivity
- Invalidate sessions on password change
- Support for session revocation

### OAuth Security

- Require PKCE for public clients
- Validate redirect URIs strictly
- Short-lived authorization codes (10 minutes)
- Refresh token rotation

## Logging and Audit

### What to Log

- Login attempts (success/failure)
- Token issuance and refresh
- Password changes
- Account lockouts
- Authorization grants/denials

### What NOT to Log

- Passwords (even hashed)
- Full tokens
- Personal data (beyond user ID)
- Request/response bodies with sensitive data

### Log Format

Use structured logging:

```json
{
  "level": "info",
  "timestamp": "2025-01-01T00:00:00.000Z",
  "audit": true,
  "eventType": "login_success",
  "userId": "user-123",
  "clientId": "jubilee-browser",
  "ipAddress": "192.168.1.1"
}
```

## API Security

### Rate Limiting

| Endpoint | Limit |
|----------|-------|
| /oauth/token | 10 requests/second |
| /oauth/authorize | 10 requests/second |
| /.well-known/* | 100 requests/second |

### CORS

- Strict origin allowlist in production
- No wildcards in production
- Credentials require explicit origin

### Headers

Required security headers:
- `Strict-Transport-Security`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Cache-Control: no-store`

## Vulnerability Reporting

If you discover a security vulnerability:

1. **DO NOT** create a public issue
2. Contact the security team immediately
3. Provide details: vulnerability type, reproduction steps, impact assessment
4. Allow time for patch before disclosure

## Security Checklist for PRs

Before submitting code:

- [ ] No secrets or credentials in code
- [ ] Input validation for all user input
- [ ] Parameterized queries only
- [ ] Sensitive data not logged
- [ ] Error messages don't leak information
- [ ] Authentication/authorization checked
- [ ] Security headers set correctly
- [ ] Tests cover security scenarios

## Compliance

This system is designed to support:
- GDPR data protection requirements
- SOC 2 security controls
- OWASP security best practices

## Resources

- [OWASP Top 10](https://owasp.org/Top10/)
- [OAuth 2.0 Security Best Practices](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-security-topics)
- [JWT Best Practices](https://datatracker.ietf.org/doc/html/rfc8725)
