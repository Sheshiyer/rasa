import { randomBytes, createHash } from "node:crypto";

/** OAuth 2.1 + PKCE (S256) helpers + a per-user token provider with refresh. */

function base64url(buf: Buffer): string {
  return buf.toString("base64url");
}

/** A high-entropy PKCE code verifier (43 chars, base64url — RFC 7636 §4.1). */
export function generateCodeVerifier(): string {
  return base64url(randomBytes(32));
}

/** S256 code challenge = base64url(sha256(verifier)) — RFC 7636 §4.2. */
export function deriveCodeChallenge(verifier: string): string {
  return base64url(createHash("sha256").update(verifier).digest());
}

export interface AuthorizationUrlParams {
  authorizationEndpoint: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  state: string;
  scope?: string;
}

/** Build the Swiggy authorization URL the app opens in a WebView. */
export function buildAuthorizationUrl(p: AuthorizationUrlParams): string {
  const url = new URL(p.authorizationEndpoint);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", p.clientId);
  url.searchParams.set("redirect_uri", p.redirectUri);
  url.searchParams.set("code_challenge", p.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("state", p.state);
  if (p.scope) url.searchParams.set("scope", p.scope);
  return url.toString();
}

export interface TokenSet {
  access_token: string;
  refresh_token: string;
  /** Absolute expiry as epoch milliseconds. */
  expires_at: number;
}

/** True when `now` is at/after expiry, accounting for a safety skew. */
export function isTokenExpired(
  tokens: TokenSet,
  now: number,
  skewMs = 0,
): boolean {
  return now >= tokens.expires_at - skewMs;
}

export interface TokenProviderOptions {
  initial: TokenSet;
  /** Exchange the refresh token for a fresh TokenSet (hits Swiggy's token endpoint). */
  refresh: (refreshToken: string) => Promise<TokenSet>;
  /** Clock injection for testing. Defaults to Date.now. */
  now?: () => number;
  /** Refresh this many ms before actual expiry. */
  skewMs?: number;
}

export interface TokenProvider {
  /** Current valid access token, refreshing first if expired or invalidated. */
  getAccessToken(): Promise<string>;
  /** Force a refresh on the next getAccessToken (e.g. after a 401). */
  invalidate(): void;
}

export function makeTokenProvider(opts: TokenProviderOptions): TokenProvider {
  const now = opts.now ?? (() => Date.now());
  const skewMs = opts.skewMs ?? 30_000;
  let tokens = opts.initial;
  let forceRefresh = false;

  return {
    async getAccessToken(): Promise<string> {
      if (forceRefresh || isTokenExpired(tokens, now(), skewMs)) {
        tokens = await opts.refresh(tokens.refresh_token);
        forceRefresh = false;
      }
      return tokens.access_token;
    },
    invalidate(): void {
      forceRefresh = true;
    },
  };
}
