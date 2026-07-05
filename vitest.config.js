import { defineConfig } from "vitest/config";

// NOTE: Vitest prints one spurious esbuild warning at startup —
//   "Cannot find base config file 'astro/tsconfigs/strict' [tsconfig.json]"
// It refers to ../../../tsconfig.json, a broken tsconfig in the PARENT VAULT
// (outside this repo), not to any Rasa file. See docs/known-issues.md.
// Tests and typecheck are unaffected.
export default defineConfig({
  test: {
    include: ["shared/**/*.test.ts", "server/**/*.test.ts"],
    environment: "node",
  },
});
