# monthlymealprep — Design Spec & Multi-Agent Architecture

> **Status:** Design spec (v1 scope locked). No code yet.
> **Date:** 2026-07-05
> **Repo slug:** `monthlymealprep` (brand name TBD via Cambium Genesis / brand-name-studio)
> **One-liner:** *A month of meals, planned to your macros and budget, ordered with one tap.*

---

## 1. Context

A new thoughtseed product branch. A mobile app / agent ecosystem where a user answers a few preference questions — via a **copy-paste ChatGPT/Claude prompt** or in-app — and the system generates a **30-day meal-ordering plan** that orders food through the **Swiggy MCP** (Zomato / Instamart / tiffin in later versions). The original pitch was "approve once and forget."

**Why now.** Swiggy shipped its MCP / Builders Club (Jan–Apr 2026): three servers (Food/Instamart/Dineout), 35 tools, incl. `place_food_order`, over OAuth 2.1 + PKCE. Agentic commerce is the defining 2026 trend (OpenAI ACP, Google UCP; McKinsey projects $3–5T agent-orchestrated retail by 2030). The rails this product needs shipped months ago.

**How this spec was derived.** A four-stream, source-cited genesis-research pass — niche validation + market sizing, competitor/defensibility, buyer personas + JTBD, and nutrition-data feasibility — reshaped the concept from the naive "AI silently orders your Swiggy food" into a defensible, one-tap, health-framed, cross-platform-*ready* product.

---

## 2. Validated thesis

The naive framing fails on four counts; the corrected framing is an open lane:

| Naive framing | What the evidence says | Correction |
|---|---|---|
| "Approve once & forget" (silent auto-order) | Too risky on money + allergens; OpenAI killed Instant Checkout Mar 2026 over exactly this UX difficulty | **One-tap-approve** per order (5-sec confirm) |
| Convenience is the pitch | Real, named pain — but a 2025 LocalCircles survey shows **90% of Indians want platform fees eliminated** | Convenience = **acquisition hook**, not the revenue model |
| Budget-driven | Budget + *restaurant delivery* is near-contradictory — budget-conscious Indians default to tiffin/home cooking | Budget = **guardrail feature**, not headline |
| Nutrition engine = the moat | Swiggy's Builders Club **already ships a "Dietary Planner" reference app** (macro/allergen/calorie menu filtering), open to any developer | Nutrition = feasible **wedge**, not a moat |

**The one defensible seam the platforms structurally cannot build: neutral, cross-platform orchestration** — a single 30-day plan spanning **Swiggy + Zomato + Instamart + tiffin** inside one budget + macro envelope. Swiggy will never build "also order from Zomato."

**The empty white-space cell to own** — no competitor marks "yes" on more than 2 of these 5:

| Competitor / category | Plans a month ahead? | Auto / one-tap orders? | Macro-accurate? | Budget-capped? | Cross-platform? |
|---|:--:|:--:|:--:|:--:|:--:|
| Swiggy native (app + MCP "Dietary Planner") | No | Yes | Partial | No | No |
| Zomato native (MCP + preference memory) | No | Yes | Partial | No | No |
| HealthifyMe | Partial | No | Yes | No | No |
| EatSure / cloud-kitchen subs | Partial | Partial | No | Partial | No |
| Tiffin apps | Yes | Partial | No | Partial | No |
| Generic AI-ordering (ChatGPT/Claude + MCP) | No | Yes | No | No | Partial |
| **monthlymealprep (target)** | **Yes** | **Yes** | **Yes** | **Yes** | **Yes (v2)** |

**Strategic posture:** build as a **partnership / acquisition target** — a hard-to-replace portable preference graph + IT-professional distribution channel that Swiggy or a HealthifyMe would rather buy than rebuild. If the cross-platform seam can't be held, this is a feature, not a company.

### Market frame (directional; report methodologies vary)
- India online food delivery: ~$31.8B (2024) → $140B by 2030 (~28% CAGR). **Don't pitch against this number.**
- The **honest addressable market** is the food-*subscription* overlap (~$296M, 2024, ~11% CAGR) + health-food ($14B+). Two orders of magnitude smaller than the delivery headline.
- Platform reach FY25: Zomato ~20.9M MTU, Swiggy ~15.1M MTU. Food-delivery AOV ≈ ₹350–450.
- **WTP benchmark:** HealthifyMe charges **₹999–1,699/mo** for AI nutrition planning, ~80% of revenue from subs. Health/coaching framing monetizes; convenience framing does not.

### Beachhead persona — "Deadline Deepak"
Metro IT/tech professional, 26–35, Bengaluru/Hyderabad/Pune/Gurgaon, ₹12–35 LPA, lives alone/flatmates, no cook, already orders 12–25×/mo, already pays Swiggy One + a health app.
**JTBD:** *"When I'm buried in sprints, help me stop spending 15 minutes and my 4pm decision-energy on 'what do I eat,' so I get fed on time without my delivery spend quietly ballooning."*
He is chosen because he's the only persona scoring top-2 on **both** monetization and reachability — you're removing friction from an *existing* daily habit, not manufacturing one, and he tolerates a 5-second daily confirm. He funds the roadmap to higher-ARPU segments (fitness "Macro Meera"; elderly-parent "Provider Prakash," highest ARPU / "guilt-money").

### Monetization
Health-framed subscription — **₹149–299/mo core** (Deepak), **₹500–999/mo** premium/fitness/senior tiers later — plus affiliate/commission economics from platforms. **Never a convenience surcharge.**

---

## 3. Scope

### In scope (v1)
- **Swiggy Food MCP only.**
- **One-tap-approve per order** autonomy model.
- All seven runtime agents (against the Swiggy adapter only).
- The copy-paste ChatGPT/Claude onboarding prompt + in-app profile.
- Nutrition enrichment via INDB (free) with Bon Happetee upgrade path.

### Out of scope (deferred, with pointers)
- **Zomato / Instamart / tiffin adapters** → v2. Architecturally reserved behind `SourceAdapter`.
- **Cross-source budget arbitrage** → activates automatically when adapters ≥ 2.
- **Pre-authorized "envelope" autonomy** (real "forget") → v3, trust-earned.
- **Cambium Genesis brand-mint** (name, positioning, visual system, proof packet) → next session. Product Seed drafted in §8.
- **Any application code** → after this spec is approved.

---

## 4. Swiggy MCP grounding (v1 target surface)

Food server, 14 tools, all used by v1:
`get_addresses`, `search_restaurants`, `search_menu`, `get_restaurant_menu`, `get_food_cart`, `update_food_cart`, `flush_food_cart`, `fetch_food_coupons`, `apply_food_coupon`, `place_food_order`, `get_food_orders`, `get_food_order_details`, `track_food_order`, `report_error`.

Auth: **OAuth 2.1 + PKCE, per user.** Dev locally on localhost, then submit a video demo for live access.

**Two hard constraints baked into the architecture:**
1. **No native scheduling.** Orders are real-time; there is no "order at 8pm on day 14" tool. The 30-day plan lives in *our* store, and our own scheduler triggers each meal-slot.
2. **No nutrition data.** Dishes carry name / description / price / veg-flag only. The Nutrition Agent must enrich externally.

---

## 5. Multi-agent architecture

Seven agents + a cross-cutting guardrail layer + a state store. Each agent has one purpose, a well-defined interface, and is independently testable. v1 runs all seven against the **Swiggy adapter only**.

```
                        ┌─────────────────────────────────────────────┐
                        │              STATE STORE                     │
                        │ Preference Profile · 30-Day Plan ·           │
                        │ Spend Ledger · Order History · Nutrition Cache│
                        └─────────────────────────────────────────────┘
                                        ▲     ▲     ▲
   ONBOARDING                           │     │     │
   copy-paste ChatGPT/Claude prompt     │     │     │
        │                               │     │     │
        ▼                               │     │     │
 ┌───────────────┐   profile   ┌────────┴───────┐   candidates   ┌───────────────┐
 │ 1 PREFERENCES │────────────▶│ 2 DISCOVERY /  │───────────────▶│ 3 NUTRITION   │
 │   AGENT       │             │   SUPPLY AGENT │                │   AGENT       │
 └───────────────┘             │ SourceAdapter  │                │ enrich macros │
        │                      │  └ SwiggyAdptr  │                └───────┬───────┘
        │                      │  (Zomato… v2)   │                        │ macro-tagged
        │                      └────────┬────────┘                        │ candidates
        │                               │ Swiggy MCP:                      ▼
        │                               │ search_restaurants        ┌───────────────┐
        │                               │ search_menu               │ 4 BUDGET /    │
        │                               │ get_restaurant_menu       │   PRICE AGENT │
        │                               │ get_addresses             │ caps+coupons  │
        │                               └───────────────────────────└───────┬───────┘
        │                                                                    │ envelope
        │                    ┌───────────────────────────────────────┐      │
        └───────────────────▶│ 5 PLANNER / ORCHESTRATOR AGENT         │◀─────┘
                             │ solve Prefs × Nutrition × Budget (CSP)  │
                             │ → 30-DAY PLAN (variety, anti-repeat)    │
                             └───────────────────┬─────────────────────┘
                                                 │ plan
                                    ┌────────────▼─────────────┐
                                    │  USER APPROVES PLAN ONCE │
                                    └────────────┬─────────────┘
                                                 │
    ┌───────────────────────────────┐           ▼
    │  GUARDRAIL / POLICY LAYER      │  ┌─────────────────────────┐
    │  allergen hard-block · spend   │◀─│ 6 SCHEDULER / EXECUTOR  │
    │  cap · price-spike abort ·     │  │ wake per slot →         │
    │  human-in-loop gates ·         │─▶│ re-validate → cart →    │
    │  FSSAI-safe copy               │  │ ONE-TAP NUDGE → order   │
    └───────────────────────────────┘  └────────────┬────────────┘
                                         Swiggy MCP: │ update_food_cart,
                                         apply_coupon,│ place_food_order
                                                     ▼
                                        ┌─────────────────────────┐
                                        │ 7 TRACKING / FEEDBACK   │
                                        │ track_food_order +      │
                                        │ rating → learn prefs    │
                                        └────────────┬────────────┘
                                                     │ updates
                                                     └───▶ (loop to Preference Profile)
```

### 5.1 Preferences Agent
- **Purpose:** turn onboarding-prompt output + in-app Q&A into a structured **Preference Profile**.
- **Inputs:** pasted JSON from the ChatGPT/Claude onboarding prompt; in-app edits.
- **Outputs:** validated `PreferenceProfile` (the portable lock-in asset).
- **Depends on:** nothing (cold-start entry).
- **Owns:** the onboarding prompt + JSON schema + app-side validation/repair (§7).

### 5.2 Discovery / Supply Agent
- **Purpose:** the `SourceAdapter` abstraction over food sources; the **reserved cross-platform moat boundary**.
- **v1:** `SwiggyAdapter` only — `get_addresses` (deliverability), `search_restaurants`, `search_menu`, `get_restaurant_menu`.
- **Outputs:** deduped `CandidateDish[]`, pre-filtered by deliverability + hard preferences (diet type, allergens).
- **v2:** `ZomatoAdapter`, `InstamartAdapter`, `TiffinAdapter` slot in behind the identical interface — no rewrite of downstream agents.

### 5.3 Nutrition Agent
- **Purpose:** enrich each `CandidateDish` with calories + macros. **Feasibility = GREEN.**
- **Pipeline (hybrid, not pure-LLM):**
  1. **LLM canonicalize + portion-parse** — normalize "Paneer Butter Masala"; parse counts ("2 Aloo Paratha" → qty 2); classify dish type → default portion from a **portion-heuristic table** (curry ~200g, paratha ~100g/pc, biryani ~330g, dal ~180g…).
  2. **Grounded lookup** (priority): **Bon Happetee** (commercial, 20k+ Indian dishes, already powers Swiggy) → **INDB** (free, 1,014 cooked Indian recipes, self-host) → IFCT/USDA per-ingredient decomposition.
  3. **LLM fallback estimate** (CoT) only on no DB hit, flagged low-confidence.
  4. **Portion scaling + confidence band** (DB-hit = high, LLM = low).
  5. **Cache** by `canonical_dish_id` (dish names repeat heavily across menus).
- **Accuracy to engineer for:** DB-hit ±15–20% cal / ±20–25% macros; LLM-fallback ±30–40%; **daily-plan total ±10–15%** (per-dish errors partially cancel).
- **MVP source:** INDB (zero data cost) → add Bon Happetee in production.
- **Framing:** always "estimated"; daily-aggregate targeting; **no per-dish precision claims.**

### 5.4 Budget / Price Agent
- **Purpose:** keep the plan inside the user's ₹/month.
- **Behavior:** allocate budget across 30 days × meal-slots (v1: single source); maintain a **Spend Ledger** (planned vs actual); pull + apply coupons (`fetch_food_coupons` / `apply_food_coupon`); enforce per-day / per-meal caps.
- **v2:** cross-source arbitrage (cheapest source meeting prefs+macros) activates when adapters ≥ 2.
- **Outputs:** per-slot budget envelope + coupon plan.

### 5.5 Planner / Orchestrator Agent
- **Purpose:** the negotiator — compose the **30-Day Plan**.
- **Method:** constraint-satisfaction / assignment over 30 days:
  - **Hard constraints (never violated):** allergens, diet type, budget hard cap, deliverability.
  - **Soft objectives (optimized):** hit macro/calorie targets, respect price envelope, variety / anti-repetition, honor cuisine likes/dislikes, delivery windows.
- **Infeasibility handling:** relax soft constraints in a defined order, surface tradeoffs to the user ("to hit 150g protein under ₹6k, variety drops"); never silently break a hard constraint.
- **Output:** `Plan` with per-slot chosen dish + ranked fallbacks + projected macros + slot budget, presented for **one-time approval**.

### 5.6 Scheduler / Executor Agent
- **Purpose:** turn the approved plan into real orders, safely, given no MCP scheduling.
- **Behavior per meal-slot:** server-side scheduler wakes → **re-validate** (restaurant open? price moved beyond cap? item in stock? still fits macros/budget?) → build cart (`update_food_cart`, `apply_food_coupon`) → send **one-tap-approve nudge** → on confirm `place_food_order`; on decline/timeout → skip or offer top fallback. **Never orders silently in v1.**
- **Reads/writes:** Spend Ledger, Order History.

### 5.7 Tracking / Feedback Agent
- **Purpose:** close the loop and deepen the moat.
- **Behavior:** `track_food_order` for live status; collect post-meal rating → update Preference Profile weights (learned likes/dislikes, portion fit). The profile getting smarter over time = switching cost.

### 5.8 Guardrail / Policy layer (cross-cutting)
Sits between Planner/Executor and any order action. Enforces: **allergens = hard block**, spend-cap, **price-spike abort**, human-in-the-loop gates, and **FSSAI-safe copy** (wellness estimates only; no disease/treatment/"doctor-approved" claims; disclaimer on every nutrition figure).

### 5.9 State store
`PreferenceProfile` · `Plan` (30-day) · `SpendLedger` · `OrderHistory` · `NutritionCache`.

---

## 6. Core data schemas

```jsonc
// PreferenceProfile — the portable lock-in asset
{
  "user_id": "string",
  "diet_type": "veg | jain | egg | nonveg",
  "cuisines_like": ["North Indian", "South Indian", "..."],
  "cuisines_avoid": ["..."],
  "allergens": ["peanut", "shellfish"],           // HARD constraint
  "dislikes": ["mushroom", "..."],
  "spice_level": "mild | medium | hot",
  "meals_per_day": 2,
  "slots": [{ "name": "lunch", "window": "12:30-13:30" },
            { "name": "dinner", "window": "20:00-21:00" }],
  "delivery_address_id": "swiggy-address-ref",
  "budget_monthly_inr": 9000,
  "calorie_target": 2000,
  "macro_target": { "protein_g": 120, "carb_g": 200, "fat_g": 60 },
  "variety_tolerance": "low | medium | high",     // repeat aversion
  "source_prefs": ["swiggy"],                      // v2: zomato, instamart, tiffin
  "cheat_rules": { "days": ["Sat"], "relax_macros": true }
}
```
```jsonc
// CandidateDish — normalized across sources
{
  "source": "swiggy",
  "restaurant_id": "string", "restaurant_name": "string",
  "dish_id": "string", "dish_name": "string", "description": "string",
  "price_inr": 260, "is_veg": true,
  "canonical_dish_id": "paneer-butter-masala",     // Nutrition Agent
  "macros": { "cal": 520, "protein_g": 18, "carb_g": 42, "fat_g": 30 },
  "macro_confidence": "high | low",
  "deliverable_to_address": true
}
```
```jsonc
// Plan (30-day) — one entry per day per slot
{
  "day": "2026-07-06", "slot": "lunch",
  "chosen": { /* CandidateDish */ },
  "fallbacks": [ /* ranked CandidateDish[] */ ],
  "slot_budget_inr": 300,
  "projected_macros": { "cal": 520, "protein_g": 18, "carb_g": 42, "fat_g": 30 }
}
// SpendLedger — planned vs actual per slot/day/month + coupons applied
```

---

## 7. The copy-paste ChatGPT/Claude onboarding prompt (signature feature)

A shareable prompt that runs the preference interview **inside the user's own ChatGPT/Claude**, then emits a strict JSON `PreferenceProfile` the user pastes back into the app. Zero-friction onboarding **and** a viral growth loop (the prompt is shareable content).

**Design requirements:**
- The prompt interviews conversationally (diet, allergens, budget, goals, meals/day, spice, dislikes) — one topic at a time.
- It **must** end by outputting a single fenced JSON block matching the `PreferenceProfile` schema exactly (allergens as an array, budget as an integer, etc.).
- **App-side validation/repair:** on paste, validate against the schema; if malformed, the Preferences Agent repairs (LLM-coerce) or asks the 1–2 missing questions in-app.
- FSSAI-safe: the prompt collects goals but makes **no** medical claims.

*(Full prompt text + JSON schema authored during implementation.)*

---

## 8. Track 1 — Cambium Genesis (deferred; ready to run)

Not executed this session. When run, it mints `{brand_system, copy_system, visual_system}` via the brandmint 25-skill set (incl. **brand-name-studio** for the real product name) and emits a product-branch proof packet (Fitcheck template) at `cambium/docs/plans/YYYY-MM-DD-<name>-product-branch-proof-packet.md`, routing the branch into Hermes/Plexus.

```yaml
# Product Seed — carry into genesis
product_id: monthlymealprep
one_sentence_seed: "A month of meals, planned to your macros and budget, ordered with one tap."
founder_intent: "Kill daily food decision-fatigue for busy urban professionals without overspend or diet failure."
target_customer: "Metro IT/tech professional, 26-35, orders 12-25x/mo, pays Swiggy One + a health app."
pain_or_desire: "Decision fatigue + budget overshoot + diet failure."
offer: "AI plans a 30-day meal schedule to your prefs/macros/budget and one-tap-orders it from Swiggy (Zomato/Instamart/tiffin next)."
survival_metric: "Weekly retained plans that auto-fill + >=1 confirmed order/day."
gtm_channel: "IT/tech hubs — LinkedIn, tech Discords, office pantries; copy-paste onboarding prompt as viral loop."
brand_constraints: "Health/wellness framing, NOT convenience-fee framing. Wellness estimates, no medical claims (FSSAI)."
technical_constraints: "Swiggy MCP only v1; no native scheduling; no nutrition data from platform; OAuth per user."
third_party_apps_needed: [Swiggy Food MCP, Bon Happetee/INDB nutrition, payments, push/notifications]
autonomy_boundary: "One-tap approve per order in v1. No silent ordering."
human_approval_required_for: [each order placement, any allergen-adjacent swap, any price above per-meal cap, payment]
```

---

## 9. Risks & mitigations

| Risk | Mitigation |
|---|---|
| **Platform disintermediation** — Swiggy clones "order my meal plan" | Lean into the cross-platform seam (reserved in v1 arch) + portable preference graph; posture as acquisition target |
| **Nutrition accuracy** — restaurant dishes lack macros | Hybrid pipeline + confidence bands + daily-aggregate framing; "estimated" labels; INDB→Bon Happetee upgrade |
| **Autonomy / liability** — wrong order, allergen, price spike | One-tap-approve + allergen hard-block + price-spike abort + FSSAI wellness framing + disclaimer |
| **Willingness to pay** — Indians reject convenience fees | Health-framed subscription, never a convenience surcharge |
| **MCP scheduling gap** — no future-order tool | App-side scheduler owns the calendar; MCP only executes real-time |
| **Supply psychology** — restaurant delivery resists routinization | Variety/anti-repetition in Planner; v2 hybrid supply (cloud kitchens, tiffin, Instamart) where recurring is native |

---

## 10. Roadmap
- **v1 — Swiggy-only thin MVP:** all 7 agents, Swiggy adapter, one-tap-approve, INDB nutrition, onboarding prompt. Local dev → Swiggy video-demo for live access.
- **v2 — cross-platform moat:** Zomato/Instamart/tiffin adapters behind `SourceAdapter`; cross-source budget arbitrage; Bon Happetee nutrition.
- **v3 — trust-earned autonomy:** pre-authorized "envelope" auto-ordering within guardrails (the real "approve & forget"); premium fitness + senior-care tiers.

---

## 11. Verification (this spec)
- **(a) Spec self-review** — no TBDs beyond explicitly-deferred items; internally consistent; single-scope; no double-interpretable requirement. *(see review note at bottom)*
- **(b) Paper dry-run** — one representative day traced end-to-end through all 7 agents (§12).
- **(c) User review** — user reads and approves this doc.

---

## 12. Paper dry-run — one day for "Deadline Deepak"

**Profile (excerpt):** nonveg, no allergens, dislikes mushroom, medium spice, 2 meals/day (lunch 12:30, dinner 20:00), Koramangala address, ₹9,000/mo (~₹300/slot), 2000 kcal, protein 120g, variety medium, source swiggy.

1. **Preferences Agent** → validated `PreferenceProfile` stored.
2. **Discovery (SwiggyAdapter)** → `get_addresses` confirms Koramangala; `search_menu`/`search_restaurants` for lunch return, after diet+deliverability filter, 3 candidates:
   - Grilled Chicken Bowl ₹280 · Rajma Chawal ₹190 · Paneer Butter Masala+2 Roti ₹260.
3. **Nutrition Agent** → enrich: Grilled Chicken Bowl {520 kcal, P42, C40, F18, high-conf DB hit}; Rajma Chawal {610, P18, C95, F12}; PBM+Roti {720, P22, C70, F38}.
4. **Budget Agent** → slot cap ₹300; all three pass; a ₹40-off coupon found for the chicken-bowl restaurant → effective ₹240.
5. **Planner** → protein target favors Grilled Chicken Bowl (P42, within cap, coupon, non-repeat vs yesterday) → **chosen**; fallbacks [Rajma Chawal, PBM+Roti]. Dinner slot planned similarly against remaining daily macro budget (protein remaining ~78g → picks a high-protein dinner).
6. **Scheduler/Executor** → at 12:00 wakes lunch slot → re-validate (restaurant open ✓, price ₹280 ✓, in stock ✓, still fits ✓) → `update_food_cart` + `apply_food_coupon` → **one-tap nudge**: "Grilled Chicken Bowl, ₹240, arrives ~12:35 — confirm?" → user taps → `place_food_order`.
7. **Tracking/Feedback** → `track_food_order` to delivery; post-meal 👍 → Preference weights nudge toward that restaurant/dish.

**Result:** schemas and interfaces hold end-to-end; hard constraints (allergen/diet/budget) enforced before any order; the only human touch is a 5-second confirm. ✔

---

### Spec self-review note
Placeholder scan: only intentional deferrals (full onboarding prompt text, brand name, application code) remain, each explicitly marked. Consistency: architecture (§5) matches schemas (§6), scope (§3), and dry-run (§12). Scope: single implementation-plannable unit (v1 Swiggy-only). Ambiguity: autonomy model, supply scope, and nutrition framing each pinned to one interpretation.
