import { z } from "zod";
import { MacrosSchema, MacroConfidenceSchema } from "./nutrition";

/**
 * A normalized dish candidate from any source. Pre-enrichment it has no macros;
 * the Nutrition Agent fills `canonical_dish_id`, `macros`, `macro_confidence`.
 * Mirrors the `candidate_dishes` table + spec §6 CandidateDish.
 */
export const CandidateDishSchema = z
  .object({
    source: z.string().min(1).default("swiggy"), // v2: 'zomato' | 'instamart' | 'tiffin'
    restaurant_id: z.string().min(1),
    restaurant_name: z.string().min(1),
    dish_id: z.string().min(1),
    dish_name: z.string().min(1),
    description: z.string().optional(),
    price_inr: z.number().int().nonnegative(),
    is_veg: z.boolean(),
    canonical_dish_id: z.string().optional(),
    macros: MacrosSchema.optional(),
    macro_confidence: MacroConfidenceSchema.optional(),
    deliverable_to_address: z.boolean().default(false),
  })
  .strict();
export type CandidateDish = z.infer<typeof CandidateDishSchema>;
