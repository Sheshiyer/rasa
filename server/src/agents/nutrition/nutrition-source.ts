/** Per-100g macros — the grounded unit a NutritionSource returns before portion scaling. */
export interface Per100g {
  cal: number;
  protein_g: number;
  carb_g: number;
  fat_g: number;
}

/**
 * A grounded nutrition database keyed by canonical dish id. v1 ships IndbSource
 * (free, India-native); Bon Happetee is reserved as a second impl behind this same
 * interface (production upgrade, not built).
 */
export interface NutritionSource {
  readonly name: string;
  lookupPer100g(canonicalDishId: string): Promise<Per100g | null>;
}
