import { describe, it, expect } from "vitest";
import {
  MacrosSchema,
  MacroConfidenceSchema,
  NutritionSourceSchema,
  NutritionCacheEntrySchema,
} from "./nutrition";

describe("MacrosSchema", () => {
  it("accepts a valid macro set", () => {
    const macros = { cal: 520, protein_g: 42, carb_g: 40, fat_g: 18 };
    expect(MacrosSchema.parse(macros)).toEqual(macros);
  });

  it("rejects a negative macro value", () => {
    expect(() =>
      MacrosSchema.parse({ cal: 520, protein_g: -1, carb_g: 40, fat_g: 18 }),
    ).toThrow();
  });

  it("rejects a missing field", () => {
    expect(() =>
      MacrosSchema.parse({ cal: 520, protein_g: 42, carb_g: 40 }),
    ).toThrow();
  });

  it("rejects a non-integer calorie value", () => {
    expect(() =>
      MacrosSchema.parse({ cal: 520.5, protein_g: 42, carb_g: 40, fat_g: 18 }),
    ).toThrow();
  });
});

describe("MacroConfidenceSchema", () => {
  it("accepts high and low", () => {
    expect(MacroConfidenceSchema.parse("high")).toBe("high");
    expect(MacroConfidenceSchema.parse("low")).toBe("low");
  });

  it("rejects any other value", () => {
    expect(() => MacroConfidenceSchema.parse("medium")).toThrow();
  });
});

describe("NutritionSourceSchema", () => {
  it("accepts the three known sources", () => {
    for (const s of ["indb", "llm-fallback", "portion-scaled"]) {
      expect(NutritionSourceSchema.parse(s)).toBe(s);
    }
  });

  it("rejects an unknown source", () => {
    expect(() => NutritionSourceSchema.parse("bon-happetee")).toThrow();
  });
});

describe("NutritionCacheEntrySchema", () => {
  it("round-trips a valid cache entry (matches nutrition_cache DDL)", () => {
    const entry = {
      canonical_dish_id: "paneer-butter-masala",
      macros: { cal: 520, protein_g: 18, carb_g: 42, fat_g: 30 },
      macro_confidence: "high" as const,
      source: "indb" as const,
      portion_g: 200,
    };
    expect(NutritionCacheEntrySchema.parse(entry)).toEqual(entry);
  });

  it("allows portion_g to be omitted (nullable numeric in DDL)", () => {
    const entry = {
      canonical_dish_id: "dal-tadka",
      macros: { cal: 180, protein_g: 9, carb_g: 24, fat_g: 6 },
      macro_confidence: "low" as const,
      source: "llm-fallback" as const,
    };
    const parsed = NutritionCacheEntrySchema.parse(entry);
    expect(parsed.canonical_dish_id).toBe("dal-tadka");
  });
});
