import { describe, it, expect } from "vitest";
import { CandidateDishSchema } from "./candidate-dish";

const base = {
  restaurant_id: "r1",
  restaurant_name: "Grill House",
  dish_id: "d1",
  dish_name: "Grilled Chicken Bowl",
  price_inr: 280,
  is_veg: false,
};

describe("CandidateDishSchema", () => {
  it("accepts a pre-enrichment dish (no macros yet)", () => {
    const parsed = CandidateDishSchema.parse(base);
    expect(parsed.macros).toBeUndefined();
    expect(parsed.canonical_dish_id).toBeUndefined();
  });

  it("defaults source to 'swiggy' and deliverable_to_address to false", () => {
    const parsed = CandidateDishSchema.parse(base);
    expect(parsed.source).toBe("swiggy");
    expect(parsed.deliverable_to_address).toBe(false);
  });

  it("accepts an enriched dish with macros + confidence", () => {
    const parsed = CandidateDishSchema.parse({
      ...base,
      canonical_dish_id: "grilled-chicken-bowl",
      macros: { cal: 520, protein_g: 42, carb_g: 40, fat_g: 18 },
      macro_confidence: "high",
      deliverable_to_address: true,
    });
    expect(parsed.macros?.protein_g).toBe(42);
    expect(parsed.macro_confidence).toBe("high");
  });

  it("rejects a negative price", () => {
    expect(() =>
      CandidateDishSchema.parse({ ...base, price_inr: -10 }),
    ).toThrow();
  });

  it("rejects a missing required field", () => {
    const { dish_name, ...rest } = base;
    void dish_name;
    expect(() => CandidateDishSchema.parse(rest)).toThrow();
  });
});
