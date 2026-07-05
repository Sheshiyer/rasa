import { describe, it, expect } from "vitest";
import { createMockSwiggyMcp } from "./mock-swiggy-mcp";
import { createSwiggyTools, SwiggyError } from "./swiggy-tools";
import type { McpTransport } from "./transport";

const tools = () =>
  createSwiggyTools({ transport: createMockSwiggyMcp(), backoffMs: () => 0 });

describe("swiggy-tools wrappers (validated against the mock)", () => {
  it("getAddresses", async () => {
    const r = await tools().getAddresses();
    expect(r.addresses[0]!.id).toBe("addr-koramangala");
  });

  it("searchRestaurants", async () => {
    const r = await tools().searchRestaurants({ query: "thai" });
    expect(r.restaurants.map((x) => x.id)).toContain("r-thai");
  });

  it("searchMenu", async () => {
    const r = await tools().searchMenu({ query: "paneer" });
    expect(
      r.items.every((i) => /paneer/i.test(i.dish_name + i.description)),
    ).toBe(true);
  });

  it("getRestaurantMenu", async () => {
    const r = await tools().getRestaurantMenu({ restaurant_id: "r-paneer" });
    expect(r.restaurant_id).toBe("r-paneer");
    expect(r.categories[0]!.items.length).toBe(2);
  });

  it("updateFoodCart + getFoodCart + flushFoodCart", async () => {
    const t = tools();
    const cart = await t.updateFoodCart({
      restaurant_id: "r-grill",
      items: [{ dish_id: "d-chicken", quantity: 2 }],
    });
    expect(cart.total_inr).toBe(560);
    expect((await t.getFoodCart()).items.length).toBe(1);
    expect((await t.flushFoodCart()).items.length).toBe(0);
  });

  it("fetchFoodCoupons + applyFoodCoupon", async () => {
    const t = tools();
    await t.updateFoodCart({
      restaurant_id: "r-grill",
      items: [{ dish_id: "d-chicken", quantity: 1 }],
    });
    const coupons = await t.fetchFoodCoupons({ restaurant_id: "r-grill" });
    const applied = await t.applyFoodCoupon({ code: coupons.coupons[0]!.code });
    expect(applied.applied).toBe(true);
  });

  it("placeFoodOrder + getFoodOrders + getFoodOrderDetails + trackFoodOrder", async () => {
    const t = tools();
    await t.updateFoodCart({
      restaurant_id: "r-grill",
      items: [{ dish_id: "d-chicken", quantity: 1 }],
    });
    const placed = await t.placeFoodOrder({
      address_id: "addr-koramangala",
      confirm_token: "tok",
    });
    expect(placed.status).toBe("placed");
    expect(
      (await t.getFoodOrders()).orders.some(
        (o) => o.order_id === placed.order_id,
      ),
    ).toBe(true);
    expect(
      (await t.getFoodOrderDetails({ order_id: placed.order_id })).order_id,
    ).toBe(placed.order_id);
    expect(
      (await t.trackFoodOrder({ order_id: placed.order_id })).eta_min,
    ).toBeGreaterThan(0);
  });

  it("reportError", async () => {
    expect((await tools().reportError({ message: "boom" })).received).toBe(
      true,
    );
  });
});

// A transport that fails the first N calls with a given error, then delegates.
function flakyTransport(
  failures: SwiggyError[],
  inner: McpTransport,
): { t: McpTransport; count: () => number } {
  let n = 0;
  const queue = [...failures];
  return {
    t: {
      async callTool(name, args) {
        n++;
        const f = queue.shift();
        if (f) throw f;
        return inner.callTool(name, args);
      },
    },
    count: () => n,
  };
}

describe("swiggy-tools error handling", () => {
  it("refreshes and retries once on a 401 (auth) error", async () => {
    const { t, count } = flakyTransport(
      [new SwiggyError("auth", "401")],
      createMockSwiggyMcp(),
    );
    let refreshed = 0;
    const st = createSwiggyTools({
      transport: t,
      backoffMs: () => 0,
      onUnauthorized: async () => void refreshed++,
    });
    const r = await st.getAddresses();
    expect(r.addresses.length).toBeGreaterThan(0);
    expect(refreshed).toBe(1);
    expect(count()).toBe(2);
  });

  it("does NOT refresh-retry more than once (a persistent 401 surfaces)", async () => {
    const { t, count } = flakyTransport(
      [new SwiggyError("auth", "401"), new SwiggyError("auth", "401")],
      createMockSwiggyMcp(),
    );
    const st = createSwiggyTools({
      transport: t,
      backoffMs: () => 0,
      onUnauthorized: async () => {},
    });
    await expect(st.getAddresses()).rejects.toMatchObject({ kind: "auth" });
    expect(count()).toBe(2);
  });

  it("retries transient transport errors with backoff (read tools)", async () => {
    const { t, count } = flakyTransport(
      [new SwiggyError("transport", "503")],
      createMockSwiggyMcp(),
    );
    const st = createSwiggyTools({ transport: t, backoffMs: () => 0 });
    await st.getAddresses();
    expect(count()).toBe(2);
  });

  it("NEVER auto-retries placeFoodOrder on a transport error (no double-charge)", async () => {
    const { t, count } = flakyTransport(
      [
        new SwiggyError("transport", "503"),
        new SwiggyError("transport", "503"),
      ],
      createMockSwiggyMcp(),
    );
    const st = createSwiggyTools({ transport: t, backoffMs: () => 0 });
    await expect(
      st.placeFoodOrder({ address_id: "a", confirm_token: "t" }),
    ).rejects.toThrow();
    expect(count()).toBe(1);
  });

  it("surfaces business (4xx) errors as typed SwiggyError without retrying", async () => {
    const { t, count } = flakyTransport(
      [
        new SwiggyError("business", "out of stock"),
        new SwiggyError("business", "out of stock"),
      ],
      createMockSwiggyMcp(),
    );
    const st = createSwiggyTools({ transport: t, backoffMs: () => 0 });
    await expect(st.searchMenu({})).rejects.toMatchObject({ kind: "business" });
    expect(count()).toBe(1);
  });
});
