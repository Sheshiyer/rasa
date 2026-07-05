import { describe, it, expect } from "vitest";
import { OrderHistoryEntrySchema } from "./order-history";

const base = {
  user_id: "11111111-1111-1111-1111-111111111111",
  restaurant_id: "r1",
  dish_id: "d1",
  dish_name: "Grilled Chicken Bowl",
  amount_inr: 240,
  status: "placed",
};

describe("OrderHistoryEntrySchema", () => {
  it("accepts a freshly placed order (no rating yet)", () => {
    const parsed = OrderHistoryEntrySchema.parse(base);
    expect(parsed.status).toBe("placed");
    expect(parsed.rating).toBeUndefined();
  });

  it("accepts a delivered+rated order", () => {
    const parsed = OrderHistoryEntrySchema.parse({
      ...base,
      swiggy_order_id: "SW123",
      status: "delivered",
      rating: 5,
    });
    expect(parsed.rating).toBe(5);
  });

  it("rejects a rating outside 1..5", () => {
    expect(() =>
      OrderHistoryEntrySchema.parse({ ...base, rating: 6 }),
    ).toThrow();
  });

  it("rejects an unknown status", () => {
    expect(() =>
      OrderHistoryEntrySchema.parse({ ...base, status: "eaten" }),
    ).toThrow();
  });
});
