# Rasa (monthlymealprep) v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the v1 Swiggy-only "Rasa" thin MVP — an Expo mobile app + a TypeScript agent backend that turns a Preference Profile into an approved 30-day meal plan and executes each meal slot as a one-tap-approve Swiggy Food order.

**Architecture:** A pnpm monorepo with three workspaces: `app/` (React Native / Expo mobile client), `server/` (TypeScript agent runtime on Node — 7 runtime agents + guardrail layer + app-side scheduler + Swiggy MCP client), and `shared/` (Zod-first types, the `PreferenceProfile` schema, `SourceAdapter` interface, and cross-cutting contracts). State lives in Supabase/Postgres. The seven agents are plain composable TypeScript modules (a lightweight orchestrator, not an agent framework) so control flow, testing, and cost are fully deterministic; only the two sub-tasks that genuinely need an LLM (nutrition canonicalization, profile repair) call a model directly via the Anthropic SDK. The `SourceAdapter` boundary is built in M1 so v2's Zomato/Instamart/tiffin adapters drop in with zero downstream rewrites.

**Tech Stack:** pnpm workspaces · TypeScript 5.x (strict) · React Native + Expo (SDK 51+, expo-router) · Node 20 LTS (server) · Supabase / Postgres (state store, Row-Level Security) · Zod (runtime validation + type source of truth) · `@modelcontextprotocol/sdk` (MCP-over-streamable-HTTP client) · Anthropic SDK (LLM calls) · Vitest (unit/integration) · Detox or Maestro (app e2e, optional in v1) · node-cron / BullMQ-style tick loop (app-side scheduler) · Expo push notifications (one-tap nudge).

## Global Constraints

- **v1 source = Swiggy Food MCP only.** All 7 agents run against the `SwiggyAdapter` exclusively. No Zomato / Instamart / tiffin code paths ship (interface reserved, not implemented).
- **Autonomy = one-tap-approve per order.** Nothing is ordered or paid silently. `place_food_order` is only ever called after an explicit user confirm on that specific slot. No pre-authorized "envelope" autonomy.
- **Swiggy Food server = exactly 14 tools:** `get_addresses`, `search_restaurants`, `search_menu`, `get_restaurant_menu`, `get_food_cart`, `update_food_cart`, `flush_food_cart`, `fetch_food_coupons`, `apply_food_coupon`, `place_food_order`, `get_food_orders`, `get_food_order_details`, `track_food_order`, `report_error`. Do not invent tools.
- **Swiggy MCP has NO native scheduling** — the 30-day calendar lives in our store; our scheduler triggers each slot in real time.
- **Swiggy MCP carries NO nutrition data** — dishes have name/description/price/veg-flag only; the Nutrition Agent enriches externally.
- **Swiggy auth = OAuth 2.1 + PKCE, per user.** Dev on localhost; live access requires a submitted video demo. Build against a mock MCP until live access is granted.
- **Allergens = hard block.** Never violated by any agent under any relaxation. Diet type, budget hard cap, and deliverability are the other hard constraints.
- **FSSAI-safe copy everywhere:** nutrition figures are always labelled "estimated"; no disease/treatment/"doctor-approved"/medical claims; a disclaimer accompanies every nutrition figure. Health/wellness framing, never a convenience-fee framing.
- **Brand = "Rasa"** (*Taste, balanced.*). Voice: effortless, balanced, warm, precise, unobtrusive (Caregiver + Sage). Colors: Turmeric Saffron `#E8A33D`, Fresh Basil Green `#2F7D5B`, Ripe Tomato `#E4572E` (confirm moments only).
- **Nutrition MVP DB = INDB** (free, 1,014 cooked Indian recipes, self-hosted). Bon Happetee is a reserved production upgrade, not built in v1.
- **Nutrition accuracy target:** DB-hit ±15–20% cal / ±20–25% macros; LLM-fallback ±30–40%; daily-plan aggregate ±10–15%. Confidence bands: DB-hit = `high`, LLM = `low`. Never claim per-dish precision.

## Non-Goals (explicitly deferred)

- **Zomato / Instamart / tiffin adapters** → v2 (interface reserved behind `SourceAdapter` in M1; no implementation).
- **Cross-source budget arbitrage** → v2 (auto-activates when adapters ≥ 2).
- **Pre-authorized "envelope" autonomy / real "approve & forget"** → v3, trust-earned.
- **Bon Happetee nutrition source** → production upgrade behind the `NutritionSource` interface.
- **Image / photography / illustration / content generation** → deferred (needs image-gen infra; Cambium Genesis brand mint is a separate session).
- **Premium fitness ("Macro Meera") / senior-care ("Provider Prakash") tiers** → v3.
- **Payments UI beyond what the Swiggy MCP checkout flow provides** → v1 relies on Swiggy's own payment authorization inside `place_food_order`; we build no independent wallet.

---

## Chosen Architecture & Tech Stack — Justification and Trade-offs

### Why a pnpm monorepo (`app/` + `server/` + `shared/`)

The `PreferenceProfile`, `CandidateDish`, and `Plan` schemas are the contract between the mobile client and the agent backend, and the onboarding-prompt JSON must validate identically on both sides. A `shared/` workspace that exports one set of Zod schemas (and their inferred TS types) eliminates schema drift — the single highest-risk class of bug in a "paste JSON from ChatGPT" product. pnpm workspaces give fast, disk-efficient installs and strict dependency isolation.

- **Trade-off:** a monorepo adds build-orchestration overhead vs. three separate repos. Mitigated by keeping `shared/` dependency-free (pure Zod + types) so it builds in milliseconds and both consumers import it directly.

### Why React Native / Expo for the app

Thoughtseed's stack already skews Expo/RN; the app is UI-light (onboarding paste box, plan review, a daily one-tap confirm push). Expo gives managed push notifications (`expo-notifications`) — critical because the one-tap nudge is the core interaction — plus OTA updates and a single codebase for iOS/Android. `expo-router` gives file-based navigation matching the small screen count.

- **Trade-off:** Expo's managed workflow constrains native modules. None of v1's needs (push, secure token storage via `expo-secure-store`, a WebView for the OAuth consent screen) require ejecting.

### Why TypeScript on Node for the backend (not Cloudflare Workers in v1)

Two forces point to a long-lived Node process over Workers for v1: (1) the **app-side scheduler** must hold a durable per-slot timer wheel and wake reliably at meal windows — a persistent process with `node-cron` + a Postgres-backed job table is simpler and more debuggable than composing Cloudflare Cron Triggers + Durable Object alarms for a pre-revenue MVP; (2) the MCP-over-streamable-HTTP client with per-user OAuth token refresh is straightforward in Node and lets us run the whole backend on localhost for the Swiggy video-demo gating path. We keep all I/O behind interfaces so a later port to Workers (Durable Objects for the scheduler, KV/R2 for cache) is mechanical.

- **Trade-off:** Node needs a host (Fly.io / Render / a small VM) vs. Workers' zero-ops edge. Acceptable at MVP scale; the interface discipline preserves the option. **Documented migration note in the repo README.**

### Why plain TS agent modules (not an agent framework) in v1

The 7 "agents" are deterministic pipeline stages with exactly two LLM touch-points (nutrition canonicalization, profile repair). A framework (OpenAI Agents SDK / LangGraph / Vercel AI SDK) would add a non-deterministic planning layer and hidden token cost over what is fundamentally a typed function pipeline plus a CSP solver. Plain modules make every stage independently unit-testable against a mock MCP and keep the guardrail layer a hard, auditable gate rather than a "tool the model might call."

- **Trade-off:** we hand-write the orchestration the CSP planner needs. That is desirable here — the planner is a constraint solver, not a chat loop. We isolate LLM calls behind an `LlmClient` interface (`canonicalizeDish`, `repairProfile`) so a framework can be adopted later without touching pipeline structure.

### Why Supabase / Postgres for the state store

Five related, queryable, relational entities (`PreferenceProfile`, `Plan`, `SpendLedger`, `OrderHistory`, `NutritionCache`) with per-user isolation. Supabase gives Postgres + Row-Level Security (each user sees only their rows) + a typed client usable from both `server/` and (read-only) `app/` + auth we can reuse for app login. `NutritionCache` keyed by `canonical_dish_id` is a natural Postgres table with an index.

- **Trade-off:** Supabase couples us to a vendor. Mitigated because it is plain Postgres underneath — a `pg` connection string is portable. All DB access goes through a thin repository layer in `server/src/store/` so the client is swappable.

### Repo / module layout

```
monthlymealprep/
├── package.json                # pnpm workspace root; scripts: build, test, lint, typecheck
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── .env.example                # SUPABASE_URL, SUPABASE_SERVICE_KEY, ANTHROPIC_API_KEY,
│                               # SWIGGY_MCP_URL, SWIGGY_OAUTH_CLIENT_ID, EXPO_PUSH_TOKEN...
├── shared/
│   ├── package.json            # name: @rasa/shared
│   └── src/
│       ├── schemas/
│       │   ├── preference-profile.ts   # Zod PreferenceProfile + inferred type
│       │   ├── candidate-dish.ts       # Zod CandidateDish
│       │   ├── plan.ts                 # Zod Plan / PlanEntry
│       │   ├── spend-ledger.ts         # Zod SpendLedger
│       │   └── nutrition.ts            # Macros, MacroConfidence, NutritionEstimate
│       ├── source-adapter.ts           # SourceAdapter interface (the v2 moat boundary)
│       ├── guardrail.ts                # GuardrailDecision types
│       └── index.ts
├── server/
│   ├── package.json            # name: @rasa/server
│   └── src/
│       ├── mcp/
│       │   ├── swiggy-client.ts        # MCP-over-streamable-HTTP client + OAuth2.1/PKCE
│       │   ├── swiggy-tools.ts         # typed wrappers for all 14 Food tools
│       │   ├── oauth-pkce.ts           # PKCE challenge/verifier + token refresh
│       │   └── mock-swiggy-mcp.ts      # in-memory mock MCP for tests + pre-live-access dev
│       ├── adapters/
│       │   └── swiggy-adapter.ts       # implements SourceAdapter over swiggy-tools
│       ├── agents/
│       │   ├── preferences.ts          # Agent 1
│       │   ├── discovery.ts            # Agent 2 (wraps SourceAdapter)
│       │   ├── nutrition/
│       │   │   ├── nutrition-agent.ts  # Agent 3 orchestrator
│       │   │   ├── canonicalize.ts     # LLM canonicalize + portion parse
│       │   │   ├── portion-table.ts    # portion-heuristic table
│       │   │   ├── indb-source.ts      # INDB lookup (NutritionSource impl)
│       │   │   └── nutrition-source.ts # NutritionSource interface (Bon Happetee reserved)
│       │   ├── budget.ts               # Agent 4
│       │   ├── planner.ts              # Agent 5 (CSP solver)
│       │   ├── scheduler/
│       │   │   ├── scheduler.ts        # Agent 6 tick loop + slot wake
│       │   │   └── executor.ts         # re-validate → cart → nudge → order
│       │   └── tracking.ts             # Agent 7
│       ├── guardrail/
│       │   └── policy.ts               # cross-cutting guardrail gate
│       ├── llm/
│       │   ├── client.ts               # LlmClient interface
│       │   └── anthropic-client.ts     # Anthropic SDK impl
│       ├── store/
│       │   ├── db.ts                   # Supabase/pg connection
│       │   ├── profiles.ts             # repository per entity
│       │   ├── plans.ts
│       │   ├── ledger.ts
│       │   ├── orders.ts
│       │   └── nutrition-cache.ts
│       ├── notify/
│       │   └── push.ts                 # Expo push (one-tap nudge)
│       ├── api/
│       │   └── routes.ts               # HTTP endpoints the app calls
│       └── index.ts                    # server entrypoint
├── app/
│   ├── package.json            # name: @rasa/app (Expo)
│   ├── app.json
│   └── src/
│       ├── app/                        # expo-router screens
│       │   ├── onboarding.tsx          # paste-JSON + in-app Q&A
│       │   ├── plan-review.tsx         # 30-day plan approval
│       │   ├── confirm/[slotId].tsx    # one-tap confirm screen
│       │   └── index.tsx               # home / today
│       ├── lib/
│       │   ├── api.ts                  # server client
│       │   ├── validate-profile.ts     # imports @rasa/shared schema
│       │   └── swiggy-auth.ts          # OAuth consent WebView launch
│       └── theme.ts                    # Rasa brand tokens
├── db/
│   └── migrations/                     # SQL DDL migrations (numbered)
├── data/
│   └── indb/                           # INDB seed CSV/JSON checked in or fetched
└── docs/
    └── onboarding-prompt.md            # the canonical copy-paste prompt (source of truth)
```

---

## Data Layer — Schemas (spec §6)

Two representations, one source of truth: **Zod schemas in `shared/`** are authoritative for runtime validation and TS types; **Postgres DDL in `db/migrations/`** persists them. Every column below has an explicit type. All user-scoped tables carry `user_id` and an RLS policy. Postgres DDL (v1 canonical):

```sql
-- 0001_init.sql

-- Users are provided by Supabase auth.users; we key everything to auth.uid().

create table preference_profiles (
  user_id              uuid primary key references auth.users(id) on delete cascade,
  diet_type            text not null check (diet_type in ('veg','jain','egg','nonveg')),
  cuisines_like        text[] not null default '{}',
  cuisines_avoid       text[] not null default '{}',
  allergens            text[] not null default '{}',            -- HARD constraint
  dislikes             text[] not null default '{}',
  spice_level          text not null check (spice_level in ('mild','medium','hot')),
  meals_per_day        int  not null check (meals_per_day between 1 and 6),
  slots                jsonb not null,   -- [{ "name":"lunch", "window":"12:30-13:30" }]
  delivery_address_id  text,             -- swiggy address ref; nullable until linked
  budget_monthly_inr   int  not null check (budget_monthly_inr > 0),
  calorie_target       int  not null check (calorie_target > 0),
  macro_target         jsonb not null,   -- { protein_g, carb_g, fat_g }
  variety_tolerance    text not null check (variety_tolerance in ('low','medium','high')),
  source_prefs         text[] not null default '{swiggy}',       -- v1: only 'swiggy'
  cheat_rules          jsonb,            -- { days:["Sat"], relax_macros:true } | null
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- CandidateDish is largely transient (produced per planning run) but the
-- nutrition enrichment is cached separately. Persist candidates per plan run
-- for auditability and fallbacks.
create table candidate_dishes (
  id                     uuid primary key default gen_random_uuid(),
  plan_run_id            uuid not null,            -- groups a discovery+enrich pass
  source                 text not null default 'swiggy',
  restaurant_id          text not null,
  restaurant_name        text not null,
  dish_id                text not null,
  dish_name              text not null,
  description            text,
  price_inr              int not null,
  is_veg                 boolean not null,
  canonical_dish_id      text,                     -- set by Nutrition Agent
  macros                 jsonb,                    -- { cal, protein_g, carb_g, fat_g } | null
  macro_confidence       text check (macro_confidence in ('high','low')),
  deliverable_to_address boolean not null default false,
  created_at             timestamptz not null default now()
);
create index candidate_dishes_plan_run_idx on candidate_dishes(plan_run_id);

create table plans (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  status        text not null check (status in ('draft','approved','active','completed','cancelled')),
  start_date    date not null,          -- 30-day window start
  end_date      date not null,
  approved_at   timestamptz,
  created_at    timestamptz not null default now()
);
create index plans_user_idx on plans(user_id);

create table plan_entries (
  id                uuid primary key default gen_random_uuid(),
  plan_id           uuid not null references plans(id) on delete cascade,
  day               date not null,
  slot              text not null,            -- 'lunch' | 'dinner' | ...
  chosen            jsonb not null,           -- serialized CandidateDish
  fallbacks         jsonb not null default '[]', -- ranked CandidateDish[]
  slot_budget_inr   int not null,
  projected_macros  jsonb not null,           -- { cal, protein_g, carb_g, fat_g }
  slot_state        text not null default 'pending'
                    check (slot_state in ('pending','nudged','confirmed','ordered','declined','skipped','failed')),
  scheduled_wake_at timestamptz,              -- when scheduler should wake this slot
  created_at        timestamptz not null default now(),
  unique (plan_id, day, slot)
);
create index plan_entries_wake_idx on plan_entries(slot_state, scheduled_wake_at);

create table spend_ledger (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  plan_id        uuid not null references plans(id) on delete cascade,
  plan_entry_id  uuid references plan_entries(id) on delete set null,
  day            date not null,
  slot           text not null,
  planned_inr    int not null,
  actual_inr     int,                          -- null until ordered
  coupon_code    text,
  coupon_discount_inr int not null default 0,
  created_at     timestamptz not null default now()
);
create index spend_ledger_user_month_idx on spend_ledger(user_id, day);

create table order_history (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  plan_entry_id     uuid references plan_entries(id) on delete set null,
  swiggy_order_id   text,                       -- from place_food_order
  restaurant_id     text not null,
  dish_id           text not null,
  dish_name         text not null,
  amount_inr        int not null,
  status            text not null,              -- placed|tracking|delivered|cancelled|failed
  rating            int check (rating between 1 and 5),  -- post-meal feedback
  placed_at         timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index order_history_user_idx on order_history(user_id);

create table nutrition_cache (
  canonical_dish_id text primary key,
  macros            jsonb not null,             -- { cal, protein_g, carb_g, fat_g }
  macro_confidence  text not null check (macro_confidence in ('high','low')),
  source            text not null,              -- 'indb' | 'llm-fallback' | 'portion-scaled'
  portion_g         numeric,
  created_at        timestamptz not null default now()
);

-- RLS: enable on every user-scoped table; policy = user_id = auth.uid().
alter table preference_profiles enable row level security;
alter table plans               enable row level security;
alter table plan_entries        enable row level security;  -- via plan_id join policy
alter table spend_ledger        enable row level security;
alter table order_history       enable row level security;
create policy own_profile on preference_profiles using (user_id = auth.uid());
create policy own_plans    on plans using (user_id = auth.uid());
create policy own_ledger   on spend_ledger using (user_id = auth.uid());
create policy own_orders   on order_history using (user_id = auth.uid());
```

The matching Zod schemas live in `shared/src/schemas/*` and are the type source (`type PreferenceProfile = z.infer<typeof PreferenceProfileSchema>`). `nutrition_cache` is not user-scoped (dish nutrition is global and shared across users — the whole point of caching by `canonical_dish_id`).

---

## The Swiggy MCP Client Module

**Transport:** MCP-over-streamable-HTTP via `@modelcontextprotocol/sdk` `Client` + `StreamableHTTPClientTransport` pointed at `SWIGGY_MCP_URL`.

**Auth (OAuth 2.1 + PKCE, per user):**
1. App generates a PKCE `code_verifier` + `code_challenge` (S256), opens Swiggy's authorization URL in a WebView (`app/src/lib/swiggy-auth.ts`).
2. User consents; Swiggy redirects with an auth `code`.
3. App sends `code` + `code_verifier` to `server`, which exchanges them at Swiggy's token endpoint for `{ access_token, refresh_token, expires_in }`.
4. Tokens stored **encrypted, per user** (server side; `expo-secure-store` holds only a session handle on-device). `oauth-pkce.ts` owns refresh: on 401 or near-expiry, exchange the refresh token and retry once.
5. Every MCP call attaches the user's current `access_token`.

**The 14 Food tools** are each wrapped in `swiggy-tools.ts` as typed async functions returning Zod-validated results, so agents never touch raw MCP JSON: `getAddresses`, `searchRestaurants`, `searchMenu`, `getRestaurantMenu`, `getFoodCart`, `updateFoodCart`, `flushFoodCart`, `fetchFoodCoupons`, `applyFoodCoupon`, `placeFoodOrder`, `getFoodOrders`, `getFoodOrderDetails`, `trackFoodOrder`, `reportError`.

**Error handling:** every wrapper distinguishes (a) transport/5xx → retry with backoff (max 2), (b) 401 → refresh-then-retry-once, (c) 4xx business errors (out of stock, restaurant closed, price changed) → typed `SwiggyError` the caller handles, (d) unknown → call `reportError` and surface to guardrail. `placeFoodOrder` is **never retried automatically** (no double-charge).

**Local-dev → live-access path:** Until Swiggy grants live access, `SWIGGY_MCP_MODE=mock` routes `swiggy-tools` to `mock-swiggy-mcp.ts` (deterministic in-memory fixtures — restaurants, menus, coupons, cart, orders). The whole system (all 7 agents, scheduler, paper dry-run) is buildable and testable against the mock. When ready, run locally against `SWIGGY_MCP_MODE=localhost`, record the video demo of a full plan → one-tap order flow, submit to Swiggy, then flip to `SWIGGY_MCP_MODE=live`. The mock is the acceptance-test harness in M-early and stays the CI backend permanently.

---

## Milestones

Each milestone ends independently testable. The `SourceAdapter` boundary lands in **M1** so the cross-platform moat is a later drop-in.

- **M0 — Monorepo scaffold & shared schemas.** pnpm workspace, `shared/` Zod schemas + inferred types, tsconfig, Vitest, lint, CI. **DoD:** `pnpm test` green on schema round-trip tests; `pnpm typecheck` clean across all workspaces.
- **M1 — SourceAdapter boundary + Swiggy MCP client + mock.** `SourceAdapter` interface in `shared/`; `swiggy-client` (OAuth2.1/PKCE + streamable-HTTP), the 14 typed tool wrappers, `mock-swiggy-mcp`, and `SwiggyAdapter`. **DoD:** every tool wrapper unit-tested against the mock; `SwiggyAdapter.discover()` returns typed `CandidateDish[]`; auth refresh path tested.
- **M2 — State store & repositories.** DDL migrations, Supabase connection, repository modules for all five entities + RLS. **DoD:** integration tests write+read every entity against a local Postgres; RLS blocks cross-user reads.
- **M3 — Nutrition pipeline.** Portion table, INDB ingestion + lookup, LLM canonicalizer (behind `LlmClient`), fallback estimator, confidence bands, cache. **DoD:** enrich a fixed dish list end-to-end; DB-hit → `high`, no-hit → `low`; second call hits cache; daily-aggregate error within ±10–15% on the dry-run day fixture.
- **M4 — Preferences Agent + onboarding prompt + validation/repair.** The canonical prompt (docs), the Zod-validated paste path, LLM repair, in-app missing-question fallback. **DoD:** valid JSON stores a profile; malformed JSON is repaired or triggers exactly the missing questions; allergens always survive round-trip.
- **M5 — Discovery + Budget agents.** Discovery over `SwiggyAdapter` (deliverability + hard-pref pre-filter, dedupe); Budget (per-slot envelope, coupon fetch/apply plan, Spend Ledger). **DoD:** discovery returns deduped deliverable candidates for the dry-run profile; budget produces per-slot caps summing under monthly budget; coupons reduce effective price.
- **M6 — Guardrail layer + Planner (CSP).** Guardrail gate (allergen hard-block, spend cap, price-spike abort, FSSAI copy check); Planner CSP solver with hard/soft constraints + defined relaxation order + infeasibility surfacing. **DoD:** planner emits a 30-day plan; injecting an allergen dish is hard-blocked; an infeasible target surfaces a tradeoff instead of violating a hard constraint.
- **M7 — Scheduler / Executor.** Tick loop + slot wake, re-validate → cart → one-tap nudge (Expo push) → on confirm `place_food_order`; decline/timeout → fallback or skip; writes ledger + order history. **DoD:** a due slot fires a nudge; confirm places a (mock) order and records actuals; decline picks the fallback; price-spike past cap aborts via guardrail.
- **M8 — Tracking / Feedback.** `track_food_order` status polling; post-meal rating → preference-weight update. **DoD:** order status transitions recorded; a 👍 nudges the stored profile weight for that dish/restaurant.
- **M9 — App integration (Expo).** Onboarding screen, plan review/approval, one-tap confirm screen wired to push deep-links, Swiggy OAuth WebView, Rasa theme. **DoD:** on-device (or simulator) run completes onboarding → plan approve → receives a nudge → one-tap confirm against the mock server.
- **M10 — Paper dry-run acceptance + live-access demo prep.** Wire the spec §12 "Deadline Deepak" day as a full-pipeline integration test; assemble the localhost live-order video-demo flow. **DoD:** the §12 day passes end-to-end through all 7 agents + guardrail as an automated test; a scripted localhost demo run is documented and reproducible.

---

## Per-Agent / Module Task Breakdown

For each: **inputs · outputs · key logic · Swiggy tools used.**

**1 · Preferences Agent** (`server/src/agents/preferences.ts`)
- **Inputs:** pasted JSON from the onboarding prompt; in-app edits.
- **Outputs:** validated, persisted `PreferenceProfile`.
- **Key logic:** `PreferenceProfileSchema.safeParse`; on failure call `LlmClient.repairProfile(raw, zodError)` → re-validate; if still missing fields, return the minimal set of in-app questions. Allergens/diet never inferred silently — repair may not fabricate a hard constraint.
- **Swiggy tools:** none (cold-start entry).

**2 · Discovery / Supply Agent** (`server/src/agents/discovery.ts` + `adapters/swiggy-adapter.ts`)
- **Inputs:** `PreferenceProfile`, target slot(s).
- **Outputs:** deduped `CandidateDish[]`, pre-filtered by deliverability + hard prefs (diet type, allergens).
- **Key logic:** confirm deliverability via `get_addresses`; query restaurants/menus; map to `CandidateDish`; drop non-deliverable, wrong-diet, allergen-named dishes; dedupe by `(restaurant_id, dish_id)`. All Swiggy calls go through `SwiggyAdapter` implementing `SourceAdapter` — the v2 boundary.
- **Swiggy tools:** `get_addresses`, `search_restaurants`, `search_menu`, `get_restaurant_menu`.

**3 · Nutrition Agent** (`server/src/agents/nutrition/*`)
- **Inputs:** `CandidateDish[]` (no macros).
- **Outputs:** macro-tagged `CandidateDish[]` + `macro_confidence`; cache writes.
- **Key logic:** LLM canonicalize + portion-parse → `canonical_dish_id` + qty + default portion (portion-heuristic table); cache lookup; INDB grounded lookup (`NutritionSource`); on no hit, CoT LLM fallback flagged `low`; portion-scale; write cache. Framing always "estimated"; no per-dish precision claims.
- **Swiggy tools:** none (external enrichment).

**4 · Budget / Price Agent** (`server/src/agents/budget.ts`)
- **Inputs:** macro-tagged candidates, `PreferenceProfile.budget_monthly_inr`, slots.
- **Outputs:** per-slot budget envelope + coupon plan; Spend Ledger entries.
- **Key logic:** allocate monthly budget across 30 days × slots; per-day/per-meal caps; fetch + evaluate coupons, keep best applicable; record planned spend. (Cross-source arbitrage deferred to v2.)
- **Swiggy tools:** `fetch_food_coupons`, `apply_food_coupon` (apply is exercised at execution time by the Executor; Budget plans which coupon).

**5 · Planner / Orchestrator Agent** (`server/src/agents/planner.ts`)
- **Inputs:** candidates (macro + price + envelope), `PreferenceProfile`.
- **Outputs:** `Plan` (per-slot chosen + ranked fallbacks + projected macros + slot budget) for one-time approval.
- **Key logic:** CSP/assignment over 30 days. Hard: allergens, diet, budget hard cap, deliverability. Soft (optimized): macro/calorie targets, price envelope, variety/anti-repeat, cuisine likes/dislikes, delivery windows. Infeasibility → relax soft constraints in a **defined order** (variety → cuisine-likes → price-envelope-softness → macro-tolerance), surface the tradeoff, never break a hard constraint.
- **Swiggy tools:** none (operates on prepared candidates).

**6 · Scheduler / Executor Agent** (`server/src/agents/scheduler/*`)
- **Inputs:** approved `Plan`, current time.
- **Outputs:** placed orders, ledger actuals, order history, slot state transitions.
- **Key logic:** tick loop selects `plan_entries` where `scheduled_wake_at <= now` and `slot_state='pending'`; **re-validate** (open? price within cap? in stock? still fits macros/budget?); build cart; run through Guardrail; send one-tap nudge (Expo push); on confirm `place_food_order`; on decline/timeout → top fallback or skip. **Never orders silently.**
- **Swiggy tools:** `get_restaurant_menu`/`search_menu` (re-validate), `update_food_cart`, `get_food_cart`, `apply_food_coupon`, `flush_food_cart`, `place_food_order`.

**7 · Tracking / Feedback Agent** (`server/src/agents/tracking.ts`)
- **Inputs:** placed order ids, post-meal ratings.
- **Outputs:** live status in Order History; updated preference weights.
- **Key logic:** poll `track_food_order` / `get_food_order_details` until terminal; collect rating → nudge stored profile weights (learned likes/dislikes, portion fit).
- **Swiggy tools:** `track_food_order`, `get_food_order_details`, `get_food_orders`.

**Guardrail / Policy layer** (`server/src/guardrail/policy.ts`)
- **Inputs:** any proposed order/cart action + `PreferenceProfile`.
- **Outputs:** `GuardrailDecision` = `allow | block(reason)`; enforced between Planner/Executor and any order action.
- **Key logic:** allergen hard-block (dish name/description/canonical vs `allergens[]`), spend-cap check, price-spike abort (delta beyond cap), human-in-the-loop gate assertion (no order without a confirm token), FSSAI copy check on any surfaced nutrition text.
- **Swiggy tools:** none (gate); may call `report_error` on abort.

---

## Nutrition Pipeline (its own milestone, M3)

Build order inside M3:
1. **Portion-heuristic table** (`portion-table.ts`): a typed map dish-type → default grams (curry ~200g, paratha ~100g/pc, biryani ~330g, dal ~180g, rice ~180g, bowl ~350g …) + a classifier from canonical name.
2. **INDB ingestion** (`data/indb/` + a one-shot loader): normalize the 1,014-recipe INDB dataset into `nutrition_source_indb` (name → per-portion macros); build a fuzzy-match index on canonical names.
3. **LLM canonicalizer** (`canonicalize.ts`, behind `LlmClient`): normalize display name → `canonical_dish_id`, parse counts ("2 Aloo Paratha" → qty 2), classify dish type.
4. **NutritionSource interface** (`nutrition-source.ts`) with `IndbSource` impl; Bon Happetee reserved as a second impl (not built).
5. **Fallback estimator** (CoT LLM) only on no DB hit → flagged `low`.
6. **Portion scaling + confidence band** (DB-hit `high`, LLM `low`).
7. **Cache** (`nutrition-cache` table) keyed by `canonical_dish_id`; check before any lookup.

**DoD (M3):** enrich the §12 dry-run dish list; Grilled Chicken Bowl resolves DB-hit `high`; an unknown dish resolves LLM `low`; repeat call is a cache hit; daily-aggregate error on the dry-run day is within ±10–15% of the fixture.

---

## The Onboarding Prompt + JSON Schema + Validation/Repair

### Canonical copy-paste prompt (store at `docs/onboarding-prompt.md`)

```
You are Rasa's onboarding assistant. Rasa plans a month of meals to a person's
macros and budget and orders them one tap at a time from food-delivery apps in
India. Your job: interview me briefly, then output my preference profile as JSON.

RULES
- Ask ONE topic at a time, in this order, waiting for my answer each time:
  1) Diet type (veg / jain / egg / nonveg)
  2) Any food allergies (I may say "none")
  3) Cuisines I like, and any I want to avoid
  4) Foods I dislike (e.g. mushroom)
  5) Spice level (mild / medium / hot)
  6) How many meals a day you should plan, and the time window for each
     (e.g. "lunch 12:30-13:30, dinner 20:00-21:00")
  7) My monthly food budget in rupees
  8) My daily calorie target and protein / carb / fat goals in grams
     (if I don't know, suggest sensible defaults for my described goal and confirm)
  9) How much I mind eating the same thing repeatedly (low / medium / high tolerance)
  10) Any cheat/relax days (e.g. "Saturdays, relax macros")
- Keep it warm and brief. Do NOT give medical, disease, or treatment advice.
  Nutrition numbers are estimates only.
- When you have all answers, output EXACTLY ONE fenced JSON code block and nothing
  after it, matching this schema. allergens/dislikes/cuisines are arrays; budget,
  calories, and macro grams are integers; meals_per_day is an integer.

OUTPUT SCHEMA (fill every field; use [] for empty arrays, null only where shown):
{
  "diet_type": "veg | jain | egg | nonveg",
  "cuisines_like": ["..."],
  "cuisines_avoid": ["..."],
  "allergens": ["..."],
  "dislikes": ["..."],
  "spice_level": "mild | medium | hot",
  "meals_per_day": 2,
  "slots": [{ "name": "lunch", "window": "12:30-13:30" }],
  "budget_monthly_inr": 9000,
  "calorie_target": 2000,
  "macro_target": { "protein_g": 120, "carb_g": 200, "fat_g": 60 },
  "variety_tolerance": "low | medium | high",
  "cheat_rules": { "days": ["Sat"], "relax_macros": true }
}

Begin by asking me about my diet type.
```

Note: the prompt intentionally omits `user_id`, `delivery_address_id`, and `source_prefs` — those are filled app-side (address via Swiggy `get_addresses`, `source_prefs` defaults to `["swiggy"]`, `user_id` from auth). The app merges them after paste.

### Exact JSON Preference Profile schema (the prompt must emit)

The prompt emits every field of `PreferenceProfile` **except** `user_id`, `delivery_address_id`, `source_prefs`. Emitted shape (Zod `OnboardingProfileSchema` in `shared/`):

```ts
// shared/src/schemas/preference-profile.ts (onboarding subset)
export const OnboardingProfileSchema = z.object({
  diet_type: z.enum(['veg','jain','egg','nonveg']),
  cuisines_like: z.array(z.string()),
  cuisines_avoid: z.array(z.string()),
  allergens: z.array(z.string()),
  dislikes: z.array(z.string()),
  spice_level: z.enum(['mild','medium','hot']),
  meals_per_day: z.number().int().min(1).max(6),
  slots: z.array(z.object({ name: z.string(), window: z.string() })).min(1),
  budget_monthly_inr: z.number().int().positive(),
  calorie_target: z.number().int().positive(),
  macro_target: z.object({
    protein_g: z.number().int().nonnegative(),
    carb_g: z.number().int().nonnegative(),
    fat_g: z.number().int().nonnegative(),
  }),
  variety_tolerance: z.enum(['low','medium','high']),
  cheat_rules: z.object({ days: z.array(z.string()), relax_macros: z.boolean() }).nullable(),
});
// Full PreferenceProfileSchema = OnboardingProfileSchema.extend({
//   user_id, delivery_address_id (nullable), source_prefs (default ['swiggy']) })
```

### App-side validation / repair (Preferences Agent, M4)

1. Extract the fenced JSON block from the paste (tolerate leading/trailing prose).
2. `OnboardingProfileSchema.safeParse`. On success → merge app-side fields → store full `PreferenceProfile`.
3. On failure → `LlmClient.repairProfile(rawText, zodIssues)` returns coerced JSON → re-parse.
4. If still failing (or a hard field like `allergens`/`diet_type` is absent/ambiguous) → return the exact missing questions to the app; **never fabricate an allergen or diet value.**

---

## Testing Strategy

**TDD throughout** (superpowers:test-driven-development): every task writes the failing test first, watches it fail, implements minimally, watches it pass, commits.

- **Unit (Vitest):** Zod schema round-trips; each of the 14 Swiggy tool wrappers against `mock-swiggy-mcp`; OAuth PKCE challenge/verifier + refresh; portion table + canonicalizer (LLM stubbed); INDB lookup; budget allocation math; guardrail decisions (allergen block, spend cap, price-spike); planner CSP on small fixtures; profile validation/repair.
- **Integration (Vitest + local Postgres + mock MCP):** repositories + RLS; discovery → nutrition → budget → planner producing a valid `Plan`; scheduler slot-wake → re-validate → cart → nudge → confirm → order → ledger/history; tracking status transitions and rating → weight update.
- **Agents against a mock Swiggy MCP:** `mock-swiggy-mcp.ts` serves deterministic fixtures (restaurants, menus, coupons, cart, orders, order status). Every agent test injects it via `SWIGGY_MCP_MODE=mock`; no test ever hits live Swiggy. `placeFoodOrder` against the mock returns a synthetic order id and records the call so tests assert it was invoked exactly once and only after a confirm token.
- **e2e (app, optional in v1):** Maestro/Detox flow onboarding → plan approve → simulated push → one-tap confirm against the mock server.
- **Paper dry-run as acceptance test (spec §12):** an integration test that seeds the "Deadline Deepak" profile and the three lunch candidates, runs all 7 agents + guardrail, and asserts: allergen/diet/budget enforced before any order; Grilled Chicken Bowl chosen for lunch with the ₹40 coupon (effective ₹240); fallbacks `[Rajma Chawal, PBM+Roti]`; the one-tap nudge fires and only a confirmed slot places an order. This test is the M10 gate.

---

## Risks / Unknowns (implementation-specific) + Mitigations

| Risk | Mitigation |
|---|---|
| **Swiggy live-access gating** — no production MCP access until a video demo is approved; timeline unknown. | Build the entire system against `mock-swiggy-mcp` from M1; the mock is a permanent CI backend. Localhost dev + scripted demo flow assembled in M10 so the video can be recorded the moment the app is functional, decoupling engineering from Swiggy's approval clock. |
| **Payment authorization inside the MCP order flow** — unclear how `place_food_order` handles payment consent; we must never double-charge or order silently. | Treat `place_food_order` as non-idempotent and never auto-retry. Require a per-slot confirm token that the Executor must present; Guardrail asserts its presence. Rely on Swiggy's own in-flow payment authorization; build no independent wallet in v1. On any ambiguous order response, poll `get_food_orders`/`get_food_order_details` before treating the order as placed. |
| **Scheduler reliability** — a missed or double-fired slot wake means a missed meal or a duplicate order. | Postgres-backed job table (`plan_entries.scheduled_wake_at` + `slot_state`) as source of truth, not in-memory timers; the tick loop selects due slots idempotently and transitions `pending → nudged` atomically so a slot can't be picked twice; crash-recovery re-reads the table on boot; a slot only ever reaches `ordered` after a confirmed `place_food_order` with a recorded Swiggy order id. |

Secondary unknowns to watch: INDB coverage vs real Swiggy menu names (mitigate with the LLM canonicalizer + `low`-confidence fallback), Expo push deliverability for the time-sensitive nudge (fallback to an in-app "Today" screen the user can open), and OAuth token-refresh edge cases across long-lived 30-day plans (refresh proactively before each slot wake).

---

## Sequenced Task Checklist (executable)

- [ ] **T0.1** Init pnpm workspace (`package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`); add `shared`, `server`, `app` packages; wire Vitest + ESLint + `typecheck`/`test`/`lint` scripts; commit.
- [ ] **T0.2** Author `shared/src/schemas/*` (PreferenceProfile, CandidateDish, Plan, SpendLedger, Nutrition) as Zod + inferred types; write round-trip tests (fail → pass); commit.
- [ ] **T0.3** Author `shared/src/source-adapter.ts` (`SourceAdapter` interface) + `guardrail.ts` types; commit.
- [ ] **T1.1** Implement `oauth-pkce.ts` (S256 challenge/verifier, token exchange, refresh); unit-test; commit.
- [ ] **T1.2** Implement `swiggy-client.ts` (streamable-HTTP MCP client) + `mock-swiggy-mcp.ts` fixtures; commit.
- [ ] **T1.3** Wrap all 14 Food tools in `swiggy-tools.ts` with Zod-validated returns + typed errors; unit-test each against the mock; commit.
- [ ] **T1.4** Implement `SwiggyAdapter` (`SourceAdapter`) `.discover()` → `CandidateDish[]`; test against mock; commit.
- [ ] **T2.1** Write DDL migrations (`db/migrations/0001_init.sql`) for all five entities + RLS; commit.
- [ ] **T2.2** Implement `store/db.ts` + repositories (profiles, plans, ledger, orders, nutrition-cache); integration-test read/write + RLS cross-user block; commit.
- [ ] **T3.1** Build `portion-table.ts` + name classifier; unit-test; commit.
- [ ] **T3.2** Ingest INDB into `nutrition_source_indb` + fuzzy index (`indb-source.ts` impl of `NutritionSource`); test lookup; commit.
- [ ] **T3.3** Implement `LlmClient` interface + `anthropic-client.ts`; `canonicalize.ts` (name→canonical, qty parse, type classify) with LLM stubbed in tests; commit.
- [ ] **T3.4** Assemble `nutrition-agent.ts` (cache → INDB → LLM fallback → scale → confidence → cache write); test DB-hit `high`, no-hit `low`, cache hit, daily-aggregate error; commit.
- [ ] **T4.1** Write `docs/onboarding-prompt.md` (canonical prompt) + `OnboardingProfileSchema`; commit.
- [ ] **T4.2** Implement Preferences Agent: extract JSON, validate, `repairProfile`, missing-question fallback (never fabricate allergen/diet); test valid + malformed + repaired paths; commit.
- [ ] **T5.1** Implement Discovery Agent over `SwiggyAdapter` (deliverability + hard-pref pre-filter + dedupe); test with dry-run profile; commit.
- [ ] **T5.2** Implement Budget Agent (per-slot envelope, coupon fetch/apply plan, Spend Ledger writes); test caps sum under budget + coupon effect; commit.
- [ ] **T6.1** Implement Guardrail `policy.ts` (allergen hard-block, spend cap, price-spike abort, confirm-token gate, FSSAI copy check); unit-test each; commit.
- [ ] **T6.2** Implement Planner CSP (hard constraints, soft objectives, defined relaxation order, infeasibility surfacing) → `Plan`; test happy path + allergen-block + infeasible-tradeoff; commit.
- [ ] **T7.1** Implement Scheduler tick loop + slot wake (Postgres job table, idempotent `pending→nudged` transition, crash recovery); test due-slot selection; commit.
- [ ] **T7.2** Implement Executor (re-validate → cart → guardrail → Expo nudge → confirm → `place_food_order` → ledger/history; decline/timeout → fallback/skip; no auto-retry on order); test confirm-orders-once, decline-picks-fallback, price-spike-aborts; commit.
- [ ] **T8.1** Implement Tracking Agent (`track_food_order` polling → status; rating → preference-weight update); test transitions + weight nudge; commit.
- [ ] **T9.1** Build Expo screens (onboarding paste+Q&A, plan review/approve, one-tap confirm deep-linked from push, Swiggy OAuth WebView) + Rasa theme; wire `app/src/lib/api.ts` to server; smoke-test on simulator against mock server; commit.
- [ ] **T10.1** Encode the spec §12 "Deadline Deepak" day as a full-pipeline integration acceptance test (all 7 agents + guardrail); make it green; commit.
- [ ] **T10.2** Document + script the localhost live-order demo flow for the Swiggy video submission; dry-run it against `SWIGGY_MCP_MODE=localhost`; commit.

---

## Self-Review

- **Spec coverage:** §3 scope → Global Constraints + Non-Goals; §4 MCP (14 tools, no scheduling, no nutrition, OAuth) → Swiggy client module + M1; §5 seven agents + guardrail + state store → per-agent breakdown + M2/M5/M6/M7/M8; §6 schemas → Data Layer DDL + Zod; §7 onboarding prompt → full prompt + schema + repair (M4); §10 roadmap v1 → milestone set; §11 verification (b) paper dry-run → M10 acceptance test; §12 dry-run day → the M10 test assertions. `SourceAdapter` reserved-boundary requirement → landed in M1.
- **Placeholder scan:** no TBD/TODO left; the one spec deferral (full prompt text) is now authored in this plan; the Bon Happetee source is explicitly reserved (a non-goal), not a placeholder.
- **Type consistency:** `PreferenceProfile`/`OnboardingProfileSchema`, `CandidateDish`, `Plan`/`plan_entries`, `SpendLedger`, `NutritionCache`, `SourceAdapter`, `NutritionSource`, `LlmClient`, `GuardrailDecision` names are used identically in the DDL, Zod, module layout, per-agent breakdown, and checklist.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-05-monthlymealprep-v1-implementation-plan.md`. Two execution options:

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task (T0.1 …), review between tasks, fast iteration. REQUIRED SUB-SKILL: superpowers:subagent-driven-development.
2. **Inline Execution** — execute tasks in-session with checkpoints. REQUIRED SUB-SKILL: superpowers:executing-plans.
