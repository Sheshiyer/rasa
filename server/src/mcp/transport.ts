/**
 * The minimal MCP surface the tool wrappers depend on. Both the real
 * streamable-HTTP client and the in-memory mock implement this, so every agent
 * and test is decoupled from the transport.
 */
export interface McpTransport {
  callTool(name: string, args: Record<string, unknown>): Promise<unknown>;
}
