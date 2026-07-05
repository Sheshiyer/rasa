/** Coarse dish taxonomy the LLM canonicalizer classifies into. */
export type DishType =
  | "curry"
  | "paratha"
  | "biryani"
  | "rice"
  | "dal"
  | "bowl"
  | "snack"
  | "dessert"
  | "beverage"
  | "thali"
  | "other";

/**
 * Portion-heuristic table: default grams per serving by dish type. Portion size —
 * not dish identity — dominates the macro error budget, so these defaults are the
 * biggest lever. paratha is per-piece (quantity multiplies it).
 */
export const PORTION_G: Record<DishType, number> = {
  curry: 200,
  paratha: 100,
  biryani: 330,
  rice: 180,
  dal: 180,
  bowl: 350,
  snack: 120,
  dessert: 120,
  beverage: 250,
  thali: 450,
  other: 250,
};

export function defaultPortionG(type: DishType): number {
  return PORTION_G[type];
}
