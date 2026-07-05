// @rasa/server — runtime agents, guardrail, scheduler, and the Swiggy MCP client.
// M1 public surface: the Swiggy transport/tools/adapter + the mock.

export type { McpTransport } from "./mcp/transport";
export { createMockSwiggyMcp } from "./mcp/mock-swiggy-mcp";
export {
  createSwiggyTools,
  SwiggyError,
  type SwiggyTools,
  type SwiggyErrorKind,
} from "./mcp/swiggy-tools";
export {
  createTransport,
  createRealSwiggyTransport,
  classifyHttpStatus,
  type SwiggyMcpMode,
} from "./mcp/swiggy-client";
export {
  generateCodeVerifier,
  deriveCodeChallenge,
  buildAuthorizationUrl,
  makeTokenProvider,
  isTokenExpired,
  type TokenSet,
  type TokenProvider,
} from "./mcp/oauth-pkce";
export { createSwiggyAdapter } from "./adapters/swiggy-adapter";

// M2 — state store + repositories
export * from "./store/index";

// M3 — nutrition pipeline
export type { LlmClient, CanonicalizeResult } from "./llm/client";
export type {
  NutritionSource,
  Per100g,
} from "./agents/nutrition/nutrition-source";
export { createIndbSource } from "./agents/nutrition/indb-source";
export {
  defaultPortionG,
  PORTION_G,
  type DishType,
} from "./agents/nutrition/portion-table";
export {
  parseQuantity,
  canonicalizeDish,
} from "./agents/nutrition/canonicalize";
export {
  createNutritionAgent,
  type NutritionCacheStore,
} from "./agents/nutrition/nutrition-agent";
