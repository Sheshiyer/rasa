import { describe, it, expect } from "vitest";
import type { CandidateDish, Macros, PreferenceProfile } from "@rasa/shared";
import { checkGuardrail } from "../guardrail/policy";
import type { BudgetEnvelope } from "./budget";
import { createPlanner } from "./planner";

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
    slots: [
      { name: "lunch", window: "12:30-13:30" },
      { name: "dinner", window: "20:00-21:00" },
    ],
    budget_monthly_inr: 9000,
    calorie_target: 2000,
    macro_target: { protein_g: 120, carb_g: 200, fat_g: 60 },
    variety_tolerance: "medium",
    source_prefs: ["swiggy"],
    ...overrides,
  };
}

function dish(
  id: string,
  name: string,
  price: number,
  macros: Macros,
  extra: Partial<CandidateDish> = {},
): CandidateDish {
  return {
    source: "swiggy",
    restaurant_id: "r",
    restaurant_name: "R",
    dish_id: id,
    dish_name: name,
    price_inr: price,
    is_veg: false,
    deliverable_to_address: true,
    macros,
    macro_confidence: "high",
    ...extra,
  };
}

const envelope: BudgetEnvelope = {
  monthly_budget_inr: 9000,
  window_days: 30,
  per_day_cap_inr: 300,
  per_slot_cap_inr: 150,
  total_planned_cap_inr: 9000,
};

const lunch = [
  dish("d-chicken", "Grilled Chicken Bowl", 140, {
    cal: 520,
    protein_g: 42,
    carb_g: 40,
    fat_g: 18,
  }),
  dish("d-rajma", "Rajma Chawal", 120, {
    cal: 610,
    protein_g: 18,
    carb_g: 95,
    fat_g: 12,
  }),
];
const dinner = [
  dish("d-paneer", "Paneer Butter Masala", 150, {
    cal: 520,
    protein_g: 16,
    carb_g: 20,
    fat_g: 40,
  }),
  dish("d-dal", "Dal Tadka", 110, {
    cal: 300,
    protein_g: 12,
    carb_g: 40,
    fat_g: 8,
  }),
];

const planner = createPlanner({ checkGuardrail });

describe("Planner (CSP)", () => {
  it("emits a 30-day plan within the monthly budget", () => {
    const res = planner.plan({
      profile: profile(),
      candidatesBySlot: { lunch, dinner },
      envelope,
      startDate: "2026-07-06",
      days: 30,
    });
    expect(res.feasible).toBe(true);
    if (!res.feasible) return;
    expect(res.entries).toHaveLength(60); // 30 days × 2 slots
    expect(res.plan.start_date).toBe("2026-07-06");
    expect(res.plan.end_date).toBe("2026-08-04"); // +29 days
    for (const e of res.entries) {
      expect(e.slot_budget_inr).toBe(150);
      expect(e.projected_macros.cal).toBeGreaterThan(0);
    }
    const spend = res.entries.reduce((s, e) => s + e.chosen.price_inr, 0);
    expect(spend).toBeLessThanOrEqual(9000);
  });

  it("NEVER selects an allergen dish, even if it is the best macro fit", () => {
    const padthai = dish(
      "d-padthai",
      "Chicken Pad Thai",
      130,
      { cal: 800, protein_g: 55, carb_g: 80, fat_g: 30 },
      {
        description: "rice noodles with crushed peanuts",
      },
    );
    const res = planner.plan({
      profile: profile({ allergens: ["peanut"] }),
      candidatesBySlot: { lunch: [padthai, lunch[0]!], dinner },
      envelope,
      startDate: "2026-07-06",
      days: 5,
    });
    expect(res.feasible).toBe(true);
    if (!res.feasible) return;
    expect(res.entries.every((e) => e.chosen.dish_id !== "d-padthai")).toBe(
      true,
    );
    expect(
      res.entries.every((e) =>
        e.fallbacks.every((f) => f.dish_id !== "d-padthai"),
      ),
    ).toBe(true);
  });

  it("surfaces an infeasibility tradeoff when a slot has no allergen-safe option", () => {
    const padthai = dish(
      "d-padthai",
      "Chicken Pad Thai",
      130,
      { cal: 800, protein_g: 55, carb_g: 80, fat_g: 30 },
      {
        description: "crushed peanuts",
      },
    );
    const res = planner.plan({
      profile: profile({ allergens: ["peanut"] }),
      candidatesBySlot: { lunch: [padthai], dinner },
      envelope,
      startDate: "2026-07-06",
      days: 5,
    });
    expect(res.feasible).toBe(false);
    if (!res.feasible) expect(res.tradeoff).toMatch(/lunch/i);
  });

  it("surfaces a budget tradeoff when the cap can't cover the cheapest day", () => {
    const res = planner.plan({
      profile: profile({ budget_monthly_inr: 60 }),
      candidatesBySlot: { lunch, dinner },
      envelope: { ...envelope, monthly_budget_inr: 60, per_slot_cap_inr: 1 },
      startDate: "2026-07-06",
      days: 5,
    });
    expect(res.feasible).toBe(false);
    if (!res.feasible) expect(res.tradeoff).toMatch(/budget/i);
  });

  it("varies the choice across consecutive days when alternatives exist", () => {
    const res = planner.plan({
      profile: profile({ meals_per_day: 1 }),
      candidatesBySlot: { lunch },
      envelope,
      startDate: "2026-07-06",
      days: 4,
    });
    expect(res.feasible).toBe(true);
    if (!res.feasible) return;
    const ids = res.entries.map((e) => e.chosen.dish_id);
    for (let i = 1; i < ids.length; i++) expect(ids[i]).not.toBe(ids[i - 1]);
  });

  it("never selects a diet-incompatible dish for a veg profile", () => {
    const veg = dish(
      "d-paneer",
      "Paneer Bowl",
      120,
      { cal: 400, protein_g: 15, carb_g: 20, fat_g: 25 },
      { is_veg: true },
    );
    const nonveg = dish(
      "d-chicken",
      "Chicken Bowl",
      120,
      { cal: 500, protein_g: 40, carb_g: 10, fat_g: 20 },
      { is_veg: false },
    );
    const res = planner.plan({
      profile: profile({ diet_type: "veg" }),
      candidatesBySlot: { lunch: [nonveg, veg] },
      envelope,
      startDate: "2026-07-06",
      days: 3,
    });
    expect(res.feasible).toBe(true);
    if (res.feasible)
      expect(res.entries.every((e) => e.chosen.is_veg)).toBe(true);
  });

  it("never selects a non-deliverable dish", () => {
    const far = dish(
      "d-far",
      "Far Biryani",
      120,
      { cal: 500, protein_g: 20, carb_g: 60, fat_g: 15 },
      {
        deliverable_to_address: false,
      },
    );
    const near = dish(
      "d-near",
      "Nearby Bowl",
      120,
      { cal: 500, protein_g: 30, carb_g: 40, fat_g: 15 },
      {
        deliverable_to_address: true,
      },
    );
    const res = planner.plan({
      profile: profile(),
      candidatesBySlot: { lunch: [far, near] },
      envelope,
      startDate: "2026-07-06",
      days: 3,
    });
    expect(res.feasible).toBe(true);
    if (res.feasible)
      expect(res.entries.every((e) => e.chosen.dish_id !== "d-far")).toBe(true);
  });
});
