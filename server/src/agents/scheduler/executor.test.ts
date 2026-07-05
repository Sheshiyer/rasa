import { describe, it, expect } from "vitest";
import type {
  CandidateDish,
  Macros,
  OrderRequest,
  PlanEntry,
  PreferenceProfile,
  RevalidateResult,
  SourceAdapter,
} from "@rasa/shared";
import { checkGuardrail } from "../../guardrail/policy";
import {
  createExecutor,
  type ConfirmDecision,
  type ExecutionStore,
  type Notifier,
} from "./executor";

const MACROS: Macros = { cal: 500, protein_g: 30, carb_g: 40, fat_g: 15 };

function profile(
  overrides: Partial<PreferenceProfile> = {},
): PreferenceProfile {
  return {
    user_id: "11111111-1111-1111-1111-111111111111",
    diet_type: "nonveg",
    cuisines_like: [],
    cuisines_avoid: [],
    allergens: [],
    dislikes: [],
    spice_level: "medium",
    meals_per_day: 2,
    slots: [{ name: "lunch", window: "12:30-13:30" }],
    budget_monthly_inr: 9000,
    calorie_target: 2000,
    macro_target: { protein_g: 120, carb_g: 200, fat_g: 60 },
    variety_tolerance: "medium",
    source_prefs: ["swiggy"],
    ...overrides,
  };
}

function dish(id: string, name: string, price: number): CandidateDish {
  return {
    source: "swiggy",
    restaurant_id: "r-grill",
    restaurant_name: "Grill House",
    dish_id: id,
    dish_name: name,
    price_inr: price,
    is_veg: false,
    deliverable_to_address: true,
    macros: MACROS,
    macro_confidence: "high",
  };
}

function entry(chosen: CandidateDish, fallbacks: CandidateDish[]): PlanEntry {
  return {
    day: "2026-07-06",
    slot: "lunch",
    chosen,
    fallbacks,
    slot_budget_inr: 150,
    projected_macros: MACROS,
    slot_state: "pending",
  };
}

function makeDeps(opts: {
  revalidate?: (
    restaurantId: string,
    dishId: string,
  ) => Promise<RevalidateResult | null>;
  decisions?: Record<string, ConfirmDecision>;
  coupon?: (
    restaurantId: string,
    subtotalInr: number,
  ) => Promise<{
    code: string;
    discount_inr: number;
    effective_inr: number;
  } | null>;
  claim?: () => boolean;
}) {
  const orders: OrderRequest[] = [];
  const recorded = {
    orders: [] as unknown[],
    ledger: [] as { actual_inr?: number }[],
    states: [] as { state: string }[],
  };
  const nudges: unknown[] = [];

  const adapter: SourceAdapter = {
    source: "swiggy",
    async listDeliveryAddresses() {
      return [{ id: "addr-koramangala" }];
    },
    async discover() {
      return [];
    },
    async fetchCoupons() {
      return [];
    },
    revalidate:
      opts.revalidate ?? (async () => ({ available: true, price_inr: 140 })),
    async order(req) {
      orders.push(req);
      return {
        order_id: `ord-${orders.length}`,
        amount_inr: 240,
        status: "placed",
      };
    },
  };
  const notifier: Notifier = {
    async sendNudge(n) {
      nudges.push(n);
      return opts.decisions?.[n.dish.dish_id] ?? "confirm";
    },
  };
  const store: ExecutionStore = {
    async recordOrder(o) {
      recorded.orders.push(o);
      return { id: `oh-${recorded.orders.length}` };
    },
    async recordLedgerActual(e) {
      recorded.ledger.push(e);
    },
    async setSlotState(s) {
      recorded.states.push(s);
    },
    async claimSlot() {
      return (opts.claim ?? (() => true))();
    },
  };
  const deps = {
    adapter,
    checkGuardrail,
    planCoupon: opts.coupon ?? (async () => null),
    notifier,
    store,
    addressId: "addr-koramangala",
    makeConfirmToken: () => "tok-1",
  };
  return { deps, orders, recorded, nudges };
}

describe("Executor", () => {
  it("on confirm, places a (mock) order and records actuals + slot state", async () => {
    const { deps, orders, recorded, nudges } = makeDeps({});
    const res = await createExecutor(deps).executeSlot(
      profile(),
      "plan-1",
      entry(dish("d-chicken", "Grilled Chicken Bowl", 140), []),
    );
    expect(res.outcome).toBe("ordered");
    expect(nudges).toHaveLength(1);
    expect(orders).toHaveLength(1);
    expect(orders[0]!.dishId).toBe("d-chicken");
    expect(orders[0]!.confirmToken).toBe("tok-1"); // order carries the confirm token
    expect(recorded.orders).toHaveLength(1);
    expect(recorded.ledger[0]!.actual_inr).toBe(240);
    expect(recorded.states.some((s) => s.state === "ordered")).toBe(true);
  });

  it("on decline, offers the fallback and orders that instead", async () => {
    const { deps, orders } = makeDeps({
      decisions: { "d-chicken": "decline", "d-rajma": "confirm" },
      revalidate: async (_r, dishId) => ({
        available: true,
        price_inr: dishId === "d-rajma" ? 120 : 140,
      }),
    });
    const res = await createExecutor(deps).executeSlot(
      profile(),
      "plan-1",
      entry(dish("d-chicken", "Chicken", 140), [
        dish("d-rajma", "Rajma Chawal", 120),
      ]),
    );
    expect(res.outcome).toBe("ordered");
    if (res.outcome === "ordered") expect(res.dishId).toBe("d-rajma");
    expect(orders).toHaveLength(1);
    expect(orders[0]!.dishId).toBe("d-rajma");
  });

  it("on timeout, skips the slot and never orders (respects silence)", async () => {
    const { deps, orders, recorded } = makeDeps({
      decisions: { "d-chicken": "timeout" },
    });
    const res = await createExecutor(deps).executeSlot(
      profile(),
      "plan-1",
      entry(dish("d-chicken", "Chicken", 140), [dish("d-rajma", "Rajma", 120)]),
    );
    expect(res.outcome).toBe("skipped");
    expect(orders).toHaveLength(0);
    expect(recorded.states.some((s) => s.state === "skipped")).toBe(true);
  });

  it("aborts via the guardrail on a price spike past the cap — never places the order", async () => {
    const { deps, orders } = makeDeps({
      revalidate: async () => ({ available: true, price_inr: 220 }),
    }); // quoted 140, cap 150
    const res = await createExecutor(deps).executeSlot(
      profile(),
      "plan-1",
      entry(dish("d-chicken", "Chicken", 140), []),
    );
    expect(res.outcome).toBe("aborted");
    if (res.outcome === "aborted")
      expect(["price_spike", "over_budget"]).toContain(res.code);
    expect(orders).toHaveLength(0);
  });

  it("falls back when the chosen dish is no longer available", async () => {
    const { deps, orders } = makeDeps({
      revalidate: async (_r, dishId) =>
        dishId === "d-chicken"
          ? { available: false, price_inr: 0 }
          : { available: true, price_inr: 120 },
    });
    const res = await createExecutor(deps).executeSlot(
      profile(),
      "plan-1",
      entry(dish("d-chicken", "Chicken", 140), [dish("d-rajma", "Rajma", 120)]),
    );
    expect(res.outcome).toBe("ordered");
    if (res.outcome === "ordered") expect(res.dishId).toBe("d-rajma");
    expect(orders).toHaveLength(1);
  });

  it("never orders on an invalid/unknown nudge decision (only a literal confirm orders)", async () => {
    const { deps, orders } = makeDeps({
      decisions: { "d-chicken": "maybe" as ConfirmDecision },
    });
    const res = await createExecutor(deps).executeSlot(
      profile(),
      "plan-1",
      entry(dish("d-chicken", "Chicken", 140), []),
    );
    expect(res.outcome).not.toBe("ordered");
    expect(orders).toHaveLength(0);
  });

  it("re-validates allergens against LIVE menu data, not stale plan-time metadata", async () => {
    const stalePlanDish = dish("d-biryani", "Biryani", 250); // plan time: no peanut
    const { deps, orders } = makeDeps({
      revalidate: async () => ({
        available: true,
        price_inr: 250,
        dish_name: "Peanut Biryani",
        description: "now made with crushed peanuts",
        is_veg: false,
      }),
    });
    const res = await createExecutor(deps).executeSlot(
      profile({ allergens: ["peanut"] }),
      "plan-1",
      entry(stalePlanDish, []),
    );
    expect(res.outcome).toBe("aborted");
    if (res.outcome === "aborted") expect(res.code).toBe("allergen");
    expect(orders).toHaveLength(0);
  });

  it("claims the slot before ordering; a lost claim skips without ordering (no double-charge)", async () => {
    let n = 0;
    const { deps, orders } = makeDeps({ claim: () => ++n === 1 }); // only the first claim wins
    const ex = createExecutor(deps);
    const e = entry(dish("d-chicken", "Chicken", 140), []);
    const first = await ex.executeSlot(profile(), "plan-1", e);
    const second = await ex.executeSlot(profile(), "plan-1", e);
    expect(first.outcome).toBe("ordered");
    expect(second.outcome).toBe("skipped");
    expect(orders).toHaveLength(1); // exactly one order despite two executions
  });
});
