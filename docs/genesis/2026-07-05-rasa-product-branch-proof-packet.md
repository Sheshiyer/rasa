# Rasa Product Branch Proof Packet

Date: 2026-07-05
Status: pre-build branch — design spec (v1 scope locked) + brand-DNA core complete; NO application code; NOT live
Branch: `rasa` (repo slug `monthlymealprep`)
Mode: Swiggy-first thin MVP; cross-platform orchestration (Zomato/Instamart/tiffin) reserved for v2

> **Canonical home:** the validation copy of this packet belongs in `cambium/docs/plans/` as
> `2026-07-05-rasa-product-branch-proof-packet.md`. The validator to run there later is
> `node scripts/validate-product-branch-packets.mjs` (in the cambium repo). This copy lives in the
> product repo (`monthlymealprep/docs/genesis/`) as the authored source; no cambium script or
> `compose.mjs` was run against the real cambium repo in this pass.

## Verdict

Rasa is a **pre-build product branch**: the v1 design spec is written and internally self-reviewed (§11 of the spec), and the strategic **brand-DNA core** (7 minted outputs) has been mapped into the Cambium Genesis contract (`docs/genesis/brand-dna.json`, validated JSON). That is the entire current strength — thinking, positioning, architecture, and brand identity are coherent and ready to hand to a build.

It is **not** ready to enter a live-launch loop. There is **no application code**, no deployed surface, no live URL, and no test suite — nothing to launch, QA, or operate. The Swiggy Food MCP requires a **video demo for live access** (dev is localhost-only until then), so even the v1 data path cannot be exercised end-to-end yet. Nutrition enrichment (INDB/Bon Happetee), payments, push/notifications, and app-store distribution are all unbuilt. This branch's next move is **implementation planning and first code**, not a supervised launch. Treat it as design-complete, build-blocked.

## Current Source Of Truth

- Product repo: `monthlymealprep` (brand `Rasa`), local path
  `/Volumes/madara/2026/twc-vault/01-Projects/thoughtseed/monthlymealprep`
- GitHub remote: not yet published (local repo; see `git log` locally)
- Local HEAD checked in this pass: `5b593c4e890ea77e86daba6e24d3c8ab02bee162` (branch `main`)
- Design spec: `docs/superpowers/specs/2026-07-05-monthlymealprep-design.md` (v1 scope locked; self-reviewed; user-approval gate noted)
- Brand-DNA core (minted): `.brandmint/brand-config.yaml`, `.brandmint/BRAND-BRIEF.md`,
  `.brandmint/outputs/*.json` (7 outputs), `.brandmint/generation-manifest.json`
- Genesis contract mapping: `docs/genesis/brand-dna.json` (`{brand_system, copy_system, visual_system}`, validated)
- Live app URL: **none** (no code deployed)
- Product context: the design spec §5 multi-agent architecture diagram + §6 core data schemas + §12 paper dry-run

## Product Seed

```yaml
product_id: monthlymealprep
name: Rasa
one_sentence_seed: "A month of meals, planned to your macros and budget, ordered with one tap."
founder_intent: "Kill daily food decision-fatigue for busy urban professionals without overspend or diet failure."
target_customer: "Metro IT/tech professional, 26-35, orders 12-25x/mo, pays Swiggy One + a health app (\"Deadline Deepak\")."
pain_or_desire: "Decision fatigue + budget overshoot + diet failure."
offer: "AI plans a 30-day meal schedule to your prefs/macros/budget and one-tap-orders it from Swiggy (Zomato/Instamart/tiffin next)."
survival_metric: "Weekly retained plans that auto-fill + >=1 confirmed order/day."
better_than_survival_metric: "A Deadline-Deepak cohort keeps a plan running a full month, stays under their self-set cap, and hits daily protein target on autopilot."
gtm_channel: "IT/tech hubs — LinkedIn, tech Discords, office pantries; copy-paste onboarding prompt as viral loop."
brand_constraints: "Health/wellness framing, NOT convenience-fee framing. Wellness estimates, no medical claims (FSSAI)."
technical_constraints: "Swiggy MCP only v1; no native scheduling (app-side scheduler owns the calendar); no nutrition data from platform (external enrichment required); OAuth 2.1 + PKCE per user."
third_party_apps_needed:
  - Swiggy Food MCP (14 tools incl. place_food_order)
  - Bon Happetee / INDB nutrition data
  - payments (subscription)
  - push / notifications (one-tap-approve nudge)
autonomy_boundary: "One-tap approve per order in v1. No silent ordering. Allergens hard-blocked."
human_approval_required_for:
  - each order placement
  - any allergen-adjacent swap
  - any price above the per-meal cap
  - payment / subscription activation
```

## Organ Routing

1. **Genesis:** use the minted Rasa brand-DNA core as the branch seed — `docs/genesis/brand-dna.json` (`brand_system` / `copy_system` / `visual_system`) plus `.brandmint/`. Do not regenerate brand identity. Remaining Genesis work: run brandmint waves 4-7 (photography / illustration / content / synthesis) when image-gen infra is available; `brand-name-studio` already resolved the name to **Rasa**.
2. **Taste:** once UI exists, audit app + marketing against the Rasa mission — enforce "competent friend who cooks," block diet-scold and convenience-fee drift, keep FSSAI-safe "estimated" framing on every nutrition figure, hold the warm-spice-plus-fresh-green look (no clinical / diet-app coldness).
3. **Hands:** build the 7-agent system (Preferences, Discovery/Supply, Nutrition, Budget, Planner, Scheduler/Executor, Tracking/Feedback) + guardrail layer + state store per spec §5. Nothing to patch yet — this is greenfield code from the spec.
4. **Cortex:** store branch lessons, the source-cited genesis research, the design spec, and this packet as searchable memory; the portable `PreferenceProfile` + preference-and-macro graph is the long-term learned asset (also the moat).
5. **Will:** operate GTM (IT/tech hubs, the copy-paste onboarding prompt as viral loop), health-framed subscription pricing (₹149-299/mo core), founder approvals, and the eventual Swiggy video-demo submission for live access.
6. **Hermes:** deliver founder-facing actions and proof summaries; here that means routing the design-approval and build-start decisions, not live-order events (none exist yet).
7. **Garden:** schedule branch health once code exists; for now, track the deferred brandmint waves and the build-plan cadence.

## Skill Cluster Routing

| Cluster | Use In This Branch | Evidence / Source |
|---|---|---|
| `design-core` / `design-orchestrator` | Visual system enforcement, app/marketing polish, Taste audits against the Rasa look. | `docs/genesis/brand-dna.json` visual_system; `.brandmint/outputs/visual-identity-core.json`. |
| `frontend-web-core` / `creative-frontend-core` | Marketing site + web onboarding / plan-approval surfaces. | Spec §7 onboarding prompt; brand copy_system. |
| `expo` (mobile) | The mobile app shell — onboarding, plan review, one-tap-approve nudge, spend ledger. | Spec §5 agent UI touchpoints; §12 dry-run (noon confirm tap). |
| `backend-architecture-core` | The 7 runtime agents, `SourceAdapter` abstraction, state store, guardrail/policy layer, app-side scheduler. | Spec §5 architecture; §6 data schemas. |
| `databases-data-core` | State store: PreferenceProfile, 30-Day Plan, Spend Ledger, Order History, Nutrition Cache. | Spec §5.9, §6 schemas. |
| `agentic-ops-core` | Multi-agent orchestration (Planner CSP), scheduler wake/re-validate loop, human-in-loop gates. | Spec §5.5, §5.6, §5.8. |
| `growth-content-core` | Copy-paste ChatGPT/Claude onboarding prompt (viral loop), launch copy, IT-hub GTM assets. | Spec §7; copy_system tone_notes. |
| `git-pr-ops-core` | Branch hygiene, first-code PRs, proof-linked commits once the repo is published. | Local repo, HEAD `5b593c4e`. |
| `browser-automation-core` | Later: onboarding-prompt QA, subscription checkout QA, live-order flow QA (post-live-access). | Deferred until code + live access exist. |

## Connected Services Map

| Service | Current Role | Status |
|---|---|---|
| Swiggy Food MCP | v1 supply + ordering rail (14 tools incl. `place_food_order`); OAuth 2.1 + PKCE per user. | **Planned / not wired.** Dev localhost-only; **live access requires a video demo submission.** |
| Nutrition DB (INDB free base → Bon Happetee production) | External macro/calorie enrichment for the Nutrition Agent (platform ships no nutrition data). | **Planned / not integrated.** INDB is the zero-cost MVP source; Bon Happetee is the production upgrade. |
| Payments | Health-framed subscription (₹149-299/mo core; premium tiers later). | **Planned / not wired.** Provider not yet selected. |
| Push / notifications | The one-tap-approve nudge per meal slot; plan-approval prompts. | **Planned / not wired.** |
| Cambium | Genesis contract + product-branch proof ledger; policy-aware next actions. | **Genesis mapping authored this pass** (`brand-dna.json`); packet awaits validation in `cambium/docs/plans/` via `validate-product-branch-packets.mjs`. Not yet run against cambium. |
| Hermes | Founder-facing delivery of approval / build-start actions and proof summaries. | **Not wired** for this branch; no runtime events yet. |
| Plexus | Brand/design system + component-library surface for the eventual UI. | **Not wired.** Relevant once frontend work starts. |
| GitHub | Source repo + PR proof path. | **Not published.** Local repo only, HEAD `5b593c4e`. |

## Verified In This Pass

- Read the full brand-DNA core: `brand-config.yaml`, `BRAND-BRIEF.md`, and all 7 `.brandmint/outputs/*.json` (niche-validator, competitor-analysis, buyer-persona, product-positioning-summary, mds-messaging-direction-summary, voice-and-tone, visual-identity-core) plus `generation-manifest.json`.
- Read the design spec `docs/superpowers/specs/2026-07-05-monthlymealprep-design.md` — v1 scope locked, self-reviewed, with the §5 multi-agent architecture diagram, §6 core data schemas, and §12 end-to-end paper dry-run for "Deadline Deepak."
- Confirmed the Cambium Genesis contract field names against `cambium/bin/meristem-genesis-contract.test.mjs` (three top-level groups `brand_system` / `copy_system` / `visual_system` and their required keys / nesting).
- Wrote `docs/genesis/brand-dna.json` mapping the minted core into the Genesis contract; **validated it parses as JSON and every required field is present and non-empty** (asset paths intentionally empty — visual assets deferred).
- Confirmed the real palette hexes carried through: primary `#E8A33D` (Turmeric Saffron), secondary `#2F7D5B` (Fresh Basil Green), accent `#E4572E` (Ripe Tomato).
- Confirmed there are **no visual asset files** under `.brandmint/` (no PNG/JPG/SVG, no `asset-manifest.json`) — so `asset_manifest.validation.all_paths_exist = false` and `paths = []` is the truthful state.
- Recorded the local git HEAD SHA `5b593c4e890ea77e86daba6e24d3c8ab02bee162` (branch `main`) by reading `.git/refs/heads/main` (no git commands run).

## Launch Blockers Found

- **No application code.** None of the 7 agents, the `SourceAdapter`, the guardrail layer, the app-side scheduler, or the state store exists yet — this is greenfield after spec approval.
- **Swiggy live-access gate.** The Food MCP is dev/localhost-only until a **video demo** is submitted and approved; the v1 ordering path cannot be exercised live before that.
- **Nutrition DB integration unbuilt.** The hybrid enrichment pipeline (LLM canonicalize + portion heuristics → INDB → Bon Happetee → LLM fallback, with confidence bands and caching) is designed but not implemented.
- **Payments unbuilt.** Subscription provider not selected or wired; no checkout.
- **App-store distribution.** No mobile build, no store listings, no review submission.
- **QA / tests.** No test suite, no harness, no browser/E2E proof — nothing to verify because nothing is built.
- **Visual assets deferred.** brandmint waves 4-7 (photography, illustration, icons/patterns, content/synthesis) need image-gen infra and have not been generated.
- **Repo not published.** GitHub remote not yet created; no PR proof path.

## Next Approval Bundle

1. **Approve the v1 design spec** (`2026-07-05-monthlymealprep-design.md`) as the build contract, or flag changes (spec §11c user-review gate).
2. **Approve the Genesis brand mapping** (`docs/genesis/brand-dna.json`) — confirm name **Rasa**, the palette, and the "competent friend who cooks" voice as the locked brand DNA.
3. **Approve the build sequence** — confirm the v1 Swiggy-only thin-MVP scope and the order in which the 7 agents are built (start with Preferences + the onboarding prompt + state store).
4. **Decide the nutrition MVP source** — confirm INDB (zero data cost) for v1 with a Bon Happetee production upgrade path, and approve any INDB self-host / licensing step.
5. **Approve Swiggy MCP onboarding** — greenlight local dev against the Food MCP and, when a demo exists, the **video-demo submission for live access**.
6. **Approve monetization framing** — confirm the health-framed subscription (₹149-299/mo core) and the hard rule of **no convenience surcharge**.
7. **Approve repo publication** — decide GitHub visibility (public/private) and remote creation.

## Pending Gates Before Public Launch

1. **Design-spec approval** recorded (founder reads and approves §11c).
2. **v1 code built** — all 7 agents + guardrail layer + state store against the Swiggy adapter, independently testable per spec §5.
3. **Swiggy live access** — video demo submitted and approved; per-user OAuth 2.1 + PKCE flow working end-to-end.
4. **Nutrition pipeline** — INDB integrated, portion-heuristic table + confidence bands live, daily-aggregate ±10-15% framing, every figure labeled "estimated."
5. **Guardrail proof** — allergen hard-block, spend-cap, price-spike abort, and one-tap gates verified to fire before any order action.
6. **Payments** — subscription checkout wired, tested, with refund policy; no convenience surcharge anywhere.
7. **Onboarding prompt** — the copy-paste ChatGPT/Claude prompt emits schema-valid `PreferenceProfile` JSON; app-side validation/repair proven.
8. **FSSAI-safe copy scrub** — no medical / disease / "doctor-approved" claims; disclaimer on every nutrition figure.
9. **QA** — end-to-end run of the §12 paper dry-run against real (or sandbox) data; mobile desktop/device proof; no console/network errors.
10. **App-store readiness** — mobile build, store listings, privacy wording, and review submission.

## Cofounder Action Queue

1. **Will / Founder:** approve the design spec and the Genesis brand mapping (the two open approval gates blocking everything downstream).
2. **Architect / Hands:** convert spec §5-§6 into an implementation plan — schemas → state store → Preferences Agent + onboarding prompt first (the portable lock-in asset and cold-start entry).
3. **Hands:** build the `SourceAdapter` + `SwiggyAdapter` (Discovery/Supply) against localhost, then the Nutrition Agent (INDB) with confidence bands.
4. **Hands:** build the Planner (CSP over prefs × nutrition × budget), then Scheduler/Executor with the guardrail/policy layer wired in front of every order action.
5. **Will:** prepare the Swiggy video-demo path and select the payments provider; draft the health-framed subscription copy.
6. **Genesis / Design:** run brandmint waves 4-7 when image-gen infra is available; produce logo files, food photography, and the icon/pattern set.
7. **Cortex:** ingest this packet, the design spec, and the genesis research into branch memory.
8. **Hermes:** surface the founder's next approval as a policy-aware recommendation, not an autonomous action (nothing here is autonomy-eligible yet).

## Go / No-Go Rule

**No-Go for any launch or autonomy loop. Go for implementation planning and first code**, contingent on founder approval of the design spec and the Genesis brand mapping.

Do not describe Rasa as a live, launching, or autonomous branch until — at minimum — the v1 code is built, Swiggy live access is granted (video demo approved), the nutrition pipeline and guardrail layer are proven, payments are wired, and one real end-to-end order has been placed through a one-tap-approve gate with allergens hard-blocked. Until then, Rasa is design-complete and brand-complete, and **build-blocked** — the honest claim is "spec + brand DNA ready to hand to a build," nothing more.
