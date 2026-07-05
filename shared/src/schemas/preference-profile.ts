import { z } from "zod";

/** A meal slot with an "HH:MM-HH:MM" delivery window. Mirrors the `slots` jsonb. */
export const SlotSchema = z
  .object({
    name: z.string().min(1),
    window: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d-([01]\d|2[0-3]):[0-5]\d$/, {
        message: "window must be HH:MM-HH:MM (24h)",
      }),
  })
  .strict();
export type Slot = z.infer<typeof SlotSchema>;

/** Daily macro targets (no calories here — `calorie_target` is a sibling field). */
export const MacroTargetSchema = z
  .object({
    protein_g: z.number().nonnegative(),
    carb_g: z.number().nonnegative(),
    fat_g: z.number().nonnegative(),
  })
  .strict();
export type MacroTarget = z.infer<typeof MacroTargetSchema>;

export const DietTypeSchema = z.enum(["veg", "jain", "egg", "nonveg"]);
export const SpiceLevelSchema = z.enum(["mild", "medium", "hot"]);
export const VarietyToleranceSchema = z.enum(["low", "medium", "high"]);

export const CheatRulesSchema = z
  .object({
    days: z.array(z.string()).default([]),
    relax_macros: z.boolean(),
  })
  .strict();

/** The portable preference profile — the app's lock-in asset. Mirrors `preference_profiles`. */
export const PreferenceProfileSchema = z
  .object({
    user_id: z.string().uuid(),
    diet_type: DietTypeSchema,
    cuisines_like: z.array(z.string()).default([]),
    cuisines_avoid: z.array(z.string()).default([]),
    allergens: z.array(z.string()).default([]), // HARD constraint
    dislikes: z.array(z.string()).default([]),
    spice_level: SpiceLevelSchema,
    meals_per_day: z.number().int().min(1).max(6),
    slots: z.array(SlotSchema).min(1),
    delivery_address_id: z.string().optional(),
    budget_monthly_inr: z.number().int().positive(),
    calorie_target: z.number().int().positive(),
    macro_target: MacroTargetSchema,
    variety_tolerance: VarietyToleranceSchema,
    source_prefs: z.array(z.string()).default(["swiggy"]),
    cheat_rules: CheatRulesSchema.optional(),
    created_at: z.string().datetime().optional(),
    updated_at: z.string().datetime().optional(),
  })
  .strict();
export type PreferenceProfile = z.infer<typeof PreferenceProfileSchema>;

/**
 * The subset the copy-paste onboarding prompt emits — every PreferenceProfile field
 * except `user_id`, `delivery_address_id`, `source_prefs` (filled app-side). NOT strict
 * (extra LLM keys are stripped). `allergens` is REQUIRED here (no default) so "no
 * allergens" is an explicit user statement, never a silently-inferred hard constraint.
 */
export const OnboardingProfileSchema = z.object({
  diet_type: DietTypeSchema,
  cuisines_like: z.array(z.string()).default([]),
  cuisines_avoid: z.array(z.string()).default([]),
  allergens: z.array(z.string()), // REQUIRED — never fabricated
  dislikes: z.array(z.string()).default([]),
  spice_level: SpiceLevelSchema,
  meals_per_day: z.number().int().min(1).max(6),
  slots: z.array(SlotSchema).min(1),
  budget_monthly_inr: z.number().int().positive(),
  calorie_target: z.number().int().positive(),
  macro_target: MacroTargetSchema,
  variety_tolerance: VarietyToleranceSchema,
  cheat_rules: CheatRulesSchema.nullable().optional(),
});
export type OnboardingProfile = z.infer<typeof OnboardingProfileSchema>;
