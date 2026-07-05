# monthlymealprep → **Rasa**

_Taste, balanced. — A month of meals, planned to your macros and budget, ordered with one tap._

**Brand:** Rasa (minted via brandmint v2 — see [`.brandmint/BRAND-BRIEF.md`](.brandmint/BRAND-BRIEF.md)). `monthlymealprep` is the repo slug.

A thoughtseed product branch. A user answers a few preference questions — via a copy-paste ChatGPT/Claude prompt or in-app — and a multi-agent system builds a **30-day meal-ordering plan** and orders it through the **Swiggy MCP** (Zomato/Instamart/tiffin in later versions), one tap at a time.

## Status

**M0 → M2 complete** (TDD) — pnpm monorepo; `@rasa/shared` Zod schemas (six spec §6 entities) + `SourceAdapter` moat boundary; `@rasa/server`'s Swiggy MCP stack (OAuth2.1/PKCE, 14 typed tool wrappers, deterministic `mock-swiggy-mcp`, `SwiggyAdapter.discover()`); and the state store (`0001_init.sql` DDL + RLS, `RasaDb.withUser()`, repositories for all entities, pglite-backed integration tests). `pnpm test` (**84 tests**) green, `pnpm typecheck` + `pnpm lint` clean. Next: **M3** — nutrition pipeline.

- **Design spec + architecture:** [`docs/superpowers/specs/2026-07-05-monthlymealprep-design.md`](docs/superpowers/specs/2026-07-05-monthlymealprep-design.md)
- **Architecture diagram:** [`docs/architecture/runtime-agent-pipeline.html`](docs/architecture/runtime-agent-pipeline.html)
- **Implementation plan (10 milestones):** [`docs/superpowers/plans/2026-07-05-monthlymealprep-v1-implementation-plan.md`](docs/superpowers/plans/2026-07-05-monthlymealprep-v1-implementation-plan.md)

### Develop

```bash
pnpm install
pnpm test        # vitest — schema round-trip tests
pnpm typecheck   # tsc across workspaces
pnpm lint        # prettier --check
```

Next milestone: **M1** — `SourceAdapter` boundary + Swiggy MCP client + `mock-swiggy-mcp`.

## The wedge (evidence-backed)

Convenience is the hook, **nutrition/health-adherence** is the value, **budget** is a guardrail, and the defensible core (reserved for v2) is **neutral cross-platform orchestration** — one plan spanning every food source. Beachhead: the metro IT/tech professional. Autonomy: **one-tap-approve per order**, not silent auto-ordering.

## Next steps

1. Cambium Genesis brand-mint (name, positioning, visual system, product-branch proof packet).
2. v1 build: seven agents against the Swiggy adapter; the copy-paste onboarding prompt; INDB nutrition.
