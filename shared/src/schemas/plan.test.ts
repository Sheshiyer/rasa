import { describe, it, expect } from "vitest";
import { PlanSchema, PlanEntrySchema } from "./plan";

const dish = {
  restaurant_id: "r1",
  restaurant_name: "Grill House",
  dish_id: "d1",
  dish_name: "Grilled Chicken Bowl",
  price_inr: 280,
  is_veg: false,
};

const entry = {
  day: "2026-07-06",
  slot: "lunch",
  chosen: dish,
  fallbacks: [dish],
  slot_budget_inr: 300,
  projected_macros: { cal: 520, protein_g: 42, carb_g: 40, fat_g: 18 },
};

describe("PlanEntrySchema", () => {
  it("accepts a valid entry and defaults slot_state to 'pending'", () => {
    const parsed = PlanEntrySchema.parse(entry);
    expect(parsed.slot_state).toBe("pending");
    expect(parsed.fallbacks).toHaveLength(1);
  });

  it("accepts an empty fallbacks array", () => {
    expect(
      PlanEntrySchema.parse({ ...entry, fallbacks: [] }).fallbacks,
    ).toEqual([]);
  });

  it("rejects an invalid slot_state", () => {
    expect(() =>
      PlanEntrySchema.parse({ ...entry, slot_state: "eaten" }),
    ).toThrow();
  });

  it("rejects a malformed day", () => {
    expect(() =>
      PlanEntrySchema.parse({ ...entry, day: "06-07-2026" }),
    ).toThrow();
  });
});

describe("PlanSchema", () => {
  const plan = {
    user_id: "11111111-1111-1111-1111-111111111111",
    status: "draft",
    start_date: "2026-07-06",
    end_date: "2026-08-04",
  };

  it("accepts a valid plan header", () => {
    expect(PlanSchema.parse(plan)).toMatchObject({ status: "draft" });
  });

  it("rejects an invalid status", () => {
    expect(() => PlanSchema.parse({ ...plan, status: "pending" })).toThrow();
  });
});
