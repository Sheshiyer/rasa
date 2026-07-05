import {
  CandidateDishSchema,
  type CandidateDish,
  type DeliveryAddress,
  type DietTypeSchema,
  type DiscoverInput,
  type SourceAdapter,
} from "@rasa/shared";
import { z } from "zod";
import type { SwiggyTools, SwiggyMenuItemT } from "../mcp/swiggy-tools";

type DietType = z.infer<typeof DietTypeSchema>;

/** nonveg eats everything; veg/jain/egg are restricted to vegetarian dishes in v1. */
function passesDiet(diet: DietType, item: SwiggyMenuItemT): boolean {
  return diet === "nonveg" ? true : item.is_veg;
}

/** Hard-block: an allergen appears (as a substring) in the dish name or description. */
function hasAllergen(item: SwiggyMenuItemT, allergensLower: string[]): boolean {
  if (allergensLower.length === 0) return false;
  const hay = `${item.dish_name} ${item.description ?? ""}`.toLowerCase();
  return allergensLower.some((a) => hay.includes(a));
}

/**
 * The v1 SourceAdapter over Swiggy. All Discovery-Agent Swiggy calls go through
 * here, so Zomato/Instamart/tiffin adapters drop in behind the same interface.
 */
export function createSwiggyAdapter(tools: SwiggyTools): SourceAdapter {
  return {
    source: "swiggy",

    async listDeliveryAddresses(): Promise<DeliveryAddress[]> {
      const { addresses } = await tools.getAddresses();
      return addresses.map((a) => ({
        id: a.id,
        label: a.label,
        lat: a.lat,
        lng: a.lng,
      }));
    },

    async discover(input: DiscoverInput): Promise<CandidateDish[]> {
      // 1. Confirm the address is one the user can actually get delivery to.
      const { addresses } = await tools.getAddresses();
      if (!addresses.some((a) => a.id === input.addressId)) {
        throw new Error(
          `address not deliverable / not found: ${input.addressId}`,
        );
      }

      // 2. Open restaurants (deduped so a duplicated search result isn't fetched twice).
      const { restaurants } = await tools.searchRestaurants(
        input.query ? { query: input.query } : {},
      );
      const seenRestaurant = new Set<string>();
      const items: SwiggyMenuItemT[] = [];
      for (const r of restaurants) {
        if (!r.is_open || seenRestaurant.has(r.id)) continue;
        seenRestaurant.add(r.id);
        const menu = await tools.getRestaurantMenu({ restaurant_id: r.id });
        for (const cat of menu.categories) items.push(...cat.items);
      }

      // 3. Filter (diet + allergen), map to CandidateDish, dedupe by (restaurant, dish).
      const allergensLower = input.profile.allergens.map((a) =>
        a.toLowerCase(),
      );
      const seenDish = new Set<string>();
      const out: CandidateDish[] = [];
      for (const it of items) {
        if (!passesDiet(input.profile.diet_type, it)) continue;
        if (hasAllergen(it, allergensLower)) continue;
        const key = `${it.restaurant_id}:${it.dish_id}`;
        if (seenDish.has(key)) continue;
        seenDish.add(key);
        out.push(
          CandidateDishSchema.parse({
            source: "swiggy",
            restaurant_id: it.restaurant_id,
            restaurant_name: it.restaurant_name,
            dish_id: it.dish_id,
            dish_name: it.dish_name,
            description: it.description ? it.description : undefined,
            price_inr: Math.round(it.price),
            is_veg: it.is_veg,
            deliverable_to_address: true,
          }),
        );
        if (input.limit && out.length >= input.limit) break;
      }
      return out;
    },

    async fetchCoupons(restaurantId) {
      const { coupons } = await tools.fetchFoodCoupons({
        restaurant_id: restaurantId,
      });
      return coupons.map((c) => ({
        code: c.code,
        title: c.title,
        discount_inr: c.discount_inr,
        min_order_inr: c.min_order_inr ?? 0,
      }));
    },

    async revalidate(restaurantId, dishId) {
      const menu = await tools.getRestaurantMenu({
        restaurant_id: restaurantId,
      });
      for (const cat of menu.categories) {
        const item = cat.items.find((i) => i.dish_id === dishId);
        if (item) {
          return {
            available: true,
            price_inr: Math.round(item.price),
            dish_name: item.dish_name,
            description: item.description,
            is_veg: item.is_veg,
            deliverable_to_address: true, // still on this restaurant's live menu
          };
        }
      }
      return null; // restaurant closed or dish no longer on the menu
    },

    async order(request) {
      await tools.updateFoodCart({
        restaurant_id: request.restaurantId,
        items: [{ dish_id: request.dishId, quantity: request.quantity }],
      });
      if (request.couponCode)
        await tools.applyFoodCoupon({ code: request.couponCode });
      const placed = await tools.placeFoodOrder({
        address_id: request.addressId,
        confirm_token: request.confirmToken,
      });
      return {
        order_id: placed.order_id,
        amount_inr: placed.amount_inr,
        status: placed.status,
      };
    },
  };
}
