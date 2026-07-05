import { z } from "zod";

/** Order lifecycle status. Mirrors `order_history.status`. */
export const OrderStatusSchema = z.enum([
  "placed",
  "tracking",
  "delivered",
  "cancelled",
  "failed",
]);
export type OrderStatus = z.infer<typeof OrderStatusSchema>;

/** A placed order + its post-meal rating. Mirrors the `order_history` table. */
export const OrderHistoryEntrySchema = z
  .object({
    id: z.string().uuid().optional(),
    user_id: z.string().uuid(),
    plan_entry_id: z.string().uuid().optional(),
    swiggy_order_id: z.string().optional(), // from place_food_order
    restaurant_id: z.string().min(1),
    dish_id: z.string().min(1),
    dish_name: z.string().min(1),
    amount_inr: z.number().int().nonnegative(),
    status: OrderStatusSchema,
    rating: z.number().int().min(1).max(5).optional(), // post-meal feedback
    placed_at: z.string().datetime().optional(),
    updated_at: z.string().datetime().optional(),
  })
  .strict();
export type OrderHistoryEntry = z.infer<typeof OrderHistoryEntrySchema>;
