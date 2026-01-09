const SSO_URL = process.env.NEXT_PUBLIC_SSO_URL || 'http://localhost:3000';
const CLIENT_ID = 'jubilee-website';

export interface User {
  id: string;
  email: string;
  emailVerified: boolean;
  displayName: string | null;
}

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

// Generate PKCE verifier and challenge
function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(hash));
}

function base64UrlEncode(data: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...data));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// Storage keys
const STORAGE_KEYS = {
  accessToken: 'jubilee_access_token',
  refreshToken: 'jubilee_refresh_token',
  user: 'jubilee_user',
  codeVerifier: 'jubilee_code_verifier',
  returnUrl: 'jubilee_return_url',
};

export function getStoredAuth(): { accessToken: string | null; user: User | null } {
  if (typeof window === 'undefined') {
    return { accessToken: null, user: null };
  }

  const accessToken = localStorage.getItem(STORAGE_KEYS.accessToken);
  const userJson = localStorage.getItem(STORAGE_KEYS.user);
  const user = userJson ? JSON.parse(userJson) : null;

  return { accessToken, user };
}

export function setStoredAuth(accessToken: string, user: User) {
  localStorage.setItem(STORAGE_KEYS.accessToken, accessToken);
  localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user));
}

export function clearStoredAuth() {
  localStorage.removeItem(STORAGE_KEYS.accessToken);
  localStorage.removeItem(STORAGE_KEYS.refreshToken);
  localStorage.removeItem(STORAGE_KEYS.user);
}

export async function initiateLogin(returnUrl?: string) {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const state = generateCodeVerifier();

  // Store verifier for later
  sessionStorage.setItem(STORAGE_KEYS.codeVerifier, codeVerifier);
  sessionStorage.setItem('jubilee_oauth_state', state);

  if (returnUrl) {
    sessionStorage.setItem(STORAGE_KEYS.returnUrl, returnUrl);
  }

  const redirectUri = `${window.location.origin}/auth/callback`;

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    redirect_uri: redirectUri,
    scope: 'openid profile email offline_access',
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  window.location.href = `${SSO_URL}/oauth/authorize?${params.toString()}`;
}

export async function handleCallback(code: string, state: string): Promise<{ user: User; accessToken: string }> {
  const storedState = sessionStorage.getItem('jubilee_oauth_state');
  const codeVerifier = sessionStorage.getItem(STORAGE_KEYS.codeVerifier);

  if (state !== storedState) {
    throw new Error('Invalid state parameter');
  }

  if (!codeVerifier) {
    throw new Error('Code verifier not found');
  }

  const redirectUri = `${window.location.origin}/auth/callback`;

  const response = await fetch(`${SSO_URL}/oauth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: CLIENT_ID,
      code_verifier: codeVerifier,
    }).toString(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error_description || error.error || 'Token exchange failed');
  }

  const tokens = await response.json();

  // Clean up session storage
  sessionStorage.removeItem(STORAGE_KEYS.codeVerifier);
  sessionStorage.removeItem('jubilee_oauth_state');

  // Decode user info from ID token (basic decode, verification done by backend)
  const idTokenPayload = JSON.parse(atob(tokens.id_token.split('.')[1]));

  const user: User = {
    id: idTokenPayload.sub,
    email: idTokenPayload.email || '',
    emailVerified: idTokenPayload.email_verified || false,
    displayName: idTokenPayload.name || null,
  };

  // Store tokens and user
  setStoredAuth(tokens.access_token, user);

  if (tokens.refresh_token) {
    localStorage.setItem(STORAGE_KEYS.refreshToken, tokens.refresh_token);
  }

  return { user, accessToken: tokens.access_token };
}

export function logout() {
  clearStoredAuth();
  window.location.href = '/';
}

export function getReturnUrl(): string {
  const stored = sessionStorage.getItem(STORAGE_KEYS.returnUrl);
  sessionStorage.removeItem(STORAGE_KEYS.returnUrl);
  return stored || '/dashboard';
}
