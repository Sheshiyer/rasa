import { describe, it, expect } from "vitest";
import {
  generateCodeVerifier,
  deriveCodeChallenge,
  buildAuthorizationUrl,
  isTokenExpired,
  makeTokenProvider,
  type TokenSet,
} from "./oauth-pkce";

describe("PKCE", () => {
  it("generates a base64url verifier of 43+ chars", () => {
    const v = generateCodeVerifier();
    expect(v).toMatch(/^[A-Za-z0-9\-_]{43,128}$/);
  });

  it("generates unique verifiers", () => {
    expect(generateCodeVerifier()).not.toBe(generateCodeVerifier());
  });

  it("derives the S256 challenge per the RFC 7636 test vector", () => {
    // From RFC 7636 Appendix B.
    const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
    expect(deriveCodeChallenge(verifier)).toBe(
      "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
    );
  });

  it("builds an authorization URL with the required OAuth2.1 params", () => {
    const url = new URL(
      buildAuthorizationUrl({
        authorizationEndpoint: "https://auth.swiggy.example/authorize",
        clientId: "rasa-app",
        redirectUri: "rasa://callback",
        codeChallenge: "abc123",
        state: "xyz",
        scope: "food.order",
      }),
    );
    expect(url.origin + url.pathname).toBe(
      "https://auth.swiggy.example/authorize",
    );
    const q = url.searchParams;
    expect(q.get("response_type")).toBe("code");
    expect(q.get("client_id")).toBe("rasa-app");
    expect(q.get("redirect_uri")).toBe("rasa://callback");
    expect(q.get("code_challenge")).toBe("abc123");
    expect(q.get("code_challenge_method")).toBe("S256");
    expect(q.get("state")).toBe("xyz");
    expect(q.get("scope")).toBe("food.order");
  });
});

describe("token expiry", () => {
  const tokens: TokenSet = {
    access_token: "a",
    refresh_token: "r",
    expires_at: 1_000_000,
  };

  it("is not expired well before expiry", () => {
    expect(isTokenExpired(tokens, 900_000)).toBe(false);
  });

  it("is expired past expiry", () => {
    expect(isTokenExpired(tokens, 1_000_001)).toBe(true);
  });

  it("is expired within the skew window before expiry", () => {
    expect(isTokenExpired(tokens, 999_000, 30_000)).toBe(true);
  });
});

describe("makeTokenProvider", () => {
  const fresh: TokenSet = {
    access_token: "A1",
    refresh_token: "R1",
    expires_at: 2_000_000,
  };

  it("returns the cached access token when still valid", async () => {
    let refreshes = 0;
    const p = makeTokenProvider({
      initial: fresh,
      refresh: async () => {
        refreshes++;
        return {
          access_token: "A2",
          refresh_token: "R2",
          expires_at: 3_000_000,
        };
      },
      now: () => 1_000_000,
    });
    expect(await p.getAccessToken()).toBe("A1");
    expect(refreshes).toBe(0);
  });

  it("refreshes when the token is expired", async () => {
    const expired: TokenSet = {
      access_token: "A1",
      refresh_token: "R1",
      expires_at: 500_000,
    };
    const p = makeTokenProvider({
      initial: expired,
      refresh: async (rt) => {
        expect(rt).toBe("R1");
        return {
          access_token: "A2",
          refresh_token: "R2",
          expires_at: 3_000_000,
        };
      },
      now: () => 1_000_000,
    });
    expect(await p.getAccessToken()).toBe("A2");
  });

  it("invalidate() forces a refresh on the next call", async () => {
    let refreshes = 0;
    const p = makeTokenProvider({
      initial: fresh,
      refresh: async () => {
        refreshes++;
        return {
          access_token: "A2",
          refresh_token: "R2",
          expires_at: 3_000_000,
        };
      },
      now: () => 1_000_000,
    });
    expect(await p.getAccessToken()).toBe("A1");
    p.invalidate();
    expect(await p.getAccessToken()).toBe("A2");
    expect(refreshes).toBe(1);
  });
});
