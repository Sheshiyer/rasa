import { z } from "zod";
import type { McpTransport } from "./transport";

/** Classified Swiggy MCP failure. `kind` drives retry policy. */
export type SwiggyErrorKind = "auth" | "transport" | "business" | "unknown";

export class SwiggyError extends Error {
  readonly kind: SwiggyErrorKind;
  override readonly cause?: unknown;
  constructor(kind: SwiggyErrorKind, message: string, cause?: unknown) {
    super(message);
    this.name = "SwiggyError";
    this.kind = kind;
    this.cause = cause;
  }
}

/* ------------------------------------------------------------------ *
 * Result schemas — lenient (unknown keys stripped) for forward-compat
 * with the real Swiggy responses; the mock matches these shapes.
 * ------------------------------------------------------------------ */

const SwiggyAddress = z.object({
  id: z.string(),
  label: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
});
const GetAddressesResult = z.object({ addresses: z.array(SwiggyAddress) });

const SwiggyRestaurant = z.object({
  id: z.string(),
  name: z.string(),
  cuisines: z.array(z.string()).default([]),
  rating: z.number().optional(),
  is_open: z.boolean().default(true),
  eta_min: z.number().optional(),
});
const SearchRestaurantsResult = z.object({
  restaurants: z.array(SwiggyRestaurant),
});

const SwiggyMenuItem = z.object({
  restaurant_id: z.string(),
  restaurant_name: z.string(),
  dish_id: z.string(),
  dish_name: z.string(),
  description: z.string().optional().default(""),
  price: z.number(),
  is_veg: z.boolean(),
});
const SearchMenuResult = z.object({ items: z.array(SwiggyMenuItem) });
const RestaurantMenuResult = z.object({
  restaurant_id: z.string(),
  restaurant_name: z.string().optional(),
  categories: z.array(
    z.object({ name: z.string(), items: z.array(SwiggyMenuItem) }),
  ),
  page: z.number().optional(),
  has_more: z.boolean().optional(),
});

const CartLine = z.object({
  dish_id: z.string(),
  restaurant_id: z.string(),
  dish_name: z.string(),
  price: z.number(),
  quantity: z.number(),
});
const Cart = z.object({
  restaurant_id: z.string().nullable(),
  items: z.array(CartLine),
  subtotal_inr: z.number(),
  coupon_code: z.string().nullable().optional(),
  discount_inr: z.number(),
  total_inr: z.number(),
});

const Coupon = z.object({
  code: z.string(),
  title: z.string().optional(),
  discount_inr: z.number(),
  min_order_inr: z.number().optional(),
});
const FetchCouponsResult = z.object({ coupons: z.array(Coupon) });
const ApplyCouponResult = z.object({
  applied: z.boolean(),
  code: z.string().optional(),
  discount_inr: z.number(),
});

const PlaceOrderResult = z.object({
  order_id: z.string(),
  status: z.string(),
  amount_inr: z.number(),
});
const OrdersResult = z.object({
  orders: z.array(
    z.object({
      order_id: z.string(),
      status: z.string(),
      amount_inr: z.number(),
      placed_at: z.string().optional(),
    }),
  ),
});
const OrderDetailsResult = z.object({
  order_id: z.string(),
  status: z.string(),
  amount_inr: z.number(),
  items: z.array(CartLine).default([]),
});
const TrackOrderResult = z.object({
  order_id: z.string(),
  status: z.string(),
  eta_min: z.number(),
});
const ReportErrorResult = z.object({ received: z.boolean() });

export type SwiggyMenuItemT = z.infer<typeof SwiggyMenuItem>;
export type SwiggyAddressT = z.infer<typeof SwiggyAddress>;

/* ------------------------------------------------------------------ */

export interface SwiggyToolsDeps {
  transport: McpTransport;
  /** Called once on a 401 before a single retry (e.g. invalidate the token so it refreshes). */
  onUnauthorized?: () => Promise<void>;
  /** Max retries for transient transport errors on idempotent tools. Default 2. */
  maxTransportRetries?: number;
  /** Backoff (ms) before transport retry `attempt` (1-based). Injectable for tests. */
  backoffMs?: (attempt: number) => number;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function createSwiggyTools(deps: SwiggyToolsDeps) {
  const maxTransportRetries = deps.maxTransportRetries ?? 2;
  const backoffMs =
    deps.backoffMs ?? ((attempt) => Math.min(2000, 200 * 2 ** (attempt - 1)));

  async function call(
    name: string,
    args: Record<string, unknown>,
    opts: { retryTransport: boolean },
  ): Promise<unknown> {
    let transportAttempts = 0;
    let refreshedOnce = false;
    for (;;) {
      try {
        return await deps.transport.callTool(name, args);
      } catch (raw) {
        const err =
          raw instanceof SwiggyError
            ? raw
            : new SwiggyError(
                "unknown",
                raw instanceof Error ? raw.message : String(raw),
                raw,
              );

        // 401 → refresh once, retry once. Safe even for place_food_order (a 401 means the call never landed).
        if (err.kind === "auth" && !refreshedOnce && deps.onUnauthorized) {
          refreshedOnce = true;
          await deps.onUnauthorized();
          continue;
        }
        // Transient transport error → backoff-retry, but only for idempotent tools.
        if (
          err.kind === "transport" &&
          opts.retryTransport &&
          transportAttempts < maxTransportRetries
        ) {
          transportAttempts++;
          await sleep(backoffMs(transportAttempts));
          continue;
        }
        throw err;
      }
    }
  }

  const RETRY = { retryTransport: true };
  const NO_RETRY = { retryTransport: false };

  return {
    // --- discover ---
    async getAddresses() {
      return GetAddressesResult.parse(await call("get_addresses", {}, RETRY));
    },
    async searchRestaurants(args: { query?: string } = {}) {
      return SearchRestaurantsResult.parse(
        await call("search_restaurants", { ...args }, RETRY),
      );
    },
    async searchMenu(args: { query?: string } = {}) {
      return SearchMenuResult.parse(
        await call("search_menu", { ...args }, RETRY),
      );
    },
    async getRestaurantMenu(args: { restaurant_id: string; page?: number }) {
      return RestaurantMenuResult.parse(
        await call("get_restaurant_menu", { ...args }, RETRY),
      );
    },
    // --- cart ---
    async getFoodCart() {
      return Cart.parse(await call("get_food_cart", {}, RETRY));
    },
    async updateFoodCart(args: {
      restaurant_id: string;
      items: { dish_id: string; quantity: number }[];
    }) {
      return Cart.parse(await call("update_food_cart", { ...args }, RETRY));
    },
    async flushFoodCart() {
      return Cart.parse(await call("flush_food_cart", {}, RETRY));
    },
    async fetchFoodCoupons(args: { restaurant_id?: string } = {}) {
      return FetchCouponsResult.parse(
        await call("fetch_food_coupons", { ...args }, RETRY),
      );
    },
    async applyFoodCoupon(args: { code: string }) {
      return ApplyCouponResult.parse(
        await call("apply_food_coupon", { ...args }, RETRY),
      );
    },
    // --- order (place is NEVER auto-retried on transport errors: no double-charge) ---
    async placeFoodOrder(args: {
      address_id: string;
      confirm_token: string;
      payment_method?: string;
    }) {
      return PlaceOrderResult.parse(
        await call("place_food_order", { ...args }, NO_RETRY),
      );
    },
    async getFoodOrders() {
      return OrdersResult.parse(await call("get_food_orders", {}, RETRY));
    },
    async getFoodOrderDetails(args: { order_id: string }) {
      return OrderDetailsResult.parse(
        await call("get_food_order_details", { ...args }, RETRY),
      );
    },
    async trackFoodOrder(args: { order_id: string }) {
      return TrackOrderResult.parse(
        await call("track_food_order", { ...args }, RETRY),
      );
    },
    async reportError(args: {
      message: string;
      context?: Record<string, unknown>;
    }) {
      return ReportErrorResult.parse(
        await call("report_error", { ...args }, RETRY),
      );
    },
  };
}

export type SwiggyTools = ReturnType<typeof createSwiggyTools>;
