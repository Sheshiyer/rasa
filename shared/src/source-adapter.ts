import type { CandidateDish } from "./schemas/candidate-dish";
import type { PreferenceProfile } from "./schemas/preference-profile";

/**
 * The cross-platform moat boundary (v1 = Swiggy only). Every food source — Swiggy
 * now, Zomato / Instamart / tiffin in v2 — is reached through this interface, so
 * downstream agents (Discovery, Executor) never depend on a specific platform.
 * v2 adapters drop in with zero downstream rewrites.
 */

export interface DeliveryAddress {
  id: string;
  label?: string;
  lat?: number;
  lng?: number;
}

export interface DiscoverInput {
  profile: PreferenceProfile;
  /** Which of the user's saved addresses to check deliverability against. */
  addressId: string;
  /** The meal slot being planned, e.g. "lunch". */
  slot: string;
  /** Optional cuisine / dish hint to narrow the search. */
  query?: string;
  /** Cap on returned candidates (default is adapter-defined). */
  limit?: number;
}

export interface CouponOffer {
  code: string;
  title?: string;
  discount_inr: number;
  min_order_inr: number;
}

/**
 * Current LIVE state of a dish at execution time. The Executor re-validates before
 * ordering and hands these live fields (not stale plan-time ones) to the guardrail, so
 * a menu that changed to add an allergen, flip veg/non-veg, or stop delivering is caught.
 */
export interface RevalidateResult {
  available: boolean;
  price_inr: number;
  dish_name?: string;
  description?: string;
  is_veg?: boolean;
  deliverable_to_address?: boolean;
}

export interface OrderRequest {
  restaurantId: string;
  dishId: string;
  quantity: number;
  addressId: string;
  couponCode?: string;
  /** Human-in-the-loop token — orders are never placed without one. */
  confirmToken: string;
}

export interface OrderResult {
  order_id: string;
  amount_inr: number;
  status: string;
}

export interface SourceAdapter {
  /** Stable source id, e.g. "swiggy". Matches CandidateDish.source. */
  readonly source: string;
  /** The user's saved delivery addresses for this source. */
  listDeliveryAddresses(): Promise<DeliveryAddress[]>;
  /**
   * Find candidate dishes for a slot: deliverable to the address, pre-filtered by
   * hard preferences (diet type, allergens), normalized to CandidateDish, deduped.
   * Macros are NOT populated here — that is the Nutrition Agent's job.
   */
  discover(input: DiscoverInput): Promise<CandidateDish[]>;
  /** Available coupons at a restaurant (the Budget Agent picks the best applicable one). */
  fetchCoupons(restaurantId: string): Promise<CouponOffer[]>;
  /** Live availability + price for a specific dish; null if it no longer exists. */
  revalidate(
    restaurantId: string,
    dishId: string,
  ): Promise<RevalidateResult | null>;
  /** Build the cart, apply the coupon, and place the order. Requires a confirm token. */
  order(request: OrderRequest): Promise<OrderResult>;
}
