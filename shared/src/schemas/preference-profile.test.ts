import { describe, it, expect } from "vitest";
import { PreferenceProfileSchema } from "./preference-profile";

const valid = {
  user_id: "11111111-1111-1111-1111-111111111111",
  diet_type: "nonveg",
  cuisines_like: ["North Indian", "South Indian"],
  cuisines_avoid: ["Chinese"],
  allergens: ["peanut"],
  dislikes: ["mushroom"],
  spice_level: "medium",
  meals_per_day: 2,
  slots: [
    { name: "lunch", window: "12:30-13:30" },
    { name: "dinner", window: "20:00-21:00" },
  ],
  delivery_address_id: "swiggy-addr-1",
  budget_monthly_inr: 9000,
  calorie_target: 2000,
  macro_target: { protein_g: 120, carb_g: 200, fat_g: 60 },
  variety_tolerance: "medium",
  source_prefs: ["swiggy"],
  cheat_rules: { days: ["Sat"], relax_macros: true },
};

describe("PreferenceProfileSchema", () => {
  it("accepts a full valid profile", () => {
    expect(PreferenceProfileSchema.parse(valid)).toMatchObject({
      diet_type: "nonveg",
    });
  });

  it("preserves allergens exactly (hard constraint must survive round-trip)", () => {
    const parsed = PreferenceProfileSchema.parse(valid);
    expect(parsed.allergens).toEqual(["peanut"]);
  });

  it("defaults source_prefs to ['swiggy'] when omitted", () => {
    const { source_prefs, ...rest } = valid;
    void source_prefs;
    expect(PreferenceProfileSchema.parse(rest).source_prefs).toEqual([
      "swiggy",
    ]);
  });

  it("allows cheat_rules and delivery_address_id to be omitted", () => {
    const { cheat_rules, delivery_address_id, ...rest } = valid;
    void cheat_rules;
    void delivery_address_id;
    expect(() => PreferenceProfileSchema.parse(rest)).not.toThrow();
  });

  it("rejects an invalid diet_type", () => {
    expect(() =>
      PreferenceProfileSchema.parse({ ...valid, diet_type: "vegan" }),
    ).toThrow();
  });

  it("rejects meals_per_day outside 1..6", () => {
    expect(() =>
      PreferenceProfileSchema.parse({ ...valid, meals_per_day: 0 }),
    ).toThrow();
    expect(() =>
      PreferenceProfileSchema.parse({ ...valid, meals_per_day: 7 }),
    ).toThrow();
  });

  it("rejects a non-positive budget", () => {
    expect(() =>
      PreferenceProfileSchema.parse({ ...valid, budget_monthly_inr: 0 }),
    ).toThrow();
  });

  it("rejects a malformed slot window", () => {
    expect(() =>
      PreferenceProfileSchema.parse({
        ...valid,
        slots: [{ name: "lunch", window: "noon" }],
      }),
    ).toThrow();
  });
});
