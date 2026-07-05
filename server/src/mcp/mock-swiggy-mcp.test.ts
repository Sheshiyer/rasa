import { describe, it, expect } from "vitest";
import { createMockSwiggyMcp } from "./mock-swiggy-mcp";

describe("mock-swiggy-mcp", () => {
  it("returns saved delivery addresses", async () => {
    const mcp = createMockSwiggyMcp();
    const res = (await mcp.callTool("get_addresses", {})) as {
      addresses: unknown[];
    };
    expect(res.addresses.length).toBeGreaterThan(0);
  });

  it("search_menu returns items and filters by query", async () => {
    const mcp = createMockSwiggyMcp();
    const all = (await mcp.callTool("search_menu", {})) as { items: unknown[] };
    const chicken = (await mcp.callTool("search_menu", {
      query: "chicken",
    })) as {
      items: { dish_name: string }[];
    };
    expect(all.items.length).toBeGreaterThan(chicken.items.length);
    expect(chicken.items.every((i) => /chicken/i.test(i.dish_name))).toBe(true);
  });

  it("get_restaurant_menu returns categorized items for a restaurant", async () => {
    const mcp = createMockSwiggyMcp();
    const res = (await mcp.callTool("get_restaurant_menu", {
      restaurant_id: "r-grill",
    })) as {
      restaurant_id: string;
      categories: { items: unknown[] }[];
    };
    expect(res.restaurant_id).toBe("r-grill");
    expect(res.categories[0]!.items.length).toBeGreaterThan(0);
  });

  it("supports a cart lifecycle: update → get → flush", async () => {
    const mcp = createMockSwiggyMcp();
    await mcp.callTool("update_food_cart", {
      restaurant_id: "r-grill",
      items: [{ dish_id: "d-chicken", quantity: 1 }],
    });
    const cart = (await mcp.callTool("get_food_cart", {})) as {
      total_inr: number;
      items: unknown[];
    };
    expect(cart.items.length).toBe(1);
    expect(cart.total_inr).toBeGreaterThan(0);
    const flushed = (await mcp.callTool("flush_food_cart", {})) as {
      items: unknown[];
    };
    expect(flushed.items.length).toBe(0);
  });

  it("place_food_order returns an order id, then it appears in get_food_orders", async () => {
    const mcp = createMockSwiggyMcp();
    await mcp.callTool("update_food_cart", {
      restaurant_id: "r-grill",
      items: [{ dish_id: "d-chicken", quantity: 1 }],
    });
    const placed = (await mcp.callTool("place_food_order", {
      address_id: "addr-koramangala",
      confirm_token: "t1",
    })) as { order_id: string; status: string };
    expect(placed.order_id).toBeTruthy();
    expect(placed.status).toBe("placed");
    const orders = (await mcp.callTool("get_food_orders", {})) as {
      orders: { order_id: string }[];
    };
    expect(orders.orders.some((o) => o.order_id === placed.order_id)).toBe(
      true,
    );
  });

  it("applies a coupon and reports the discount", async () => {
    const mcp = createMockSwiggyMcp();
    // A coupon requires the cart to meet its min-order threshold.
    await mcp.callTool("update_food_cart", {
      restaurant_id: "r-grill",
      items: [{ dish_id: "d-chicken", quantity: 1 }],
    });
    const coupons = (await mcp.callTool("fetch_food_coupons", {
      restaurant_id: "r-grill",
    })) as {
      coupons: { code: string }[];
    };
    const code = coupons.coupons[0]!.code;
    const applied = (await mcp.callTool("apply_food_coupon", { code })) as {
      applied: boolean;
      discount_inr: number;
    };
    expect(applied.applied).toBe(true);
    expect(applied.discount_inr).toBeGreaterThan(0);
  });

  it("throws on an unknown tool", async () => {
    const mcp = createMockSwiggyMcp();
    await expect(mcp.callTool("no_such_tool", {})).rejects.toThrow();
  });
});
