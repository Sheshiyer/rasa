import { describe, it, expect } from "vitest";
import type { CandidateDish, PreferenceProfile } from "@rasa/shared";
import { checkGuardrail, checkNutritionCopy, type OrderAction } from "./policy";

function profile(
  overrides: Partial<PreferenceProfile> = {},
): PreferenceProfile {
  return {
    user_id: "11111111-1111-1111-1111-111111111111",
    diet_type: "nonveg",
    cuisines_like: [],
    cuisines_avoid: [],
    allergens: ["peanut"],
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

function dish(overrides: Partial<CandidateDish> = {}): CandidateDish {
  return {
    source: "swiggy",
    restaurant_id: "r-grill",
    restaurant_name: "Grill House",
    dish_id: "d-chicken",
    dish_name: "Grilled Chicken Bowl",
    price_inr: 280,
    is_veg: false,
    deliverable_to_address: true,
    ...overrides,
  };
}

const action = (overrides: Partial<OrderAction> = {}): OrderAction => ({
  dish: dish(),
  effective_price_inr: 240,
  slot_cap_inr: 300,
  confirm_token: "tok",
  ...overrides,
});

describe("checkGuardrail", () => {
  it("allows a safe, in-budget, confirmed order", () => {
    expect(checkGuardrail(profile(), action())).toEqual({ allow: true });
  });

  it("hard-blocks a dish naming an allergen (name or description)", () => {
    const d = dish({
      dish_id: "d-padthai",
      dish_name: "Chicken Pad Thai",
      description: "with crushed peanuts",
    });
    const res = checkGuardrail(
      profile({ allergens: ["peanut"] }),
      action({ dish: d }),
    );
    expect(res.allow).toBe(false);
    if (!res.allow) expect(res.code).toBe("allergen");
  });

  it("blocks when the effective price exceeds the slot cap", () => {
    const res = checkGuardrail(
      profile(),
      action({ effective_price_inr: 400, slot_cap_inr: 300 }),
    );
    expect(res.allow).toBe(false);
    if (!res.allow) expect(res.code).toBe("over_budget");
  });

  it("aborts on a price spike beyond the tolerance vs the quoted price", () => {
    const res = checkGuardrail(
      profile(),
      action({
        effective_price_inr: 280,
        quoted_price_inr: 200,
        priceSpikeThresholdPct: 0.15,
        slot_cap_inr: 1000,
      }),
    );
    expect(res.allow).toBe(false);
    if (!res.allow) expect(res.code).toBe("price_spike");
  });

  it("blocks an order with no confirm token when confirmation is required", () => {
    const res = checkGuardrail(
      profile(),
      action({ confirm_token: undefined, requireConfirm: true }),
    );
    expect(res.allow).toBe(false);
    if (!res.allow) expect(res.code).toBe("missing_confirm");
  });

  it("allergen safety takes priority over other blocks", () => {
    const d = dish({ dish_name: "Peanut Chikki", description: "sweet" });
    const res = checkGuardrail(
      profile({ allergens: ["peanut"] }),
      action({
        dish: d,
        effective_price_inr: 999,
        slot_cap_inr: 100,
        confirm_token: undefined,
        requireConfirm: true,
      }),
    );
    expect(res.allow).toBe(false);
    if (!res.allow) expect(res.code).toBe("allergen");
  });
});

describe("checkGuardrail — hardening (from adversarial review)", () => {
  it("matches an allergen despite surrounding whitespace", () => {
    const res = checkGuardrail(
      profile({ allergens: [" peanut "] }),
      action({ dish: dish({ dish_name: "Peanut Chicken" }) }),
    );
    expect(res.allow).toBe(false);
    if (!res.allow) expect(res.code).toBe("allergen");
  });

  it("matches an allergen in its plural form", () => {
    const d = dish({
      dish_name: "Thai Salad",
      description: "topped with crushed peanuts",
    });
    expect(
      checkGuardrail(profile({ allergens: ["peanut"] }), action({ dish: d }))
        .allow,
    ).toBe(false);
  });

  it("does NOT false-positive on word fragments (egg vs eggplant, nut vs coconut)", () => {
    const eggplant = dish({ dish_name: "Eggplant Curry", is_veg: true });
    expect(
      checkGuardrail(
        profile({ allergens: ["egg"], diet_type: "veg" }),
        action({ dish: eggplant }),
      ).allow,
    ).toBe(true);
    const coconut = dish({ dish_name: "Coconut Chutney", is_veg: true });
    expect(
      checkGuardrail(
        profile({ allergens: ["nut"], diet_type: "veg" }),
        action({ dish: coconut }),
      ).allow,
    ).toBe(true);
  });

  it("hard-blocks a non-veg dish for a veg profile", () => {
    const res = checkGuardrail(
      profile({ diet_type: "veg" }),
      action({ dish: dish({ is_veg: false }) }),
    );
    expect(res.allow).toBe(false);
    if (!res.allow) expect(res.code).toBe("diet");
  });

  it("allows a veg dish for a veg profile, and any dish for nonveg", () => {
    expect(
      checkGuardrail(
        profile({ diet_type: "veg" }),
        action({ dish: dish({ is_veg: true }) }),
      ).allow,
    ).toBe(true);
    expect(
      checkGuardrail(
        profile({ diet_type: "nonveg" }),
        action({ dish: dish({ is_veg: false }) }),
      ).allow,
    ).toBe(true);
  });

  it("hard-blocks a non-deliverable dish", () => {
    const res = checkGuardrail(
      profile(),
      action({ dish: dish({ deliverable_to_address: false }) }),
    );
    expect(res.allow).toBe(false);
    if (!res.allow) expect(res.code).toBe("not_deliverable");
  });

  it("does not treat a zero quoted price as a spike", () => {
    const res = checkGuardrail(
      profile(),
      action({
        quoted_price_inr: 0,
        effective_price_inr: 100,
        slot_cap_inr: 300,
      }),
    );
    expect(res.allow).toBe(true);
  });

  it("blocks a negative effective price", () => {
    const res = checkGuardrail(
      profile(),
      action({ effective_price_inr: -50, slot_cap_inr: 200 }),
    );
    expect(res.allow).toBe(false);
    if (!res.allow) expect(res.code).toBe("invalid_price");
  });
});

describe("checkNutritionCopy (FSSAI)", () => {
  it("blocks medical / disease claims", () => {
    expect(checkNutritionCopy("This meal cures diabetes.").allow).toBe(false);
    expect(checkNutritionCopy("Clinically proven to help you.").allow).toBe(
      false,
    );
    expect(checkNutritionCopy("A doctor-approved plan.").allow).toBe(false);
  });

  it("blocks immunity / reversal / detox / prevention claims", () => {
    expect(checkNutritionCopy("This meal boosts immunity.").allow).toBe(false);
    expect(checkNutritionCopy("Reverses diabetes naturally.").allow).toBe(
      false,
    );
    expect(checkNutritionCopy("A detoxifying cleanse.").allow).toBe(false);
    expect(checkNutritionCopy("Prevents diabetes.").allow).toBe(false);
    expect(checkNutritionCopy("Heals inflammation.").allow).toBe(false);
  });

  it("allows a healthy/balanced description without a medical claim", () => {
    expect(checkNutritionCopy("A healthy, balanced meal.").allow).toBe(true);
  });

  it("allows honest, estimated wellness copy", () => {
    expect(
      checkNutritionCopy("About 520 kcal, estimated — a tasty treat.").allow,
    ).toBe(true);
    expect(checkNutritionCopy("~28g protein (estimate).").allow).toBe(true);
  });
});
