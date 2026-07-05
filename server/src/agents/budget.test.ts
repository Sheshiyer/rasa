import { describe, it, expect } from "vitest";
import type { PreferenceProfile } from "@rasa/shared";
import { createMockSwiggyMcp } from "../mcp/mock-swiggy-mcp";
import { createSwiggyTools } from "../mcp/swiggy-tools";
import { createSwiggyAdapter } from "../adapters/swiggy-adapter";
import { createBudgetAgent } from "./budget";

function makeProfile(
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

const agentOnMock = () =>
  createBudgetAgent({
    adapter: createSwiggyAdapter(
      createSwiggyTools({
        transport: createMockSwiggyMcp(),
        backoffMs: () => 0,
      }),
    ),
  });

const U = "11111111-1111-1111-1111-111111111111";
const P = "22222222-2222-2222-2222-222222222222";

describe("Budget Agent", () => {
  it("produces per-slot caps that sum under the monthly budget", () => {
    const env = agentOnMock().envelope(
      makeProfile({ budget_monthly_inr: 9000, meals_per_day: 2 }),
      30,
    );
    expect(env.per_slot_cap_inr).toBeGreaterThan(0);
    expect(env.total_planned_cap_inr).toBeLessThanOrEqual(9000);
    expect(env.per_day_cap_inr).toBe(env.per_slot_cap_inr * 2);
  });

  it("applies the best applicable coupon to reduce the effective price", async () => {
    const plan = await agentOnMock().planCoupon("r-grill", 280);
    expect(plan).not.toBeNull();
    expect(plan!.code).toBe("SAVE40");
    expect(plan!.effective_inr).toBe(240);
  });

  it("returns no coupon when the subtotal is under the minimum order", async () => {
    expect(await agentOnMock().planCoupon("r-grill", 150)).toBeNull();
  });

  it("builds a spend-ledger entry with the coupon applied", () => {
    const entry = agentOnMock().ledgerEntry({
      userId: U,
      planId: P,
      day: "2026-07-06",
      slot: "lunch",
      plannedInr: 280,
      coupon: { code: "SAVE40", discount_inr: 40, effective_inr: 240 },
    });
    expect(entry.planned_inr).toBe(280);
    expect(entry.coupon_code).toBe("SAVE40");
    expect(entry.coupon_discount_inr).toBe(40);
    expect(entry.user_id).toBe(U);
  });
});
