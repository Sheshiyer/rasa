import { describe, it, expect } from "vitest";
import { classifyHttpStatus, createTransport } from "./swiggy-client";

describe("classifyHttpStatus", () => {
  it("maps 401 to auth", () => expect(classifyHttpStatus(401)).toBe("auth"));
  it("maps 429 and 5xx to transport (retryable)", () => {
    expect(classifyHttpStatus(429)).toBe("transport");
    expect(classifyHttpStatus(500)).toBe("transport");
    expect(classifyHttpStatus(503)).toBe("transport");
  });
  it("maps other 4xx to business", () => {
    expect(classifyHttpStatus(400)).toBe("business");
    expect(classifyHttpStatus(403)).toBe("business");
    expect(classifyHttpStatus(404)).toBe("business");
  });
});

describe("createTransport", () => {
  it("returns a working mock transport in mock mode", async () => {
    const t = createTransport({ mode: "mock" });
    const res = (await t.callTool("get_addresses", {})) as {
      addresses: unknown[];
    };
    expect(res.addresses.length).toBeGreaterThan(0);
  });

  it("throws when a live/localhost mode is missing its URL", () => {
    expect(() => createTransport({ mode: "live" })).toThrow();
    expect(() => createTransport({ mode: "localhost" })).toThrow();
  });

  it("throws when a live mode is missing a token provider", () => {
    expect(() =>
      createTransport({ mode: "live", url: "https://mcp.swiggy.com/food" }),
    ).toThrow();
  });
});
