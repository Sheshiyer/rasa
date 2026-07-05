import { describe, it, expect } from "vitest";
import { SpendLedgerEntrySchema } from "./spend-ledger";

const base = {
  user_id: "11111111-1111-1111-1111-111111111111",
  plan_id: "22222222-2222-2222-2222-222222222222",
  day: "2026-07-06",
  slot: "lunch",
  planned_inr: 300,
};

describe("SpendLedgerEntrySchema", () => {
  it("accepts a planned entry with no actual yet", () => {
    const parsed = SpendLedgerEntrySchema.parse(base);
    expect(parsed.actual_inr).toBeUndefined();
    expect(parsed.coupon_discount_inr).toBe(0);
  });

  it("accepts an actualized entry with a coupon", () => {
    const parsed = SpendLedgerEntrySchema.parse({
      ...base,
      actual_inr: 240,
      coupon_code: "SAVE40",
      coupon_discount_inr: 40,
    });
    expect(parsed.actual_inr).toBe(240);
    expect(parsed.coupon_discount_inr).toBe(40);
  });

  it("rejects a negative planned amount", () => {
    expect(() =>
      SpendLedgerEntrySchema.parse({ ...base, planned_inr: -1 }),
    ).toThrow();
  });
});
