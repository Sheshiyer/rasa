import { z } from "zod";

/** Calories + macros for a dish or a day. Mirrors the `macros` jsonb in the DDL. */
export const MacrosSchema = z
  .object({
    cal: z.number().int().nonnegative(),
    protein_g: z.number().nonnegative(),
    carb_g: z.number().nonnegative(),
    fat_g: z.number().nonnegative(),
  })
  .strict();
export type Macros = z.infer<typeof MacrosSchema>;

/** DB-hit = high, LLM estimate = low. Mirrors `macro_confidence` checks. */
export const MacroConfidenceSchema = z.enum(["high", "low"]);
export type MacroConfidence = z.infer<typeof MacroConfidenceSchema>;

/** Where a macro estimate came from. Mirrors `nutrition_cache.source`. */
export const NutritionSourceSchema = z.enum([
  "indb",
  "llm-fallback",
  "portion-scaled",
]);
export type NutritionSource = z.infer<typeof NutritionSourceSchema>;

/** A cached, canonical-dish-keyed nutrition estimate. Mirrors the `nutrition_cache` table. */
export const NutritionCacheEntrySchema = z
  .object({
    canonical_dish_id: z.string().min(1),
    macros: MacrosSchema,
    macro_confidence: MacroConfidenceSchema,
    source: NutritionSourceSchema,
    portion_g: z.number().positive().optional(),
  })
  .strict();
export type NutritionCacheEntry = z.infer<typeof NutritionCacheEntrySchema>;
