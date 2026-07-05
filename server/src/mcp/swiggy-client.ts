import { createMockSwiggyMcp } from "./mock-swiggy-mcp";
import { SwiggyError, type SwiggyErrorKind } from "./swiggy-tools";
import type { McpTransport } from "./transport";
import type { TokenProvider } from "./oauth-pkce";

export type SwiggyMcpMode = "mock" | "localhost" | "live";

/** Map an HTTP status to a retry class. 401 = auth, 429/5xx = transient, other 4xx = business. */
export function classifyHttpStatus(status: number): SwiggyErrorKind {
  if (status === 401) return "auth";
  if (status === 429 || status >= 500) return "transport";
  if (status >= 400) return "business";
  return "unknown";
}

function classifyThrown(e: unknown, tool: string): SwiggyError {
  const anyE = e as { status?: number; code?: number; message?: string };
  const status =
    typeof anyE?.status === "number"
      ? anyE.status
      : typeof anyE?.code === "number"
        ? anyE.code
        : undefined;
  if (status !== undefined) {
    return new SwiggyError(
      classifyHttpStatus(status),
      `tool ${tool} failed (${status})`,
      e,
    );
  }
  const msg = anyE?.message ?? String(e);
  const kind: SwiggyErrorKind =
    /fetch failed|ECONN|ETIMEDOUT|network|socket|aborted/i.test(msg)
      ? "transport"
      : "unknown";
  return new SwiggyError(kind, `tool ${tool} failed: ${msg}`, e);
}

export interface SwiggyTransportConfig {
  url: string;
  tokenProvider: TokenProvider;
  clientName?: string;
  clientVersion?: string;
}

/**
 * The real MCP-over-streamable-HTTP transport (wraps @modelcontextprotocol/sdk).
 * Isolated infra: exercised at live-integration time; the mock is the tested path.
 * Self-heals on 401 — it drops the connection so the next call reconnects with a
 * freshly-refreshed token (the tools layer invalidates the TokenProvider on 401).
 */
export function createRealSwiggyTransport(
  cfg: SwiggyTransportConfig,
): McpTransport {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let clientPromise: Promise<any> | null = null;

  async function getClient(): Promise<unknown> {
    if (!clientPromise) {
      clientPromise = (async () => {
        const { Client } =
          await import("@modelcontextprotocol/sdk/client/index.js");
        const { StreamableHTTPClientTransport } =
          await import("@modelcontextprotocol/sdk/client/streamableHttp.js");
        const accessToken = await cfg.tokenProvider.getAccessToken();
        const transport = new StreamableHTTPClientTransport(new URL(cfg.url), {
          requestInit: { headers: { Authorization: `Bearer ${accessToken}` } },
        });
        const client = new Client({
          name: cfg.clientName ?? "rasa",
          version: cfg.clientVersion ?? "0.0.0",
        });
        await client.connect(transport);
        return client;
      })();
    }
    return clientPromise;
  }

  return {
    async callTool(name, args) {
      try {
        const client = (await getClient()) as {
          callTool: (p: {
            name: string;
            arguments: Record<string, unknown>;
          }) => Promise<{
            isError?: boolean;
            structuredContent?: unknown;
            content?: { type?: string; text?: string }[];
          }>;
        };
        const result = await client.callTool({ name, arguments: args });
        if (result?.isError)
          throw new SwiggyError(
            "business",
            `tool ${name} returned an error result`,
          );
        if (result?.structuredContent !== undefined)
          return result.structuredContent;
        const text = Array.isArray(result?.content)
          ? result.content
              .filter((c) => c?.type === "text")
              .map((c) => c.text ?? "")
              .join("")
          : "";
        return text ? JSON.parse(text) : {};
      } catch (e) {
        const err = e instanceof SwiggyError ? e : classifyThrown(e, name);
        if (err.kind === "auth") clientPromise = null; // force reconnect with a fresh token next time
        throw err;
      }
    },
  };
}

export interface CreateTransportOptions {
  mode: SwiggyMcpMode;
  url?: string;
  tokenProvider?: TokenProvider;
  clientName?: string;
  clientVersion?: string;
}

/** Pick the transport for the current mode. `mock` needs nothing; live/localhost need url + token. */
export function createTransport(opts: CreateTransportOptions): McpTransport {
  if (opts.mode === "mock") return createMockSwiggyMcp();
  if (!opts.url)
    throw new Error(`SWIGGY_MCP_URL is required for mode "${opts.mode}"`);
  if (!opts.tokenProvider)
    throw new Error(`a TokenProvider is required for mode "${opts.mode}"`);
  return createRealSwiggyTransport({
    url: opts.url,
    tokenProvider: opts.tokenProvider,
    clientName: opts.clientName,
    clientVersion: opts.clientVersion,
  });
}
