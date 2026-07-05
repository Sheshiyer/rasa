import type { Macros } from "@rasa/shared";
import type { DishType } from "../agents/nutrition/portion-table";

/** The two sub-tasks in v1 that genuinely need an LLM sit behind this interface, so
 *  the pipeline stays deterministic and testable (stub the client). repairProfile
 *  (M4) joins here later. */

export interface CanonicalizeResult {
  /** Stable slug used as the cache + nutrition-source key, e.g. "paneer-butter-masala". */
  canonical_dish_id: string;
  dish_type: DishType;
}

export interface LlmClient {
  /** Normalize a display name to a canonical dish id + coarse type. */
  canonicalizeDish(input: {
    name: string;
    description?: string;
  }): Promise<CanonicalizeResult>;
  /** Fallback macro estimate (per serving at portion_g) when no grounded source hits. */
  estimateMacros(input: {
    name: string;
    description?: string;
    portion_g: number;
  }): Promise<Macros>;
}
