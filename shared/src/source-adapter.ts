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
}
