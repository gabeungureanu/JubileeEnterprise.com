import { Hono } from 'hono';
import { getConfig } from '../config/index.js';
import { getJWKS } from '../services/jwt.js';
import type { OpenIDConfiguration } from '../types/index.js';

const wellKnown = new Hono();

wellKnown.get('/.well-known/openid-configuration', (c) => {
  const config = getConfig();
  const issuer = config.ISSUER_URL;

  const configuration: OpenIDConfiguration = {
    issuer,
    authorization_endpoint: `${issuer}/oauth/authorize`,
    token_endpoint: `${issuer}/oauth/token`,
    userinfo_endpoint: `${issuer}/oauth/userinfo`,
    jwks_uri: `${issuer}/.well-known/jwks.json`,
    registration_endpoint: undefined,

    scopes_supported: ['openid', 'profile', 'email', 'offline_access'],

    response_types_supported: ['code', 'token', 'id_token', 'code token', 'code id_token'],

    response_modes_supported: ['query', 'fragment'],

    grant_types_supported: ['authorization_code', 'refresh_token', 'client_credentials'],

    subject_types_supported: ['public'],

    id_token_signing_alg_values_supported: [config.JWT_ALGORITHM],

    token_endpoint_auth_methods_supported: [
      'client_secret_basic',
      'client_secret_post',
      'none',
    ],

    claims_supported: [
      'sub',
      'iss',
      'aud',
      'exp',
      'iat',
      'auth_time',
      'nonce',
      'email',
      'email_verified',
      'name',
    ],

    code_challenge_methods_supported: ['S256', 'plain'],
  };

  return c.json(configuration);
});

wellKnown.get('/.well-known/jwks.json', (c) => {
  const jwks = getJWKS();
  return c.json(jwks);
});

export { wellKnown };
